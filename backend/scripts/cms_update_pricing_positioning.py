"""
CMS Update Script — Pricing & Positioning Revision
═══════════════════════════════════════════════════════════════════════
Date:    2026-05-31
Source:  /app/memory/STUDIO_V2/PRICING_POSITIONING_REVISION.md
Scope:   Aggiorna `editorial_blocks` + `editorial_block_translations`
         per namespace `site.features.*` e `site.pricing.*`.

Strategy:
  • IDEMPOTENT — re-runnable safely
  • UPSERT per ogni chiave (INSERT … ON CONFLICT UPDATE)
  • Source locale: it-IT (normalized per direttiva)
  • Translations: en-US per ogni chiave
  • Compatibile con hold P0: zero DELETE, solo UPDATE/INSERT

Authority:
  • LOCALE_ARCHITECTURE_DIRECTIVE.md (BCP-47, dynamic locale)
  • PRICING_POSITIONING_REVISION.md (copy approvato + naming tier finale)
  • TIER_NAMING_FINAL_REVISION.md (Blueprint Studio/Practice/Enterprise)
"""
import os
import sys
import hashlib
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')

DATABASE_URL = os.environ.get('SESSION_POOLER_URL') or os.environ.get('DATABASE_URL')
SOURCE_LOCALE = 'it-IT'
TARGET_LOCALES = ['en-US']  # MVP enabled locales beyond source


# ═══════════════════════════════════════════════════════════════════════
# COPY DATA — PRICING_POSITIONING_REVISION.md (source IT) + en-US translation
# ═══════════════════════════════════════════════════════════════════════

