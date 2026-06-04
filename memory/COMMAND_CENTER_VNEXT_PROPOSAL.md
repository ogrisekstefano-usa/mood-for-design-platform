# COMMAND CENTER vNEXT PROPOSAL
*A Forward-Looking Redesign for High-Velocity Decision Making*

## 1. Executive Summary: The Redesign Thesis
The MOOD Command Center currently suffers from an identity crisis: it looks like an editorial magazine but needs to function like a high-speed Relationship Operating System. To fix this, we must pivot away from "beauty for beauty's sake" and embrace **"Functional Luxury"**. 

**Core Principles:**
- **Density over decoration**: Use tight spacing and data-grids.
- **Answers instantly**: Every screen immediately surfaces: *What requires attention? What changed? What is overdue? What is next? Who owns this?*
- **Aesthetic**: Swiss Brutalism meets Dark Luxury. Sharp edges, 1px borders, high-contrast typography, zero generic rounded SaaS elements. (Targeting benchmarks like Attio, Linear).

---

## 2. Relationship Center vNext (Tenant Detail)
*Validating the user's proposed 3-Column Layout*

**Workflow Rationale for 3 Columns:** APPROVED. 
An advisor managing a relationship needs to hold three contexts simultaneously without switching tabs:
1. **Who am I talking to?** (Contacts - Left)
2. **What is the history?** (Timeline - Center)
3. **What must I do right now?** (Follow-ups - Right)
Hiding any of these behind a tab destroys efficiency.

### ASCII Wireframe
```text
┌─────────────────────────────────────────────────────────────────────────┐
│ [KPI STRIP] Status: ACTIVE | Health: 64 | Owner: RAFFAELLA | Overdue: 2 │
├─────────────────────┬───────────────────────────┬───────────────────────┤
│ CONTACTS (Left)     │ TIMELINE & ACT (Center)   │ FOLLOW-UPS (Right)    │
│                     │                           │                       │
│ ─ Founders          │ [All] [Calls] [Emails]    │ 🔴 OVERDUE            │
│   MR Mario Rossi    │                           │   Call Mario (2d)     │
│   EM Elena Martinel │ TODAY                     │                       │
│                     │ 14:30 ☎ Call - Mario      │ 🟡 TODAY              │
│ ─ Architects        │ 11:05 ✉ Email - Elena     │   Send Quote          │
│   LC Luca Conti     │                           │                       │
│                     │ YESTERDAY                 │ ⚪ THIS WEEK          │
│ ─ Admin             │ 16:40 ⊞ Meeting           │   Review brief        │
│                     │                           │                       │
│ [+ Add Contact]     │ [+ Log Activity]          │ [+ Add Follow-up]     │
└─────────────────────┴───────────────────────────┴───────────────────────┘
```
**Annotations:**
- **Left (Contacts)**: Answers "Who?". Highlights Decision Makers and recent interaction timestamps.
- **Center (Timeline)**: Answers "What changed?". Chronological, dense, collapsed by default.
- **Right (Follow-Ups)**: Answers "What is next?". Triage queue sorted by urgency (Overdue > Today > Week).

---

## 3. Tenant List vNext
**Interaction Model:**
- Move from a generic "card/list" to a **Data Table / Spreadsheet View** (Linear style).
- **Filters**: Persist on the left or top bar. Support Saved Views (e.g., "My Active Tenants", "Slipping Health").
- **Bulk Actions**: Select multiple tenants to assign an advisor, log a mass update, or send a bulk email.
- **Density**: Support `Compact` (32px rows) and `Comfortable` (48px rows).

---

## 4. Advisor Workspace v1 Alignment (M5)
The M5 Implementation Plan (`/app/memory/M5_IMPLEMENTATION_PLAN.md`) is structurally sound but requires visual strictness.
- **Confirm**: The "My Day" fixed order (Attention > Overdue > New > Opportunities) is perfect for high-speed triage.
- **Revise**: Ensure the components built for M5 utilize the new sharp, high-density token system out of the gate, rather than inheriting the flawed M1/M2 rounded-card aesthetics.

---

