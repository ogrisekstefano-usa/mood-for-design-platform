# I18N-CLOSURE-SPRINT — DELIVERABLE 3: MISSING KEYS REPORT
> Prodotto: 10 Jun 2026 · Agente: E1-Fork · Sprint: I18N-CLOSURE-SPRINT

---

## 1. Stato Attuale Post-Sprint

| Categoria | # Chiavi Mancanti | Stato |
|-----------|-------------------|-------|
| JSON de-sync (it-IT vs en-US) | **0** | ✅ RISOLTO |
| CRM pages runtime (AccountsPage, Leads, Prospects, Members) | **0** | ✅ RISOLTO |
| DesignJourneyTab (dopo FASE 2) | **0** | ✅ RISOLTO |
| Auth pages (pre-esistente, fuori scope) | **28** | ⚠️ NOTO |
| JourneyOperatingPage (hardcoded) | **~12** | ⚠️ NOTO |

---

## 2. De-sync JSON: 0 Chiavi (RISOLTO)

Il de-sync precedente è stato completamente risolto in questo sprint:

| Chiave | Fix applicato |
|--------|--------------|
| `members.toast_required_fields` | Aggiunta in `en-US.json` |
| `nav.section.*` (25 chiavi) | Sincronizzate in entrambi i JSON |

**Stato finale**: `it-IT.json` = 1939 chiavi · `en-US.json` = 1939 chiavi · **Delta = 0**.

---

## 3. Chiavi Mancanti Residue — Auth Pages (28 chiavi, PRE-ESISTENTE)

Classificazione: **FUORI SCOPE SPRINT** — chiavi pre-esistenti ante FASE 1.
Rilevate a runtime dall'overlay di governance (testing agent `iteration_236.json`).

### 3.1 Namespace `auth.login.*` — 8 chiavi
| Chiave | Usata in | Stato JSON |
|--------|----------|------------|
| `auth.login.brand_logo` | `LoginPage.jsx` | ❌ MANCANTE |
| `auth.login.cta` | `LoginPage.jsx` | ❌ MANCANTE |
| `auth.login.email_label` | `LoginPage.jsx` | ❌ MANCANTE |
| `auth.login.email_placeholder` | `LoginPage.jsx` | ❌ MANCANTE |
| `auth.login.eyebrow` | `LoginPage.jsx` | ❌ MANCANTE |
| `auth.login.hero_image` | `LoginPage.jsx` | ❌ MANCANTE |
| `auth.login.password_label` | `LoginPage.jsx` | ❌ MANCANTE |
| `auth.login.password_placeholder` | `LoginPage.jsx` | ❌ MANCANTE |

### 3.2 Namespace `auth.access.*` — 5 chiavi
| Chiave | Usata in | Stato JSON |
|--------|----------|------------|
| `auth.access.need_help` | `AccessEntryPage.jsx` | ❌ MANCANTE |
| `auth.access.quote` | `AccessEntryPage.jsx` | ❌ MANCANTE |
| `auth.access.quote_author` | `AccessEntryPage.jsx` | ❌ MANCANTE |
| `auth.access.support` | `AccessEntryPage.jsx` | ❌ MANCANTE |
| `auth.access.support_email` | `AccessEntryPage.jsx` | ❌ MANCANTE |

### 3.3 Namespace `access.*` — 15 chiavi
| Chiave | Usata in | Stato JSON |
|--------|----------|------------|
| `access.back_to_home` | `AccessEntryPage.jsx` | ❌ MANCANTE |
| `access.confirm_body` | `AccessEntryPage.jsx` | ❌ MANCANTE |
| `access.confirm_hint` | `AccessEntryPage.jsx` | ❌ MANCANTE |
| `access.confirm_title` | `AccessEntryPage.jsx` | ❌ MANCANTE |
| `access.cta` | `AccessEntryPage.jsx` | ❌ MANCANTE |
| `access.email_label` | `AccessEntryPage.jsx` | ❌ MANCANTE |
| `access.email_placeholder` | `AccessEntryPage.jsx` | ❌ MANCANTE |
| `access.error_generic` | `AccessEntryPage.jsx` | ❌ MANCANTE |
| `access.eyebrow` | `AccessEntryPage.jsx` | ❌ MANCANTE |
| `access.new_journey` | `AccessEntryPage.jsx` | ❌ MANCANTE |
| `access.new_journey_cta` | `AccessEntryPage.jsx` | ❌ MANCANTE |
| `access.send_another` | `AccessEntryPage.jsx` | ❌ MANCANTE |
| `access.submitting` | `AccessEntryPage.jsx` | ❌ MANCANTE |
| `access.subtitle` | `AccessEntryPage.jsx` | ❌ MANCANTE |
| `access.title` | `AccessEntryPage.jsx` | ❌ MANCANTE |

