"""
ITER161 — Seed editorial copy for Studio Relations & Advisor Console.

Tone: curatorial / private banking / editorial operations.
No CRM / sales / pipeline / lead vocabulary. Italian first.
"""
import asyncio
from sqlalchemy import text

from database import AsyncSessionLocal
from tenant_resolver import get_corporate_tenant


COPY = {
    # ─────────────────────── Console shell
    "console.eyebrow":          {"it": "Advisor Console"},
    "console.headline":         {"it": "Le tue relazioni di studio."},
    "console.sublead":          {"it": "Un osservatorio editoriale sulle conversazioni in corso con l'ecosistema."},

    "console.nav.console":      {"it": "Quadro generale"},
    "console.nav.relations":    {"it": "Studio Relations"},
    "console.nav.followups":    {"it": "Promemoria di lettura"},
    "console.nav.pending":      {"it": "Introduzioni in attesa"},

    # ─────────────────────── Quadro generale (summary)
    "summary.eyebrow":          {"it": "Quadro generale"},
    "summary.headline":         {"it": "L'ecosistema, in questo momento."},
    "summary.total.label":      {"it": "Relazioni curate"},
    "summary.total.helper":     {"it": "Studi nel tuo orbitale advisor."},
    "summary.active.label":     {"it": "Conversazioni vive"},
    "summary.active.helper":    {"it": "In dialogo, lettura, o preparazione di una presentazione."},
    "summary.activated.label":  {"it": "Ecosistemi attivati"},
    "summary.activated.helper": {"it": "Studi che hanno aperto la loro composizione MOOD."},
    "summary.ready.label":      {"it": "Pronti all'apertura"},
    "summary.ready.helper":     {"it": "Allineamento editoriale completo, da approvare."},
    "summary.advisory_value":   {"it": "Advisory Value in osservazione"},
    "summary.advisory.recurring": {"it": "ricorrente mensile"},
    "summary.advisory.setup":   {"it": "valore di configurazione iniziale"},
    "summary.advisory.helper":  {"it": "Stime indicative dalla tua lettura — non impegni commerciali."},

    # ─────────────────────── Pending introductions
    "pending.eyebrow":          {"it": "Introduzioni in attesa"},
    "pending.headline":         {"it": "Studi che hanno chiesto una conversazione."},
    "pending.empty":            {"it": "Nessuna nuova introduzione in attesa. Le conversazioni vive sono di sotto."},
    "pending.open_cta":         {"it": "Apri la lettura"},
    "pending.archetype.label":  {"it": "Archetipo"},
    "pending.received":         {"it": "Ricevuta"},
    "pending.reviewing":        {"it": "In lettura"},

    # ─────────────────────── Studio Relations list
    "relations.eyebrow":        {"it": "Studio Relations"},
    "relations.headline":       {"it": "Il tuo network in lettura."},
    "relations.sublead":        {"it": "Ogni relazione racconta una storia. Cura il ritmo, non la velocità."},
    "relations.empty":          {"it": "Nessuna relazione attiva. Apri una introduzione per iniziare."},
    "relations.new_cta":        {"it": "Apri una nuova relazione"},
    "relations.filter.all":     {"it": "Tutte"},
    "relations.filter.active":  {"it": "Attive"},
    "relations.filter.ready":   {"it": "Pronte all'apertura"},
    "relations.filter.activated":{"it": "Attivate"},
    "relations.filter.archived":{"it": "In archivio"},
    "relations.col.studio":     {"it": "Studio"},
    "relations.col.archetype":  {"it": "Archetipo"},
    "relations.col.status":     {"it": "Stato"},
    "relations.col.temperature":{"it": "Temperatura"},
    "relations.col.value":      {"it": "Advisory Value"},
    "relations.col.last":       {"it": "Ultimo segnale"},

    # ─────────────────────── Status (curatorial)
    "status.prospect":               {"it": "Osservazione iniziale"},
    "status.under_review":           {"it": "In lettura editoriale"},
    "status.contacted":              {"it": "Conversazione aperta"},
    "status.presentation_scheduled": {"it": "Presentazione programmata"},
    "status.presented":              {"it": "Presentazione consegnata"},
    "status.qualified":              {"it": "Allineamento editoriale"},
    "status.proposal":               {"it": "Proposta in lettura"},
    "status.activated":              {"it": "Ecosistema attivato"},
    "status.not_aligned":            {"it": "Non allineato"},
    "status.archived":               {"it": "In archivio"},

    # ─────────────────────── Temperature (curatorial)
    "temperature.cold":     {"it": "In ascolto"},
    "temperature.warm":     {"it": "In dialogo"},
    "temperature.strong":   {"it": "In allineamento"},
    "temperature.ready":    {"it": "Pronto all'apertura"},

    # ─────────────────────── Detail page
    "detail.back":              {"it": "Torna alla console"},
    "detail.section.identity":  {"it": "Provenienza"},
    "detail.section.timeline":  {"it": "Cartella curatoriale"},
    "detail.section.value":     {"it": "Advisory Value"},
    "detail.section.notes":     {"it": "Note dell'advisor"},
    "detail.section.followups": {"it": "Promemoria di lettura"},
    "detail.section.visits":    {"it": "Visit Reports"},
    "detail.notes.placeholder": {"it": "Osservazioni libere. Atmosfera. Tensioni. Risonanze."},
    "detail.notes.save":        {"it": "Salva la lettura"},
    "detail.notes.saved":       {"it": "Letto."},
    "detail.next_action.label": {"it": "Prossimo movimento"},
    "detail.next_action.placeholder": {"it": "Una sola frase. Il prossimo passo curatoriale."},
    "detail.status.label":      {"it": "Stato della relazione"},
    "detail.temperature.label": {"it": "Temperatura"},
    "detail.activate_cta":      {"it": "Apri l'Ecosistema dello Studio"},
    "detail.activate.helper":   {"it": "Attivazione curatoriale privata. Crea il tenant, invita il founder, apre la composizione."},

    # ─────────────────────── Identity Verification (the killer feature)
    "identity_check.eyebrow":   {"it": "Provenienza dello studio"},
    "identity_check.clear":     {"it": "Nessuna risonanza nel network. Puoi procedere con tranquillità."},
    "identity_check.possible":  {"it": "Una possibile risonanza nel network."},
    "identity_check.existing":  {"it": "Questo studio è già in lettura nel network."},
    "identity_check.active_tenant":{"it": "Lo studio fa già parte dell'ecosistema MOOD."},
    "identity_check.confidence.high": {"it": "Risonanza alta"},
    "identity_check.confidence.medium": {"it": "Risonanza media"},
    "identity_check.confidence.low":    {"it": "Lieve eco"},
    "identity_check.owner":     {"it": "In cura presso"},
    "identity_check.last_signal":{"it": "Ultimo segnale"},
    "identity_check.proceed":   {"it": "Procedi comunque"},
    "identity_check.open_existing": {"it": "Apri la relazione esistente"},

    # ─────────────────────── Visit Report
    "visit.eyebrow":            {"it": "Visit Report"},
    "visit.headline":           {"it": "Una lettura curatoriale dello studio."},
    "visit.sublead":            {"it": "Non note commerciali. Una mappa dell'atmosfera, del rituale, del materiale."},
    "visit.atmosphere.label":   {"it": "Atmosfera osservata"},
    "visit.atmosphere.placeholder":{"it": "Un paragrafo libero. Luce, ritmo, persone, silenzio."},
    "visit.workflow.label":     {"it": "Maturità del workflow"},
    "visit.showroom.label":     {"it": "Qualità dello showroom"},
    "visit.material.label":     {"it": "Cultura del materiale"},
    "visit.alignment.label":    {"it": "Allineamento al Design Journey"},
    "visit.client.label":       {"it": "Maturità del cliente esperienziale"},
    "visit.international.label":{"it": "Apertura internazionale"},
    "visit.digital.label":      {"it": "Maturità digitale"},
    "visit.complexity.label":   {"it": "Complessità operativa"},
    "visit.scale.0":            {"it": "Non osservato"},
    "visit.scale.1":            {"it": "Nascente"},
    "visit.scale.2":            {"it": "In formazione"},
    "visit.scale.3":            {"it": "Maturo"},
    "visit.scale.4":            {"it": "Sofisticato"},
    "visit.scale.5":            {"it": "Eccezionale"},
    "visit.opportunities.label":{"it": "Opportunità lette"},
    "visit.objections.label":   {"it": "Tensioni emerse"},
    "visit.competitors.label":  {"it": "Strumenti in uso oggi"},
    "visit.next_step.label":    {"it": "Prossimo movimento curatoriale"},
    "visit.value.eyebrow":      {"it": "Advisory Value indicativo"},
    "visit.value.monthly":      {"it": "Ricorrente mensile"},
    "visit.value.setup":        {"it": "Configurazione iniziale"},
    "visit.value.probability":  {"it": "Probabilità di apertura"},
    "visit.save_cta":           {"it": "Archivia la lettura"},
    "visit.saved":              {"it": "Lettura archiviata."},

    # ─────────────────────── Follow-ups (promemoria)
    "followup.eyebrow":         {"it": "Promemoria di lettura"},
    "followup.empty":           {"it": "Nessun promemoria. La relazione respira."},
    "followup.add_cta":         {"it": "Aggiungi un promemoria"},
    "followup.type.label":      {"it": "Tipo di movimento"},
    "followup.type.call":       {"it": "Chiamata"},
    "followup.type.email":      {"it": "Lettera"},
    "followup.type.visit":      {"it": "Visita"},
    "followup.type.demo":       {"it": "Presentazione guidata"},
    "followup.type.internal_review":{"it": "Revisione interna"},
    "followup.type.activation": {"it": "Apertura ecosistema"},
    "followup.type.proposal":   {"it": "Lettura della proposta"},
    "followup.due.label":       {"it": "Quando"},
    "followup.notes.label":     {"it": "Nota di contesto"},
    "followup.complete_cta":    {"it": "Segna come letto"},
    "followup.bucket.overdue":  {"it": "In ritardo di lettura"},
    "followup.bucket.today":    {"it": "Oggi"},
    "followup.bucket.this_week":{"it": "Questa settimana"},
    "followup.bucket.scheduled":{"it": "Più avanti"},

    # ─────────────────────── Timeline event labels
    "event.relation_opened":         {"it": "Relazione aperta"},
    "event.contact_made":            {"it": "Prima conversazione"},
    "event.presentation_scheduled":  {"it": "Presentazione programmata"},
    "event.presentation_delivered":  {"it": "Presentazione guidata consegnata"},
    "event.visit_recorded":          {"it": "Visit Report archiviato"},
    "event.status_changed":          {"it": "Cambio di stato"},
    "event.temperature_changed":     {"it": "Cambio di temperatura"},
    "event.ownership_changed":       {"it": "Passaggio di consegna"},
    "event.followup_created":        {"it": "Promemoria aggiunto"},
    "event.followup_completed":      {"it": "Promemoria letto"},
    "event.ecosystem_aligned":       {"it": "Allineamento editoriale"},
    "event.activated":               {"it": "Ecosistema attivato"},
    "event.archived":                {"it": "Archiviato"},
    "event.note_added":              {"it": "Nota aggiunta"},

    # ─────────────────────── Open Studio Ecosystem (the sacred moment)
    "activation.eyebrow":       {"it": "Apertura dell'ecosistema"},
    "activation.headline":      {"it": "Attivazione curatoriale privata."},
    "activation.sublead":       {"it": "Un momento, non un processo. Lo studio entra ufficialmente nell'orbita MOOD."},
    "activation.review.title":  {"it": "Revisione finale"},
    "activation.review.studio": {"it": "Studio"},
    "activation.review.archetype":{"it": "Archetipo"},
    "activation.review.experiences":{"it": "Composizione iniziale"},
    "activation.review.advisor":{"it": "Advisor in cura"},
    "activation.review.founder":{"it": "Founder che riceverà l'invito"},
    "activation.confirm_cta":   {"it": "Conferma l'apertura"},
    "activation.cancel_cta":    {"it": "Non ancora"},
    "activation.confirmation.title":{"it": "L'ecosistema è aperto."},
    "activation.confirmation.body":{"it": "Lo studio ha ricevuto la sua chiave editoriale. Un Magic Link è in viaggio verso il founder."},
    "activation.confirmation.tenant":{"it": "Tenant"},
    "activation.confirmation.return":{"it": "Torna alla console"},
}


async def seed():
    tenant = await get_corporate_tenant()
    tenant_id = tenant["id"]
    NAMESPACE = "admin.studioRelations"
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
    print(f"admin.studioRelations seed: {inserted} new, "
          f"{updated} refreshed, {translations} translations.")


if __name__ == "__main__":
    asyncio.run(seed())
