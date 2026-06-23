"""
seed_site_en_us.py
Esegue il seed EN-US per tutte le pagine pubbliche.
Ordine: home (chirurgico) → audience (completo) → training (completo) → features (completamento)
Idempotente. Run: cd /app/backend && python -m db.seed_site_en_us
"""
import asyncio
from database import AsyncSessionLocal
from sqlalchemy import text
from tenant_resolver import get_corporate_tenant


# ── §B.1 Home — solo il blocco con keyword vietata ──────────────────────────
HOME_SURGICAL: dict[str, str] = {
    # "An editorial platform…" → "An editorial ecosystem…"
    "hero.subtitle_accent": (
        "An editorial ecosystem for the contemporary design project: "
        "a methodology — Design Journey™ — made operational by Blueprint™."
    ),
}


# ── §B.2 Audience ──────────────────────────────────────────────────────────
# Mappa §B.2 sui 12 blocchi esistenti + aggiunge blocchi per profilo
AUDIENCE_EN: dict[str, str] = {
    # Existing 12 blocks
    "hero.eyebrow":     "For those who design the way people live.",
    "hero.title":       "For studios that believe how a project is told matters as much as the project itself.",
    "hero.subtitle":    "Five professional profiles. Five specific pain points. One methodology that speaks to all of them.",
    "hero.cta":         "Find the right configuration for your studio",
    "hero.body":        (
        "Interior designers, architects, furniture retailers, luxury showrooms, "
        "multi-location organizations, and design brands: MOOD was built for the specific "
        "challenges of each."
    ),
    "body.eyebrow":     "Who MOOD is for",
    "body.title":       "Five profiles. One methodology.",
    "body.body":        (
        "MOOD for DESIGN proposes a methodology — Design Journey™ — built for the "
        "contemporary project. Five professional profiles, each with their own specific "
        "workflow and challenges, each with a Blueprint™ configuration designed for them."
    ),
    "intro.body":       (
        "Every practice has its intention. MOOD adapts its flows to your way of working — "
        "not the other way around. Across every profile, one shared thread: "
        "a project that stays legible, preserved, and recognizable."
    ),
    "cta.label":        "Find the right configuration for your studio",
    "seo.title":        "Who MOOD is for — Studios, architects, showrooms, design brands",
    "seo.description":  (
        "Interior designers, architects, furniture retailers, luxury showrooms, "
        "multi-location organizations, brands: see how MOOD speaks to each."
    ),

    # ── Per-profile blocks (new) ────────────────────────────────────────────
    "profile.interior.eyebrow":    "Interior Designers",
    "profile.interior.title":      "For those who cultivate the voice of their practice.",
    "profile.interior.challenges": (
        "Time lost reformatting presentation boards between revisions. "
        "Clients who change direction without memory of why. Materials selected in showrooms, "
        "forgotten halfway through a project. Final presentations that cost three days of "
        "reworking material that already existed. Consulting effort that remains invisible."
    ),
    "profile.interior.outcomes":   (
        "A single editorial narrative that the client reads, remembers, and makes their own. "
        "Revisions cut in half. Curation tracked and recognized. A portfolio that builds "
        "itself, project by project."
    ),
    "profile.interior.how_mood":   (
        "Design Journey™ captures every decision your studio makes — adopted and discarded — "
        "in a continuous editorial narrative. Blueprint™ is the workspace where that narrative "
        "lives. Your studio becomes more recognizable; every project enters automatically "
        "into your studio's editorial archive."
    ),
    "profile.interior.cta":        "Explore Design Journey™",

    "profile.architect.eyebrow":   "Architects",
    "profile.architect.title":     "For those who lead projects from concept to construction.",
    "profile.architect.challenges": (
        "Coherence lost between concept and construction documents. Material specifications "
        "lost in the transition between phases. Documentation fragmented across CAD, BIM, "
        "email, and PDFs of various generations. Project decisions hard to trace during "
        "construction administration. Publications that require months of reworking material "
        "already produced."
    ),
    "profile.architect.outcomes":  (
        "The project remains a continuous document, from brief to delivery. Technical "
        "specifications and editorial motivations speak to each other. Publications take "
        "days, not months. The studio's knowledge becomes transmissible to new collaborators."
    ),
    "profile.architect.how_mood":  (
        "Design Journey™ holds the seven phases of a project in a single editorial memory, "
        "accessible to project leads, junior designers, and external partners. Project "
        "decisions remain legible years later. Blueprint™ makes your design knowledge part "
        "of your studio's archive — not solely the property of the individual who made it."
    ),
    "profile.architect.cta":       "Explore Design Journey™",

    "profile.showroom.eyebrow":    "Furniture Retailers",
    "profile.showroom.title":      "For those who know that selling design begins in a project, not on a showroom floor.",
    "profile.showroom.challenges": (
        "Slow, unsystematic lead qualification. Project follow-up that depends on the "
        "individual salesperson's memory. Client engagement that ends after the first visit. "
        "Showroom experience not tracked. Difficulty converting quote to confirmed order."
    ),
    "profile.showroom.outcomes":   (
        "Leads already qualified at the moment of the showroom visit. Follow-up that is "
        "systematic but editorial — never aggressive. The client continues to live inside "
        "the project between visits. Quote-to-order conversion supported by the continuous "
        "narrative of the project in progress."
    ),
    "profile.showroom.how_mood":   (
        "The furniture retailer enters the client's Design Journey™ at the right moment — "
        "phase 04, Material Exploration. Selections made in the showroom are preserved in "
        "the project memory, cited alongside the showroom's name. The relationship with the "
        "commissioning studio becomes continuous, not episodic."
    ),
    "profile.showroom.cta":        "See how a showroom participates in the Journey™",

    "profile.luxury.eyebrow":      "Luxury Showrooms",
    "profile.luxury.title":        "For those who guide choices — not sell products.",
    "profile.luxury.challenges":   (
        "Managing complex relationships with studios, designers, architects. Material "
        "specifications developed in the showroom but not credited as authorship in the "
        "finished project. Difficulty maintaining project continuity between appointments "
        "spaced over time. Collaboration with designers reliant on individual memory."
    ),
    "profile.luxury.outcomes":     (
        "Your name alongside every specification that entered the project. Long-term "
        "relationships with studios that consult you systematically. Specifications tracked, "
        "rationale preserved, commercial return measurable as the editorial history of "
        "real projects."
    ),
    "profile.luxury.how_mood":     (
        "The showroom enters Design Journey™ as a curation author. Every specified material "
        "carries the showroom's name next to the decision. The relationship with the studio "
        "becomes narrative, not transactional. Blueprint™ makes your contribution part of "
        "the client studio's editorial archive."
    ),
    "profile.luxury.cta":          "See the evolution of the showroom's role",

    "profile.brand.eyebrow":       "Brands · Manufacturers",
    "profile.brand.title":         "For those who design and produce — and want to know how their products enter projects.",
    "profile.brand.challenges":    (
        "The product enters projects without being remembered as a choice. Sell-out data "
        "doesn't tell the story. Sales figures don't reflect the real value of adoption. "
        "The brand's presence in finished projects is invisible."
    ),
    "profile.brand.outcomes":      (
        "Every specified product carries the editorial history of the project it entered. "
        "Brand presence becomes traceable as product authorship, not just revenue. "
        "Direct relationships with the studios that choose your products."
    ),
    "profile.brand.how_mood":      (
        "The brand enters Design Journey™ as a product author. Every specification includes "
        "a product biography — origin, intention, cultural context. Product adoption becomes "
        "measurable as editorial history, not just as a sell-out number."
    ),
    "profile.brand.cta":           "Explore the MOOD brand program",

    "final_cta.title":             "Do you recognize your studio in this page?",
    "final_cta.body":              (
        "The conversation begins by telling us how you work today. "
        "A Blueprint™ configuration is built for you once your way of working has been understood."
    ),
    "final_cta.cta_primary":       "Request a Blueprint™ configuration",
    "final_cta.cta_secondary":     "Explore Design Journey™",
}

