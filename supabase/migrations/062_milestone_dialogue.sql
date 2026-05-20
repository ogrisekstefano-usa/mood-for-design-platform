-- 062 · Milestone Dialogue · Sprint F.B
--
-- Tre superfici nuove che trasformano il Design Journey™ da timeline
-- operativa in dialogo progettuale immersivo:
--
--   1. milestone_versions  — capitoli progettuali (NON "V1/V2").
--                            label editoriale italiano (Direzione
--                            iniziale, Evoluzione proposta, Variante
--                            condivisa, Revisione materica, Nuova
--                            interpretazione, Direzione finale).
--
--   2. milestone_feedback  — conversazione curatoriale cliente.
--                            kind ENUM con 9 voci editoriali italiane
--                            (mai "approve / reject / comment").
--
--   3. project_rationale   — il "perché" delle scelte, persistito su
--                            projects.metadata_json.rationale_json.

-- 1. milestone_versions ─────────────────────────────────────────────
create table if not exists milestone_versions (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null,
    milestone_id    uuid not null,
    -- Editorial Italian chapter label. NEVER "V1/V2/V3".
    chapter_kind    text not null check (chapter_kind in (
        'initial_direction',          -- Direzione iniziale
        'proposed_evolution',          -- Evoluzione proposta
        'shared_variant',              -- Variante condivisa
        'material_revision',           -- Revisione materica
        'new_interpretation',          -- Nuova interpretazione
        'final_direction',             -- Direzione finale
        'lighter_variant',             -- Variante più luminosa
        'more_material_variant',       -- Direzione più materica
        'hospitality_interpretation',  -- Interpretazione hospitality
        'minimal_contemporary'         -- Evoluzione minimal contemporanea
    )),
    title           text not null,
    summary         text,
    rationale       text,
    palette_hint    jsonb default '[]',
    cover_url       text,
    created_by      uuid,
    created_at      timestamptz default now(),
    updated_at      timestamptz default now()
);

create index if not exists idx_mvers_milestone on milestone_versions (milestone_id, created_at desc);
create index if not exists idx_mvers_tenant    on milestone_versions (tenant_id);


-- 2. milestone_feedback ─────────────────────────────────────────────
create table if not exists milestone_feedback (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null,
    milestone_id    uuid not null,
    version_id      uuid,
    -- Editorial Italian feedback kinds — NEVER "approve / reject".
    kind            text not null check (kind in (
        'embraces',                  -- Questa direzione mi rappresenta
        'explore_atmosphere',         -- Vorrei approfondire questa atmosfera
        'request_variant',            -- Possiamo esplorare una variante?
        'material_loved',             -- Questo materiale mi convince
        'wants_lighter',              -- Vorrei una proposta più luminosa
        'storytelling_strong',        -- Questa soluzione racconta bene il progetto
        'wants_more_material',        -- Mi piacerebbe vedere un'alternativa più materica
        'palette_works',              -- Questa palette funziona molto bene
        'request_detail',             -- Vorrei approfondire questo dettaglio
        'free_voice'                  -- voce libera, prosa editoriale
    )),
    -- Optional free-text voice from the client/designer ("quote").
    quote           text,
    author_role     text default 'client',
    author_user_id  uuid,
    created_at      timestamptz default now()
);

create index if not exists idx_mfb_milestone on milestone_feedback (milestone_id, created_at desc);
create index if not exists idx_mfb_tenant    on milestone_feedback (tenant_id);