> **Nota**: Le chiavi `access.*` usano E3 (`useBlueprint().t`) che ha fallback incorporato.
> A runtime mostrano il fallback EN hardcoded, non `⟦key⟧`. Sono invisibili all'overlay
> solo se il fallback è visivamente corretto. Bassa urgenza operativa ma meritano fix.

---

## 4. Chiavi Mancanti — JourneyOperatingPage (hardcoded, ~12 chiavi)

`JourneyOperatingPage.jsx` usa E3 con fallback inline (`t('key', null, 'fallback')`).
Le chiavi non esistono nei JSON ma la UI mostra comunque il fallback EN.

| Chiave (fallback) | Valore fallback | Stato JSON |
|-------------------|----------------|------------|
| `journey.meta_client` | "Client" | ❌ NON IN JSON |
| `journey.meta_status` | "Status" | ❌ NON IN JSON |
| `journey.meta_next_action` | "Next Action" | ❌ NON IN JSON |
| `journey.roadmap_title` | "Journey Roadmap" | ❌ NON IN JSON |
| `journey.phase_in_progress` | "In progress" | ❌ NON IN JSON |
| `journey.steps_done` | "steps done" | ❌ NON IN JSON |
| `journey.phase_upcoming` | "Upcoming" | ❌ NON IN JSON |
| `journey.phase_open` | "Open" | ❌ NON IN JSON |
| `journey.no_checklist_items` | "No checklist items yet for this phase." | ❌ NON IN JSON |
| `journey.related_assets` | "Related Assets" | ❌ NON IN JSON |
| `journey.no_assets` | "No assets are linked to this phase yet." | ❌ NON IN JSON |
| `journey.done` | "Done" | ❌ NON IN JSON |
| `journey.started` | "Started" | ❌ NON IN JSON |
| `journey.open_discovery_engine` | "Open Discovery Engine" | ❌ NON IN JSON |
| `journey.open_first_conversation` | "Open the first design conversation." | ❌ NON IN JSON |
| `journey.wizard_hint` | "Visual-first wizard…" | ❌ NON IN JSON |

> **Impatto**: L'utente italiano vede testi in EN su JourneyOperatingPage.
> Urgenza: **MEDIA** — la pagina è funzionale ma non tradotta.
> Azione suggerita: aggiungere ~16 chiavi a `journey.*` nei JSON in prossimo sprint.

---

## 5. Classificazione per Modulo

| Modulo | # Missing | Priorità | In scope prossimo sprint? |
|--------|-----------|----------|--------------------------|
| Auth (login, access) | 28 | P1 | Sì — sprint breve |
| JourneyOperatingPage | ~16 | P1 | Sì — aggiungere chiavi JSON |
| DesignJourneyTab | **0** | — | — (risolto) |
| CRM (Accounts, Leads, Prospects, Members) | **0** | — | — (risolto) |
| Dashboard | **0** | — | — |
| Moodboard | **0** | — | — |
| Specifications | **0** | — | — |

---

## 6. Mappa de-sync precedente (ora risolto)

Prima di questo sprint (pre-I18N-CLOSURE-SPRINT):
- it-IT: **1908 chiavi** · en-US: **1883 chiavi** · Delta: **25 chiavi IT-only**
- Fix applicato: 25 chiavi sincronizzate, `members.toast_required_fields` aggiunta in en-US
- Stato finale: **0 de-sync**

---

*Documento generato automaticamente dall'analisi statica del codebase — I18N-CLOSURE-SPRINT*
