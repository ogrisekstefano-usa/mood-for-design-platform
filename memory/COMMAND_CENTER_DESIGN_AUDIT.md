# COMMAND CENTER DESIGN AUDIT
*Mode: UX/UI Review & Redesign Proposal*
*Positioning: B2B Relationship OS (Attio/Linear/Notion tier) within MOOD's Dark Luxury aesthetic.*

---

## 1. /command-center/tenants (Tenant List)
**Current Issues:**
- Acts like a simple CMS directory rather than an operational CRM view.
- Lack of dense data. Fails to immediately answer: "What requires attention?" or "Who owns this relationship?".
- Inconsistent spacing and weak CTA placement; filter discoverability is low.
- Visual noise from unnecessary decorative elements instead of data-driven indicators.

**UX Score:**
- **Clarity (4/10)**: Too sparse; doesn't prioritize actionable data (next steps, overdue).
- **Efficiency (3/10)**: Finding tenants that need attention requires clicking into them.
- **Discoverability (5/10)**: Basic search works, but saved views or complex filters are missing.
- **Premium Feel (6/10)**: Looks clean but resembles a blog index rather than a luxury CRM.
- **Scalability (4/10)**: Will break down cognitively when scaling to 500+ studios.

**Proposed Structure:**
- **Layout**: High-density data table or tight grid.
- **Hierarchy**: Tenant Name (Primary) > Health/Temperature > Overdue Follow-ups > Last Touch > Owner.
- **Actions**: Bulk selection, quick-filter tabs (Requires Attention, Active, Cold).

**Visual Direction:**
- Tightened row heights (32px or 40px standard density). Monospaced numerals for dates and counts. Text-based status indicators instead of bloated chip arrays.

---

## 2. /command-center/tenants/{id} (Relationship Center)
**Current Issues:**
- Currently broken (infinite spinner). Even when working, it relies on an editorial/magazine layout.
- Data is buried inside tabs. Forces users to context-switch to see Timeline vs. Contacts vs. Follow-ups.
- Huge typography eats up screen real estate, reducing the speed of decision-making.

**UX Score:**
- **Clarity (3/10)**: Form over function. "What changed?" is hidden.
- **Efficiency (2/10)**: Tab-switching destroys operational momentum.
- **Discoverability (5/10)**: Everything is there, just behind clicks.
- **Premium Feel (5/10)**: Editorial beauty, but frustrating to use (anti-premium in a work context).
- **Scalability (3/10)**: Does not support a 20k+ activity log natively without infinite scroll / tight density.

**Proposed Structure:**
- **Layout**: The 3-Column Layout is **APPROVED and REQUIRED**. 
  - *Workflow Rationale*: Advisors need to see *who* they are talking to (Left: Contacts), *what* was said (Center: Timeline), and *what* to do next (Right: Follow-Ups).
- **Sections**: KPI Strip pinned at the top. Left = Contacts (280px), Center = Timeline (Fluid), Right = Queue (340px).

**Visual Direction:**
- Remove large Serif headers for data labels. Use tracking-wide uppercase eyebrows (`text-[10px]`) for structural labels. Dark background (`#0A0A0B`) with white content panels for contrast and readability.

---

## 3. Contacts Module (List + Drawer)
**Current Issues:**
- No visual distinction for "Decision Makers".
- Missing "Last Interaction" metadata on the surface.
- Drawer animations and layout feel generic.

**UX Score:**
- **Clarity (6/10)**: Simple list, but lacks relational depth.
- **Efficiency (5/10)**: Hard to know who to email first.
- **Discoverability (6/10)**: Basic.
- **Premium Feel (7/10)**: Drawer UI is decent, but typography scaling is loose.
- **Scalability (8/10)**: 12 contacts per studio scales fine, but needs better grouping.

**Proposed Structure:**
- Group by role (Founders, Architects, Admin). 
- Pin "Primary Contact" at the top.
- Immediate quick actions on hover (Email, Log Call).

