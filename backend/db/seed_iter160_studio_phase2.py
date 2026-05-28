"""
ITER160 Phase 2 — Seed editorial copy for Movements III, IV, V.

Tone: editorial / architectural / hospitality.
Italian-first; EN/FR/DE/ES intentionally deferred to manual editorial
review (see ITER160 PRD §13 acceptance criteria).
"""
import asyncio
from sqlalchemy import text

from database import AsyncSessionLocal
from tenant_resolver import get_corporate_tenant


COPY = {
    # ────────────────────────── Movement III — Ecosystem
    "ecosystem.eyebrow":          {"it": "Movimento terzo"},
    "ecosystem.headline":         {"it": "Componi il tuo spazio operativo."},
    "ecosystem.sublead":          {"it": "Le esperienze che inviti oggi possono crescere con lo studio. Niente è bloccato."},
    "ecosystem.included_line":    {"it": "— inclusa nella tua composizione."},
    "ecosystem.exclude_line":     {"it": "— non per ora."},
    "ecosystem.continue_cta":     {"it": "Continua"},
    "ecosystem.helper":           {"it": "Puoi sempre invitare nuove esperienze nella tua composizione."},

    # ────────────────────────── Movement IV — Identity
    "identity.eyebrow":           {"it": "Movimento quarto"},
    "identity.headline":          {"it": "Lascia che il tuo studio si presenti."},
    "identity.sublead":           {"it": "Pochi tratti — nome, lingua, mercati, persone. La composizione cresce mentre la scrivi."},
    "identity.studio_name.label":       {"it": "Il nome del tuo studio"},
    "identity.studio_name.placeholder": {"it": "Atelier, studio, casa…"},
    "identity.monogram.label":          {"it": "Il vostro monogramma editoriale"},
    "identity.monogram.helper":         {"it": "Una o due lettere — come una firma."},
    "identity.where.label":             {"it": "Dove componete"},
    "identity.where.city_placeholder":  {"it": "Milano"},
    "identity.where.country_placeholder": {"it": "Italia"},
    "identity.languages.label":         {"it": "Le lingue del vostro studio"},
    "identity.atelier.label":           {"it": "L'atelier — chi compone con voi"},
    "identity.atelier.name_placeholder":{"it": "Nome e cognome"},
    "identity.atelier.role_placeholder":{"it": "Ruolo"},
    "identity.atelier.add":             {"it": "Invita un altro nome"},
    "identity.markets.label":           {"it": "I mondi in cui progettate"},
    "identity.temperament.label":       {"it": "Il temperamento del vostro workflow"},
    "identity.temperament.helper":      {"it": "Una scelta atmosferica. Influenzerà discretamente densità, ritmo, suggerimenti."},
    "identity.contact.eyebrow":         {"it": "Il vostro riferimento"},
    "identity.contact.headline":        {"it": "Come possiamo continuare la conversazione."},
    "identity.contact.name_placeholder":{"it": "Il tuo nome"},
    "identity.contact.role_placeholder":{"it": "Il tuo ruolo nello studio"},
    "identity.contact.email_label":     {"it": "Email"},
    "identity.contact.email_placeholder":{"it": "nome@studio.com"},
    "identity.contact.phone_label":     {"it": "Telefono"},
    "identity.contact.phone_prefix_placeholder": {"it": "+39"},
    "identity.contact.phone_number_placeholder": {"it": "Numero"},
    "identity.contact.website_label":   {"it": "Sito web dello studio"},
    "identity.contact.website_placeholder": {"it": "www.studio.com"},
    "identity.contact.notes_label":     {"it": "Cosa vi attende da MOOD"},
    "identity.contact.notes_placeholder":{"it": "Progetti, materiali, ambizioni — quanto desiderate condividere."},
    "identity.continue_cta":            {"it": "Invia la richiesta"},
    "identity.confirm_inline":          {"it": "Composto."},

    # ────────────────────────── Movement V — Request
    "request.eyebrow":      {"it": "Richiesta ricevuta"},
    "request.headline":     {"it": "La tua composizione è stata ricevuta."},
    "request.body":         {"it": "Un MOOD Advisor leggerà il profilo del vostro studio e vi contatterà per continuare la conversazione."},
    "request.guided_intro": {"it": "MOOD viene introdotto attraverso una presentazione guidata e una configurazione sartoriale, costruita intorno al workflow, ai materiali, ai mercati e all'esperienza dei vostri clienti."},
    "request.reference_label": {"it": "Riferimento della richiesta"},
    "request.return_cta":   {"it": "Torna a MOOD"},

    # ────────────────────────── Temperament cards
    "temperament.quiet.title":     {"it": "Quieto"},
    "temperament.quiet.body":      {"it": "Le decisioni maturano con lentezza. Lo studio preferisce la contemplazione alla velocità."},
    "temperament.composed.title":  {"it": "Composto"},
    "temperament.composed.body":   {"it": "Un ritmo di iterazioni meditate. La maggior parte degli studi inizia qui."},
    "temperament.vivid.title":     {"it": "Vivido"},
    "temperament.vivid.body":      {"it": "Composizione rapida, decisioni quotidiane, ritmo immediato."},

    # ────────────────────────── Markets
    "market.private_residential": {"it": "Residenziale privato"},
    "market.hospitality":         {"it": "Hospitality"},
    "market.cultural":            {"it": "Culturale"},
    "market.yacht":               {"it": "Yacht"},
    "market.aviation":            {"it": "Aviation"},
    "market.retail":              {"it": "Retail"},
    "market.office":              {"it": "Office"},
    "market.showroom":            {"it": "Showroom"},
    "market.restaurant":          {"it": "Restaurant"},

    # ────────────────────────── Roles
    "role.founder":         {"it": "Founder"},
    "role.partner":         {"it": "Partner"},
    "role.designer":        {"it": "Designer"},
    "role.project_lead":    {"it": "Project Lead"},
    "role.curator":         {"it": "Curator"},
    "role.advisor":         {"it": "Advisor"},
    "role.studio_manager":  {"it": "Studio Manager"},

    # ────────────────────────── Languages (display labels)
    "language.it":     {"it": "Italiano"},
    "language.en-us":  {"it": "English"},
    "language.fr":     {"it": "Français"},
    "language.de":     {"it": "Deutsch"},
    "language.es":     {"it": "Español"},

    # ────────────────────────── Experiences
    "experience.design_journey_os.title": {"it": "Design Journey OS"},
    "experience.design_journey_os.body":  {"it": "Il sistema operativo editoriale di ogni progetto — dall'ascolto alla realizzazione."},
    "experience.material_intelligence.title": {"it": "Material Intelligence"},
    "experience.material_intelligence.body":  {"it": "Una memoria relazionale di materiali, finiture e dei progetti che hanno modellato."},
    "experience.moodboard_experience.title": {"it": "Moodboard Experience"},
    "experience.moodboard_experience.body":  {"it": "Atmosfere composte — relazionali, non archivi visivi."},
    "experience.showroom_continuity.title":  {"it": "Showroom Continuity"},
    "experience.showroom_continuity.body":   {"it": "Il tessuto connettivo tra showroom fisico e atelier digitale."},
    "experience.client_presentation_flow.title": {"it": "Client Presentation Flow"},
    "experience.client_presentation_flow.body":  {"it": "Presentazioni immersive dove le decisioni diventano un momento, non una riunione."},
}


async def seed():
    tenant = await get_corporate_tenant()
    tenant_id = tenant["id"]
    NAMESPACE = "studio.activation"
    inserted = 0
    updated  = 0
    translations = 0
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
            if row[1]:
                inserted += 1
            else:
                updated += 1
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
    print(f"studio.activation seed (Movements III + IV + V): "
          f"{inserted} new, {updated} refreshed, {translations} translations.")


if __name__ == "__main__":
    asyncio.run(seed())
