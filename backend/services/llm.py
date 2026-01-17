import os
from openai import AsyncOpenAI
from typing import Optional, Dict, Any, List
import json
import logging
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# ==============================================================================
# PROMPTS
# ==============================================================================

PROMPT_RESUME = """
Analyze the following Resume/CV text to assist a student in finding a relevant research lab.

Resume Content:
{resume_text}

TASK:
1. Extract the top 4-5 technical "Experience/Interest" Keywords (e.g. "Computer Vision", "React", "CRISPR").
2. Write a 1-sentence "Custom Prompt" summary describing what kind of research they are looking for based on their experience.
   (e.g. "I am looking for a lab focused on AI and NLP, specifically dealing with large language models.")

Return JSON:
{{
    "keywords": ["Keyword1", "Keyword2", ...],
    "summary": "Full sentence summary..."
}}
"""

PROMPT_DISCOVERY = """
You are extracting RESEARCH FACULTY information from a university webpage.

URL: {url}
Page Content:
{text_content}

FILTER_TOPIC: {major}

YOUR TASK:
1. ANALYZE: Does this page contain RESEARCH FACULTY (Professors who conduct research)?
   - GOOD pages: "Faculty Directory", "Our Faculty", "Research Faculty", "People > Faculty"
   - BAD pages: "Leadership", "Administration", "Office of...", "About the Dean"
   - IF this is a LEADERSHIP/ADMIN page: Return empty professors array immediately.

2. EXTRACT only ACTIVE RESEARCH FACULTY. For each person found:
   - name: Real full name
   - profile_url: Direct link to their individual profile page
   - title: Academic title (Professor, Assistant Professor, Associate Professor, Lecturer)
   - email: If visible
   - snippet: Brief research description if visible

CRITICAL EXCLUSIONS (Do NOT extract these people):
- **ADMINISTRATORS**: Vice Chancellor, Provost, Dean, Associate Dean, Vice Dean, 
  Chancellor, President, Vice President, Director (of office/program), Executive Director
- **NON-RESEARCH STAFF**: Coordinator, Advisor, Counselor, HR, Administrative Assistant, 
  Manager, Specialist, Analyst
- **INACTIVE**: Alumni, Emeritus, Deceased, "In Memoriam", Historical figures
- **STUDENTS**: Graduate students, PhD candidates, Postdocs, Interns, Fellows
- **ORGANIZATIONS**: Names containing "Lab", "Center", "Institute", "Office", "Program"

VALID TITLES TO INCLUDE:
- Professor, Assistant Professor, Associate Professor
- Research Professor, Clinical Professor, Teaching Professor
- Lecturer, Senior Lecturer, Instructor
- Research Scientist (only if they lead research)

OUTPUT FORMAT:
{{
    "page_type": "Faculty Directory" or "Leadership Page" or "Other",
    "professors": [
        {{
            "name": "<REAL_HUMAN_NAME>",
            "profile_url": "<DIRECT_PROFILE_URL>",
            "title": "<ACADEMIC_TITLE>",
            "email": "<EMAIL_IF_FOUND>",
            "snippet": "<RESEARCH_AREA>"
        }}
    ]
}}

If this is a LEADERSHIP page or NO research faculty found:
{{"page_type": "Leadership Page", "professors": []}}
"""

PROMPT_PROFILE = """
Extract detailed information about this professor from their profile page.

Professor Name: {professor_name}
Profile URL: {url}

Page Content:
{text_content}

NOTE: The content may contain a section marked "=== EXTERNAL LAB WEBSITE CONTENT ===".
This section contains data from the professor's personal lab website or research group page.
PRIORITIZE this section for:
- Research Summary (it is usually more up-to-date)
- Keywords (extract specific technical terms from this section)
- Recent News/Publications

TASK:
1. VERIFY STATUS: Is this person ACTIVE faculty?
   - If Deceased, In Memoriam, Emeritus (inactive), or Alumni: RETURN JSON WITH ERROR.
   - If they are a Grad Student, Staff, or Admin: RETURN JSON WITH ERROR.

2. EXTRACT (If Active):
   - title: Academic title
   - department: Department name
   - school: University name
   - email: Email address
   - summary: 3-5 sentence bio
   - keywords: 5-7 research keywords
   - links: Array of {{"label": "...", "url": "..."}}
   
3. SCORING (Relevance to User):
   - USER SEARCH GOAL: "{user_search_prompt}"
   - CALCULATION: How relevant is this professor's research to the user's goal?
   - match_score: Integer 0-100 (100 = Perfect Match, 0 = Irrelevant)
   - match_reasoning: 1 sentence explaining the score.
    
Return JSON (Valid Profile):
{{
    "professor_name": "{professor_name}",
    "title": "...",
    "department": "...",
    "school": "...",
    "email": "...",
    "summary": "...",
    "keywords": [...],
    "links": [...],
    "match_score": 85,
    "match_reasoning": "Research in X strictly aligns with user's interest in Y."
}}

Return JSON (Invalid/Inactive):
{{
    "error": "Person is deceased/alumni/inactive"
}}
"""

# ==============================================================================
# SERVICE
# ==============================================================================