# IT translations for audience new blocks (functional placeholders)
AUDIENCE_IT_NEW: dict[str, str] = {
    "profile.interior.eyebrow":    "Interior Designer",
    "profile.interior.title":      "Per chi coltiva la voce del proprio studio.",
    "profile.interior.challenges": (
        "Tempo perso a riformattare tavole di presentazione tra revisioni. "
        "Clienti che cambiano direzione senza memoria del perché. Materiali selezionati "
        "in showroom e dimenticati a metà progetto. Consulenze che restano invisibili."
    ),
    "profile.interior.outcomes":   (
        "Un'unica narrativa editoriale che il cliente legge, ricorda e fa propria. "
        "Revisioni dimezzate. Curation tracciata e riconosciuta."
    ),
    "profile.interior.how_mood":   (
        "Design Journey™ cattura ogni decisione — adottata e scartata — in una narrativa "
        "editoriale continua. Blueprint™ è lo spazio dove quella narrativa vive."
    ),
    "profile.interior.cta":        "Esplora Design Journey™",

    "profile.architect.eyebrow":   "Architetti",
    "profile.architect.title":     "Per chi guida il progetto dal concept alla costruzione.",
    "profile.architect.challenges": (
        "Coerenza persa tra concept e documenti costruttivi. Specifiche materiali "
        "perse nella transizione tra fasi. Documentazione frammentata tra CAD, BIM, email."
    ),
    "profile.architect.outcomes":  (
        "Il progetto rimane un documento continuo, dal brief alla consegna. "
        "Pubblicazioni in giorni, non mesi."
    ),
    "profile.architect.how_mood":  (
        "Design Journey™ tiene le sette fasi di progetto in un'unica memoria editoriale, "
        "accessibile a capoprogetto, junior e partner esterni."
    ),
    "profile.architect.cta":       "Esplora Design Journey™",

    "profile.showroom.eyebrow":    "Retailer del mobile",
    "profile.showroom.title":      "Per chi sa che vendere design inizia in un progetto.",
    "profile.showroom.challenges": (
        "Qualificazione lead lenta e non sistematica. Follow-up che dipende dalla memoria "
        "del singolo venditore. Coinvolgimento del cliente che finisce dopo la prima visita."
    ),
    "profile.showroom.outcomes":   (
        "Lead già qualificati al momento della visita in showroom. Follow-up sistematico "
        "ma editoriale — mai aggressivo."
    ),
    "profile.showroom.how_mood":   (
        "Il retailer entra nel Design Journey™ del cliente al momento giusto — fase 04, "
        "Esplorazione Materiali."
    ),
    "profile.showroom.cta":        "Scopri come uno showroom partecipa al Journey™",

    "profile.luxury.eyebrow":      "Showroom luxury",
    "profile.luxury.title":        "Per chi guida le scelte — non vende prodotti.",
    "profile.luxury.challenges":   (
        "Gestione di relazioni complesse con studi, designer, architetti. Specifiche "
        "materiali sviluppate in showroom ma non accreditate come authorship nel progetto."
    ),
    "profile.luxury.outcomes":     (
        "Il tuo nome accanto a ogni specifica entrata nel progetto. Relazioni a lungo "
        "termine con studi che ti consultano sistematicamente."
    ),
    "profile.luxury.how_mood":     (
        "Lo showroom entra nel Design Journey™ come autore di curation. Ogni materiale "
        "specificato porta il nome dello showroom accanto alla decisione."
    ),
    "profile.luxury.cta":          "Scopri l'evoluzione del ruolo dello showroom",

    "profile.brand.eyebrow":       "Brand · Produttori",
    "profile.brand.title":         "Per chi progetta e produce — e vuole sapere come i suoi prodotti entrano nei progetti.",
    "profile.brand.challenges":    (
        "Il prodotto entra nei progetti senza essere ricordato come scelta. "
        "I dati di sell-out non raccontano la storia."
    ),
    "profile.brand.outcomes":      (
        "Ogni prodotto specificato porta la storia editoriale del progetto in cui è entrato. "
        "La presenza del brand diventa tracciabile come authorship, non solo come fatturato."
    ),
    "profile.brand.how_mood":      (
        "Il brand entra nel Design Journey™ come autore di prodotto. Ogni specifica include "
        "una biografia del prodotto — origine, intenzione, contesto culturale."
    ),
    "profile.brand.cta":           "Esplora il programma MOOD per i brand",

    "final_cta.title":             "Ti riconosci in questa pagina?",
    "final_cta.body":              (
        "La conversazione inizia raccontandoci come lavori oggi. "
        "Una configurazione Blueprint™ viene costruita per te una volta compreso il tuo modo di lavorare."
    ),
    "final_cta.cta_primary":       "Candidati a MOOD",
    "final_cta.cta_secondary":     "Esplora Design Journey™",
}


