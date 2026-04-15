"""
Topology and Lifeline API routers.

Endpoints for relationship visualization (topology) and chronological timeline (lifeline).

Rationale:
- Topology: Visualizes relationships between people from Neural Matrix
- Lifeline: Chronological view of completed tasks + journal entries
- Both query encrypted database + return decrypted data with privacy guarantees
"""

from fastapi import APIRouter, Query, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date
from typing import List, Optional, Dict, Any
import logging

# Import models (adjust paths based on your project structure)
# from backend.models import IdentityMatrix, Ticket, DailyJournal
# from backend.crypto import decrypt_field
# from backend.database import get_db

router = APIRouter(prefix="/api", tags=["Topology & Lifeline"])
logger = logging.getLogger(__name__)


# ==============================================================================
# Data Models (Request/Response)
# ==============================================================================

class TopoNode:
    """Node in relationship topology (person)."""
    
    def __init__(self, person_id: str, name: str, facts_count: int, last_mentioned: str):
        self.id = person_id
        self.name = name
        self.facts_count = facts_count
        self.last_mentioned = last_mentioned
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "facts_count": self.facts_count,
            "last_mentioned": self.last_mentioned
        }


class TopoEdge:
    """Edge in relationship topology (co-mention = relationship)."""
    
    def __init__(self, source: str, target: str, weight: float = 1.0):
        self.source = source
        self.target = target
        self.weight = weight  # Strength of relationship (0.0 to 1.0)
    
    def to_dict(self):
        return {
            "source": self.source,
            "target": self.target,
            "weight": self.weight
        }


class LifelineEvent:
    """Single event in lifeline (task or journal entry)."""
    
    def __init__(
        self,
        event_id: str,
        event_type: str,  # "task" or "journal"
        title: str,
        date_iso: str,
        priority: Optional[str] = None,
        description: Optional[str] = None
    ):
        self.id = event_id
        self.type = event_type
        self.title = title
        self.date = date_iso
        self.priority = priority
        self.description = description
    
    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "date": self.date,
            "priority": self.priority,
            "description": self.description,
        }


# ==============================================================================
# Topology: Relationship Graph
# ==============================================================================

