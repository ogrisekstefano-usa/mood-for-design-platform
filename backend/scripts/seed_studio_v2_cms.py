"""
Seed CMS copy for Studio Activation Flow V2.
─────────────────────────────────────────────────────────────────────
Populates editorial_blocks (+ editorial_block_translations) under:
  • studio_v2.archetype.<code>.{label,description}
  • studio_v2.help.<code>.label
  • studio_v2.country.<ISO>.label
  • studio_v2.ui.<key>

Locales seeded: it-IT (source) + en-US (translation).
"""
import asyncio, os, sys, uuid
sys.path.insert(0, '/app/backend')
from sqlalchemy import text
from database import AsyncSessionLocal
from tenant_resolver import get_corporate_tenant

# ─── COPY ────────────────────────────────────────────────────────────
ARCHETYPES = {
    'interior_design': {
        'it-IT': ("Studio Interior Design",  "Studi che progettano spazi residenziali e commerciali."),
        'en-US': ("Interior Design Studio",  "Studios designing residential and commercial spaces."),
    },
    'architecture': {
        'it-IT': ("Studio Architettura",     "Studi di architettura, integrati al progetto interno."),
        'en-US': ("Architecture Studio",     "Architecture practices, integrated with interior design."),
    },
    'showroom': {
        'it-IT': ("Showroom",                "Spazi espositivi dedicati a brand di design e arredo."),
        'en-US': ("Showroom",                "Exhibition spaces dedicated to design and furniture brands."),
    },
    'retailer': {
        'it-IT': ("Retailer",                "Punti vendita specializzati in arredo e design."),
        'en-US': ("Retailer",                "Specialised retail points for design and furniture."),
    },
    'design_build': {
        'it-IT': ("Design & Build",          "Realtà integrate che progettano e realizzano."),
        'en-US': ("Design & Build",          "Integrated firms that design and deliver."),
    },
    'brand': {
        'it-IT': ("Brand",                   "Marchi di design, arredo, materiali, contract."),
        'en-US': ("Brand",                   "Design, furniture, materials and contract brands."),
    },
    'other': {
        'it-IT': ("Altro",                   "Una realtà diversa che vuole esplorare MOOD."),
        'en-US': ("Other",                   "A different practice that wants to explore MOOD."),
    },
}

HELP_TOPICS = {
    'process_design':      {'it-IT': "Organizzare il processo di progettazione",
                            'en-US': "Organise the design process"},
    'materials':           {'it-IT': "Gestire materiali e fornitori",
                            'en-US': "Manage materials and suppliers"},
    'client_presentation': {'it-IT': "Presentare progetti ai clienti",
                            'en-US': "Present projects to clients"},
    'team_coordination':   {'it-IT': "Coordinare il team",
                            'en-US': "Coordinate the team"},
    'business_growth':     {'it-IT': "Sviluppare nuove opportunità commerciali",
                            'en-US': "Develop new business opportunities"},
    'other':               {'it-IT': "Altro",
                            'en-US': "Other"},
}

