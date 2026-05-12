from pydantic import BaseModel
from typing import Optional, List, Any
from enum import Enum


class MoodboardStatus(str, Enum):
    draft = 'draft'
    active = 'active'
    archived = 'archived'


class MoodboardCreate(BaseModel):
    title: str
    description: Optional[str] = None
    project_id: Optional[str] = None
    template_id: Optional[str] = None


class MoodboardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[MoodboardStatus] = None
    pages: Optional[List[Any]] = None
    blocks: Optional[List[Any]] = None
    thumbnail_url: Optional[str] = None