@router.get("/network/topology")
async def get_relationship_topology(
    user_id: str,
    depth: int = Query(2, ge=1, le=5),
    limit: int = Query(100, ge=10, le=500),
    db: Session = Depends(None)  # Placeholder, inject get_db in main.py
):
    """
    Build relationship graph from Neural Matrix.
    
    Query identity_matrix for PERSON entries (encrypted facts about relationships).
    Decrypt and parse to extract people + relationships.
    Return graph as nodes (people) + edges (co-mentions = relationships).
    
    Args:
        user_id: User ID
        depth: Max relationship depth (1=direct, 2=friend of friend)
        limit: Max nodes to return (performance)
    
    Returns:
        {
            "nodes": [
                {"id": "person_1", "name": "Sarah", "facts_count": 3, "last_mentioned": "2026-04-15T10:30Z"}
            ],
            "edges": [
                {"source": "person_1", "target": "person_2", "weight": 0.8}
            ]
        }
    
    Example:
        GET /api/network/topology?user_id=user_123&depth=2&limit=100
    """
    
    try:
        logger.info(
            "[TOPOLOGY] Building relationship graph",
            extra={
                "user_id": user_id,
                "depth": depth,
                "limit": limit
            }
        )
        
        # Import here to avoid circular imports
        # In production, use proper dependency injection in main.py
        from backend.models import IdentityMatrix  # Placeholder
        from backend.crypto import decrypt_field
        
        # Query identity_matrix for PERSON entries
        # Rationale: PERSON category = facts about people the user knows
        # E.g., "Sarah is my colleague from startup X"
        person_facts = db.query(IdentityMatrix).filter(
            IdentityMatrix.user_id == user_id,
            IdentityMatrix.category == "PERSON",
            IdentityMatrix.created_at >= datetime.now() - timedelta(days=365)
        ).order_by(IdentityMatrix.created_at.desc()).limit(limit).all()
        
        if not person_facts:
            logger.warning(f"No person facts found for user {user_id}")
            return {
                "nodes": [],
                "edges": [],
                "debug": "No person facts found"
            }
        
        # Extract unique people from facts
        people: Dict[str, Any] = {}  # person_name -> {name, facts_count, last_mentioned}
        
        for fact_record in person_facts:
            # Decrypt fact (stores person_name, relationship info)
            fact_encrypted = fact_record.fact_encrypted  # Assuming fact_encrypted column
            person_name = decrypt_field(fact_encrypted, user_id)
            
            if not person_name:
                continue  # Skip if decryption failed
            
            # Normalize person name (lowercase for deduplication)
            person_key = person_name.lower().strip()
            
            if person_key not in people:
                people[person_key] = {
                    "name": person_name,
                    "facts_count": 0,
                    "last_mentioned": fact_record.created_at.isoformat() + "Z"
                }
            
            people[person_key]["facts_count"] += 1
            # Update last_mentioned to most recent
            people[person_key]["last_mentioned"] = max(
                people[person_key]["last_mentioned"],
                fact_record.created_at.isoformat() + "Z"
            )
        
        # Build nodes
        nodes = []
        person_list = list(people.items())[:limit]  # Limit node count
        
        for idx, (person_key, person_data) in enumerate(person_list):
            node = TopoNode(
                person_id=f"person_{idx}",
                name=person_data["name"],
                facts_count=person_data["facts_count"],
                last_mentioned=person_data["last_mentioned"]
            )
            nodes.append(node.to_dict())
        
        # Build edges (co-mention = relationship)
        # Rationale: If two people mentioned in same conversation/fact, they're related
        # E.g., "Sarah works with Moritz at startup X" = edge(Sarah, Moritz)
        edges = []
        person_indices = {name: idx for idx, name in enumerate([p for _, p in person_list])}
        
        # For each pair of people, calculate relationship strength
        # Simple heuristic: If mentioned in same chat/fact, they're connected
        for fact_record in person_facts:
            fact_encrypted = fact_record.fact_encrypted
            fact_text = decrypt_field(fact_encrypted, user_id)
            
            if not fact_text:
                continue
            
            # Extract all people mentioned in this fact
            mentioned_people = []
            for person_key in people.keys():
                if person_key in fact_text.lower():
                    mentioned_people.append(person_key)
            
            # Create edges between all mentioned people
            # Rationale: They're co-mentioned = related
            for i, person_a in enumerate(mentioned_people):
                for person_b in mentioned_people[i+1:]:
                    if person_a in person_indices and person_b in person_indices:
                        edge = TopoEdge(
                            source=f"person_{person_indices[person_a]}",
                            target=f"person_{person_indices[person_b]}",
                            weight=0.8  # Co-mention strength
                        )
                        edges.append(edge.to_dict())
        
        logger.info(
            "[TOPOLOGY] Graph built",
            extra={
                "user_id": user_id,
                "nodes": len(nodes),
                "edges": len(edges)
            }
        )
        
        return {
            "nodes": nodes,
            "edges": edges
        }
    
    except Exception as e:
        logger.error(
            "[TOPOLOGY] Error building graph",
            exc_info=e,
            extra={"user_id": user_id}
        )
        raise HTTPException(status_code=500, detail="Failed to build topology")


# ==============================================================================
# Lifeline: Chronological Timeline
# ==============================================================================

