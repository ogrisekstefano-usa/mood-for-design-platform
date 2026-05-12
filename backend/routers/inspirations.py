"""Inspirations — magazine posts + paragraphs (CMS)."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from middleware.auth import get_current_user
from database import db

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.get("")
def list_posts(
    status: str = Query(None),
    language: str = Query(None),
    current_user: dict = Depends(get_current_user),
):
    client = db()
    q = client.table('magazine_posts').select('*').eq('tenant_id', current_user['tenant_id'])
    if status: q = q.eq('status', status)
    if language: q = q.eq('language', language)
    r = q.order('created_at', desc=True).execute()
    return {"data": r.data or []}


@router.get("/{post_id}")
def get_post(post_id: str, current_user: dict = Depends(get_current_user)):
    client = db()
    r = client.table('magazine_posts').select('*').eq('id', post_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not r.data:
        raise HTTPException(404, "Not found")
    post = r.data[0]
    paragraphs = client.table('magazine_paragraphs').select('*').eq('post_id', post_id).order('sort_order').execute()
    post['paragraphs'] = paragraphs.data or []
    return post
