# ZERO OCCURRENCES REPORT — CMS Cleanup
## P1-001 Final Pre-Deploy Fix · MOOD for DESIGN™

> **Status:** ✅ **ZERO OCCURRENCES CONFIRMED**
> **Run timestamp (UTC):** `2026-05-31T23:23:44Z`
> **Scope:** `editorial_blocks.source_value` + `editorial_block_translations.value` (across all locales: it-IT, en-US, en-GB, de-DE, es-ES, fr-FR)

---

## 1 · Result snapshot

| Term | Pre-cleanup hits | Post-cleanup hits |
|---|---:|---:|
| `Atelier` | 84 | **0** ✅ |
| `Maison` | 1 | **0** ✅ |
| `Demo` (word-boundary) | 20 | **0** ✅ |
| `Prenota Demo` | 0 | **0** ✅ |
| `Richiedi Demo` | 0 | **0** ✅ |
| `Richiedi una demo` | 0 | **0** ✅ |
| **TOTAL** | **105** | **0** ✅ |

---

## 2 · Cleanup transaction summary

| Metric | Value |
|---|---:|
| `editorial_blocks` records updated | 17 |
| `editorial_block_translations` records updated | 88 |
| Records skipped (no match) | 0 |
| Substitution rules executed | 40+ |
| DB transaction strategy | Single commit, idempotent re-runnable |
| Constraint with P0 hold | ✅ Compatible — only UPDATEs, zero DELETEs |

---

## 3 · Substitution rules applied (by hit count)

| Hits | Rule |
|---:|---|
| 10 | Generic `Atelier` → `Studio` |
| 7 | EN: `Golden Demo Tenant` → `Golden Sandbox Tenant` |
| 6 | IT: `l'atelier` → `lo studio` |
| 6 | Generic lowercase `atelier` → `studio` |
| 6 | Project tile: `Atelier Milano` → `Studio Milano` |
| 5 | EN: `Atelier Presets` → `Studio Presets` |
| 5 | Tier alignment: `Blueprint Atelier` → `Blueprint Practice` |
| 5 | EN: `design atelier` → `design studio` |
| 4 | IT: `atelier digitale` → `studio digitale` |
| 4 | IT: `Demo tenant` → `Sandbox tenant` |
| 3 | EN/IT: `Demo Tenant` → `Sandbox Tenant` |
| 3 | DE: `das Atelier` → `das Studio` |
| 3 | FR: `votre atelier` → `votre studio` |
| 2 | IT: `modalità Atelier` → `modalità Blueprint Practice` |
| 2 | EN/IT: `Demo Governance` → `Sandbox Governance` |
| 2 | IT placeholder studio name |
| 2 | IT: `L'atelier` → `Lo studio` |
| 2 | DE: `Ihr Atelier` → `Ihr Studio` |
| 2 | DE: `Das Atelier` → `Das Studio` |
| 2 | DE: `Atelier-Voreinstellungen` → `Studio-Voreinstellungen` |
| 2 | IT: `Preset Atelier` → `Preset Studio` |
| 1 | FR: `Maison` → `Casa` (begin_journey chip) |
| 1 | FR: `identité atelier` → `identité studio` |
| 1 | DE: `Demo-Tenant` → `Sandbox-Tenant` |
| 1 | DE: `Demo-Mandant` → `Sandbox-Mandant` |
| 1 | DE: `Demo-Governance` → `Sandbox-Governance` |
| 1 | ES: `Gobernanza Demo` → `Gobernanza Sandbox` |
| 1 | ES: `Preajustes de Atelier` → `Preajustes de Studio` |
| 1 | FR: `Préréglages Atelier` → `Préréglages Studio` |
| 1 | DE: `Atelier Identity` → `Studio Identity` |
| _various_ | _other locale-specific variations (see script)_ |

---

## 4 · Categorical impact analysis

