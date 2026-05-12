from pydantic import BaseModel, EmailStr
from typing import Optional, List
from enum import Enum


class LeadStatus(str, Enum):
    new = 'new'
    contacted = 'contacted'
    qualified = 'qualified'
    converted = 'converted'
    lost = 'lost'


class LeadType(str, Enum):
    client = 'client'
    partner = 'partner'


class LeadCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    project_type: Optional[str] = None
    budget_range: Optional[str] = None
    location: Optional[str] = None
    message: Optional[str] = None
    type: LeadType = LeadType.client
    source: str = 'website'


class LeadUpdate(BaseModel):
    full_name: Optional[str] = None
    status: Optional[LeadStatus] = None
    phone: Optional[str] = None
    project_type: Optional[str] = None
    budget_range: Optional[str] = None
    assigned_to: Optional[str] = None
    message: Optional[str] = None
