"""
MOOD Command Center — seed editorial copy per la Super Admin Overview.

Namespace: command.overview.*
Tono: governance editoriale, registro curatoriale.
Locale: IT (source). Fallback chain inerited from site_resolver.
"""
import asyncio
from sqlalchemy import text

from database import AsyncSessionLocal
from tenant_resolver import get_corporate_tenant


COPY = {
    # ─────────────────────── Shell
    "shell.eyebrow":        {"it": "MOOD · Command Center"},
    "shell.title":          {"it": "Quadro di governo"},
    "shell.sublead":        {"it": "Una lettura editoriale dell'ecosistema MOOD nella sua interezza."},

    # ─────────────────────── KPI cards
    "kpi.advisors.label":           {"it": "Advisor in dialogo"},
    "kpi.advisors.helper":          {"it": "Profili attivi nella rete MOOD."},

    "kpi.relations.label":          {"it": "Relazioni nell'orbitale"},
    "kpi.relations.helper":         {"it": "Studi sotto la lettura dei nostri advisor."},

    "kpi.active.label":             {"it": "Conversazioni vive"},
    "kpi.active.helper":            {"it": "In lettura, presentazione o allineamento."},

    "kpi.activated.label":          {"it": "Ecosistemi attivati"},
    "kpi.activated.helper":         {"it": "Studi che hanno aperto la propria composizione."},

    "kpi.requests.label":           {"it": "Introduzioni ricevute"},
    "kpi.requests.helper":          {"it": "Totale richieste arrivate dal sito MOOD."},

    "kpi.unassigned.label":         {"it": "Da assegnare"},
    "kpi.unassigned.helper":        {"it": "Introduzioni in attesa di un advisor."},

    "kpi.pipeline_recurring.label": {"it": "Ricorrente in osservazione"},
    "kpi.pipeline_recurring.helper":{"it": "Stima editoriale, non impegni commerciali."},

    "kpi.pipeline_setup.label":     {"it": "Setup in osservazione"},
    "kpi.pipeline_setup.helper":    {"it": "Valore di configurazione previsto in lettura."},

    # ─────────────────────── Advisor table
    "advisors.eyebrow":             {"it": "Advisor"},
    "advisors.headline":            {"it": "Le voci della rete MOOD."},
    "advisors.sublead":             {"it": "Chi cura le conversazioni, dove, e con quale ritmo."},
    "advisors.empty":               {"it": "Nessun advisor attivo. Profilo Raffaella in costruzione."},
    "advisors.col.advisor":         {"it": "Advisor"},
    "advisors.col.code":            {"it": "Codice"},
    "advisors.col.status":          {"it": "Stato"},
    "advisors.col.active":          {"it": "Vive"},
    "advisors.col.activated":       {"it": "Attivate"},
    "advisors.col.requests":        {"it": "Introduzioni"},
    "advisors.col.commission":      {"it": "Commissione"},

    # ─────────────────────── Relations table
    "relations.eyebrow":            {"it": "Studio Relations"},
    "relations.headline":           {"it": "Tutte le relazioni in lettura."},
    "relations.sublead":            {"it": "Cross-advisor. Le ultime 50 in ordine di segnale."},
    "relations.empty":              {"it": "Nessuna relazione registrata. L'osservatorio è in attesa."},
    "relations.col.studio":         {"it": "Studio"},
    "relations.col.archetype":      {"it": "Archetipo"},
    "relations.col.owner":          {"it": "Advisor"},
    "relations.col.status":         {"it": "Stato"},
    "relations.col.temperature":    {"it": "Temperatura"},
    "relations.col.value":          {"it": "Advisory Value"},
    "relations.col.last":           {"it": "Ultimo segnale"},

    # ─────────────────────── Studio Requests
    "requests.eyebrow":             {"it": "Introduzioni"},
    "requests.headline":            {"it": "Studi che hanno bussato a MOOD."},
    "requests.sublead":             {"it": "Le ultime 50 introduzioni, con il loro stato di assegnazione."},
    "requests.empty":               {"it": "Nessuna nuova introduzione. Il flusso è quieto."},
    "requests.col.studio":          {"it": "Studio"},
    "requests.col.contact":         {"it": "Contatto"},
    "requests.col.archetype":       {"it": "Archetipo"},
    "requests.col.status":          {"it": "Stato"},
    "requests.col.assignment":      {"it": "Assegnazione"},
    "requests.col.created":         {"it": "Ricevuta"},
    "requests.unassigned":          {"it": "Non assegnata"},

    # ─────────────────────── Activated Tenants
    "tenants.eyebrow":              {"it": "Tenant attivati"},
    "tenants.headline":             {"it": "Studi entrati nel proprio Blueprint."},
    "tenants.sublead":              {"it": "Ogni ecosistema ha la sua composizione. Apri il manifesto per vederla."},
    "tenants.empty":                {"it": "Nessun tenant attivato. L'ecosistema è in formazione."},
    "tenants.col.studio":           {"it": "Studio"},
    "tenants.col.slug":             {"it": "Slug"},
    "tenants.col.status":           {"it": "Stato"},
    "tenants.col.created":          {"it": "Aperto il"},
    "tenants.action.manifest":      {"it": "Manifesto"},
    "tenants.action.open":          {"it": "Apri Blueprint"},
}


async def seed():
    tenant = await get_corporate_tenant()
    tenant_id = tenant["id"]
    NAMESPACE = "command.overview"
    inserted = updated = translations = 0

    async with AsyncSessionLocal() as s:
        for block_key, locales in COPY.items():
            source_value = locales.get("it") or next(iter(locales.values()))
            row = (await s.execute(
                text("""
                    INSERT INTO editorial_blocks
                      (id, scope, tenant_id, namespace, block_key, block_type,
                       source_locale, source_value, source_hash, is_active,
                       created_at, updated_at)
                    VALUES (gen_random_uuid(), 'tenant', :tid, :ns, :bk, 'body',
                            'it', :sv, '', true, NOW(), NOW())
                    ON CONFLICT (tenant_id, namespace, block_key) DO UPDATE
                       SET source_value = EXCLUDED.source_value,
                           updated_at   = NOW()
                    RETURNING id, (xmax = 0) AS inserted
                """),
                {"tid": tenant_id, "ns": NAMESPACE, "bk": block_key, "sv": source_value},
            )).first()
            block_id = row[0]
            if row[1]: inserted += 1
            else:      updated  += 1
            for locale, value in locales.items():
                await s.execute(
                    text("""
                        INSERT INTO editorial_block_translations
                          (id, block_id, locale, value, status, generated_by,
                           source_hash, locked, created_at, updated_at)
                        VALUES (gen_random_uuid(), :bid, :loc, :val, 'manual',
                                'system-seed', '', false, NOW(), NOW())
                        ON CONFLICT (block_id, locale) DO UPDATE
                           SET value = EXCLUDED.value, updated_at = NOW()
                    """),
                    {"bid": block_id, "loc": locale, "val": value},
                )
                translations += 1
        await s.commit()
    print(f"command.overview seed: {inserted} new, {updated} refreshed, "
          f"{translations} translations.")


if __name__ == "__main__":
    asyncio.run(seed())
