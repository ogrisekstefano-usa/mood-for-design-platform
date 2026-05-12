"""Pydantic request/response models — aligned with Supabase schema."""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ── Auth ─────────────────────────────────────────────────────────────────────
class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    company_name: str = Field(min_length=1, max_length=200)
    locale: str = 'en-US'


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class AuthSession(BaseModel):
    access_token: str
    refresh_token: str
    expires_at: Optional[int] = None
    token_type: str = 'bearer'


class UserProfileResponse(BaseModel):
    id: str
    auth_user_id: str
    tenant_id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    status: Optional[str] = None


class AuthResponse(BaseModel):
    session: AuthSession
    user: UserProfileResponse


# ── Leads ────────────────────────────────────────────────────────────────────
class LeadCreate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    lead_type: str = 'private_client'  # 'private_client' | 'ad_partner'
    source: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    language: str = 'en'
    project_type: Optional[str] = None
    budget_range: Optional[str] = None
    timeline: Optional[str] = None
    style_preference: Optional[str] = None
    notes: Optional[str] = None
    metadata_json: Dict[str, Any] = Field(default_factory=dict)


class LeadUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    score: Optional[int] = None
    notes: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    project_type: Optional[str] = None
    budget_range: Optional[str] = None
    timeline: Optional[str] = None
    style_preference: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None


# ── Projects ─────────────────────────────────────────────────────────────────
class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: Optional[str] = None
    project_type: Optional[str] = None
    priority: str = 'normal'
    budget_range: Optional[str] = None
    timeline: Optional[str] = None
    language: str = 'en'
    lead_id: Optional[str] = None
    client_user_id: Optional[str] = None
    assigned_to: Optional[str] = None
    metadata_json: Dict[str, Any] = Field(default_factory=dict)


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    project_type: Optional[str] = None
    priority: Optional[str] = None
    budget_range: Optional[str] = None
    timeline: Optional[str] = None
    assigned_to: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None


# ── Proposals ────────────────────────────────────────────────────────────────
class ProposalCreate(BaseModel):
    project_id: str
    title: str = Field(min_length=1, max_length=300)
    description: Optional[str] = None
    total_value: Optional[float] = None
    currency: str = 'EUR'
    expires_at: Optional[str] = None


class ProposalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    pdf_url: Optional[str] = None
    total_value: Optional[float] = None
    currency: Optional[str] = None
    expires_at: Optional[str] = None


class ProposalSignoff(BaseModel):
    decision: str  # approved | revision_requested | rejected
    comment: Optional[str] = None


# ── Moodboards ───────────────────────────────────────────────────────────────
class MoodboardCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: Optional[str] = None
    project_id: Optional[str] = None
    template_id: Optional[str] = None


class MoodboardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


# ── Tenant / Blueprint ───────────────────────────────────────────────────────
class TenantSettingUpsert(BaseModel):
    key: str
    value_json: Dict[str, Any]


# ── Storage ──────────────────────────────────────────────────────────────────
class SignedUploadRequest(BaseModel):
    bucket: str
    path: str
    content_type: Optional[str] = None


class MediaUploadComplete(BaseModel):
    bucket: str
    storage_path: str
    file_name: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    category: Optional[str] = None
    project_id: Optional[str] = None
    alt_text: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
