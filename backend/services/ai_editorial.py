"""
AI Editorial Assistant — provider-abstracted service.
Default provider: Anthropic Claude Sonnet 4.5 via emergentintegrations.
All calls logged to ai_assist_logs (tokens, latency, cost).
Swap to gpt-5.2 / Gemini by changing AI_DEFAULT_PROVIDER+AI_DEFAULT_MODEL in .env.
"""
import os
import json
import time
import uuid
import logging
from dataclasses import dataclass
from typing import Optional, Any
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import text
from emergentintegrations.llm.chat import LlmChat, UserMessage

from database import AsyncSessionLocal

load_dotenv(Path(__file__).parent.parent / '.env')
logger = logging.getLogger(__name__)


@dataclass
class AILogContext:
    """Groups optional observability fields for an AI call."""
    tenant_id: Optional[str] = None
    user_id: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    locale: Optional[str] = None

EMERGENT_LLM_KEY    = os.environ['EMERGENT_LLM_KEY']
DEFAULT_PROVIDER    = os.environ.get('AI_DEFAULT_PROVIDER', 'anthropic')
DEFAULT_MODEL       = os.environ.get('AI_DEFAULT_MODEL', 'claude-sonnet-4-5-20250929')


# ── Editorial system prompts ──────────────────────────────────────────────────

EDITORIAL_STRATEGIST = """You are the MOOD editorial AI — creative infrastructure for an
international luxury interior-design publication (Kinfolk × Dezeen × Aman Journal level).
You write for sophisticated readers: designers, architects, curators, brand directors.

Core rules:
- Editorial precision. Restraint over ostentation. Specificity over adjectives.
- Cultural awareness: adapt voice per locale (it = colta, en-us = curated, en-uk = considered,
  fr = raffinée, de = präzise, es = elegante).
- Never use generic "luxury" filler. Reference materials, eras, ateliers, geographies.
- Output strict JSON when asked for structured data. No prose preface.
"""

PHOTO_DIRECTOR = """You are a luxury interior photography director.
Reference: Apple editorial × Aman Journal × Kinfolk. Architectural restraint.
Specify lens feel, light direction, palette, framing, post-production mood.
Output strict JSON when asked.
"""


# ── Provider-abstracted client ────────────────────────────────────────────────

class EditorialAI:
    def __init__(
        self,
        system_message: str = EDITORIAL_STRATEGIST,
        provider: str = DEFAULT_PROVIDER,
        model: str = DEFAULT_MODEL,
        session_id: Optional[str] = None,
    ):
        self.provider = provider
        self.model = model
        self.session_id = session_id or f"mood-{uuid.uuid4()}"
        self._system = system_message
        self._chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=self.session_id,
            system_message=system_message,
        ).with_model(provider, model)

    async def ask(
        self,
        prompt: str,
        *,
        action: str = 'copy',
        context: Optional[AILogContext] = None,
        expect_json: bool = False,
    ) -> dict:
        """Send a prompt, persist observability log, return {ok, text, json?}."""
        ctx = context or AILogContext()
        started = time.time()
        success = True
        err_msg = None
        response_text = None
        response_json = None

        try:
            msg = UserMessage(text=prompt)
            response_text = await self._chat.send_message(msg)
            if expect_json:
                response_json = _extract_json(response_text)
        except Exception as e:
            success = False
            err_msg = str(e)
            logger.exception("AI call failed: %s", e)

        latency_ms = int((time.time() - started) * 1000)
        await self._log(
            tenant_id=ctx.tenant_id, user_id=ctx.user_id,
            action=action, prompt=prompt,
            response_text=response_text, response_json=response_json,
            latency_ms=latency_ms,
            entity_type=ctx.entity_type, entity_id=ctx.entity_id,
            locale=ctx.locale, success=success, error_message=err_msg,
        )
        return {
            'ok': success,
            'text': response_text,
            'json': response_json,
            'model': self.model,
            'provider': self.provider,
            'latency_ms': latency_ms,
            'error': err_msg,
        }

    async def _log(self, **fields):
        try:
            async with AsyncSessionLocal() as session:
                await session.execute(
                    text("""
                        INSERT INTO ai_assist_logs (
                          id, tenant_id, user_id, provider, model, action,
                          prompt, response_text, response_json,
                          latency_ms, entity_type, entity_id, locale,
                          success, error_message, created_at
                        ) VALUES (
                          gen_random_uuid(), :tid, :uid, :prov, :mdl, :act,
                          :prm, :rt, CAST(:rj AS jsonb),
                          :lat, :et, :eid, :loc,
                          :ok, :err, NOW()
                        )
                    """),
                    {
                        'tid': fields.get('tenant_id'),
                        'uid': fields.get('user_id'),
                        'prov': self.provider, 'mdl': self.model,
                        'act': fields.get('action'),
                        'prm': (fields.get('prompt') or '')[:8000],
                        'rt':  (fields.get('response_text') or '')[:16000] if fields.get('response_text') else None,
                        'rj':  json.dumps(fields.get('response_json')) if fields.get('response_json') is not None else None,
                        'lat': fields.get('latency_ms'),
                        'et':  fields.get('entity_type'),
                        'eid': fields.get('entity_id'),
                        'loc': fields.get('locale'),
                        'ok':  bool(fields.get('success', True)),
                        'err': fields.get('error_message'),
                    },
                )
                await session.commit()
        except Exception as e:
            logger.warning("ai log persistence failed: %s", e)


def _extract_json(txt: str) -> Optional[Any]:
    """Robust JSON extraction from possibly-fenced LLM output."""
    if not txt:
        return None
    s = txt.strip()
    if s.startswith('```'):
        # strip ```json ... ```
        s = s.strip('`')
        if s.lower().startswith('json'):
            s = s[4:]
        s = s.strip()
    try:
        return json.loads(s)
    except Exception:
        # try to find first { ... }
        try:
            start = s.find('{')
            end = s.rfind('}')
            if start >= 0 and end > start:
                return json.loads(s[start:end+1])
        except Exception:
            pass
    return None