**Visual Direction:**
- 28px square avatars with 1px borders. Role groupings with minimal dividers.

---

## 4. Activities Log (Global)
**Current Issues:**
- Lacks a unified global perspective. Hard to filter by "My Activities" versus "All".
- Unnecessary visual noise (colored backgrounds for standard events).

**UX Score:**
- **Clarity (5/10)**: A bit muddy with icons.
- **Efficiency (4/10)**: Inline editing/expansion is missing or clunky.
- **Discoverability (5/10)**: Filters exist but take up too much vertical space.
- **Premium Feel (6/10)**: Too many rounded corners.
- **Scalability (5/10)**: Needs a strict data-grid approach.

**Proposed Structure:**
- Fixed columns (Time, Icon, Content, Owner). 
- Click to expand row (accordion style) rather than opening a new modal.

**Visual Direction:**
- Sharp, square borders. Monospaced time formats. Lucide icons without background fills unless denoting a specific status.

---

## 5. Timeline (Admin)
**Current Issues:**
- Difficult to parse. "Story" format instead of "Log" format.
- Lacks day-grouping precision.

**UX Score:**
- **Clarity (4/10)**: Hard to scan quickly.
- **Efficiency (5/10)**: Scrolling is tedious.
- **Discoverability (6/10)**: Okay.
- **Premium Feel (5/10)**: Feels like a journal.
- **Scalability (4/10)**: Breaks down after 50 activities.

**Proposed Structure:**
- Strict chronological ledger. Grouped by day with a sticky header. 
- "Collapsed by default" strategy.

**Visual Direction:**
- 1px left border connecting events. Subtle `#1C1C20` hover states on rows.

---

## 6. Relationship Sections (Sub-tabs)
**Current Issues:**
- Creates a disjointed experience. "Opportunities" and "Documents" hide vital context.

**UX Score:**
- All scores avg 4/10.

**Proposed Structure:**
- Move away from deep sub-tabs. Opportunities should be embedded into the Timeline as major events; Documents should have a quick-access drawer.

**Visual Direction:**
- Standardized link styling. Active states use a crisp 2px bottom border (`#00C9B3`).

---

## 7. Notification Center (Bell + Drawer)
**Current Issues:**
- Currently implemented in M4, but visual density needs alignment with the new "Attio/Linear" mandate.
- High-priority vs low-priority is not instantly decipherable without reading.

**UX Score:**
- **Clarity (6/10)**: Getting better, but dense text.
- **Efficiency (7/10)**: Drawer access is fast.
- **Discoverability (8/10)**: Bell is obvious.
- **Premium Feel (6/10)**: A bit generic.
- **Scalability (6/10)**: Will pile up quickly.

**Proposed Structure:**
- Group by "Critical/Requires Attention" vs "FYI".

**Visual Direction:**
- Use a 2px left border strip to denote severity (Red for critical, Teal for actionable).

---

## 8. Introductions (Inbox)
**Current Issues:**
- Currently conceptualized as a list. Needs to be a high-speed triage inbox.

**UX Score:** N/A (M5 scope)

**Proposed Structure:**
- Kanban or Split-pane Inbox. Select on left, review on right.
- Actions: Accept, Decline, Defer.

**Visual Direction:**
- High-contrast text for source/priority. Action buttons must be distinct.

---

## 9. Activation Flow (Studio_Activation)
**Current Issues:**
- Pipeline kanban feels like Trello, lacking the "MOOD" high-end branding.

**UX Score:**
- **Clarity (7/10)**: Understandable.
- **Premium Feel (4/10)**: Too utilitarian/SaaS-like.

**Proposed Structure:**
- Keep Kanban but redesign cards. Strip out generic card shadows. Use 1px borders and high-contrast typography.

**Visual Direction:**
- Sharp corners, dense data. 

---

## 10. Advisor Assignment
**Current Issues:**
- Hard to see at a glance who owns what. Ownership should not be buried in a settings tab.