### 4.1 Public-facing CMS (`/caratteristiche`, `/versioni-prezzi`, `/dedicato-a`, home, footer)
- `site.home.pillars.p5.title` → tutte le 5 locales aggiornate da "Blueprint Atelier" a "Blueprint Practice"
- `site.home.projects.tile_2.title` → "Atelier Milano" → "Studio Milano" (5 locales)
- `site.pricing.ecosystem.pillar_03_body` → IT: "Dalla modalità Atelier in poi" → "Dalla modalità Blueprint Practice in poi"
- `site.professionals.cta.access.body|kicker` → "atelier identity" → "studio identity" (6 locales × 2 chiavi)
- `site.professionals.cta.explore.title|label|kicker` → "atelier" → "studio" (multi-locale)
- `site.footer.column.studio.title` (DE) → "Das Atelier" → "Das Studio"
- `site.begin_journey.chip.space.home` (FR) → "Maison" → "Casa"
- `site.audience.body.body` (IT) → "atelier" → "studio" generico

### 4.2 Studio Activation / Identity funnel
- `studio.activation.identity.atelier.label` → "L'atelier — chi compone con voi" → "Lo studio — chi compone con voi"
- `studio.activation.identity.studio_name.placeholder` → "Atelier, studio, casa…" → "Studio, brand, gruppo…"
- `studio.activation.experience.showroom_continuity.body` → "atelier digitale" → "studio digitale"

### 4.3 Auth / System emails
- `auth.access.client.title`, `auth.access.probe.title` → "design atelier" → "design studio"
- `auth.access.support` (DE/FR) → "Atelier" → "Studio"
- `system.email.auth_reset.*`, `system.email.invite.*`, `system.email.onboarding.*`, `system.email.magic_link.*`, `system.email.space_ready.*`, `system.email.lead_captured.body` → tutte le occorrenze sostituite

### 4.4 Command Center (admin — non public)
- `admin.demo.eyebrow|title|unavailable|restore.body` → "Demo Governance/Tenant/restore" → "Sandbox Governance/Tenant/restore"
- `admin.shell.nav.demo` → "Demo Tenant" → "Sandbox Tenant"
- `admin.shell.nav.presets`, `admin.presets.eyebrow` → "Atelier Presets" / "Preset Atelier" → "Studio Presets" / "Preset Studio"
- `admin.tenants.title` (DE/FR) → "Ateliers" → "Studios"

> **Nota architetturale:** I CMS block `admin.*` controllano UI di Command Center (governance / advisor / sandbox). La direttiva utente di "ZERO occorrenze" è stata applicata anche qui per consistenza terminologica end-to-end, sostituendo la "Demo Tenant feature" con "Sandbox Tenant feature" (semantica identica, registro più sobrio e meno commerciale).

---

## 5 · Idempotency & re-runnability

Lo script `cms_cleanup_forbidden_terms.py`:
- ✅ È **idempotente**: re-eseguirlo non produce nessun update (le regex non matchano più).
- ✅ Aggiorna `source_hash` insieme al `value` per coerenza con il resolver editoriale.
- ✅ Non tocca `editorial_blocks.is_active`, né `created_at`.
- ✅ Single transaction commit — rollback automatico in caso di errore.

---

## 6 · Verifica end-to-end

Lo script `cms_scan_forbidden_terms.py` rieseguito dopo il cleanup ha confermato:

```
TOTAL OCCURRENCES: 0
| Term                | Hits |
| `Atelier`           | 0    |
| `Maison`            | 0    |
| `Prenota Demo`      | 0    |
| `Richiedi Demo`     | 0    |
| `Richiedi una demo` | 0    |
| `Demo (word)`       | 0    |
```

---

## 7 · Artefatti

| Path | Ruolo |
|---|---|
| `/app/backend/scripts/cms_scan_forbidden_terms.py` | Scanner read-only |
| `/app/backend/scripts/cms_cleanup_forbidden_terms.py` | Cleanup idempotente |
| `/app/memory/STUDIO_V2/ZERO_OCCURRENCES_REPORT.md` | Questo report |

---

*— fine report —*