# ISO countries shown in Step 2 — derived from markets.countries[]
COUNTRIES = {
    'IT': ("Italia",              "Italy"),
    'SM': ("San Marino",          "San Marino"),
    'VA': ("Città del Vaticano",  "Vatican City"),
    'DE': ("Germania",            "Germany"),
    'AT': ("Austria",             "Austria"),
    'CH': ("Svizzera",            "Switzerland"),
    'LI': ("Liechtenstein",       "Liechtenstein"),
    'FR': ("Francia",             "France"),
    'BE': ("Belgio",              "Belgium"),
    'LU': ("Lussemburgo",         "Luxembourg"),
    'MC': ("Principato di Monaco","Monaco"),
    'GB': ("Regno Unito",         "United Kingdom"),
    'IE': ("Irlanda",             "Ireland"),
    'ES': ("Spagna",              "Spain"),
    'PT': ("Portogallo",          "Portugal"),
    'AD': ("Andorra",             "Andorra"),
    'US': ("Stati Uniti",         "United States"),
    'MX': ("Messico",             "Mexico"),
    'BR': ("Brasile",             "Brazil"),
    'AR': ("Argentina",           "Argentina"),
    'CL': ("Cile",                "Chile"),
    'CO': ("Colombia",            "Colombia"),
    'PE': ("Perù",                "Peru"),
    'UY': ("Uruguay",             "Uruguay"),
    'AE': ("Emirati Arabi Uniti", "United Arab Emirates"),
    'SA': ("Arabia Saudita",      "Saudi Arabia"),
    'QA': ("Qatar",               "Qatar"),
    'KW': ("Kuwait",              "Kuwait"),
    'BH': ("Bahrein",             "Bahrain"),
    'OM': ("Oman",                "Oman"),
    'SE': ("Svezia",              "Sweden"),
    'NO': ("Norvegia",            "Norway"),
    'DK': ("Danimarca",           "Denmark"),
    'FI': ("Finlandia",           "Finland"),
    'IS': ("Islanda",             "Iceland"),
    'GT': ("Guatemala",           "Guatemala"),
    'PA': ("Panama",              "Panama"),
    'CR': ("Costa Rica",          "Costa Rica"),
    'DO': ("Repubblica Dominicana","Dominican Republic"),
    'CU': ("Cuba",                "Cuba"),
    'SV': ("El Salvador",         "El Salvador"),
    'HN': ("Honduras",            "Honduras"),
    'NI': ("Nicaragua",           "Nicaragua"),
    'BZ': ("Belize",              "Belize"),
    'JM': ("Giamaica",            "Jamaica"),
    'TT': ("Trinidad e Tobago",   "Trinidad and Tobago"),
}

UI = {
    'step1.title':        {'it-IT': "Parlaci del tuo studio.",                     'en-US': "Tell us about your studio."},
    'step1.sublead':      {'it-IT': "Una scelta singola.",                          'en-US': "Pick one."},
    'step2.title':        {'it-IT': "Dove lavora principalmente il tuo studio?",   'en-US': "Where does your studio primarily operate?"},
    'step2.country':      {'it-IT': "Paese",                                        'en-US': "Country"},
    'step2.city':         {'it-IT': "Città",                                        'en-US': "City"},
    'step2.more':         {'it-IT': "Operiamo anche in altri mercati",              'en-US': "We also operate in other markets"},
    'step3.title':        {'it-IT': "Chi sarà il referente principale?",            'en-US': "Who will be the main contact?"},
    'step3.first_name':   {'it-IT': "Nome",                                         'en-US': "First name"},
    'step3.last_name':    {'it-IT': "Cognome",                                      'en-US': "Last name"},
    'step3.email':        {'it-IT': "Email professionale",                          'en-US': "Work email"},
    'step3.phone':        {'it-IT': "Telefono",                                     'en-US': "Phone"},
    'step4.title':        {'it-IT': "Come possiamo aiutarti?",                      'en-US': "How can we help?"},
    'step4.sublead':      {'it-IT': "Multi-selezione. Almeno una opzione.",         'en-US': "Multiple choice. At least one."},
    'step5.title':        {'it-IT': "Abbiamo ricevuto la tua candidatura.",         'en-US': "We received your application."},
    'step5.next_steps':   {'it-IT': "Prossimi passi",                               'en-US': "Next steps"},
    'step5.step1':        {'it-IT': "Un MOOD Advisor esaminerà la candidatura.",    'en-US': "A MOOD Advisor will review your application."},
    'step5.step2':        {'it-IT': "Verrai contattato entro 3 giorni lavorativi.", 'en-US': "We'll reach out within 3 working days."},
    'step5.step3':        {'it-IT': "Riceverai una email di conferma al tuo indirizzo.",
                           'en-US': "A confirmation email is on its way to your inbox."},
    'step5.timing':       {'it-IT': "Tempi indicativi: 7–10 giorni dalla candidatura alla configurazione del Blueprint.",
                           'en-US': "Typical timing: 7–10 days from application to Blueprint configuration."},
    'btn.continue':       {'it-IT': "Continua",            'en-US': "Continue"},
    'btn.back':           {'it-IT': "Indietro",            'en-US': "Back"},
    'btn.submit':         {'it-IT': "Invia candidatura",   'en-US': "Submit application"},
    'btn.home':           {'it-IT': "Torna alla home",     'en-US': "Back to home"},
    'email.taken_user':   {'it-IT': "Questa email è già associata a un Blueprint attivo.",
                           'en-US': "This email is already linked to an active Blueprint."},
    'email.taken_advisor':{'it-IT': "Questa email appartiene a un MOOD Advisor.",
                           'en-US': "This email belongs to a MOOD Advisor."},
    'email.taken_pending':{'it-IT': "Una candidatura per questa email è già in revisione.",
                           'en-US': "An application for this email is already under review."},
    'email.invalid':      {'it-IT': "Inserisci un indirizzo email valido.",
                           'en-US': "Please enter a valid email address."},
    'field.required':     {'it-IT': "Campo obbligatorio.",
                           'en-US': "Required field."},
}


