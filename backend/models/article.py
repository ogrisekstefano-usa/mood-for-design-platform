from pydantic import BaseModel
from typing import Optional, List, Any
from enum import Enum


class ArticleStatus(str, Enum):
    draft = 'draft'
    published = 'published'
    archived = 'archived'


class ArticleCreate(BaseModel):
    title: str
    slug: str
    language: str = 'it'
    excerpt: Optional[str] = None
    main_photo_url: Optional[str] = None
    hero_video_url: Optional[str] = None
    content: Optional[List[Any]] = []
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = []


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    excerpt: Optional[str] = None
    main_photo_url: Optional[str] = None
    content: Optional[List[Any]] = None
    status: Optional[ArticleStatus] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    tags: Optional[List[str]] = None
    published_at: Optional[str] = None
