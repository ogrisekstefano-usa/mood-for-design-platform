import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from models.article import ArticleCreate, ArticleUpdate
from middleware.auth import get_current_user
from database import get_db, db_available

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.get("")
def list_articles(
    status: str = Query(None),
    language: str = Query(None),
    current_user: dict = Depends(get_current_user)
):
    if not db_available():
        return {"data": [], "total": 0}
    db = get_db()
    q = db.table('articles').select('id,title,slug,status,language,main_photo_url,excerpt,category,tags,published_at,created_at')
    q = q.eq('tenant_id', current_user['tenant_id'])
    if status:
        q = q.eq('status', status)
    if language:
        q = q.eq('language', language)
    result = q.order('created_at', desc=True).execute()
    return {"data": result.data, "total": len(result.data)}


@router.post("", status_code=201)
def create_article(body: ArticleCreate, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    db = get_db()
    now = _now()
    article = {
        'id': str(uuid.uuid4()),
        'tenant_id': current_user['tenant_id'],
        'status': 'draft',
        'created_by': current_user['sub'],
        **body.model_dump(exclude_none=True),
        'created_at': now,
        'updated_at': now,
    }
    result = db.table('articles').insert(article).execute()
    return result.data[0] if result.data else article


@router.get("/{article_id}")
def get_article(article_id: str, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    db = get_db()
    result = db.table('articles').select('*').eq('id', article_id).execute()
    if not result.data:
        raise HTTPException(404, "Article not found")
    return result.data[0]


@router.put("/{article_id}")
def update_article(article_id: str, body: ArticleUpdate, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    db = get_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates['updated_at'] = _now()
    result = db.table('articles').update(updates).eq('id', article_id).eq('tenant_id', current_user['tenant_id']).execute()
    if not result.data:
        raise HTTPException(404, "Article not found")
    return result.data[0]


@router.delete("/{article_id}")
def delete_article(article_id: str, current_user: dict = Depends(get_current_user)):
    if not db_available():
        raise HTTPException(503, "Database not configured")
    db = get_db()
    db.table('articles').delete().eq('id', article_id).eq('tenant_id', current_user['tenant_id']).execute()
    return {"message": "Article deleted"}
