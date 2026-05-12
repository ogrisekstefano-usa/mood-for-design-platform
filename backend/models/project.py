from pydantic import BaseModel
from typing import Optional
from enum import Enum


class ProjectStatus(str, Enum):
    discovery = 'discovery'
    design = 'design'
    execution = 'execution'
    completed = 'completed'
    on_hold = 'on_hold'


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    status: ProjectStatus = ProjectStatus.discovery
    type: Optional[str] = None
    budget: Optional[float] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    assigned_to: Optional[str] = None
    lead_id: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    status: Optional[ProjectStatus] = None
    type: Optional[str] = None
    budget: Optional[float] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    assigned_to: Optional[str] = None