class LLMService:
    def __init__(self):
        # LLM Provider Configuration
        use_local = os.environ.get("USE_LOCAL_LLM", "false").lower() == "true"
        
        if use_local:
            self.base_url = "http://localhost:11434/v1"
            self.api_key = "ollama"
            self.available_models = ["phi3"]
            logger.info("Using LOCAL Ollama LLM")
        else:
            self.base_url = os.environ.get("LLM_BASE_URL", "https://api.groq.com/openai/v1")
            self.api_key = os.environ.get("LLM_API_KEY", "")
            # Only models that actually work on Groq
            self.available_models = [
                "llama-3.3-70b-versatile",                         # Best for extraction
                "meta-llama/llama-4-maverick-17b-128e-instruct",   # Better than scout
            ]
            logger.info("Using CLOUD Groq LLM")
        
        self.client = AsyncOpenAI(base_url=self.base_url, api_key=self.api_key)
        self.current_model_index = 0
        self.rate_limit_time = 0  # Track when we got rate limited

    async def _call_llm(self, messages: List[Dict], on_log=None, log_prefix="") -> Optional[Dict]:
        """Helper to call LLM with retry logic and JSON parsing."""
        import time
        
        # Reset model index after 60 seconds of cooldown
        if time.time() - self.rate_limit_time > 60:
            self.current_model_index = 0
        
        for i in range(len(self.available_models)):
            model_idx = (self.current_model_index + i) % len(self.available_models)
            model = self.available_models[model_idx]
            
            try:
                if on_log:
                    await on_log(json.dumps({"type": "info", "message": f"{log_prefix}Analyzing with {model}..."}))
                
                # Try with JSON mode first, fall back to regular if not supported
                try:
                    response = await self.client.chat.completions.create(
                        model=model,
                        messages=messages,
                        temperature=0.1,
                        response_format={"type": "json_object"}
                    )
                except Exception as json_err:
                    if "json" in str(json_err).lower() or "response_format" in str(json_err).lower():
                        # Model doesn't support JSON mode, try without it
                        if on_log:
                            await on_log(json.dumps({"type": "info", "message": f"Retrying without JSON mode..."}))
                        response = await self.client.chat.completions.create(
                            model=model,
                            messages=messages,
                            temperature=0.1
                        )
                    else:
                        raise json_err
                
                content = response.choices[0].message.content
                if not content: 
                    continue  # Try next model
                
                # Parse JSON from response
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    # Try to extract JSON from markdown code block
                    if "```json" in content:
                        json_str = content.split("```json")[1].split("```")[0].strip()
                        return json.loads(json_str)
                    elif "```" in content:
                        json_str = content.split("```")[1].split("```")[0].strip()
                        return json.loads(json_str)
                    else:
                        logger.error(f"Failed to parse JSON from: {content[:200]}")
                        continue  # Try next model

            except Exception as e:
                error_str = str(e)
                # Handle Rate Limits
                if "429" in error_str or "rate_limit" in error_str.lower():
                    self.current_model_index = (model_idx + 1) % len(self.available_models)
                    self.rate_limit_time = time.time()
                    if on_log:
                        await on_log(json.dumps({"type": "status", "message": f"Rate limit hit. Switching to next model..."}))
                    continue  # Try next model
                
                logger.error(f"LLM Error ({model}): {e}")
                if on_log:
                    await on_log(json.dumps({"type": "error", "message": f"Issue: {str(e)[:50]}"}))
                continue  # Try next model instead of returning None
        
        return None  # All models failed

    async def parse_resume(self, resume_text: str) -> Dict[str, Any]:
        prompt = PROMPT_RESUME.format(resume_text=resume_text[:10000])
        result = await self._call_llm([{"role": "user", "content": prompt}])
        return result or {"keywords": [], "summary": "Failed to analyze resume."}

    async def discover_professors(self, html_content: str, url: str, on_log=None, major: str = None, candidate_links: List[str] = []) -> List[Dict[str, str]]:
        """PHASE 1: Directory Scan - Extract professors from a page."""
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove noisy elements that confuse the LLM
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "noscript", "iframe", "svg", "button", "input"]):
            tag.decompose()
            
        # Use newline separator to preserve list structure (CRITICAL for directories)
        text_content = soup.get_text(separator='\n', strip=True)
        
        # Clean up excessive newlines/spaces
        import re
        text_content = re.sub(r'\n\s*\n', '\n', text_content)
        text_content = text_content[:15000]  # Increased limit slightly for long directories
        major_str = str(major or "All Departments")
        
        prompt = PROMPT_DISCOVERY.format(
            url=url,
            text_content=text_content,
            major=major_str
        )
        
        messages = [
            {"role": "system", "content": "You are a data extraction assistant. Output valid JSON only."},
            {"role": "user", "content": prompt}
        ]
        
        data = await self._call_llm(messages, on_log, log_prefix="Discovery: ")
        
        if not data:
            return {"professors": [], "is_profile_page": False}
        
        # Normalize list response (legacy support) to dict
        if isinstance(data, list):
            return {"professors": data, "navigation_links": []}
            
        return data

    async def extract_profile(self, html_content: str, url: str, professor_name: str = "Unknown", on_log=None, user_prompt: str = None) -> Dict[str, Any]:
        """PHASE 2: Deep Profile Extraction"""
        soup = BeautifulSoup(html_content, 'html.parser')
        for script in soup(["script", "style", "nav", "footer"]):
            script.decompose()
        
        text_content = soup.get_text(separator=' ', strip=True)[:6000]
        
        # If no user prompt is provided, default to general research relevance
        prompt_criteria = user_prompt if user_prompt else "General academic research relevance"

        formatted_prompt = PROMPT_PROFILE.replace("{professor_name}", professor_name)\
                                         .replace("{url}", url)\
                                         .replace("{text_content}", text_content)\
                                         .replace("{user_search_prompt}", prompt_criteria)
        
        messages = [
            {"role": "system", "content": "Output valid JSON only. Extract as much detail as possible."},
            {"role": "user", "content": formatted_prompt}
        ]
        
        data = await self._call_llm(messages, on_log, log_prefix="Profile: ")
        
        if not data:
            return {"professor_name": professor_name, "error": "Extraction failed"}
            
        return data
