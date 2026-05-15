"""
MOOD for DESIGN — SQLAlchemy ORM Models mapped to existing Blueprint schema.

NOTE: This module declares ORM mappings against tables that ALREADY exist
in Supabase (Blueprint engine). DO NOT create_all() — DDL is owned by
Blueprint migrations. We only read/write rows.

Tables mapped (subset relevant to corporate site):
- tenants
- tenant_domains
- tenant_memberships
- cms_pages
- cms_sections
- cms_assets
- magazine_posts
- magazine_paragraphs
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    String, Boolean, Integer, Text, DateTime, Numeric, Enum,
    ForeignKey, JSON, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY, ENUM as PgEnum

# Existing Postgres ENUM types (do NOT create — already in DB)
TenantStatusEnum    = PgEnum('draft', 'active', 'suspended', 'archived',
                              name='tenant_status', create_type=False)
DomainTypeEnum      = PgEnum('platform_subdomain', 'custom_domain',
                              name='domain_type', create_type=False)
CmsPageStatusEnum   = PgEnum('draft', 'published', 'scheduled', 'archived',
                              name='cms_page_status', create_type=False)
from sqlalchemy.orm import Mapped, mapped_column, relationship, DeclarativeBase


class Base(DeclarativeBase):
    pass


# ── Tenants ───────────────────────────────────────────────────────────────────

class Tenant(Base):
    __tablename__ = 'tenants'

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    slug: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(TenantStatusEnum, nullable=False)  # tenant_status enum
    logo_url: Mapped[Optional[str]] = mapped_column(Text)
    primary_color: Mapped[Optional[str]] = mapped_column(Text)
    secondary_color: Mapped[Optional[str]] = mapped_column(Text)
    font_heading: Mapped[Optional[str]] = mapped_column(Text)
    font_body: Mapped[Optional[str]] = mapped_column(Text)
    default_language: Mapped[Optional[str]] = mapped_column(Text)
    active_languages: Mapped[Optional[list]] = mapped_column(ARRAY(Text))
    active_plan: Mapped[str] = mapped_column(Text, nullable=False)
    enabled_modules: Mapped[list] = mapped_column(JSONB, nullable=False)
    max_users: Mapped[Optional[int]] = mapped_column(Integer)
    max_projects: Mapped[Optional[int]] = mapped_column(Integer)
    max_storage_gb: Mapped[Optional[float]] = mapped_column(Numeric)
    subscription_status: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    domains: Mapped[List['TenantDomain']] = relationship('TenantDomain', back_populates='tenant')
    pages: Mapped[List['CmsPage']] = relationship('CmsPage', back_populates='tenant')


class TenantDomain(Base):
    __tablename__ = 'tenant_domains'

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey('tenants.id', ondelete='CASCADE'))
    domain: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(DomainTypeEnum, nullable=False)  # domain_type enum
    is_primary: Mapped[Optional[bool]] = mapped_column(Boolean)
    verification_status: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    tenant: Mapped['Tenant'] = relationship('Tenant', back_populates='domains')


# ── CMS Pages / Sections ──────────────────────────────────────────────────────

class CmsPage(Base):
    """
    Blueprint CMS page.
    page_key      → 'home', 'pricing', etc. (corporate slug)
    locale_meta   → {locale: {title, description, og_title, ...}}
    page_content  → page-level config (template, layout flags)
    status        → cms_page_status enum
    """
    __tablename__ = 'cms_pages'

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey('tenants.id', ondelete='CASCADE'))
    page_key: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[Optional[str]] = mapped_column(Text)
    locale_meta: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    page_content: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(CmsPageStatusEnum, nullable=False)  # cms_page_status enum
    scheduled_publish_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ai_translated_locales: Mapped[list] = mapped_column(ARRAY(Text), nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    tenant: Mapped['Tenant'] = relationship('Tenant', back_populates='pages')
    sections: Mapped[List['CmsSection']] = relationship(
        'CmsSection',
        back_populates='page',
        order_by='CmsSection.sort_order',
        cascade='all, delete-orphan',
    )


class CmsSection(Base):
    """
    Blueprint CMS section. ONE record = ONE section on a page.
    section_type   → editorial_hero, split_story, cinematic_quote, etc.
    locale_content → {locale: {headline, body, cta, ...}}
    settings       → {layout, image_url, background, ...}
    asset_refs     → uuid[] referencing cms_assets
    """
    __tablename__ = 'cms_sections'

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey('tenants.id', ondelete='CASCADE'))
    page_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey('cms_pages.id', ondelete='CASCADE'))
    section_type: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    locale_content: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    asset_refs: Mapped[list] = mapped_column(ARRAY(UUID(as_uuid=False)), nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    page: Mapped['CmsPage'] = relationship('CmsPage', back_populates='sections')