# ─── UPSERT helpers ─────────────────────────────────────────────────
async def upsert_block(session, tenant_id, namespace, block_key, source_value):
    """Insert or update the editorial_block, return its id."""
    import hashlib
    src_hash = hashlib.sha256((source_value or '').encode('utf-8')).hexdigest()
    row = (await session.execute(text("""
        INSERT INTO editorial_blocks
          (id, tenant_id, namespace, block_key, source_value, source_hash,
           is_active, scope)
        VALUES (gen_random_uuid(), :t, :ns, :k, :v, :h, TRUE, 'tenant')
        ON CONFLICT (tenant_id, namespace, block_key) DO UPDATE
          SET source_value = EXCLUDED.source_value,
              source_hash  = EXCLUDED.source_hash,
              is_active    = TRUE
        RETURNING id
    """), {"t": tenant_id, "ns": namespace, "k": block_key,
           "v": source_value, "h": src_hash})).mappings().first()
    return row['id']


async def upsert_translation(session, block_id, locale, value):
    await session.execute(text("""
        INSERT INTO editorial_block_translations (id, block_id, locale, value)
        VALUES (gen_random_uuid(), :bid, :loc, :val)
        ON CONFLICT (block_id, locale) DO UPDATE
          SET value = EXCLUDED.value
    """), {"bid": block_id, "loc": locale, "val": value})


async def main():
    tenant = await get_corporate_tenant()
    tid = tenant['id']
    count = 0
    async with AsyncSessionLocal() as s:
        # Archetypes — label + description
        for code, locs in ARCHETYPES.items():
            for field_idx, field in enumerate(['label', 'description']):
                src = locs['it-IT'][field_idx]
                bid = await upsert_block(s, tid, 'studio_v2.archetype',
                                          f"{code}.{field}", src)
                count += 1
                for loc, vals in locs.items():
                    await upsert_translation(s, bid, loc, vals[field_idx])

        # Help topics — label only
        for code, locs in HELP_TOPICS.items():
            bid = await upsert_block(s, tid, 'studio_v2.help',
                                      f"{code}.label", locs['it-IT'])
            count += 1
            for loc, val in locs.items():
                await upsert_translation(s, bid, loc, val)

        # Countries — label
        for iso, (it, en) in COUNTRIES.items():
            bid = await upsert_block(s, tid, 'studio_v2.country',
                                      f"{iso}.label", it)
            count += 1
            await upsert_translation(s, bid, 'it-IT', it)
            await upsert_translation(s, bid, 'en-US', en)

        # UI strings
        for key, locs in UI.items():
            bid = await upsert_block(s, tid, 'studio_v2.ui', key, locs['it-IT'])
            count += 1
            for loc, val in locs.items():
                await upsert_translation(s, bid, loc, val)

        await s.commit()
    print(f"Seeded {count} editorial_blocks for Studio V2.")


if __name__ == '__main__':
    asyncio.run(main())
