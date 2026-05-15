"""
MOOD for DESIGN — SQLAlchemy ORM Models
Multi-tenant schema: Tenants → Pages → Sections → SectionContent
Supabase-ready. All tables support multilingual content via _content sibling tables.
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import (
    String, Boolean, Integer, Text, DateTime, Numeric,
    ForeignKey, JSON, UniqueConstraint, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())

def now_utc():
    return datetime.now(timezone.utc)


# ── Tenants ───────────────────────────────────────────────────────────────────

class Tenant(Base):
    __tablename__ = 'tenants'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    domain: Mapped[Optional[str]] = mapped_column(String(255))
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    pages: Mapped[List['Page']] = relationship('Page', back_populates='tenant', cascade='all, delete-orphan')
    navigation_items: Mapped[List['NavigationItem']] = relationship('NavigationItem', back_populates='tenant', cascade='all, delete-orphan')
    pricing_plans: Mapped[List['PricingPlan']] = relationship('PricingPlan', back_populates='tenant', cascade='all, delete-orphan')
    journal_posts: Mapped[List['JournalPost']] = relationship('JournalPost', back_populates='tenant', cascade='all, delete-orphan')


# ── Pages ─────────────────────────────────────────────────────────────────────

class Page(Base):
    __tablename__ = 'pages'
    __table_args__ = (UniqueConstraint('tenant_id', 'slug', name='uq_page_tenant_slug'),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey('tenants.id', ondelete='CASCADE'), index=True)
    slug: Mapped[str] = mapped_column(String(200), nullable=False)
    template: Mapped[str] = mapped_column(String(100), default='corporate-default')
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    seo: Mapped[dict] = mapped_column(JSON, default=dict)  # {locale: {title, description, og_title...}}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    tenant: Mapped['Tenant'] = relationship('Tenant', back_populates='pages')
    sections: Mapped[List['Section']] = relationship(
        'Section', back_populates='page',
        order_by='Section.display_order',
        cascade='all, delete-orphan'
    )


# ── Sections ──────────────────────────────────────────────────────────────────

class Section(Base):
    __tablename__ = 'sections'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    page_id: Mapped[str] = mapped_column(String(36), ForeignKey('pages.id', ondelete='CASCADE'), index=True)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey('tenants.id', ondelete='CASCADE'), index=True)
    type: Mapped[str] = mapped_column(String(100), nullable=False)  # from section registry
    config: Mapped[dict] = mapped_column(JSON, default=dict)         # layout, image_url, etc.
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    page: Mapped['Page'] = relationship('Page', back_populates='sections')
    content_items: Mapped[List['SectionContent']] = relationship(
        'SectionContent', back_populates='section', cascade='all, delete-orphan'
    )


class SectionContent(Base):
    """Multilingual content for a section (one row per locale)."""
    __tablename__ = 'section_content'
    __table_args__ = (UniqueConstraint('section_id', 'locale_code', name='uq_section_content_locale'),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    section_id: Mapped[str] = mapped_column(String(36), ForeignKey('sections.id', ondelete='CASCADE'), index=True)
    locale_code: Mapped[str] = mapped_column(String(20), nullable=False)  # 'it', 'en-us', etc.
    content: Mapped[dict] = mapped_column(JSON, default=dict)  # headline, body, cta, etc.

    section: Mapped['Section'] = relationship('Section', back_populates='content_items')


# ── Navigation ────────────────────────────────────────────────────────────────

class NavigationItem(Base):
    __tablename__ = 'navigation_items'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey('tenants.id', ondelete='CASCADE'), index=True)
    nav_group: Mapped[str] = mapped_column(String(50), default='main')  # 'main', 'footer', 'cta'
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    href: Mapped[str] = mapped_column(String(500), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    tenant: Mapped['Tenant'] = relationship('Tenant', back_populates='navigation_items')
    labels: Mapped[List['NavigationContent']] = relationship(
        'NavigationContent', back_populates='nav_item', cascade='all, delete-orphan'
    )


class NavigationContent(Base):
    """Multilingual labels for navigation items."""
    __tablename__ = 'navigation_content'
    __table_args__ = (UniqueConstraint('nav_item_id', 'locale_code', name='uq_nav_content_locale'),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    nav_item_id: Mapped[str] = mapped_column(String(36), ForeignKey('navigation_items.id', ondelete='CASCADE'), index=True)
    locale_code: Mapped[str] = mapped_column(String(20), nullable=False)
    label: Mapped[str] = mapped_column(String(500), nullable=False)

    nav_item: Mapped['NavigationItem'] = relationship('NavigationItem', back_populates='labels')


# ── Pricing ───────────────────────────────────────────────────────────────────

class PricingPlan(Base):
    __tablename__ = 'pricing_plans'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey('tenants.id', ondelete='CASCADE'), index=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    price_monthly: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    price_yearly: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(String(10), default='EUR')
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    badge: Mapped[Optional[str]] = mapped_column(String(100))
    stripe_price_id_monthly: Mapped[Optional[str]] = mapped_column(String(255))
    stripe_price_id_yearly: Mapped[Optional[str]] = mapped_column(String(255))

    tenant: Mapped['Tenant'] = relationship('Tenant', back_populates='pricing_plans')
    content_items: Mapped[List['PricingPlanContent']] = relationship(
        'PricingPlanContent', back_populates='plan', cascade='all, delete-orphan'
    )


class PricingPlanContent(Base):
    """Multilingual content for pricing plans."""
    __tablename__ = 'pricing_plan_content'
    __table_args__ = (UniqueConstraint('plan_id', 'locale_code', name='uq_pricing_content_locale'),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    plan_id: Mapped[str] = mapped_column(String(36), ForeignKey('pricing_plans.id', ondelete='CASCADE'), index=True)
    locale_code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    cta_text: Mapped[Optional[str]] = mapped_column(String(100), default='Get Started')
    features: Mapped[list] = mapped_column(JSON, default=list)

    plan: Mapped['PricingPlan'] = relationship('PricingPlan', back_populates='content_items')


# ── Journal Posts ─────────────────────────────────────────────────────────────

class JournalPost(Base):
    __tablename__ = 'journal_posts'
    __table_args__ = (UniqueConstraint('tenant_id', 'slug', name='uq_journal_tenant_slug'),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey('tenants.id', ondelete='CASCADE'), index=True)
    slug: Mapped[str] = mapped_column(String(300), nullable=False)
    featured_image: Mapped[Optional[str]] = mapped_column(String(1000))
    category: Mapped[Optional[str]] = mapped_column(String(100))
    author_name: Mapped[Optional[str]] = mapped_column(String(255))
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)

    tenant: Mapped['Tenant'] = relationship('Tenant', back_populates='journal_posts')
    content_items: Mapped[List['JournalPostContent']] = relationship(
        'JournalPostContent', back_populates='post', cascade='all, delete-orphan'
    )


class JournalPostContent(Base):
    """Multilingual content for journal posts."""
    __tablename__ = 'journal_post_content'
    __table_args__ = (UniqueConstraint('post_id', 'locale_code', name='uq_journal_content_locale'),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    post_id: Mapped[str] = mapped_column(String(36), ForeignKey('journal_posts.id', ondelete='CASCADE'), index=True)
    locale_code: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    excerpt: Mapped[Optional[str]] = mapped_column(Text)
    body: Mapped[Optional[str]] = mapped_column(Text)

    post: Mapped['JournalPost'] = relationship('JournalPost', back_populates='content_items')


# ── Locales ───────────────────────────────────────────────────────────────────

class Locale(Base):
    __tablename__ = 'locales'

    code: Mapped[str] = mapped_column(String(20), primary_key=True)  # 'it', 'en-us', 'fr', etc.
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    flag: Mapped[Optional[str]] = mapped_column(String(10))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