# ── §B.5 Training ───────────────────────────────────────────────────────────
TRAINING_EN: dict[str, str] = {
    "hero.eyebrow":           "Method transmission",
    "hero.title":             "Learning the editorial craft of the project.",
    "hero.title_line_1":      "Learn.",
    "hero.title_line_2":      "Grow.",
    "hero.title_line_3":      "Practice.",
    "hero.subtitle":          "Programs, tutorials, and live sessions for the language of the contemporary project.",
    "hero.body":              (
        "Resources, guides, and learning programs to unlock the full potential of "
        "Blueprint™ and Design Journey™ in your studio's daily work."
    ),
    "hero.cta_primary":       "Explore learning programs",
    "hero.cta_secondary":     "Watch tutorials",
    "intro.body":             (
        "The infrastructure is the means; the method is the culture. MOOD Academy "
        "transmits the editorial language of the project through learning programs, "
        "tutorials, and live sessions.\n\n"
        "Adopting Design Journey™ is an editorial operation, not an installation. "
        "Academy guides every configured studio through the language of the method, "
        "how to lead the Journey™, and the daily practice of Project Memory™.\n\n"
        "Every Blueprint™ configuration includes access to MOOD Academy."
    ),
    "sections.item_01_eyebrow": "Programs",
    "sections.item_01_title":   "Structured learning, step by step.",
    "sections.item_01_body":    (
        "Structured method transmission programs, divided by profile "
        "(interior designer, architect, showroom). Each program unfolds over "
        "4–8 weeks of guided work."
    ),
    "sections.item_01_cta":     "Explore programs",
    "sections.item_02_eyebrow": "Tutorials",
    "sections.item_02_title":   "Fast, focused answers.",
    "sections.item_02_body":    (
        "Short, targeted videos for those who want fast answers. "
        "Each tutorial is 2–4 minutes long and addresses a single concrete "
        "situation within Design Journey™."
    ),
    "sections.item_02_cta":     "Go to tutorials",
    "sections.item_03_eyebrow": "Guides",
    "sections.item_03_title":   "Complete, current guides.",
    "sections.item_03_body":    (
        "When a tutorial isn't enough, editorial guides offer a deeper view: "
        "method references, project templates, editorial style guides for the "
        "Blueprint™ workspace."
    ),
    "sections.item_03_cta":     "Browse guides",
    "sections.item_04_eyebrow": "Live sessions",
    "sections.item_04_title":   "Live sessions with the MOOD team.",
    "sections.item_04_body":    (
        "Every month we host live sessions with the MOOD team and design industry guests: "
        "practical workshops, conversations on method, open dialogues with studios "
        "that have adopted Blueprint™."
    ),
    "sections.item_04_cta":     "See upcoming events",
    "anchor_percorsi.eyebrow":  "Guided programs",
    "anchor_percorsi.subtitle": "An editorial path — not a manual.",
    "anchor_percorsi.title":    "Learn step by step.",
    "anchor_percorsi.body":     (
        "Every MOOD program is a structured journey through the method. "
        "We begin with the fundamentals of Design Journey™ and build toward "
        "mastery of every phase — from brief to the life of the finished project."
    ),
    "anchor_percorsi.cta":      "Explore programs",
    "anchor_tutorial.eyebrow":  "Fast tutorials",
    "anchor_tutorial.subtitle": "Three minutes to master a feature.",
    "anchor_tutorial.title":    "Fast, practical tutorials.",
    "anchor_tutorial.body":     (
        "Short, targeted videos for those who want fast answers. "
        "Each tutorial covers a single feature in 2–4 minutes."
    ),
    "anchor_tutorial.cta":      "Go to tutorials",
    "anchor_guide.eyebrow":     "Guides",
    "anchor_guide.subtitle":    "The depth for those who seek mastery.",
    "anchor_guide.title":       "Complete, current guides.",
    "anchor_guide.body":        (
        "When a tutorial isn't enough, editorial guides offer a longer view: "
        "method references, project templates, and editorial style guides for Blueprint™."
    ),
    "anchor_guide.cta":         "Browse guides",
    "anchor_webinar.eyebrow":   "Webinars & live",
    "anchor_webinar.subtitle":  "A conversation — not a conference.",
    "anchor_webinar.title":     "Live sessions with our team.",
    "anchor_webinar.body":      (
        "Every month we organize live sessions with our editorial team and guests "
        "from the design world: practical workshops, method dialogues, and open "
        "conversations with studios that have adopted Blueprint™."
    ),
    "anchor_webinar.cta":       "See upcoming events",
    "anchor_academy.eyebrow":   "MOOD Academy",
    "anchor_academy.subtitle":  "Continuous learning for those who design the future.",
    "anchor_academy.title":     "Grow with MOOD Academy.",
    "anchor_academy.body":      (
        "Academy is the deepest level of our learning commitment: structured programs, "
        "live sessions, editorial guides, and a community of design professionals who "
        "share the language of Design Journey™."
    ),
    "anchor_academy.cta":       "Request access",
    "academy.item_01_eyebrow":  "Academy",
    "academy.item_01_title":    "Grow with MOOD Academy.",
    "academy.item_01_body":     (
        "Continuous learning, case studies, and inspiration to transform your "
        "editorial competencies project by project."
    ),
    "academy.item_01_cta":      "Discover more",
    "cta.label":                "Explore MOOD Academy",
    "seo.title":                "Training — MOOD Academy",
    "seo.description":          (
        "MOOD Academy: editorial learning for studios and partners — "
        "webinars, tutorials, certification programs, and live sessions."
    ),
}


