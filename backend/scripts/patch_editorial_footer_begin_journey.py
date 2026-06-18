#!/usr/bin/env python3
"""
patch_editorial_footer_begin_journey.py
════════════════════════════════════════
Aggiunge "Brief di Progetto" → /begin-journey
nella colonna "Contatti" della sezione editorial_footer (home page).

STRUTTURA TARGET:
  locale_content.it.cols[2] (heading: "Contatti") → aggiunge link dopo /consulenza
  locale_content.en-US.cols → ricostruisce con entry "Project Brief" se mancante

Pubblica la pagina HOME dopo l'aggiornamento (refresh snapshot).
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

from supabase import create_client
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

TENANT_ID   = '848354b9-a43e-4147-bdad-116fb93bd585'
SECTION_ID  = 'd839a470-c9ce-449d-bd5d-4e8a5a0e30db'  # editorial_footer

BRIEF_LINK_IT = {
    'href': '/begin-journey',
    'label': 'Brief di Progetto',
}
BRIEF_LINK_EN = {
    'href': '/begin-journey',
    'label': 'Project Brief',
}

# ── 1. Leggi la sezione ────────────────────────────────────────────────────────
sec_res = sb.table('cms_sections').select('id,locale_content').eq('id', SECTION_ID).single().execute()
lc = sec_res.data['locale_content']
print(f"[OK] Sezione letta: {SECTION_ID}")

# ── 2. Patcha locale IT ────────────────────────────────────────────────────────
it_cols = lc.get('it', {}).get('cols', [])
patched_it = False

for col in it_cols:
    heading = col.get('heading', '')
    if heading in ('Contatti', 'Contact'):
        existing_hrefs = [lnk.get('href') for lnk in col.get('links', [])]
        if BRIEF_LINK_IT['href'] in existing_hrefs:
            print(f"[INFO-IT] Link '/begin-journey' già presente. Nessuna modifica.")
            patched_it = True
        else:
            # Inserisce dopo /consulenza se presente, altrimenti alla fine
            try:
                cons_idx = next(i for i,l in enumerate(col['links']) if l.get('href') == '/consulenza')
                col['links'].insert(cons_idx + 1, BRIEF_LINK_IT)
            except StopIteration:
                col['links'].append(BRIEF_LINK_IT)
            patched_it = True
            print(f"[OK-IT] Link 'Brief di Progetto' → /begin-journey aggiunto a colonna '{heading}'")
        break

if not patched_it:
    # Nessuna colonna "Contatti" trovata → aggiunge una nuova
    print("[WARN-IT] Colonna 'Contatti' non trovata. Aggiunta nuova colonna.")
    it_cols.append({
        'heading': 'Contatti',
        'links': [
            {'href': '/consulenza', 'label': 'Prenota una consulenza'},
            BRIEF_LINK_IT,
        ],
    })
    if 'it' not in lc:
        lc['it'] = {}
    lc['it']['cols'] = it_cols

# ── 3. Patcha locale EN-US ─────────────────────────────────────────────────────
en_cols = lc.get('en-US', {}).get('cols', [])
patched_en = False

for col in en_cols:
    heading = col.get('heading', '') or col.get('title', '')
    if heading.lower() in ('contact', 'contacts', 'contatti'):
        existing_hrefs = [lnk.get('href') for lnk in col.get('links', [])]
        if BRIEF_LINK_EN['href'] in existing_hrefs:
            print(f"[INFO-EN] Link '/begin-journey' già presente. Nessuna modifica.")
            patched_en = True
        else:
            try:
                cons_idx = next(i for i,l in enumerate(col['links']) if l.get('href') == '/consulenza')
                col['links'].insert(cons_idx + 1, BRIEF_LINK_EN)
            except StopIteration:
                col['links'].append(BRIEF_LINK_EN)
            patched_en = True
            print(f"[OK-EN] Link 'Project Brief' → /begin-journey aggiunto a colonna EN '{heading}'")
        break

if not patched_en:
    # EN non ha colonna Contatti
    print("[INFO-EN] Nessuna colonna Contact in EN-US. Aggiungo link in EN base.")
    en_base = lc.get('en', {})
    en_cols_base = en_base.get('cols', [])
    bj_in_en = any(lnk.get('href') == '/begin-journey' for col in en_cols_base for lnk in col.get('links', []))
    if not bj_in_en:
        en_cols_base.append({
            'heading': 'Contact',
            'links': [
                {'href': '/consulenza', 'label': 'Book a consultation'},
                BRIEF_LINK_EN,
            ],
        })
        if 'en' not in lc:
            lc['en'] = {}
        lc['en']['cols'] = en_cols_base
        print("[OK-EN] Colonna 'Contact' creata in locale 'en'.")

# ── 4. Aggiorna la sezione nel DB ──────────────────────────────────────────────
upd = sb.table('cms_sections').update({'locale_content': lc}).eq('id', SECTION_ID).execute()
print(f"[OK] Sezione aggiornata. Righe: {len(upd.data)}")

# ── 5. Pubblica la pagina HOME (aggiorna snapshot) ─────────────────────────────
from core.storefront_revisions import publish_page as core_publish
result = core_publish(
    tenant_id=TENANT_ID,
    page_key='home',
    profile_id=None,
    label='patch-editorial-footer-add-begin-journey',
)
print(f"[OK] Pagina HOME pubblicata. rev_id={result['revision_id']}")

# ── 6. Verifica snapshot ───────────────────────────────────────────────────────
rev = sb.table('cms_page_revisions').select('snapshot').eq('id', result['revision_id']).single().execute()
snap = rev.data['snapshot']
found = False
for s in snap.get('sections', []):
    if s.get('section_type') == 'editorial_footer':
        lc_snap = s.get('locale_content', {})
        for col in lc_snap.get('it', {}).get('cols', []):
            for lnk in col.get('links', []):
                if lnk.get('href') == '/begin-journey':
                    found = True
                    print(f"[VERIFICA OK] Snapshot IT: col='{col.get('heading')}' href='/begin-journey' label='{lnk.get('label')}'")
if not found:
    print("[WARN] /begin-journey NON trovato nello snapshot IT — verificare.")

print("\n✅ DONE — editorial_footer aggiornato + home page pubblicata.")
