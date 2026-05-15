"""
End-to-end smoke test for Session I — Journal + Media + AI + CMS workflow.
Designed to run against the live backend via REACT_APP_BACKEND_URL.
"""
import os
import io
import sys
import json
import time
from pathlib import Path
import requests
from PIL import Image

BASE = os.environ.get('API_BASE')
if not BASE:
    env_path = Path('/app/frontend/.env')
    for line in env_path.read_text().splitlines():
        if line.startswith('REACT_APP_BACKEND_URL='):
            BASE = line.split('=', 1)[1].strip().strip('"')
            break

if not BASE:
    sys.exit("REACT_APP_BACKEND_URL missing")

API = f"{BASE}/api"
print(f"Testing against {API}")
results = []


def check(label, ok, info=''):
    status = '✓' if ok else '✗'
    print(f"  {status} {label}{(' — ' + info) if info else ''}")
    results.append((label, bool(ok), info))


# ── 1) Media upload ─────────────────────────────────────────────────────────
print("\n[1] MEDIA UPLOAD")
img = Image.new('RGB', (1200, 800), color=(0, 201, 179))  # teal
buf = io.BytesIO(); img.save(buf, format='JPEG', quality=80); buf.seek(0)
r = requests.post(
    f"{API}/media/upload",
    files={'file': ('teal-hero.jpg', buf.getvalue(), 'image/jpeg')},
    data={
        'bucket': 'cms-assets',
        'folder_path': '/journal/test',
        'alt_text': json.dumps({'en-us': 'Teal hero test image', 'it': 'Immagine teal di test'}),
        'caption': json.dumps({'en-us': 'Generated for smoke test'}),
        'tags': 'test,smoke,teal',
        'photographer': 'MOOD Studio',
    },
    timeout=30,
)
check('upload image (jpeg)', r.status_code == 200, f"{r.status_code} {r.text[:120]}")
asset = r.json()
asset_id = asset['id']
check('public_url present', asset.get('public_url', '').startswith('http'))
check('dimensions extracted', asset.get('width') == 1200 and asset.get('height') == 800)
check('dominant_color extracted', bool(asset.get('dominant_color')))

# Patch metadata
r = requests.patch(
    f"{API}/media/assets/{asset_id}",
    json={'tags': ['hero', 'editorial', 'teal'], 'caption': {'en-us': 'Updated caption'}},
    timeout=10,
)
check('patch metadata', r.status_code == 200, f"{r.status_code}")

# Hotspots
r = requests.post(
    f"{API}/media/assets/{asset_id}/hotspots",
    json={'hotspots': [
        {'x': 25.5, 'y': 40.0, 'label': {'en-us': 'Sofa', 'it': 'Divano'},
         'url': 'https://example.com/sofa', 'open_blank': True},
        {'x': 70.0, 'y': 60.0, 'label': {'en-us': 'Lamp'}, 'url': 'https://example.com/lamp'},
    ]},
    timeout=10,
)
check('set hotspots (2)', r.status_code == 200 and r.json().get('count') == 2)

# List
r = requests.get(f"{API}/media/assets?limit=10", timeout=10)
check('list assets', r.status_code == 200 and r.json().get('total') >= 1)


# ── 2) Categories + Tags ────────────────────────────────────────────────────
print("\n[2] JOURNAL TAXONOMY")
r = requests.post(f"{API}/journal/admin/categories", json={
    'slug': 'design-thinking',
    'locale_meta': {
        'en-us': {'name': 'Design Thinking', 'description': 'Ideas reshaping interiors'},
        'it':    {'name': 'Pensiero del Design', 'description': 'Idee che ridefiniscono gli interni'},
    },
    'sort_order': 1,
}, timeout=10)
check('upsert category', r.status_code == 200, f"{r.status_code} {r.text[:80]}")
cat = r.json()

r = requests.post(f"{API}/journal/admin/tags", json={
    'slug': 'travertine', 'tag_group': 'material',
    'locale_meta': {'en-us': {'label': 'Travertine'}, 'it': {'label': 'Travertino'}},
}, timeout=10)
check('upsert tag travertine', r.status_code == 200)

r = requests.get(f"{API}/journal/categories?locale=it", timeout=10)
check('public categories (it)', r.status_code == 200 and any(c['name'] == 'Pensiero del Design' for c in r.json()['items']))


# ── 3) Article create → block → publish → public ───────────────────────────
print("\n[3] JOURNAL ARTICLE WORKFLOW")
import secrets
suffix = secrets.token_hex(3)
r = requests.post(f"{API}/journal/admin/articles", json={
    'article_type': 'editorial',
    'canonical_locale': 'en-us',
    'localizations': [
        {'locale_code': 'en-us', 'slug': f'language-of-luxury-test-{suffix}',
         'title': 'The New Language of Luxury Interiors',
         'excerpt': 'How restraint is replacing ostentation in contemporary design.'},
        {'locale_code': 'it', 'slug': f'linguaggio-del-lusso-test-{suffix}',
         'title': 'Il nuovo linguaggio degli interni di lusso',
         'excerpt': 'Come la moderazione sta sostituendo l\'ostentazione nel design contemporaneo.'},
    ],
    'hero_asset_id': asset_id,
    'author_display_name': 'Marco Ricci',
}, timeout=20)
check('create article', r.status_code == 200, f"{r.status_code} {r.text[:160]}")
article = r.json()
article_id = article['id']
check('article has 2 localizations', len(article.get('localizations', [])) == 2)

