"""
AI Editorial Assistant API — Claude Sonnet 4.5 (provider-abstracted).
Routes are admin-gated. All calls logged in ai_assist_logs.
"""
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from services.ai_editorial import EditorialAI, EDITORIAL_STRATEGIST, PHOTO_DIRECTOR
from routers._auth import require_admin_tenant

router = APIRouter(prefix='/ai/editorial', tags=['ai-editorial'])


def _ai(system: str = EDITORIAL_STRATEGIST) -> EditorialAI:
    return EditorialAI(system_message=system)


# ── Request models ───────────────────────────────────────────────────────────

class TopicsRequest(BaseModel):
    angle: str
    locale: str = 'en-us'
    count: int = 5
    audience: str = 'interior designers and luxury brand directors'


class OutlineRequest(BaseModel):
    topic: str
    locale: str = 'en-us'
    article_type: str = 'editorial'
    target_length_words: int = 1200


class SEORequest(BaseModel):
    title: str
    excerpt: Optional[str] = None
    locale: str = 'en-us'
    keywords: Optional[list[str]] = None


class ExcerptRequest(BaseModel):
    title: str
    body_or_outline: str
    locale: str = 'en-us'
    max_chars: int = 220


class CopyRequest(BaseModel):
    section_brief: str
    locale: str = 'en-us'
    tone: str = 'editorial-luxury'
    word_target: int = 250


class TranslateRequest(BaseModel):
    source_text: str
    source_locale: str
    target_locale: str
    register: str = 'editorial'
    preserve_terms: Optional[list[str]] = None


class CategorizeRequest(BaseModel):
    title: str
    body: str
    locale: str = 'en-us'
    known_categories: Optional[list[str]] = None


class PhotoDirectionRequest(BaseModel):
    subject: str
    mood: Optional[str] = 'editorial-luxury'
    locale: str = 'en-us'


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post('/topics')
async def suggest_topics(body: TopicsRequest, tenant=Depends(require_admin_tenant)):
    prompt = (
        f"Suggest {body.count} editorial article topics on this angle:\n"
        f"ANGLE: {body.angle}\n"
        f"LOCALE: {body.locale}\nAUDIENCE: {body.audience}\n"
        "Return strict JSON: {\"topics\":[{\"title\":\"\",\"angle\":\"\",\"why_now\":\"\"}]}"
    )
    return await _ai().ask(prompt, action='topics', tenant_id=tenant['id'],
                            locale=body.locale, expect_json=True)


@router.post('/outline')
async def generate_outline(body: OutlineRequest, tenant=Depends(require_admin_tenant)):
    prompt = (
        f"Build an editorial outline.\nTOPIC: {body.topic}\nTYPE: {body.article_type}\n"
        f"LOCALE: {body.locale}\nTARGET: {body.target_length_words} words.\n"
        "Return strict JSON: {\"hook\":\"\",\"sections\":[{\"heading\":\"\",\"summary\":\"\",\"target_words\":0}],\"closing\":\"\"}"
    )
    return await _ai().ask(prompt, action='outline', tenant_id=tenant['id'],
                            locale=body.locale, expect_json=True)


@router.post('/seo')
async def generate_seo(body: SEORequest, tenant=Depends(require_admin_tenant)):
    prompt = (
        f"Compose SEO assets for an editorial piece (locale {body.locale}).\n"
        f"TITLE: {body.title}\nEXCERPT: {body.excerpt or ''}\n"
        f"KEYWORDS: {', '.join(body.keywords or [])}\n"
        "Return strict JSON: {\"seo_title\":\"<=60 chars\",\"seo_description\":\"<=160 chars\",\"og_title\":\"\",\"og_description\":\"\",\"keywords\":[]}"
    )
    return await _ai().ask(prompt, action='seo', tenant_id=tenant['id'],
                            locale=body.locale, expect_json=True)


@router.post('/excerpt')
async def generate_excerpt(body: ExcerptRequest, tenant=Depends(require_admin_tenant)):
    prompt = (
        f"Write a single editorial excerpt under {body.max_chars} characters.\n"
        f"LOCALE: {body.locale}\nTITLE: {body.title}\nSOURCE:\n{body.body_or_outline}\n"
        "Return strict JSON: {\"excerpt\":\"...\"}"
    )
    return await _ai().ask(prompt, action='excerpt', tenant_id=tenant['id'],
                            locale=body.locale, expect_json=True)


@router.post('/copy')
async def generate_copy(body: CopyRequest, tenant=Depends(require_admin_tenant)):
    prompt = (
        f"Write editorial body copy (~{body.word_target} words).\n"
        f"TONE: {body.tone}\nLOCALE: {body.locale}\nBRIEF: {body.section_brief}\n"
        "Return strict JSON: {\"copy\":\"...\"} — copy may contain line breaks."
    )
    return await _ai().ask(prompt, action='copy', tenant_id=tenant['id'],
                            locale=body.locale, expect_json=True)


@router.post('/translate')
async def translate(body: TranslateRequest, tenant=Depends(require_admin_tenant)):
    prompt = (
        f"Translate from {body.source_locale} to {body.target_locale} with cultural adaptation. "
        f"Register: {body.register}. Preserve as-is: {', '.join(body.preserve_terms or [])}.\n"
        f"SOURCE:\n{body.source_text}\n"
        "Return strict JSON: {\"translated\":\"...\",\"notes\":\"brief rationale\"}"
    )
    return await _ai().ask(prompt, action='translate', tenant_id=tenant['id'],
                            locale=body.target_locale, expect_json=True)


@router.post('/categorize')
async def suggest_categories(body: CategorizeRequest, tenant=Depends(require_admin_tenant)):
    prompt = (
        f"Suggest 2-4 categories and 4-8 tags for this piece (locale {body.locale}).\n"
        f"TITLE: {body.title}\nBODY:\n{body.body}\n"
        f"KNOWN CATEGORIES: {', '.join(body.known_categories or [])}\n"
        "Return strict JSON: {\"categories\":[{\"slug\":\"\",\"label\":\"\"}],\"tags\":[{\"slug\":\"\",\"label\":\"\",\"group\":\"material|style|designer|country|year|other\"}]}"
    )
    return await _ai().ask(prompt, action='categorize', tenant_id=tenant['id'],
                            locale=body.locale, expect_json=True)


@router.post('/photo-direction')
async def photo_direction(body: PhotoDirectionRequest, tenant=Depends(require_admin_tenant)):
    prompt = (
        f"Direct a photographer for an interior design editorial.\n"
        f"SUBJECT: {body.subject}\nMOOD: {body.mood}\nLOCALE: {body.locale}\n"
        "Return strict JSON: {\"lighting\":\"\",\"lens_feel\":\"\",\"framing\":\"\","
        "\"palette\":[],\"styling\":\"\",\"architecture_refs\":[],\"luxury_refs\":[],\"sample_prompt\":\"\"}"
    )
    return await _ai(PHOTO_DIRECTOR).ask(prompt, action='photo_direction',
                                           tenant_id=tenant['id'], locale=body.locale,
                                           expect_json=True)