## 5. Notification Center
- **Placement**: Global Drawer (Right-side slide-out), accessible via Topbar 🔔.
- **Density**: High. No massive white space. Use an inbox-style list.
- **Integration**: Clicking a notification should *not* always navigate away. If it pertains to a Follow-Up, it should open the Follow-Up quick-action modal directly.

---

## 6. Global System Primitives
To maintain consistency and speed:
- **Status Indicators**: Text-based with colored dots, *not* heavy colored background chips.
  - `🔴 Overdue`, `🟡 Due Today / Open`, `🟢 Fresh / Completed`, `⚪ Stale / Snoozed`.
- **Ownership Avatars**: 24px squares, sharp edges, monogram text, 1px border.
- **Last-Touch Metadata**: Always relative (`2h ago`, `3d ago`, `overdue by 1d`).
- **"Next Action" Affordance**: Hovering over rows reveals immediate actionable buttons (`[Complete] [Reschedule]`) on the right edge.

---

## 7. Typography & Spacing Tokens (Numeric Proposal)

- **Typography Scale** (Inter/Roboto are banned. Recommend: Inter/Geist for data, Playfair Display sparingly for macro-level brand headers only, though user requested shifting away from editorial. Let's use a crisp Geometric Sans for all UI elements to emulate Linear/Attio, perhaps **IBM Plex Sans** or **Geist** if available):
  - `H1 (Macro)`: 24px (1.5rem), Medium.
  - `H2 (Section)`: 14px (0.875rem), Semi-Bold, uppercase tracking-wide.
  - `Body`: 13px, Regular, 1.5 line-height.
  - `Data/Meta`: 11px, Monospaced or tabular-nums for dates/times.
- **Spacing Scale (Density Mode)**:
  - `p-2` (8px): Internal element spacing.
  - `p-4` (16px): Standard container padding.
  - `gap-1` (4px): List item stacking.

---

## 8. Color & State System
*Dark Luxury with Functional Colors*
- **Base Shell**: `#0A0A0B`
- **Surface Panels**: `#16161A` (Dark) or Pure White `#FFFFFF` (if sticking to the dark-shell/white-panel hybrid). *Recommendation: Go full dark mode for the CRM to emulate Linear, using `#16161A` for cards and `#222226` for hovers.*
- **Borders**: `#2C2C30` (Subtle 1px separators).
- **Text**: `#EDEDED` (Primary), `#A0A0A5` (Secondary).
- **Functional States** (Must contrast against black):
  - 🔴 Critical/Overdue: `#FF453A`
  - 🟡 Warning/Due: `#FF9F0A`
  - 🟢 OK/Active: `#32D74B`
  - 🔵 Info/Teal (MOOD Brand): `#00C9B3`

---

## 9. Migration Roadmap

- **Phase 1 (Immediate / M5)**: Implement the Advisor Workspace using the new grid/density rules. Do not rewrite old screens yet.
- **Phase 2 (M6)**: Execute the **Relationship Center vNext** (3-column layout). This deprecates the old Tenant Detail view.
- **Phase 3 (M7)**: Retrofit the Tenant List view into a high-density Data Table. Unify all Drawers/Modals globally to the sharp, 1px-border styling.

---

## 10. Open Questions for the User
1. **Full Dark vs. Hybrid?** The current mockups show a dark shell with white content panels. For the Attio/Linear vibe, do you approve transitioning the *entire* CRM content area to a deep dark mode (surfaces in `#16161A`)?
2. **Typography Override?** You explicitly requested moving away from the magazine/journal feel. Do you authorize fully stripping `Playfair Display` from the CRM operational views in favor of a dense, highly legible Sans-Serif?
3. **Data Table Preference:** For the Tenant List, do you prefer a strictly resizable spreadsheet interface (like Notion/Airtable) or a dense list-row interface (like Linear)?
4. **Action Placement:** In the 3-column layout, do you prefer Quick Actions (`[Complete]`, `[Email]`) hidden behind row-hovers (cleaner) or perpetually visible (faster)?
5. **Timeline Expansion:** Should clicking a timeline activity expand it *inline* (accordion, pushing content down), or open a slide-out right Drawer? (Inline is proposed for speed).