FEATURES_COPY = {
    # [1] HERO — FeatureHeroSplit
    'site.features.hero.eyebrow': {
        'it-IT': 'Blueprint',
        'en-US': 'Blueprint',
    },
    'site.features.hero.title': {
        'it-IT': 'Una sola piattaforma per tutto il progetto.',
        'en-US': 'One platform for the entire project.',
    },
    'site.features.hero.subtitle': {
        'it-IT': 'Tieni insieme clienti, progetti, materiali, presentazioni e team. Smetti di rincorrere file, mail e fogli sparsi.',
        'en-US': 'Keep clients, projects, materials, presentations and team in one place. Stop chasing files, emails and scattered spreadsheets.',
    },
    'site.features.hero.body': {
        'it-IT': 'Blueprint è la piattaforma operativa di MOOD for DESIGN. Organizza e registra ogni fase del Design Journey: dal primo contatto alla selezione dei materiali, dalla presentazione al cliente fino all\'avanzamento del progetto.',
        'en-US': 'Blueprint is the operating platform by MOOD for DESIGN. It organizes and records every stage of the Design Journey: from the first contact to material selection, from client presentation to project delivery.',
    },
    'site.features.hero.cta': {
        'it-IT': 'Candida il tuo studio',
        'en-US': 'Apply your studio',
    },
    # [2] CONTEXT — FeatureNarrative
    'site.features.intro.eyebrow': {
        'it-IT': 'Cosa fa Blueprint',
        'en-US': 'What Blueprint does',
    },
    'site.features.intro.headline': {
        'it-IT': 'Tutto il lavoro dello studio in un unico posto.',
        'en-US': 'All of the studio\'s work in one place.',
    },
    'site.features.intro.body': {
        'it-IT': 'Blueprint non è un CRM, non è un gestionale, non è un moodboard tool. È la piattaforma che li riunisce. Ogni cliente, ogni progetto, ogni materiale e ogni decisione restano collegati e ricostruibili nel tempo.',
        'en-US': 'Blueprint is not a CRM, not a management tool, not a moodboard app. It is the platform that brings them together. Every client, every project, every material and every decision stays connected and traceable over time.',
    },
    # [3] 6 ITEMS — FeatureNumberedList (eyebrow / title / body)
    'site.features.item_01.eyebrow': {'it-IT': 'Clienti & contatti', 'en-US': 'Clients & contacts'},
    'site.features.item_01.title':   {'it-IT': 'Ogni relazione documentata.', 'en-US': 'Every relationship documented.'},
    'site.features.item_01.body':    {'it-IT': 'Anagrafiche, conversazioni, contesto del cliente. Niente più appunti dispersi tra mail e telefonate.',
                                       'en-US': 'Profiles, conversations, client context. No more notes scattered across emails and phone calls.'},

    'site.features.item_02.eyebrow': {'it-IT': 'Fasi di progetto', 'en-US': 'Project phases'},
    'site.features.item_02.title':   {'it-IT': 'Il progetto strutturato per momenti.', 'en-US': 'The project structured by phase.'},
    'site.features.item_02.body':    {'it-IT': 'Dal brief alla consegna, ogni fase del lavoro è una sezione consultabile. Tu sai sempre a che punto sei.',
                                       'en-US': 'From brief to delivery, every phase of the work is a section you can consult. You always know where you stand.'},

    'site.features.item_03.eyebrow': {'it-IT': 'Materiali & fornitori', 'en-US': 'Materials & suppliers'},
    'site.features.item_03.title':   {'it-IT': 'Una libreria materiali sempre aggiornata.', 'en-US': 'A materials library that stays current.'},
    'site.features.item_03.body':    {'it-IT': 'Schede tecniche, listini, contatti fornitori. Disponibili per tutto il team, ricercabili in pochi click.',
                                       'en-US': 'Technical sheets, price lists, supplier contacts. Available to the whole team, searchable in a few clicks.'},

    'site.features.item_04.eyebrow': {'it-IT': 'Presentazione al cliente', 'en-US': 'Client presentation'},
    'site.features.item_04.title':   {'it-IT': 'Moodboard e proposte pronte da condividere.', 'en-US': 'Moodboards and proposals ready to share.'},
    'site.features.item_04.body':    {'it-IT': 'Preparare una presentazione richiede meno tempo. Il cliente la riceve in un formato curato, senza email allegate.',
                                       'en-US': 'Preparing a presentation takes less time. The client receives it in a polished format, without email attachments.'},

    'site.features.item_05.eyebrow': {'it-IT': 'Coordinamento team', 'en-US': 'Team coordination'},
    'site.features.item_05.title':   {'it-IT': 'Ruoli, accessi, attività in chiaro.', 'en-US': 'Roles, access and tasks made clear.'},
    'site.features.item_05.body':    {'it-IT': 'Designer, junior, project manager: ognuno vede ciò che serve. Le revisioni interne non si perdono.',
                                       'en-US': 'Designers, juniors, project managers: each sees what they need. Internal reviews stop getting lost.'},

    'site.features.item_06.eyebrow': {'it-IT': 'Presenza editoriale', 'en-US': 'Editorial presence'},
    'site.features.item_06.title':   {'it-IT': 'Lo studio racconta i suoi progetti.', 'en-US': 'The studio tells its own story.'},
    'site.features.item_06.body':    {'it-IT': 'Una sezione magazine integrata. Pubblichi quando vuoi, senza dipendere da agenzie esterne.',
                                       'en-US': 'A built-in magazine section. Publish whenever you want, without depending on external agencies.'},

    # [4] LAYERS — proprietary naming progressively
    'site.features.layers.eyebrow':  {'it-IT': 'Sotto la superficie', 'en-US': 'Under the surface'},
    'site.features.layers.headline': {'it-IT': 'Tre strumenti che lavorano insieme.', 'en-US': 'Three tools working together.'},
    'site.features.layers.body':     {'it-IT': 'Quello che vedi in Blueprint è la sintesi di tre layer specializzati che operano dietro le quinte.',
                                       'en-US': 'What you see in Blueprint is the synthesis of three specialized layers operating behind the scenes.'},
    'site.features.layers.l1.title': {'it-IT': 'Design Journey™', 'en-US': 'Design Journey™'},
    'site.features.layers.l1.body':  {'it-IT': 'Mantiene la storia di ogni progetto. Cosa è stato deciso, quando, da chi.',
                                       'en-US': 'Keeps the story of every project. What was decided, when, by whom.'},
    'site.features.layers.l2.title': {'it-IT': 'Material Intelligence™', 'en-US': 'Material Intelligence™'},
    'site.features.layers.l2.body':  {'it-IT': 'Tiene insieme materiali, fornitori, schede tecniche e prezzi. Aggiornati per tutto lo studio.',
                                       'en-US': 'Holds materials, suppliers, technical sheets and prices together. Up to date for the entire studio.'},
    'site.features.layers.l3.title': {'it-IT': 'Moodboard Experience™', 'en-US': 'Moodboard Experience™'},
    'site.features.layers.l3.body':  {'it-IT': 'Trasforma idee, immagini e materiali in presentazioni condivisibili in pochi minuti.',
                                       'en-US': 'Turns ideas, images and materials into shareable presentations in minutes.'},

    # [5] CTA
    'site.features.cta.eyebrow':  {'it-IT': 'Pronto a iniziare?', 'en-US': 'Ready to start?'},
    'site.features.cta.headline': {'it-IT': 'Vediamo se Blueprint è giusto per il tuo studio.', 'en-US': 'Let\'s see if Blueprint is right for your studio.'},
    'site.features.cta.body':     {'it-IT': 'La candidatura richiede 3 minuti. Un Advisor MOOD ti contatterà per definire la configurazione più adatta.',
                                    'en-US': 'The application takes 3 minutes. A MOOD Advisor will contact you to define the right configuration.'},
    'site.features.cta.label':    {'it-IT': 'Candida il tuo studio', 'en-US': 'Apply your studio'},
}