# ── §B.3 Features — completamento 29 blocchi mancanti ───────────────────────
# item_07-13 = 7 outcomes, item_14 = Academy bridge, item_15 = CTA bridge
# item_07-09 hanno IT vuoto → li aggiorniamo anche in IT
# item_10-15 hanno IT vuoto → li aggiorniamo anche in IT

FEATURES_MISSING_EN: dict[str, dict[str, str]] = {
    "item_07.eyebrow": {
        "en-US": "Memory",
        "it-IT": "Memoria",
    },
    "item_07.title": {
        "en-US": "Never lose the context behind a material decision.",
        "it-IT": "Il contesto dietro ogni decisione sui materiali. Sempre.",
    },
    "item_07.body": {
        "en-US": (
            "Every material that enters a project enters with its reason. "
            "Six months later, you still know why you chose that Calacatta marble "
            "— and why you ruled out the other. Six years later, your studio still remembers."
        ),
        "it-IT": (
            "Ogni materiale che entra in un progetto entra con la sua ragione. "
            "Sei mesi dopo, sai ancora perché hai scelto quel marmo — e perché hai scartato l'altro."
        ),
    },
    "item_08.eyebrow": {
        "en-US": "Continuity",
        "it-IT": "Continuità",
    },
    "item_08.title": {
        "en-US": "One story. Seven chapters. Every decision preserved.",
        "it-IT": "Una storia. Sette capitoli. Ogni decisione preservata.",
    },
    "item_08.body": {
        "en-US": (
            "The project stops being a different email for every stakeholder. "
            "Client, studio, showroom, and brand read the same story. "
            "Divergent versions stop existing."
        ),
        "it-IT": (
            "Il progetto smette di essere un'email diversa per ogni interlocutore. "
            "Cliente, studio, showroom e brand leggono la stessa storia. "
            "Le versioni divergenti non esistono più."
        ),
    },
    "item_09.eyebrow": {
        "en-US": "Editorial voice",
        "it-IT": "Voce editoriale",
    },
    "item_09.title": {
        "en-US": "Your studio becomes more recognizable with every project.",
        "it-IT": "Il tuo studio diventa più riconoscibile a ogni progetto.",
    },
    "item_09.body": {
        "en-US": (
            "Your studio's voice is built through the decisions it preserves. "
            "Blueprint™ transforms every project into a chapter of an editorial "
            "bibliography that belongs to you."
        ),
        "it-IT": (
            "La voce del tuo studio si costruisce attraverso le decisioni che preserva. "
            "Blueprint™ trasforma ogni progetto in un capitolo di una bibliografia editoriale che ti appartiene."
        ),
    },
    "item_10.eyebrow": {
        "en-US": "Material curation",
        "it-IT": "Material curation",
    },
    "item_10.title": {
        "en-US": "Materials as decisions, not catalog items.",
        "it-IT": "I materiali come decisioni, non come voci di catalogo.",
    },
    "item_10.body": {
        "en-US": (
            "For MOOD, a material is time-extended, relational, authored. "
            "Material Intelligence™ is the way your studio preserves the 'why' behind "
            "every material decision — and makes it an active reference for future projects."
        ),
        "it-IT": (
            "Per MOOD, un materiale è temporalmente esteso, relazionale, autorato. "
            "Material Intelligence™ è il modo in cui il tuo studio preserva il 'perché' "
            "dietro ogni decisione sui materiali."
        ),
    },
    "item_11.eyebrow": {
        "en-US": "Client conversation",
        "it-IT": "Conversazione con il cliente",
    },
    "item_11.title": {
        "en-US": "The client reads the same story you see.",
        "it-IT": "Il cliente legge la stessa storia che vedi tu.",
    },
    "item_11.body": {
        "en-US": (
            "Revisions aren't lost. Discarded alternatives stay legible. "
            "The client feels like a co-author, not the recipient of a PDF. "
            "The final presentation doesn't need to be 'prepared' — it already exists."
        ),
        "it-IT": (
            "Le revisioni non vanno perse. Le alternative scartate rimangono leggibili. "
            "Il cliente si sente co-autore, non destinatario di un PDF."
        ),
    },
    "item_12.eyebrow": {
        "en-US": "Ecosystem",
        "it-IT": "Ecosistema",
    },
    "item_12.title": {
        "en-US": "Showrooms and brands enter the conversation — not just the sale.",
        "it-IT": "Showroom e brand entrano nella conversazione — non solo nella vendita.",
    },
    "item_12.body": {
        "en-US": (
            "The showroom is credited next to the curation it proposed. "
            "The brand is recognized as a product author, not just a supplier. "
            "Every actor in the project becomes part of the story."
        ),
        "it-IT": (
            "Lo showroom è accreditato accanto alla curation che ha proposto. "
            "Il brand è riconosciuto come autore di prodotto, non solo fornitore."
        ),
    },
    "item_13.eyebrow": {
        "en-US": "Studio archive",
        "it-IT": "Archivio dello studio",
    },
    "item_13.title": {
        "en-US": "Know-how stops living only in people.",
        "it-IT": "Il know-how smette di vivere solo nelle persone.",
    },
    "item_13.body": {
        "en-US": (
            "A lime blue chosen for a project in 2022 is available again when you discuss "
            "it with a new client in 2027. Your studio's knowledge accumulates project by "
            "project — and remains accessible even as people change."
        ),
        "it-IT": (
            "Un blu calcite scelto per un progetto nel 2022 è disponibile quando ne parli "
            "con un nuovo cliente nel 2027. Il know-how si accumula progetto per progetto."
        ),
    },
    "item_14.eyebrow": {
        "en-US": "Academy",
        "it-IT": "Academy",
    },
    "item_14.title": {
        "en-US": "Every configuration includes access to MOOD Academy.",
        "it-IT": "Ogni configurazione include l'accesso a MOOD Academy.",
    },
    "item_14.body": {
        "en-US": (
            "Adopting a methodology means learning to live it. MOOD Academy guides every "
            "configured studio through learning programs, tutorials, and live method "
            "transmission sessions."
        ),
        "it-IT": (
            "Adottare una metodologia significa imparare a viverla. MOOD Academy guida "
            "ogni studio configurato attraverso percorsi di apprendimento, tutorial e "
            "sessioni live di trasmissione del metodo."
        ),
    },
    "item_15.eyebrow": {
        "en-US": "Start",
        "it-IT": "Inizia",
    },
    "item_15.title": {
        "en-US": "Let's see if Blueprint™ is right for your studio.",
        "it-IT": "Vediamo se Blueprint™ è giusto per il tuo studio.",
    },
    "item_15.body": {
        "en-US": (
            "Every configuration is proposed after an opening conversation. "
            "Tell us how you work today — we'll propose an editorial configuration made for you."
        ),
        "it-IT": (
            "Ogni configurazione è proposta dopo una conversazione iniziale. "
            "Raccontaci come lavori oggi — proponiamo una configurazione editoriale fatta per te."
        ),
    },
    "seo.title": {
        "en-US": "What Blueprint™ makes possible — Editorial outcomes for your studio",
        "it-IT": "Caratteristiche — MOOD for DESIGN",
    },
    "seo.description": {
        "en-US": (
            "Memory, continuity, editorial voice, material curation, client conversation, "
            "ecosystem, studio archive. Everything Blueprint™ enables."
        ),
        "it-IT": (
            "L'ecosistema MOOD: moodboard editoriali, flussi di progetto, libreria materiali, "
            "presentazioni e archivio dello studio — tutto in Blueprint™."
        ),
    },
}


