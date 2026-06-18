#!/usr/bin/env python3
"""
patch_footer_begin_journey.py
═════════════════════════════
Aggiunge il link "Brief di Progetto" → /begin-journey
alla colonna "Contenuti" del footer CMS per il tenant 'studio'.

STRATEGIA:
  - Legge la sezione footer esistente dalla tabella cms_sections
  - Aggiunge il link nella colonna col_contenuti se non già presente
  - Salva la sezione aggiornata
  - Pubblica la pagina footer (refresh snapshot)

Label:
  IT:      "Brief di Progetto"
  EN:      "Project Brief"
  Href:    /begin-journey
"""
import os, sys, json
sys.path.insert(0, '/app/backend')

env_path = '/app/backend/.env'
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = (os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or
                os.environ.get('SUPABASE_SERVICE_KEY') or '')

if not SUPABASE_URL or not SUPABASE_KEY:
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line.startswith('SUPABASE_URL=') and not SUPABASE_URL:
                SUPABASE_URL = line.split('=', 1)[1].strip()
            elif line.startswith('SUPABASE_SERVICE_ROLE_KEY=') and not SUPABASE_KEY:
                SUPABASE_KEY = line.split('=', 1)[1].strip()
            elif line.startswith('SUPABASE_SERVICE_KEY=') and not SUPABASE_KEY:
                SUPABASE_KEY = line.split('=', 1)[1].strip()
            elif line.startswith('SUPABASE_KEY=') and not SUPABASE_KEY:
                SUPABASE_KEY = line.split('=', 1)[1].strip()

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERRORE: SUPABASE_URL o SUPABASE_KEY non trovati.")
    sys.exit(1)

from supabase import create_client
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

TENANT_ID = '848354b9-a43e-4147-bdad-116fb93bd585'

NEW_LINK = {
    'id':   'fn_brief',
    'href': '/begin-journey',
    'label': {
        'it':       'Brief di Progetto',
        'en':       'Project Brief',
        '_default': 'Project Brief',
    },
}

# ── 1. Recupera page_id footer ────────────────────────────────────────────────
page_res = sb.table('cms_pages').select('id').eq('tenant_id', TENANT_ID).eq('page_key', 'footer').single().execute()
PAGE_ID = page_res.data['id']
print(f"[OK] Footer page ID: {PAGE_ID}")

# ── 2. Recupera la sezione footer esistente ───────────────────────────────────
sec_res = sb.table('cms_sections').select('id,settings').eq('page_id', PAGE_ID).eq('tenant_id', TENANT_ID).eq('section_type', 'footer').limit(1).execute()

if not sec_res.data:
    print("ERRORE: Nessuna sezione footer trovata. Eseguire prima seed_footer_premium.py")
    sys.exit(1)

section = sec_res.data[0]
SECTION_ID = section['id']
settings = section['settings']
print(f"[OK] Sezione footer ID: {SECTION_ID}")

# ── 3. Trova la colonna 'col_contenuti' e aggiungi il link ───────────────────
nav_cols = settings.get('nav_cols', [])
patched = False

for col in nav_cols:
    if col.get('id') == 'col_contenuti':
        # Verifica se il link è già presente (idempotenza)
        existing_hrefs = [lnk.get('href') for lnk in col.get('links', [])]
        if NEW_LINK['href'] in existing_hrefs:
            print(f"[INFO] Link '{NEW_LINK['href']}' già presente in col_contenuti. Nessuna modifica necessaria.")
            patched = True
            break
        # Aggiunge dopo il link a /consulenza
        col['links'].append(NEW_LINK)
        patched = True
        print(f"[OK] Link 'Brief di Progetto' → /begin-journey aggiunto a col_contenuti")
        break

if not patched:
    # col_contenuti non trovata → crea una colonna nuova
    print("[WARN] col_contenuti non trovata. Creo una nuova colonna 'Inizia'.")
    nav_cols.append({
        'id':      'col_inizia',
        'heading': {'it': 'Inizia', 'en': 'Start', '_default': 'Start'},
        'links': [NEW_LINK],
    })
    settings['nav_cols'] = nav_cols

# ── 4. Aggiorna la sezione nel DB ──────────────────────────────────────────────
upd_res = sb.table('cms_sections').update({'settings': settings}).eq('id', SECTION_ID).eq('tenant_id', TENANT_ID).execute()
print(f"[OK] Sezione aggiornata. Righe modificate: {len(upd_res.data)}")

# ── 5. Pubblica la pagina footer (aggiorna lo snapshot) ───────────────────────
from core.storefront_revisions import publish_page as core_publish
result = core_publish(
    tenant_id=TENANT_ID,
    page_key='footer',
    profile_id=None,
    label='patch-footer-add-begin-journey-link',
)
print(f"[OK] Footer pubblicato. rev_id={result['revision_id']}")

# ── 6. Verifica snapshot ──────────────────────────────────────────────────────
rev_res = sb.table('cms_page_revisions').select('id,snapshot_json').eq('id', result['revision_id']).single().execute()
snap = rev_res.data.get('snapshot_json', {})
found_link = False
for col in snap.get('settings', {}).get('nav_cols', []):
    for lnk in col.get('links', []):
        if lnk.get('href') == '/begin-journey':
            found_link = True
            print(f"[VERIFICA OK] Link trovato nello snapshot: col='{col['id']}' → href='{lnk['href']}' label_it='{lnk['label'].get('it')}'")

if not found_link:
    print("[WARN] Link /begin-journey NON trovato nello snapshot — verificare manualmente.")

print("\n✅ DONE — Footer aggiornato e snapshot pubblicato.")
print(f"   Tenants: {TENANT_ID}")
print(f"   Sezione: {SECTION_ID}")
print(f"   Revisione: {result['revision_id']}")
