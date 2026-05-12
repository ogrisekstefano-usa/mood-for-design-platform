from pydantic import BaseModel
from typing import Optional, List, Any
from enum import Enum


class ProposalStatus(str, Enum):
    draft = 'draft'
    sent = 'sent'
    viewed = 'viewed'
    approved = 'approved'
    revision_requested = 'revision_requested'
    rejected = 'rejected'
    expired = 'expired'


class ProposalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    project_id: Optional[str] = None
    client_email: Optional[str] = None
    elements: Optional[List[Any]] = []


class ProposalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProposalStatus] = None
    elements: Optional[List[Any]] = None
    client_email: Optional[str] = None
    pdf_url: Optional[str] = None


class ProposalRespond(BaseModel):
    action: str  # approve | request_revision | reject
    note: Optional[str] = None