# Add 3 blocks
block_payloads = [
    {'block_type': 'hero_cinematic', 'sort_order': 0,
     'locale_content': {'en-us': {'overline': 'Editorial'},
                        'it': {'overline': 'Editoriale'}},
     'settings': {'overlay': 'dark', 'asset_ref': asset_id},
     'asset_refs': [asset_id]},
    {'block_type': 'paragraph', 'sort_order': 1,
     'locale_content': {'en-us': {'body': 'Luxury today whispers. Tomorrow it might fall silent.'},
                        'it': {'body': 'Il lusso oggi sussurra. Domani potrebbe tacere del tutto.'}}},
    {'block_type': 'quote', 'sort_order': 2,
     'locale_content': {'en-us': {'quote': 'Restraint is the highest form of expression.', 'attribution': 'Marco Ricci'},
                        'it': {'quote': 'La moderazione è la forma più alta di espressione.', 'attribution': 'Marco Ricci'}}},
]
for bp in block_payloads:
    rb = requests.post(f"{API}/journal/admin/articles/{article_id}/blocks", json=bp, timeout=10)
    check(f"add block {bp['block_type']}", rb.status_code == 200)

# Autosave draft
r = requests.patch(f"{API}/journal/admin/articles/{article_id}/draft",
                    json={'draft_json': {'editor_state': 'wip', 'lastSeen': time.time()}},
                    timeout=10)
check('autosave draft', r.status_code == 200)

# Reorder blocks
art = requests.get(f"{API}/journal/admin/articles/{article_id}", timeout=10).json()
block_ids = [b['id'] for b in art['blocks']]
rev = list(reversed(block_ids))
r = requests.post(f"{API}/journal/admin/articles/{article_id}/blocks/reorder",
                    json={'order': rev}, timeout=10)
check('reorder blocks', r.status_code == 200)

# Publish
r = requests.post(f"{API}/journal/admin/articles/{article_id}/publish", timeout=15)
check('publish article', r.status_code == 200 and r.json().get('status') == 'published')

# Public read (it locale)
r = requests.get(f"{API}/journal/articles/linguaggio-del-lusso-test-{suffix}?locale=it", timeout=10)
check('public read (it slug)', r.status_code == 200 and 'lusso' in (r.json().get('title') or '').lower())

# Public read (en-us by slug)
r = requests.get(f"{API}/journal/articles/language-of-luxury-test-{suffix}?locale=en-us", timeout=10)
check('public read (en-us slug)', r.status_code == 200 and len(r.json().get('blocks', [])) == 3)

# Public list
r = requests.get(f"{API}/journal/articles?locale=it&limit=10", timeout=10)
check('public articles list (it)', r.status_code == 200 and r.json()['items'][0]['title'].startswith('Il nuovo'))

# Revisions
r = requests.get(f"{API}/journal/admin/articles/{article_id}/revisions", timeout=10)
check('revisions trail recorded', r.status_code == 200 and len(r.json()['items']) >= 3)

# Revert draft (only clears draft_json)
r = requests.post(f"{API}/journal/admin/articles/{article_id}/revert", timeout=10)
check('revert draft', r.status_code == 200)


# ── 4) CMS admin: page autosave + publish ──────────────────────────────────
print("\n[4] CMS ADMIN — pages")
pages = requests.get(f"{API}/cms/pages", timeout=10).json()['items']
home = next(p for p in pages if p['page_key'] == 'home')

r = requests.patch(f"{API}/cms/pages/{home['id']}/draft",
                    json={'draft_json': {'wip': True, 'ts': time.time()}},
                    timeout=10)
check('autosave page draft', r.status_code == 200)

r = requests.post(f"{API}/cms/pages/{home['id']}/publish", timeout=10)
check('publish page (rebuilds published_json + invalidates cache)', r.status_code == 200)

# Public render unchanged (still works)
r = requests.get(f"{API}/corporate/pages/home?locale=it", timeout=10)
check('post-publish public render OK', r.status_code == 200 and len(r.json()['sections']) >= 6)


# ── 5) AI Editorial Assistant ──────────────────────────────────────────────
print("\n[5] AI EDITORIAL (Claude Sonnet 4.5)")
r = requests.post(f"{API}/ai/editorial/topics", json={
    'angle': 'how Italian travertine returned to luxury interiors',
    'locale': 'en-us', 'count': 3,
}, timeout=60)
ok = r.status_code == 200 and r.json().get('ok') and r.json().get('json') is not None
check('AI topics', ok, f"http {r.status_code}, has_json={bool(r.json().get('json'))}, latency_ms={r.json().get('latency_ms')}")
if ok:
    print('   sample:', json.dumps(r.json()['json'])[:200])

r = requests.post(f"{API}/ai/editorial/seo", json={
    'title': 'The Quiet Return of Travertine',
    'locale': 'en-us',
    'keywords': ['travertine', 'interior design', 'italian materials'],
}, timeout=60)
check('AI seo', r.status_code == 200 and r.json().get('ok'))

r = requests.post(f"{API}/ai/editorial/translate", json={
    'source_text': 'Restraint is the new luxury.',
    'source_locale': 'en-us', 'target_locale': 'it',
}, timeout=60)
ok = r.status_code == 200 and r.json().get('ok')
check('AI translate en→it', ok, (r.json().get('json') or {}).get('translated', '')[:60])


# ── 6) Cleanup not strictly required for smoke (deterministic test data) ───
print("\n[6] CLEANUP")
r = requests.delete(f"{API}/media/assets/{asset_id}", timeout=10)
check('soft delete asset', r.status_code == 200)


# ── Summary ────────────────────────────────────────────────────────────────
print(f"\n{'='*60}")
passed = sum(1 for _, ok, _ in results if ok)
total = len(results)
print(f"PASSED: {passed}/{total}")
failed = [(n, info) for n, ok, info in results if not ok]
if failed:
    print("FAILED:")
    for n, info in failed:
        print(f"  - {n}: {info}")
    sys.exit(1)
print("ALL GREEN")