# ── Helpers ──────────────────────────────────────────────────────────────────
async def upsert_translation(
    s, block_id: str, locale: str, value: str
) -> bool:
    """Returns True if inserted, False if updated."""
    result = (await s.execute(text("""
        INSERT INTO editorial_block_translations
          (id, block_id, locale, value, status, generated_by,
           source_hash, locked, created_at, updated_at)
        VALUES (gen_random_uuid(), :bid, :loc, :val,
                'manual', 'seed-phase2', '', false, NOW(), NOW())
        ON CONFLICT (block_id, locale)
        DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        RETURNING (xmax = 0) AS was_insert
    """), {"bid": block_id, "loc": locale, "val": value})).fetchone()
    return bool(result and result[0])


async def get_or_create_block(s, tid: str, namespace: str, block_key: str, source_value: str = "") -> str:
    block_id = (await s.execute(text("""
        INSERT INTO editorial_blocks
          (id, scope, tenant_id, namespace, block_key, block_type,
           source_locale, source_value, source_hash, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), 'tenant', :tid, :ns, :bk, 'text',
                'it-IT', :sv, '', true, NOW(), NOW())
        ON CONFLICT (tenant_id, namespace, block_key)
        DO UPDATE SET updated_at = NOW()
        RETURNING id
    """), {"tid": tid, "ns": namespace, "bk": block_key, "sv": source_value})).scalar_one()
    return block_id