PRICING_COPY = {
    # [1] HERO — PricingHeroCinematic
    'site.pricing.hero.eyebrow':  {'it-IT': 'Modalità di adozione', 'en-US': 'How to adopt Blueprint'},
    'site.pricing.hero.title':    {'it-IT': 'Blueprint non si compra. Si configura.', 'en-US': 'Blueprint isn\'t bought. It\'s configured.'},
    'site.pricing.hero.subtitle': {'it-IT': 'Ogni studio ha la propria dimensione, il proprio team e i propri clienti. La configurazione di Blueprint nasce dopo un dialogo con un Advisor MOOD.',
                                    'en-US': 'Every studio has its own size, team and clients. Your Blueprint configuration is shaped through a conversation with a MOOD Advisor.'},
    'site.pricing.hero.body':     {'it-IT': 'Non c\'è un listino pubblico. C\'è la configurazione giusta per il tuo studio.',
                                    'en-US': 'There is no public price list. There is the right configuration for your studio.'},

    # [2] FLOW (D2: renamed from "philosophy" to "Come viene adottato Blueprint")
    'site.pricing.intro.eyebrow':  {'it-IT': 'Come viene adottato Blueprint', 'en-US': 'How Blueprint is adopted'},
    'site.pricing.intro.headline': {'it-IT': 'Tre passaggi, due settimane in media.', 'en-US': 'Three steps, two weeks on average.'},
    'site.pricing.intro.body':     {'it-IT': 'L\'accesso a Blueprint è curato. Vogliamo conoscere il tuo studio prima di proporti la configurazione.',
                                    'en-US': 'Access to Blueprint is curated. We want to understand your studio before proposing a configuration.'},

    'site.pricing.philosophy.eyebrow':  {'it-IT': 'Come viene adottato Blueprint', 'en-US': 'How Blueprint is adopted'},
    'site.pricing.philosophy.headline': {'it-IT': 'Tre passaggi per entrare in Blueprint.', 'en-US': 'Three steps to enter Blueprint.'},
    'site.pricing.philosophy.body':     {'it-IT': 'L\'accesso è curato. Conosciamo lo studio, proponiamo la configurazione, attiviamo il workspace. In media due settimane dall\'inizio.',
                                          'en-US': 'Access is curated. We get to know the studio, propose the configuration, activate the workspace. On average two weeks from start.'},
    'site.pricing.philosophy.step_01.label': {'it-IT': '01 · Candidatura', 'en-US': '01 · Application'},
    'site.pricing.philosophy.step_01.body':  {'it-IT': 'Compili la candidatura in 3 minuti. Raccogliamo categoria, sede, lingue operative, priorità.',
                                               'en-US': 'You complete the application in 3 minutes. We capture category, location, working languages and priorities.'},
    'site.pricing.philosophy.step_02.label': {'it-IT': '02 · Dialogo Advisor', 'en-US': '02 · Advisor conversation'},
    'site.pricing.philosophy.step_02.body':  {'it-IT': 'Un Advisor MOOD analizza la richiesta e ti contatta. Insieme definiamo la configurazione adatta.',
                                               'en-US': 'A MOOD Advisor reviews the request and reaches out. Together we define the right configuration.'},
    'site.pricing.philosophy.step_03.label': {'it-IT': '03 · Attivazione', 'en-US': '03 · Activation'},
    'site.pricing.philosophy.step_03.body':  {'it-IT': 'Ricevi il tuo workspace Blueprint dedicato. Il team viene formato. Sei operativo.',
                                               'en-US': 'You receive your dedicated Blueprint workspace. The team is trained. You are operational.'},

    # [3] TIER 01 — Blueprint Studio
    'site.pricing.tier_01.eyebrow':  {'it-IT': 'Blueprint Studio', 'en-US': 'Blueprint Studio'},
    'site.pricing.tier_01.title':    {'it-IT': 'Per chi inizia con MOOD.', 'en-US': 'For those starting with MOOD.'},
    'site.pricing.tier_01.subtitle': {'it-IT': 'Studio individuale o team ristretto che vuole strutturare il lavoro.',
                                       'en-US': 'Individual studio or small team that wants to structure the work.'},
    'site.pricing.tier_01.body':     {'it-IT': 'Tutta la piattaforma Blueprint per la gestione del lavoro quotidiano. Onboarding guidato, supporto email, formazione iniziale.',
                                       'en-US': 'The full Blueprint platform for everyday work. Guided onboarding, email support, initial training.'},
    'site.pricing.tier_01.inc_1':    {'it-IT': 'Blueprint completa', 'en-US': 'Full Blueprint platform'},
    'site.pricing.tier_01.inc_2':    {'it-IT': 'Onboarding guidato', 'en-US': 'Guided onboarding'},
    'site.pricing.tier_01.inc_3':    {'it-IT': 'Formazione iniziale', 'en-US': 'Initial training'},
    'site.pricing.tier_01.inc_4':    {'it-IT': 'Supporto email', 'en-US': 'Email support'},
    'site.pricing.tier_01.inc_5':    {'it-IT': 'Aggiornamenti continui', 'en-US': 'Continuous updates'},
    'site.pricing.tier_01.price':         {'it-IT': '', 'en-US': ''},
    'site.pricing.tier_01.price_caption': {'it-IT': '', 'en-US': ''},
    'site.pricing.tier_01.cta':      {'it-IT': 'Parlane con un Advisor', 'en-US': 'Talk to an Advisor'},

    # TIER 02 — Blueprint Practice
    'site.pricing.tier_02.eyebrow':  {'it-IT': 'Blueprint Practice', 'en-US': 'Blueprint Practice'},
    'site.pricing.tier_02.title':    {'it-IT': 'Per lo studio strutturato.', 'en-US': 'For the structured studio.'},
    'site.pricing.tier_02.subtitle': {'it-IT': 'Team di 5–15 persone, progetti articolati, più mercati.',
                                       'en-US': 'Team of 5–15 people, complex projects, multiple markets.'},
    'site.pricing.tier_02.body':     {'it-IT': 'Tutta la configurazione di Blueprint Studio più: accessi team avanzati, workspace personalizzato, supporto prioritario, Advisor di riferimento.',
                                       'en-US': 'Everything in Blueprint Studio plus: advanced team access, personalized workspace, priority support, dedicated Advisor.'},
    'site.pricing.tier_02.inc_1':    {'it-IT': 'Tutto della modalità Blueprint Studio', 'en-US': 'Everything in Blueprint Studio'},
    'site.pricing.tier_02.inc_2':    {'it-IT': 'Accessi team avanzati', 'en-US': 'Advanced team access'},
    'site.pricing.tier_02.inc_3':    {'it-IT': 'Workspace personalizzato', 'en-US': 'Personalized workspace'},
    'site.pricing.tier_02.inc_4':    {'it-IT': 'Supporto prioritario', 'en-US': 'Priority support'},
    'site.pricing.tier_02.inc_5':    {'it-IT': 'Advisor di riferimento', 'en-US': 'Dedicated Advisor'},
    'site.pricing.tier_02.price':         {'it-IT': '', 'en-US': ''},
    'site.pricing.tier_02.price_caption': {'it-IT': '', 'en-US': ''},
    'site.pricing.tier_02.cta':      {'it-IT': 'Parlane con un Advisor', 'en-US': 'Talk to an Advisor'},

    # TIER 03 — Blueprint Enterprise
    'site.pricing.tier_03.eyebrow':  {'it-IT': 'Blueprint Enterprise', 'en-US': 'Blueprint Enterprise'},
    'site.pricing.tier_03.title':    {'it-IT': 'Per il gruppo e il brand.', 'en-US': 'For the group and the brand.'},
    'site.pricing.tier_03.subtitle': {'it-IT': 'Più studi, più mercati, più brand sotto la stessa governance.',
                                       'en-US': 'Multiple studios, multiple markets, multiple brands under a single governance.'},
    'site.pricing.tier_03.body':     {'it-IT': 'Configurazione su misura. Multi-tenant, governance condivisa, integrazioni dedicate, Advisor e team relazionale dedicati.',
                                       'en-US': 'Tailored configuration. Multi-tenant, shared governance, dedicated integrations, dedicated Advisor and relationship team.'},
    'site.pricing.tier_03.inc_1':    {'it-IT': 'Tutto della modalità Blueprint Practice', 'en-US': 'Everything in Blueprint Practice'},
    'site.pricing.tier_03.inc_2':    {'it-IT': 'Multi-tenant e multi-brand', 'en-US': 'Multi-tenant and multi-brand'},
    'site.pricing.tier_03.inc_3':    {'it-IT': 'Integrazioni su misura', 'en-US': 'Tailored integrations'},
    'site.pricing.tier_03.inc_4':    {'it-IT': 'Advisor dedicato', 'en-US': 'Dedicated Advisor'},
    'site.pricing.tier_03.inc_5':    {'it-IT': 'Workshop strategici', 'en-US': 'Strategic workshops'},
    'site.pricing.tier_03.price':         {'it-IT': '', 'en-US': ''},
    'site.pricing.tier_03.price_caption': {'it-IT': '', 'en-US': ''},
    'site.pricing.tier_03.cta':      {'it-IT': 'Parlane con un Advisor', 'en-US': 'Talk to an Advisor'},

    # TIER 04 — empty (3-tier model)
    'site.pricing.tier_04.eyebrow':  {'it-IT': '', 'en-US': ''},
    'site.pricing.tier_04.title':    {'it-IT': '', 'en-US': ''},
    'site.pricing.tier_04.subtitle': {'it-IT': '', 'en-US': ''},
    'site.pricing.tier_04.body':     {'it-IT': '', 'en-US': ''},
    'site.pricing.tier_04.price':         {'it-IT': '', 'en-US': ''},
    'site.pricing.tier_04.price_caption': {'it-IT': '', 'en-US': ''},
    'site.pricing.tier_04.cta':      {'it-IT': '', 'en-US': ''},

    # [4] COMPARISON TABLE — capability oriented (3 tiers only)
    'site.pricing.comparison.title':         {'it-IT': 'Cosa è incluso in ogni configurazione.', 'en-US': 'What\'s included in each configuration.'},
    'site.pricing.comparison.tier_01_name':  {'it-IT': 'Blueprint Studio', 'en-US': 'Blueprint Studio'},
    'site.pricing.comparison.tier_02_name':  {'it-IT': 'Blueprint Practice', 'en-US': 'Blueprint Practice'},
    'site.pricing.comparison.tier_03_name':  {'it-IT': 'Blueprint Enterprise', 'en-US': 'Blueprint Enterprise'},
    'site.pricing.comparison.tier_04_name':  {'it-IT': '', 'en-US': ''},

    'site.pricing.comparison.row_01.label':  {'it-IT': 'Piattaforma Blueprint completa', 'en-US': 'Full Blueprint platform'},
    'site.pricing.comparison.row_01.tier_01':{'it-IT': '✓', 'en-US': '✓'},
    'site.pricing.comparison.row_01.tier_02':{'it-IT': '✓', 'en-US': '✓'},
    'site.pricing.comparison.row_01.tier_03':{'it-IT': '✓', 'en-US': '✓'},
    'site.pricing.comparison.row_01.tier_04':{'it-IT': '', 'en-US': ''},

    'site.pricing.comparison.row_02.label':  {'it-IT': 'Design Journey™', 'en-US': 'Design Journey™'},
    'site.pricing.comparison.row_02.tier_01':{'it-IT': '✓', 'en-US': '✓'},
    'site.pricing.comparison.row_02.tier_02':{'it-IT': '✓', 'en-US': '✓'},
    'site.pricing.comparison.row_02.tier_03':{'it-IT': '✓', 'en-US': '✓'},
    'site.pricing.comparison.row_02.tier_04':{'it-IT': '', 'en-US': ''},

    'site.pricing.comparison.row_03.label':  {'it-IT': 'Material Intelligence™', 'en-US': 'Material Intelligence™'},
    'site.pricing.comparison.row_03.tier_01':{'it-IT': '✓', 'en-US': '✓'},
    'site.pricing.comparison.row_03.tier_02':{'it-IT': '✓', 'en-US': '✓'},
    'site.pricing.comparison.row_03.tier_03':{'it-IT': '✓', 'en-US': '✓'},
    'site.pricing.comparison.row_03.tier_04':{'it-IT': '', 'en-US': ''},

    'site.pricing.comparison.row_04.label':  {'it-IT': 'Moodboard Experience™', 'en-US': 'Moodboard Experience™'},
    'site.pricing.comparison.row_04.tier_01':{'it-IT': '✓', 'en-US': '✓'},
    'site.pricing.comparison.row_04.tier_02':{'it-IT': '✓', 'en-US': '✓'},
    'site.pricing.comparison.row_04.tier_03':{'it-IT': '✓', 'en-US': '✓'},
    'site.pricing.comparison.row_04.tier_04':{'it-IT': '', 'en-US': ''},

    'site.pricing.comparison.row_05.label':  {'it-IT': 'Editorial Magazine integrato', 'en-US': 'Integrated Editorial Magazine'},
    'site.pricing.comparison.row_05.tier_01':{'it-IT': '✓', 'en-US': '✓'},
    'site.pricing.comparison.row_05.tier_02':{'it-IT': '✓', 'en-US': '✓'},
    'site.pricing.comparison.row_05.tier_03':{'it-IT': '✓', 'en-US': '✓'},
    'site.pricing.comparison.row_05.tier_04':{'it-IT': '', 'en-US': ''},

    'site.pricing.comparison.row_06.label':  {'it-IT': 'Accessi team', 'en-US': 'Team access'},
    'site.pricing.comparison.row_06.tier_01':{'it-IT': 'Singolo / piccolo', 'en-US': 'Single / small'},
    'site.pricing.comparison.row_06.tier_02':{'it-IT': 'Esteso', 'en-US': 'Extended'},
    'site.pricing.comparison.row_06.tier_03':{'it-IT': 'Multi-studio', 'en-US': 'Multi-studio'},
    'site.pricing.comparison.row_06.tier_04':{'it-IT': '', 'en-US': ''},

    'site.pricing.comparison.row_07.label':  {'it-IT': 'Workspace personalizzato', 'en-US': 'Personalized workspace'},
    'site.pricing.comparison.row_07.tier_01':{'it-IT': 'Standard', 'en-US': 'Standard'},
    'site.pricing.comparison.row_07.tier_02':{'it-IT': 'Avanzato', 'en-US': 'Advanced'},
    'site.pricing.comparison.row_07.tier_03':{'it-IT': 'Su misura', 'en-US': 'Tailored'},
    'site.pricing.comparison.row_07.tier_04':{'it-IT': '', 'en-US': ''},

    'site.pricing.comparison.row_08.label':  {'it-IT': 'Multi-tenant / multi-brand', 'en-US': 'Multi-tenant / multi-brand'},
    'site.pricing.comparison.row_08.tier_01':{'it-IT': '—', 'en-US': '—'},
    'site.pricing.comparison.row_08.tier_02':{'it-IT': '—', 'en-US': '—'},
    'site.pricing.comparison.row_08.tier_03':{'it-IT': '✓', 'en-US': '✓'},
    'site.pricing.comparison.row_08.tier_04':{'it-IT': '', 'en-US': ''},

    'site.pricing.comparison.row_09.label':  {'it-IT': 'Integrazioni con sistemi terzi', 'en-US': 'Third-party integrations'},
    'site.pricing.comparison.row_09.tier_01':{'it-IT': '—', 'en-US': '—'},
    'site.pricing.comparison.row_09.tier_02':{'it-IT': 'Standard', 'en-US': 'Standard'},
    'site.pricing.comparison.row_09.tier_03':{'it-IT': 'Su misura', 'en-US': 'Tailored'},
    'site.pricing.comparison.row_09.tier_04':{'it-IT': '', 'en-US': ''},

    'site.pricing.comparison.row_10.label':  {'it-IT': 'Onboarding', 'en-US': 'Onboarding'},
    'site.pricing.comparison.row_10.tier_01':{'it-IT': 'Guidato', 'en-US': 'Guided'},
    'site.pricing.comparison.row_10.tier_02':{'it-IT': 'Strutturato', 'en-US': 'Structured'},
    'site.pricing.comparison.row_10.tier_03':{'it-IT': 'Dedicato', 'en-US': 'Dedicated'},
    'site.pricing.comparison.row_10.tier_04':{'it-IT': '', 'en-US': ''},

    'site.pricing.comparison.row_11.label':  {'it-IT': 'Formazione', 'en-US': 'Training'},
    'site.pricing.comparison.row_11.tier_01':{'it-IT': 'Iniziale', 'en-US': 'Initial'},
    'site.pricing.comparison.row_11.tier_02':{'it-IT': 'Continua', 'en-US': 'Ongoing'},
    'site.pricing.comparison.row_11.tier_03':{'it-IT': 'Workshop strategici', 'en-US': 'Strategic workshops'},
    'site.pricing.comparison.row_11.tier_04':{'it-IT': '', 'en-US': ''},

    'site.pricing.comparison.row_12.label':  {'it-IT': 'Supporto', 'en-US': 'Support'},
    'site.pricing.comparison.row_12.tier_01':{'it-IT': 'Email', 'en-US': 'Email'},
    'site.pricing.comparison.row_12.tier_02':{'it-IT': 'Prioritario', 'en-US': 'Priority'},
    'site.pricing.comparison.row_12.tier_03':{'it-IT': 'Advisor dedicato', 'en-US': 'Dedicated Advisor'},
    'site.pricing.comparison.row_12.tier_04':{'it-IT': '', 'en-US': ''},

    'site.pricing.comparison.row_13.label':  {'it-IT': 'Aggiornamenti piattaforma', 'en-US': 'Platform updates'},
    'site.pricing.comparison.row_13.tier_01':{'it-IT': '✓', 'en-US': '✓'},
    'site.pricing.comparison.row_13.tier_02':{'it-IT': '✓', 'en-US': '✓'},
    'site.pricing.comparison.row_13.tier_03':{'it-IT': '✓', 'en-US': '✓'},
    'site.pricing.comparison.row_13.tier_04':{'it-IT': '', 'en-US': ''},

    'site.pricing.comparison.contact_cta':   {'it-IT': 'Parlane con un Advisor', 'en-US': 'Talk to an Advisor'},
    'site.pricing.comparison.footer_note':   {'it-IT': 'La configurazione esatta viene definita dall\'Advisor MOOD insieme allo studio.',
                                                'en-US': 'The exact configuration is defined by the MOOD Advisor together with the studio.'},

    # [5] ECOSYSTEM — accompaniment
    'site.pricing.ecosystem.eyebrow':         {'it-IT': 'Più di un software', 'en-US': 'More than software'},
    'site.pricing.ecosystem.headline':        {'it-IT': 'Blueprint è una piattaforma più un metodo.', 'en-US': 'Blueprint is a platform plus a method.'},
    'site.pricing.ecosystem.body':            {'it-IT': 'Entrare in MOOD significa essere accompagnati: dall\'onboarding alla formazione, fino al supporto operativo continuo.',
                                                'en-US': 'Joining MOOD means being supported: from onboarding to training to continuous operational support.'},
    'site.pricing.ecosystem.pillar_01.title': {'it-IT': 'Onboarding curato', 'en-US': 'Curated onboarding'},
    'site.pricing.ecosystem.pillar_01.body':  {'it-IT': 'Importazione dei progetti esistenti, configurazione del workspace, prima formazione del team.',
                                                'en-US': 'Migration of existing projects, workspace configuration, initial team training.'},
    'site.pricing.ecosystem.pillar_02.title': {'it-IT': 'Formazione continua', 'en-US': 'Ongoing training'},
    'site.pricing.ecosystem.pillar_02.body':  {'it-IT': 'Sessioni periodiche, materiali aggiornati, accesso a una community di studi che condividono pratiche.',
                                                'en-US': 'Recurring sessions, up-to-date materials, access to a community of studios sharing practices.'},
    'site.pricing.ecosystem.pillar_03.title': {'it-IT': 'Advisor di riferimento', 'en-US': 'Dedicated Advisor'},
    'site.pricing.ecosystem.pillar_03.body':  {'it-IT': 'Una persona MOOD ti conosce e ti segue. Non un ticket, non un chatbot.',
                                                'en-US': 'A MOOD person who knows you and follows you. Not a ticket, not a chatbot.'},

    # [6] CTA finale
    'site.pricing.cta.headline': {'it-IT': 'Vediamo se Blueprint è giusto per il tuo studio.', 'en-US': 'Let\'s see if Blueprint is right for your studio.'},
    'site.pricing.cta.body':     {'it-IT': 'La candidatura richiede 3 minuti. Un Advisor MOOD ti contatterà entro 2 giorni lavorativi.',
                                   'en-US': 'The application takes 3 minutes. A MOOD Advisor will contact you within 2 business days.'},
    'site.pricing.cta.label':    {'it-IT': 'Candida il tuo studio', 'en-US': 'Apply your studio'},
}