@router.get("/lifeline")
async def get_lifeline(
    user_id: str,
    start_date: Optional[str] = Query(None, regex=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: Optional[str] = Query(None, regex=r"^\d{4}-\d{2}-\d{2}$"),
    limit: int = Query(100, ge=10, le=500),
    db: Session = Depends(None)  # Placeholder
):
    """
    Chronological timeline of life events.
    
    Merges completed tasks + journal entries into single timeline.
    Returns events sorted by date (newest first, or oldest first per query param).
    
    Args:
        user_id: User ID
        start_date: Filter to events after this date (ISO 8601)
        end_date: Filter to events before this date (ISO 8601)
        limit: Max events to return
    
    Returns:
        {
            "events": [
                {
                    "id": "task_123",
                    "type": "task",
                    "title": "Completed Q2 planning",
                    "date": "2026-04-15T14:00Z",
                    "priority": "HIGH",
                    "description": "..."
                },
                {
                    "id": "journal_2026-04-15",
                    "type": "journal",
                    "title": "April 15 — Great productive day",
                    "date": "2026-04-15T23:59Z",
                    "description": "..."
                }
            ],
            "count": 24,
            "period": {"start": "2026-01-01", "end": "2026-04-15"}
        }
    
    Example:
        GET /api/lifeline?user_id=user_123&start_date=2026-04-01&limit=50
    """
    
    try:
        logger.info(
            "[LIFELINE] Fetching timeline",
            extra={
                "user_id": user_id,
                "start_date": start_date,
                "end_date": end_date,
                "limit": limit
            }
        )
        
        # Import models
        from backend.models import Ticket, DailyJournal  # Placeholder
        from datetime import timedelta
        
        # Parse date filters
        start_datetime = None
        end_datetime = None
        
        if start_date:
            start_datetime = datetime.strptime(start_date, "%Y-%m-%d")
        
        if end_date:
            # End of day (23:59:59)
            end_datetime = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        
        # If no filters, default to last 90 days
        if not start_datetime:
            start_datetime = datetime.now() - timedelta(days=90)
        
        if not end_datetime:
            end_datetime = datetime.now() + timedelta(days=1)
        
        # Query completed tasks
        # Rationale: Only include DONE tickets (life milestones)
        # Exclude TODO, IN_PROGRESS (those are future, not historical)
        tickets = db.query(Ticket).filter(
            Ticket.user_id == user_id,
            Ticket.status == "DONE",
            Ticket.created_at >= start_datetime,
            Ticket.created_at <= end_datetime
        ).all()
        
        # Query journal entries
        # Rationale: DailyJournal = daily reflections, summaries
        # Each journal entry is a daily milestone
        journals = db.query(DailyJournal).filter(
            DailyJournal.user_id == user_id,
            DailyJournal.created_at >= start_datetime,
            DailyJournal.created_at <= end_datetime
        ).all()
        
        # Merge into events list
        events = []
        
        # Add tasks as events
        for ticket in tickets:
            event = LifelineEvent(
                event_id=f"task_{ticket.id}",
                event_type="task",
                title=ticket.title,
                date_iso=ticket.created_at.isoformat() + "Z",
                priority=ticket.priority,
                description=ticket.description
            )
            events.append(event.to_dict())
        
        # Add journal entries as events
        for journal in journals:
            # Decrypt journal summary (encrypted fact)
            summary = journal.summary or "[Summary not available]"
            
            event = LifelineEvent(
                event_id=f"journal_{journal.id}",
                event_type="journal",
                title=f"{journal.created_at.strftime('%B %d')} — Daily Reflection",
                date_iso=journal.created_at.isoformat() + "Z",
                description=summary
            )
            events.append(event.to_dict())
        
        # Sort by date (newest first)
        # Rationale: Newest events at top (better UX for scrolling)
        events.sort(key=lambda e: e["date"], reverse=True)
        
        # Limit results
        events = events[:limit]
        
        logger.info(
            "[LIFELINE] Timeline built",
            extra={
                "user_id": user_id,
                "event_count": len(events),
                "tasks": len(tickets),
                "journals": len(journals)
            }
        )
        
        return {
            "events": events,
            "count": len(events),
            "period": {
                "start": start_datetime.date().isoformat(),
                "end": end_datetime.date().isoformat()
            }
        }
    
    except ValueError as e:
        logger.error(
            "[LIFELINE] Invalid date format",
            exc_info=e,
            extra={"start_date": start_date, "end_date": end_date}
        )
        raise HTTPException(status_code=400, detail="Invalid date format (use YYYY-MM-DD)")
    
    except Exception as e:
        logger.error(
            "[LIFELINE] Error fetching timeline",
            exc_info=e,
            extra={"user_id": user_id}
        )
        raise HTTPException(status_code=500, detail="Failed to fetch lifeline")


# ==============================================================================
# Integration with FastAPI main.py
# ==============================================================================

"""
Add to main.py:

from backend.routers.topology import router as topology_router

app = FastAPI()

# Include topology router (will add /api/network/topology and /api/lifeline routes)
app.include_router(topology_router)

# Usage:
# - http://localhost:8000/api/network/topology?user_id=user_123
# - http://localhost:8000/api/lifeline?user_id=user_123&start_date=2026-04-01
"""