# ── Main ─────────────────────────────────────────────────────────────────────
async def run():
    tenant = await get_corporate_tenant()
    tid = tenant["id"]
    stats: dict[str, dict] = {}

    async with AsyncSessionLocal() as s:

        # ── 1. Home — surgical update ────────────────────────────────────────
        print("→ site.home (surgical)")
        ins = upd = 0
        for block_key, en_value in HOME_SURGICAL.items():
            bid = await get_or_create_block(s, tid, "site.home", block_key, en_value)
            was_insert = await upsert_translation(s, bid, "en-US", en_value)
            if was_insert: ins += 1
            else: upd += 1
        stats["site.home"] = {"inserted": ins, "updated": upd}

        # ── 2. Audience — full EN-US ─────────────────────────────────────────
        print("→ site.audience (en-US)")
        ins = upd = 0
        for block_key, en_value in AUDIENCE_EN.items():
            bid = await get_or_create_block(s, tid, "site.audience", block_key, en_value)
            was_insert = await upsert_translation(s, bid, "en-US", en_value)
            if was_insert: ins += 1
            else: upd += 1
            # Add IT placeholder for new blocks (profile.*, final_cta.*)
            if block_key.startswith("profile.") or block_key.startswith("final_cta."):
                it_val = AUDIENCE_IT_NEW.get(block_key, "")
                await upsert_translation(s, bid, "it-IT", it_val)
        stats["site.audience"] = {"inserted": ins, "updated": upd}

        # ── 3. Training — full EN-US ─────────────────────────────────────────
        print("→ site.training (en-US)")
        ins = upd = 0
        for block_key, en_value in TRAINING_EN.items():
            bid = await get_or_create_block(s, tid, "site.training", block_key, en_value)
            was_insert = await upsert_translation(s, bid, "en-US", en_value)
            if was_insert: ins += 1
            else: upd += 1
        stats["site.training"] = {"inserted": ins, "updated": upd}

        # ── 4. Features — complete missing EN-US + fill empty IT ────────────
        print("→ site.features (missing blocks)")
        ins = upd = 0
        for block_key, locale_map in FEATURES_MISSING_EN.items():
            it_sv = locale_map.get("it-IT", "")
            bid = await get_or_create_block(s, tid, "site.features", block_key, it_sv)
            for locale, value in locale_map.items():
                was_insert = await upsert_translation(s, bid, locale, value)
                if was_insert: ins += 1
                else: upd += 1
        stats["site.features"] = {"inserted": ins, "updated": upd}

        await s.commit()

    for ns, d in stats.items():
        print(f"✅  {ns}: {d['inserted']} inserted, {d['updated']} updated")


if __name__ == "__main__":
    asyncio.run(run())