# ═══════════════════════════════════════════════════════════════════════
# UPSERT LOGIC
# ═══════════════════════════════════════════════════════════════════════

def split_key(full_key: str) -> tuple[str, str]:
    """site.features.hero.title → (site.features, hero.title)"""
    parts = full_key.split('.')
    return '.'.join(parts[:2]), '.'.join(parts[2:])


def upsert_block(cur, full_key: str, source_value: str, source_locale: str, tenant_id: str):
    namespace, block_key = split_key(full_key)
    h = hashlib.md5((source_value or '').encode('utf-8')).hexdigest()
    cur.execute("""
        INSERT INTO editorial_blocks
          (scope, tenant_id, namespace, block_key, block_type, source_locale, source_value, source_hash, is_active, updated_at)
        VALUES
          ('tenant', %s, %s, %s, 'text', %s, %s, %s, true, now())
        ON CONFLICT (tenant_id, namespace, block_key) DO UPDATE
          SET source_value = EXCLUDED.source_value,
              source_locale = EXCLUDED.source_locale,
              source_hash = EXCLUDED.source_hash,
              is_active = true,
              updated_at = now()
        RETURNING id
    """, (tenant_id, namespace, block_key, source_locale, source_value, h))
    return cur.fetchone()[0]


def upsert_translation(cur, block_id: str, locale: str, value: str, is_source: bool = False):
    h = hashlib.md5((value or '').encode('utf-8')).hexdigest()
    status = 'source' if is_source else 'manual'
    cur.execute("""
        INSERT INTO editorial_block_translations
          (block_id, locale, value, source_hash, status, generated_by, updated_at)
        VALUES
          (%s, %s, %s, %s, %s, 'human', now())
        ON CONFLICT (block_id, locale) DO UPDATE
          SET value = EXCLUDED.value,
              source_hash = EXCLUDED.source_hash,
              status = EXCLUDED.status,
              generated_by = 'human',
              updated_at = now()
    """, (block_id, locale, value, h, status))


