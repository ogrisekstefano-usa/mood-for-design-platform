from pydantic import BaseModel
from typing import Optional, Dict, Any


class AnalyticsEvent(BaseModel):
    event_type: str
    session_id: Optional[str] = None
    properties: Optional[Dict[str, Any]] = {}
    url: Optional[str] = None
    referrer: Optional[str] = None
