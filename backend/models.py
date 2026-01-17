from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from uuid import UUID
from datetime import datetime

# --- Requests ---

class CreateSessionRequest(BaseModel):
    user_id: UUID  # In production, this would come from auth context
    root_urls: List[str]
    objective_prompt: Optional[str] = "Find professors offering undergraduate research opportunities."
    major: Optional[str] = None
    custom_prompt: Optional[str] = None

# --- Responses / DB Models ---

class ProfessorCardResponse(BaseModel):
    id: Optional[UUID] = None
    session_id: Optional[UUID] = None
    professor_name: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    school: Optional[str] = None
    primary_url: Optional[str] = None
    links: List[Dict[str, str]] = [] # New field for labeled links
    personal_urls: List[str] = [] # Legacy field, keep for now
    summary: Optional[str] = None
    research_themes: List[str] = []
    keywords: List[str] = []
    evidence_snippets: Optional[Dict[str, Any]] = {}
    recent_papers: Optional[List[Dict[str, Any]]] = []
    undergrad_friendly_score: Optional[float] = 0.0
    match_score: Optional[float] = 0.0
    match_reasoning: Optional[str] = None
    created_at: Optional[datetime] = None

class ScrapeSessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    root_urls: List[str]
    status: str
    blocked_reason: Optional[str] = None
    blocked_url: Optional[str] = None
    created_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

class SessionResponse(BaseModel):
    session: ScrapeSessionResponse
    cards: List[ProfessorCardResponse] = []