def get_corporate_tenant_id(cur) -> str:
    cur.execute("SELECT id FROM tenants WHERE slug = 'studio' LIMIT 1")
    row = cur.fetchone()
    if not row:
        raise RuntimeError("Corporate tenant (slug=studio) not found")
    return row[0]


def apply_copy(copy_dict: dict, label: str):
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    stats = {'blocks': 0, 'translations': 0, 'errors': []}
    try:
        tenant_id = get_corporate_tenant_id(cur)
        for full_key, locales_map in copy_dict.items():
            source_value = locales_map.get(SOURCE_LOCALE, '')
            try:
                block_id = upsert_block(cur, full_key, source_value, SOURCE_LOCALE, tenant_id)
                stats['blocks'] += 1
                # source row also as translation row for resolver
                upsert_translation(cur, block_id, SOURCE_LOCALE, source_value, is_source=True)
                stats['translations'] += 1
                for tgt in TARGET_LOCALES:
                    val = locales_map.get(tgt, '')
                    upsert_translation(cur, block_id, tgt, val, is_source=False)
                    stats['translations'] += 1
            except Exception as e:
                stats['errors'].append(f"{full_key}: {e}")
                conn.rollback()
                cur = conn.cursor()
        conn.commit()
    finally:
        cur.close()
        conn.close()
    print(f"\n[{label}] blocks={stats['blocks']} translations={stats['translations']} errors={len(stats['errors'])}")
    for e in stats['errors'][:10]:
        print(f"  • {e}")
    return stats


if __name__ == '__main__':
    print(f"Source locale: {SOURCE_LOCALE} | Target locales: {TARGET_LOCALES}")
    s1 = apply_copy(FEATURES_COPY, "FEATURES")
    s2 = apply_copy(PRICING_COPY, "PRICING")
    print(f"\nTOTAL blocks: {s1['blocks']+s2['blocks']}")
    print(f"TOTAL translations: {s1['translations']+s2['translations']}")
    print(f"TOTAL errors: {len(s1['errors'])+len(s2['errors'])}")
    sys.exit(0 if not (s1['errors'] or s2['errors']) else 1)
