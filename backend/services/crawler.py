import requests
from requests.exceptions import Timeout, ConnectionError, RequestException
from bs4 import BeautifulSoup
from uuid import UUID
import uuid
import logging
import asyncio
import json
import time
from typing import List, Optional, Dict, Any
from models import ProfessorCardResponse
from services.supabase_client import get_supabase_client
from services.llm import LLMService

logger = logging.getLogger(__name__)

class CrawlerService:
    def __init__(self):
        self.supabase = get_supabase_client()
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        self.llm_service = LLMService()

    async def run_session(self, session_id: UUID, root_urls: List[str], log_callback=None, major: str = None, custom_prompt: str = None):
        """
        Two-Phase Intelligent Crawler:
        Phase 1: Discovery - Find professor names and profile URLs quickly
        Phase 2: Investigation - Deep dive into each profile for full details
        """
        await self._update_session_status(session_id, "running")
        if log_callback: 
            await log_callback(json.dumps({
                "type": "phase", 
                "phase": "discovery", 
                "message": "Starting intelligent discovery..."
            }))
        
        all_cards = []
        visited_urls = set()
        seen_professors = set()  # Deduplication by name
        professor_stubs = []  # Candidates to investigate
        
        MAX_PROFESSORS = 15
        MAX_DISCOVERY_PAGES = 30  # Increased to allow finding deep directories
        TIMEOUT_SECONDS = 180  # More time for deep investigation
        start_time = time.time()
        
        try:
            # ═══════════════════════════════════════════════════════════════
            # ═══════════════════════════════════════════════════════════════
            # PHASE 1: DISCOVERY - Find professors quickly (FAIL FAST)
            # ═══════════════════════════════════════════════════════════════
            # REDESIGN: Max depth 1 (Shallow), Max 5 pages. Rely on user for good link.
            discovery_queue = [{"url": url, "depth": 0} for url in root_urls]
            for url in root_urls:
                visited_urls.add(url)
            
            pages_scanned = 0
            MAX_PAGES_FAIL_FAST = 5
            
            while discovery_queue and pages_scanned < MAX_PAGES_FAIL_FAST:
                # ... (time check logic is fine)
                if time.time() - start_time > TIMEOUT_SECONDS / 2:
                    break

                current = discovery_queue.pop(0)
                url = current["url"]
                depth = current["depth"]
                
                # REDESIGN: Stop if depth > 1
                if depth > 1:
                    continue
                
                if log_callback:
                    await log_callback(json.dumps({
                        "type": "scanning",
                        "url": url,
                        "depth": depth,
                        "pages_crawled": pages_scanned,
                        "found": len(professor_stubs)
                    }))
                
                # ... (fetch logic) ...
                try:
                    html_content = await self._async_fetch(url)
                except Exception as e:
                    if log_callback:
                        await log_callback(json.dumps({"type": "error", "message": f"Could not access: {url}"}))
                    continue
                
                pages_scanned += 1
                
                # Extract potential links first for agentic navigation
                candidate_links_raw = self._extract_directory_links(html_content, url)
                
                # Quick discovery scan
                discovery_result = await self.llm_service.discover_professors(
                    html_content, url, log_callback, major, candidate_links_raw
                )
                
                # ... (profile extraction log logic is fine) ...
                
                # Handle Discovery Result
                if discovery_result.get("is_profile_page"):
                     # ... (profile logic is fine) ...
                     prof_data = await self.llm_service.extract_profile(html_content, url, professor_name="Unknown", on_log=log_callback)
                     if prof_data and prof_data.get("professor_name") != "Unknown":
                         professor_stubs.append({"name": prof_data["professor_name"], "profile_url": url, "full_data": prof_data})
                
                else:
                    # Directory page - collect stubs
                    found_profs = discovery_result.get("professors", [])
                    
                    if log_callback and found_profs:
                         await log_callback(json.dumps({"type": "discovery", "count": len(found_profs)}))
                    
                    # Store found professors
                    seen_professors = set(p["name"].lower() for p in professor_stubs)
                    
                    for prof in found_profs:
                        name = prof.get("name", "").strip()
                        title = prof.get("title", "").strip().lower()
                        
                        if not name or name.lower() == "unknown":
                            continue
                        
                        # ========== NAME VALIDATION ==========
                        # Must look like a real human name (first + last name minimum)
                        name_parts = name.split()
                        if len(name_parts) < 2:
                            continue
                        
                        # Reject known placeholder names
                        placeholder_names = ["john smith", "jane doe", "john doe", "jane smith", "john t. smith", "jane m. doe", "test user", "sample professor"]
                        if name.lower() in placeholder_names:
                            continue
                        
                        # Reject names that are clearly not people (LLM hallucinations)
                        non_person_terms = [
                            "digital", "agriculture", "tinnitus", "communications", "network",
                            "committee", "research", "innovation", "advisory", "oversight",
                            "bic", "bil", "bcnn", "roi", "ceo", "cto", "cfo", "vp",
                            "group", "team", "staff", "faculty", "personnel"
                        ]
                        if name.lower() in non_person_terms or any(term == name.lower() for term in non_person_terms):
                            continue
                        
                        # Safety Filter: Reject names that look like organizations/places
                        bad_keywords = [
                            "lab", "center", "institute", "university", "department", "school", 
                            "program", "office", "facility", "college", "services", "administration",
                            "bureau", "reach", "alliance", "consortium", "initiative", "committee",
                            "board", "council", "foundation", "society", "network", "group"
                        ]
                        if any(k in name.lower() for k in bad_keywords):
                            continue
                        
                        # Safety Filter: Reject administrative titles
                        admin_titles = [
                            "vice chancellor", "chancellor", "provost", "president", "vice president",
                            "dean", "associate dean", "vice dean", "assistant dean",
                            "director", "executive director", "assistant director", "associate director",
                            "coordinator", "manager", "administrator", "specialist", "analyst",
                            "counselor", "advisor", "secretary", "assistant to"
                        ]
                        if any(admin in title for admin in admin_titles):
                            continue

                        if name.lower() in seen_professors:
                            continue
                        seen_professors.add(name.lower())
                        
                        profile_url = prof.get("profile_url")
                        
                        # Resolve relative URLs
                        if profile_url and not profile_url.startswith("http"):
                            profile_url = requests.compat.urljoin(url, profile_url)
                        
                        # Skip if profile URL is same as current page (no unique profile found)
                        if profile_url and profile_url == url:
                            profile_url = None
                        
                        # Add professor stub
                        professor_stubs.append({
                            "name": name,
                            "profile_url": profile_url,
                            "source_url": url,
                            "title": prof.get("title"),
                            "email": prof.get("email"),
                            "snippet": prof.get("snippet")
                        })
                        
                        if log_callback:
                            await log_callback(json.dumps({
                                "type": "info",
                                "message": f"📋 Found: {name}" + (f" ({profile_url[:40]}...)" if profile_url else " (no profile link)")
                            }))
                
                
                # NAVIGATION: Use heuristic-based link extraction (fast, no LLM needed)
                # REDESIGN: Only depth 0 allowed (Shallow Discovery)
                if depth == 0:
                    new_links = self._extract_directory_links(html_content, url)
                    added_links = 0
                    for link in new_links[:8]:  # Take top 8 highest-priority links
                        if link not in visited_urls:
                            visited_urls.add(link)
                            discovery_queue.append({"url": link, "depth": depth + 1})
                            added_links += 1
                    
                    if added_links > 0 and log_callback:
                        await log_callback(json.dumps({
                            "type": "info",
                            "message": f"🔗 Found {added_links} faculty directory links to explore"
                        }))
                
                # Stop if we have enough candidates
                if len(professor_stubs) >= MAX_PROFESSORS * 2:
                    break
            
            # ═══════════════════════════════════════════════════════════════
            # FAIL FAST CHECK
            # ═══════════════════════════════════════════════════════════════
            if len(professor_stubs) < 3:
                msg = f"Only found {len(professor_stubs)} potential candidates. Please provide a direct link to the 'Faculty Directory'."
                if log_callback:
                    await log_callback(json.dumps({
                        "type": "suggestion", 
                        "title": "Low Yield Warning",
                        "message": msg
                    }))
                
                # Abort session
                await self._update_session_status(session_id, "error", blocked_reason=msg)
                return
            
            if log_callback:
                await log_callback(json.dumps({
                    "type": "phase",
                    "phase": "investigation",
                    "message": f"Discovery complete. Investigating {min(len(professor_stubs), MAX_PROFESSORS)} professors..."
                }))
            
            # ═══════════════════════════════════════════════════════════════
            # PHASE 2: INVESTIGATION - Deep dive into each professor
            # ═══════════════════════════════════════════════════════════════
            
            for i, stub in enumerate(professor_stubs[:MAX_PROFESSORS]):
                if time.time() - start_time > TIMEOUT_SECONDS:
                    if log_callback:
                        await log_callback(json.dumps({
                            "type": "info",
                            "message": "Time limit reached. Saving collected data..."
                        }))
                    break
                
                name = stub["name"]
                profile_url = stub.get("profile_url")
                
                if log_callback:
                    await log_callback(json.dumps({
                        "type": "investigating",
                        "name": name,
                        "step": "profile",
                        "progress": f"{i+1}/{min(len(professor_stubs), MAX_PROFESSORS)}",
                        "message": f"🔍 Investigating: {name} ({(profile_url or '')[:30]}...)"
                    }))
                
                # If we already have full data from discovery phase
                if stub.get("full_data"):
                    prof_data = stub["full_data"]
                elif profile_url and profile_url not in visited_urls:
                    visited_urls.add(profile_url)
                    
                    try:
                        html_content = await self._async_fetch(profile_url)
                        
                        if log_callback:
                            await log_callback(json.dumps({
                                "type": "scanning",
                                "url": profile_url,
                                "depth": 1,
                                "pages_crawled": pages_scanned,
                                "found": len(all_cards)
                            }))
                        
                        pages_scanned += 1
                        
                        # Deep extraction - Unified Method
                        user_search_context = custom_prompt or f"Research in {major}" if major else None
                        
                        prof_data = await self.llm_service.extract_profile(
                            html_content, 
                            profile_url, 
                            name, 
                            log_callback,
                            user_prompt=user_search_context
                        )

                        if prof_data.get("error"):
                            logger.info(f"Failed to analyze {name}: {prof_data['error']}")
                            if log_callback:
                                await log_callback(json.dumps({
                                    "type": "info",
                                    "message": f"   → Using directory info (analysis failed: {prof_data['error']})"
                                }))
                            # Fallback to simple stub data so we don't lose the professor
                            prof_data = {"professor_name": name}
                            profile_url = None

                        
                    except Exception as e:
                        logger.warning(f"Failed to fetch profile for {name}: {e}")
                        prof_data = {"professor_name": name}
                        profile_url = None
                else:
                    # No profile URL, create minimal card from stub
                    prof_data = {"professor_name": name}

                # MERGE: If deep extraction failed or returned little, use Stub data
                if not prof_data.get("title") and stub.get("title"):
                    prof_data["title"] = stub["title"]
                if not prof_data.get("summary") and stub.get("snippet"):
                    prof_data["summary"] = stub["snippet"]
                if not prof_data.get("school") and "illinois" in (profile_url or "").lower():
                    prof_data["school"] = "University of Illinois Urbana-Champaign"
                
                # Resolve any relative URLs in links
                resolved_links = []
                base_url = profile_url or stub.get("source_url", "")
                for link_obj in prof_data.get("links", []):
                    if isinstance(link_obj, dict) and link_obj.get("url"):
                        link_url = link_obj["url"]
                        if not link_url.startswith("http"):
                            link_url = requests.compat.urljoin(base_url, link_url)
                        resolved_links.append({
                            "label": link_obj.get("label", "Link"),
                            "url": link_url
                        })
                
                # ═══════════════════════════════════════════════════════════════
                # DEEP INVESTIGATION: Visit Lab/Personal Website if found
                # ═══════════════════════════════════════════════════════════════
                external_url = None
                for link in resolved_links:
                    label = link.get("label", "").lower()
                    if "lab" in label or "personal" in label or "research group" in label or "homepage" in label:
                        # Validate it's not the same as profile_url
                        if link["url"] != profile_url and "scholar.google" not in link["url"]:
                            external_url = link["url"]
                            break
                
                if external_url and log_callback:
                    await log_callback(json.dumps({
                        "type": "info",
                        "message": f"🕵️ Deep Dive: Investigating external site: {external_url}"
                    }))
                    
                    try:
                        # Fetch external site
                        external_html = await self._async_fetch(external_url)
                        
                        # Combine contexts: Profile + External Site
                        combined_content = html_content + "\n\n<!-- ================= EXTERNAL LAB WEBSITE CONTENT ================= -->\n\n" + external_html
                        
                        # Re-extract with richer context
                        deep_data = await self.llm_service.extract_profile(
                            combined_content, 
                            url, # Keep original URL as primary ID 
                            name, 
                            log_callback,
                            user_prompt=user_search_context
                        )
                        
                        if deep_data and not deep_data.get("error"):
                            # Merge deep data into prof_data
                            # Prefer deep data for summary, keywords, and extra links
                            if deep_data.get("summary") and len(deep_data["summary"]) > len(prof_data.get("summary", "")):
                                prof_data["summary"] = deep_data["summary"]
                            
                            prof_data["keywords"] = list(set(prof_data.get("keywords", []) + deep_data.get("keywords", [])))
                            
                            # Add new links found on lab site
                            for new_link in deep_data.get("links", []):
                                if isinstance(new_link, dict) and new_link.get("url"):
                                    # Check duplicates
                                    if not any(l["url"] == new_link["url"] for l in resolved_links):
                                        resolved_links.append(new_link)
                            
                            if log_callback:
                                await log_callback(json.dumps({
                                    "type": "info",
                                    "message": "   ✅ Deep investigation successful. Updated profile data."
                                }))
                                
                    except Exception as e:
                        logger.warning(f"Deep investigation failed for {external_url}: {e}")
                        if log_callback:
                            await log_callback(json.dumps({
                                "type": "info", 
                                "message": f"   ⚠️ Could not access external site: {str(e)[:50]}"
                            }))

                # Log links found
                if log_callback and resolved_links:
                    labels = [l["label"] for l in resolved_links[:4]]
                    await log_callback(json.dumps({
                        "type": "info",
                        "message": f"   → Found links: {', '.join(labels)}"
                    }))
                
                # Create and save card
                card = ProfessorCardResponse(
                    session_id=session_id,
                    professor_name=prof_data.get("professor_name", name),
                    title=prof_data.get("title"),
                    department=prof_data.get("department"),
                    school=prof_data.get("school"),
                    primary_url=profile_url or stub.get("source_url"),
                    links=resolved_links,
                    summary=prof_data.get("summary"),
                    keywords=prof_data.get("keywords", []),
                    match_score=prof_data.get("match_score", 0.0)
                )
                
                self._save_card(session_id, card)
                all_cards.append(card)
                
                if log_callback:
                    await log_callback(json.dumps({
                        "type": "found_card",
                        "name": card.professor_name,
                        "department": card.department or "Unknown",
                        "title": card.title or "",
                        "links_count": len(card.links),
                        "summary": (card.summary or "")[:100]
                    }))
                
                # Small delay to avoid rate limits
                await asyncio.sleep(0.5)
            
            # ═══════════════════════════════════════════════════════════════
            # COMPLETE
            # ═══════════════════════════════════════════════════════════════
            await self._update_session_status(session_id, "done")
            
            if log_callback:
                await log_callback(json.dumps({
                    "type": "complete",
                    "total_cards": len(all_cards),
                    "pages_crawled": pages_scanned,
                    "message": f"Investigation complete! Found {len(all_cards)} professors."
                }))
            
            # Send suggestions via log_callback instead of yield
            if log_callback:
                if len(all_cards) < 5:
                    await log_callback(json.dumps({
                        "type": "suggestion",
                        "message": "Tip: Few results found? Try pasting the exact 'Faculty Directory' URL (e.g., https://cs.illinois.edu/people/faculty) instead of the home page."
                    }))
                elif all_cards:
                    avg_score = sum([c.match_score or 0 for c in all_cards]) / len(all_cards)
                    if 0 < avg_score < 40:
                        await log_callback(json.dumps({
                            "type": "suggestion",
                            "message": f"Tip: Average Match Score is low ({int(avg_score)}%). Try refining your 'Custom Prompt'."
                        }))
            
        except Exception as e:
            logger.error(f"Crawler session failed: {e}")
            await self._update_session_status(session_id, "failed", blocked_reason=str(e))
            if log_callback:
                await log_callback(json.dumps({"type": "error", "message": str(e)}))

    async def _async_fetch(self, url: str) -> str:
        """Async wrapper for fetching a URL."""
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, self._fetch, url)
        return response.text

    def _extract_directory_links(self, html: str, base_url: str) -> List[str]:
        """Extract links that likely lead to more faculty/directory pages."""
        soup = BeautifulSoup(html, 'html.parser')
        links = []
        
        # HIGH PRIORITY keywords (Faculty directories)
        high_priority = ['faculty', 'people', 'directory', 'professors', 'researchers', 'labs', 'research-groups', 'academic-staff']
        
        # MEDIUM PRIORITY keywords (General academic pages)
        medium_priority = ['department', 'about', 'team', 'members', 'profiles', 'academic']
        
        # BLOCKED keywords (NEVER follow these)
        blocked = [
            'history', 'alumni', 'news', 'events', 'calendar', 'nobel', 'laureate', 'pulitzer', 
            'awards', 'obituary', 'memoriam', 'deceased', 'emeritus', 'retired',
            'staff', 'admin', 'counseling', 'hr', 'human-resources', 'services', 
            'well-being', 'assistance', 'finance', 'jobs', 'careers', 'transcript',
            'registrar', 'advising', 'undergraduate', 'accessibility', 'login', 'apply',
            'catalog', 'archive', 'handbook', 'policy', 'policies',
            # Leadership/Admin pages to avoid
            'leadership', 'chancellor', 'provost', 'dean', 'president', 'executive',
            'board-of', 'trustees', 'governance', 'strategic', 'mission', 'vision'
        ]
        
        # BLOCKED file extensions (skip non-HTML files)
        blocked_extensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', 
                              '.jpg', '.jpeg', '.png', '.gif', '.svg', '.zip', '.tar', '.gz']
        
        for a in soup.find_all('a', href=True):
            href = a['href'].lower()
            text = a.get_text().lower()
            combined = href + " " + text
            
            # BLOCK: Skip file downloads
            if any(href.endswith(ext) for ext in blocked_extensions):
                continue
            
            # BLOCK: Skip if matches any blocked keyword
            if any(k in combined for k in blocked):
                continue
            
            # PRIORITY: Score based on keywords
            priority = 0
            if any(k in combined for k in high_priority):
                priority = 2
            elif any(k in combined for k in medium_priority):
                priority = 1
            else:
                continue  # Skip if no relevant keywords
            
            full_url = requests.compat.urljoin(base_url, a['href'])
            if base_url.split('/')[2] in full_url:  # Same domain
                links.append((priority, full_url))
        
        # Sort by priority (highest first) and deduplicate
        links = sorted(set(links), key=lambda x: -x[0])
        return [url for _, url in links]

    def _fetch(self, url: str):
        response = requests.get(url, headers=self.headers, timeout=10)
        if response.status_code in [403, 429]:
            raise Exception(f"HTTP {response.status_code}")
        return response

    def _save_card(self, session_id: UUID, card: ProfessorCardResponse):
        try:
            data = card.model_dump(exclude={"id", "created_at"}, exclude_none=True)
            data["session_id"] = str(session_id)
            
            if "links" in data and data["links"]:
                data["links"] = data["links"]
            
            logging.info(f"Saving card {card.professor_name} (Links: {len(data.get('links', []))})")
            self.supabase.table("professor_cards").insert(data).execute()
            
        except Exception as e:
            logger.error(f"Failed to save card to DB: {e}")

    async def _update_session_status(self, session_id: UUID, status: str, blocked_reason: str = None, blocked_url: str = None):
        try:
            data = {"status": status}
            if blocked_reason:
                data["blocked_reason"] = blocked_reason
            if blocked_url:
                data["blocked_url"] = blocked_url
            
            self.supabase.table("scrape_sessions").update(data).eq("id", str(session_id)).execute()
            logger.info(f"Session {session_id} updated: {status}")
        except Exception as e:
            logger.error(f"Failed to update session status: {e}")
