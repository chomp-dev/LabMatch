from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import uuid
from typing import List
import logging
import asyncio
import json

from models import CreateSessionRequest, SessionResponse, ScrapeSessionResponse, ProfessorCardResponse
from services.crawler import CrawlerService
from services.supabase_client import get_supabase_client

load_dotenv()

app = FastAPI(title="LabMatch Backend")

origins = [
    "*",  # Allow all for development
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global dictionary to store event queues for each session
session_queues = {}

crawler_service = CrawlerService()
supabase = get_supabase_client()

@app.get("/")
def read_root():
    try:
        # Simple health check for Supabase
        supabase.table("scrape_sessions").select("id").limit(1).execute()
        return {"message": "Welcome to LabMatch API", "status": "healthy"}
    except Exception as e:
        logging.error(f"Health check failed: {e}")
        # Return 503 so frontend knows service is degraded
        raise HTTPException(status_code=503, detail="Supabase is down")

@app.post("/parse-resume")
async def parse_resume(file: UploadFile = File(...)):
    """
    Parses a PDF resume and returns keywords/summary.
    """
    try:
        from pypdf import PdfReader
        from io import BytesIO
        
        contents = await file.read()
        pdf_file = BytesIO(contents)
        reader = PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
            
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
            
        # Analyze with LLM
        result = await crawler_service.llm_service.parse_resume(text)
        return result
        
    except ImportError:
        raise HTTPException(status_code=500, detail="pypdf not installed")
    except Exception as e:
        logging.error(f"Resume parsing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/sessions", response_model=SessionResponse)
async def create_session(request: CreateSessionRequest, background_tasks: BackgroundTasks):
    # 1. Create Session in Supabase
    data = {
        "user_id": str(request.user_id),
        "root_urls": request.root_urls,
        "objective_prompt": request.objective_prompt,
        "major": request.major,
        "custom_prompt": request.custom_prompt,
        "status": "queued"
    }
    
    try:
        response = supabase.table("scrape_sessions").insert(data).execute()
        new_session = response.data[0]
        session_id = uuid.UUID(new_session['id'])
        
        # Initialize event queue for this session
        session_queues[session_id] = asyncio.Queue()
        
        # 2. Trigger crawler in background
        background_tasks.add_task(run_crawler_task, session_id, request.root_urls, request.major, request.custom_prompt)
        
        # 3. Return initial state using Pydantic models
        session_model = ScrapeSessionResponse(**new_session)
        return SessionResponse(session=session_model, cards=[])
        
    except Exception as e:
        logging.error(f"Error creating session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions/{session_id}/stream")
async def stream_session_logs(session_id: uuid.UUID):
    if session_id not in session_queues:
        # Check against DB to see if it's a valid session that just finished or server restarted
        try:
            res = supabase.table("scrape_sessions").select("status").eq("id", str(session_id)).execute()
            if res.data:
                # Session exists, but no queue. It's likely finished or server restarted.
                async def dead_stream():
                     yield f"data: {json.dumps({'type': 'end', 'message': 'Session finished or connection lost'})}\n\n"
                return StreamingResponse(dead_stream(), media_type="text/event-stream")
        except Exception as e:
            logging.error(f"Error checking DB for stream {session_id}: {e}")

        raise HTTPException(status_code=404, detail="Session stream not found or session expired")

    async def event_generator():
        queue = session_queues[session_id]
        try:
            while True:
                # Wait for next log
                message = await queue.get()
                
                # Check for special 'DONE' message to close stream
                if message == "STREAM_DONE":
                    yield f"data: {json.dumps({'type': 'end', 'message': 'Crawling finished'})}\n\n"
                    break
                
                # Check if it's already a JSON event string
                if isinstance(message, str) and message.strip().startswith('{'):
                     yield f"data: {message}\n\n"
                else:
                     # Wraps plain text logs
                     yield f"data: {json.dumps({'type': 'log', 'message': message})}\n\n"
        except asyncio.CancelledError:
            # Client disconnected
            pass

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/ingest")
async def ingest_artifact(artifact: dict):
    """
    Receives scraped data from the Chrome Extension.
    artifact: { session_id, url, title, content (text), html (optional) }
    """
    try:
        session_id = artifact.get("session_id")
        if not session_id:
            raise HTTPException(status_code=400, detail="Missing session_id")

        data = {
            "session_id": session_id,
            "source": "chrome_extension",
            "url": artifact.get("url"),
            "title": artifact.get("title"),
            "extracted_text": artifact.get("content"),
            "raw_metadata": {"html_snippet": artifact.get("html")[:2000] if artifact.get("html") else ""}
        }
        
        logging.info(f"Ingesting artifact from {data['url']}")
        supabase.table("scrape_artifacts").insert(data).execute()
        
        return {"status": "success", "message": "Artifact ingested"}
        
    except Exception as e:
        logging.error(f"Error ingesting artifact: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions/{session_id}", response_model=SessionResponse)
def get_session(session_id: str):
    try:
        # Fetch session
        session_res = supabase.table("scrape_sessions").select("*").eq("id", session_id).execute()
        if not session_res.data:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_data = session_res.data[0]
        
        # Fetch cards
        cards_res = supabase.table("professor_cards").select("*").eq("session_id", session_id).execute()
        cards_data = cards_res.data if cards_res.data else []
        
        return SessionResponse(
            session=ScrapeSessionResponse(**session_data),
            cards=[ProfessorCardResponse(**c) for c in cards_data]
        )
    except Exception as e:
        # If it's the 404 we raised, re-raise it
        if isinstance(e, HTTPException):
            raise e
        logging.error(f"Error fetching session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def run_crawler_task(session_id: uuid.UUID, root_urls: List[str], major: str = None, custom_prompt: str = None):
    logging.info(f"Starting crawl for {session_id} on {root_urls}")
    
    # helper for emitting logs
    async def log_callback(message: str):
        if session_id in session_queues:
            await session_queues[session_id].put(message)

    try:
        await log_callback(f"Starting crawl session for: {', '.join(root_urls)}")
        await crawler_service.run_session(session_id, root_urls, log_callback, major, custom_prompt)
        await log_callback("Crawl task finished successfully.")
    except Exception as e:
        await log_callback(f"Crawl task failed: {str(e)}")
    finally:
        # Signal stream end
        if session_id in session_queues:
            await session_queues[session_id].put("STREAM_DONE")
            # Wait a bit for stream to flush before cleaning up
            await asyncio.sleep(60)
            del session_queues[session_id]
        logging.info(f"Crawl task finished for {session_id}")