**UX Score:**
- **Clarity (3/10)**: Hidden.

**Proposed Structure:**
- Top-level KPI strip on every Tenant Detail view. 

**Visual Direction:**
- Small distinct avatars (`24x24`) coupled with uppercase names (`RAFFAELLA M.`).

---

## 11. CRM Drawers (Contact, Activity)
**Current Issues:**
- Margins and padding feel arbitrary. Typography feels disconnected from the global shell.

**UX Score:**
- **Efficiency (7/10)**: Drawers are better than pages.
- **Premium Feel (5/10)**: Inconsistent spacing.

**Proposed Structure:**
- Standardize header height. Pin primary actions to the bottom or top right.

**Visual Direction:**
- `backdrop-blur` on the overlay. Pure white or deep black drawers depending on theme context. 1px borders.

---

## 12. Modals
**Current Issues:**
- Generic "Bootstrap" feel. Centered dialogs that disrupt flow.

**UX Score:**
- **Efficiency (5/10)**: Interruptive.

**Proposed Structure:**
- Shift most modals to slide-out drawers (right side) to preserve context, OR use small, tightly packed command menus (Cmd+K style).

**Visual Direction:**
- No soft shadows. Hard 1px borders (`rgba(255,255,255,0.1)`).

---

## 13. Empty / Loading / Error States
**Current Issues:**
- Default spinners. Bland "No data" text. Doesn't guide the user to the next action.

**UX Score:**
- **Discoverability/Efficiency (2/10)**: Dead ends.

**Proposed Structure:**
- Every empty state must have a CTA (e.g., "No activities. → [Log a Call]").

**Visual Direction:**
- Muted icons (Lucide, 24px) with tracking-wide text. No massive illustrations.

---

## 14. WorkspaceShell
**Current Issues:**
- Sidebar is decent but lacks density control.

**UX Score:**
- **Premium Feel (7/10)**: Dark mode helps.

**Proposed Structure:**
- Tighten navigation links. Add "Recent" quick links. 

**Visual Direction:**
- Hover states should use subtle `#16161A` backgrounds, not bright highlights.

---

## 15. Advisor Workspace v1
**Current Issues:**
- Not yet implemented, but HTML mocks show a good direction. Needs to ensure it doesn't drift into generic dashboard territory.

**UX Score:** N/A (M5)

**Proposed Structure:**
- Adhere strictly to the "My Day" order: Attention, Overdue, New, Opportunities.

**Visual Direction:**
- Heavy reliance on typography hierarchy. Minimal use of color except for Status (Red/Amber/Teal).

---

## DESIGN CONSISTENCY AUDIT
*Must align Blueprint, Command Center, Workspace, CRM modules.*

**Inconsistencies:**
- Blueprint uses heavy editorial typography; CRM modules attempt SaaS UI. Result: Cognitive clash.
- Rounding: Command Center mixes `rounded-md` and `rounded-none`.
- Color logic: Accents change between Teal, Blue, and Purple without semantic meaning.

## PRIORITY MATRIX

🔴 **Must Fix Before September Launch (M6/M7):**
- **Tenant Detail (Relationship Center)**: Rebuild into the 3-column layout. The current flow is a blocker for high-velocity work.
- **Timeline & Activities**: Convert to high-density, collapsed-by-default ledger format.
- **Empty States**: Implement actionable zero-data states.
- **Typography Standardization**: Strip large serif fonts from data tables and replace with tight, geometric/sans-serif fonts.

🟡 **Can Wait Until M6:**
- **Tenant List View**: Advanced filters and saved views.
- **Introductions Inbox Kanban**: Can use a standard list view temporarily.
- **CRM Drawers refinement**: Unify padding and margins globally.

🟢 **Nice to have / Backlog:**
- Advanced Cmd+K navigation.
- Custom loading animations (e.g., ASCII/Retro-tech loaders).
