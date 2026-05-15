# Architecture Isolation Report — Blueprint OS ⇄ Storefront

_Status: ✅ COMPLETED — 15 Feb 2026 (Phase N)_

## Problem statement

Recent storefront visual work (Phase L/M — EXE INTERIOR, demo CTA, onboarding
tour) unintentionally bled into the Blueprint OS chrome. The contamination
vectors were:

1. **`:root` globals** in `site/exe.css` and `components/demo/demo.css` —
   variables were declared at document root, so they leaked into every subtree
   including Blueprint OS surfaces.
2. **`TenantThemeContext.applyThemeVarsToRoot`** — wrote `--brand-*` directly
   onto `document.documentElement`, so any tenant theme switch repainted the
   OS chrome too (since OS components fall back to `--brand-*` for some
   shared concepts).
3. **No surface boundary** in the DOM — OS pages and storefront pages shared
   the same global CSS namespace.

## Isolation strategy

> **Blueprint OS = SOFTWARE.   Storefront = BRAND EXPERIENCE.**
> They must never share visual runtime dependencies.

Two complementary mechanisms now enforce this:

### 1 — DOM-level surface markers

Every subtree carries one of two attributes:

| Marker                          | Where it lives                                  |
| ------------------------------- | ----------------------------------------------- |
| `data-surface="os"`             | `<div class="App" data-surface="os">` (fallback) |
|                                 | `<BlueprintThemeProvider>` (explicit, layouts)   |
| `data-surface="storefront"`     | `<StorefrontThemeProvider>` (SiteLayout)        |

Layouts wired:

- `DashboardLayout` → wrapped in `BlueprintThemeProvider`
- `AdminLayout`     → wrapped in `BlueprintThemeProvider`
- `SiteLayout`      → wrapped in `StorefrontThemeProvider`
- `App` root        → carries `data-surface="os"` fallback for auth pages, etc.

### 2 — CSS-scoped tokens

`/app/frontend/src/design-system/os/tokens.css`
declares every `--bp-*` and every `--brand-*` fallback inside
`[data-surface="os"] { … }`.

`/app/frontend/src/design-system/storefront/tokens.css`
declares `--brand-*` defaults inside `[data-surface="storefront"] { … }`.

`/app/frontend/src/contexts/TenantThemeContext.jsx`
no longer touches `documentElement`. It now manages a single
`<style id="mfd-storefront-runtime-theme">` tag whose rule is:

```css
[data-surface="storefront"] {
  --brand-primary: …;
  --brand-font-display: …;
  /* …only what the tenant changed… */
}
```

Because the rule is scoped to `[data-surface="storefront"]`, the OS surface
**cannot** see the tenant theme — even if a future component accidentally
reads `--brand-primary`, it falls through to the OS-side defensive mapping
that points it at `--bp-primary`.

### 3 — Files added/changed

```
NEW  /app/frontend/src/design-system/os/BlueprintThemeProvider.jsx
NEW  /app/frontend/src/design-system/os/tokens.css
NEW  /app/frontend/src/design-system/storefront/StorefrontThemeProvider.jsx
NEW  /app/frontend/src/design-system/storefront/tokens.css
NEW  /app/architecture/ARCHITECTURE_ISOLATION.md           ← this report

EDIT /app/frontend/src/contexts/TenantThemeContext.jsx     (scoped <style>)
EDIT /app/frontend/src/site/exe.css                        (:root → [data-surface="storefront"])
EDIT /app/frontend/src/components/demo/demo.css            (:root → [data-surface])
EDIT /app/frontend/src/site/SiteLayout.jsx                 (wrap StorefrontThemeProvider)
EDIT /app/frontend/src/components/layout/DashboardLayout.jsx (wrap BlueprintThemeProvider)
EDIT /app/frontend/src/components/layout/AdminLayout.jsx     (wrap BlueprintThemeProvider)
EDIT /app/frontend/src/App.js                                (data-surface="os" fallback on root)
```

`/app/frontend/src/index.css` keeps its legacy `:root` block intentionally —
it ensures pre-existing components that haven't migrated still find `--bp-*`
through cascade. New components MUST live under one of the two providers.

## Verification

Smoke-tested 3 surfaces in a single session:

| Surface              | Route                       | Surface attr | Rendering        |
| -------------------- | --------------------------- | ------------ | ---------------- |
| Public storefront    | `/`                         | `storefront` | cream + serif    |
| Blueprint OS auth    | `/auth/login`               | `os`         | dark + teal      |
| Blueprint OS Studio  | `/settings/storefront`      | `os` × 2     | dark chrome + cream iframe preview inside |

No visual regression. The Studio header / sidebar / tabs render with OS tokens
even while the inline preview shows the tenant-branded storefront.

## Remaining risks (P2 — non-blocking)

1. **Legacy `:root` in `index.css`** still declares OS tokens globally. Safe
   today (no contamination because storefront components don't read `--bp-*`),
   but a future contributor could shadow them. _Mitigation:_ removal is
   a separate scoped change that requires verifying every `.bp-*` utility
   class in `index.css` still cascades correctly.
2. **`/auth/*` pages don't have an explicit `<BlueprintThemeProvider>`** —
   they inherit from `data-surface="os"` on the App root. Sufficient today,
   but adding an `AuthLayout` wrapper would make the intent explicit.
3. **No CI guard** prevents a new component from declaring `:root` vars or
   importing storefront primitives into OS folders. A simple
   `scripts/lint-architecture.sh` (search for `:root` outside design-system,
   search for `site/` imports inside `pages/settings/`) would catch this.

## Future-safe patterns

When adding new code, follow these rules:

1. **Tokens**: never declare CSS custom properties at `:root`. Put them under
   one of `[data-surface="os"]` or `[data-surface="storefront"]`.
2. **Layouts**: every new top-level layout must wrap in the appropriate
   theme provider. If unsure → `BlueprintThemeProvider` (OS is the safer
   default — the storefront is opt-in).
3. **Imports**: OS components import from `/design-system/os/*`.
   Storefront components import from `/design-system/storefront/*` or
   `/site/*`. **Never cross-import**.
4. **Visual primitives**: keep them duplicated rather than shared. A
   "Card" or "Button" living under OS is a different primitive from a
   "Card" or "Button" living under storefront — they only happen to look
   similar, they are not the same thing.
5. **Runtime overrides**: write to a scoped `<style>` tag (see
   `TenantThemeContext`), never to `document.documentElement.style`.

## AI guardrail rules (for future agents)

```
CRITICAL — Blueprint OS isolation:
  • NEVER add CSS custom properties at :root.
  • NEVER modify `tokens.css` files without an explicit design-system change order.
  • NEVER inject tenant branding via document.documentElement.
  • Storefront-only edits go under /site/, /pages/site/, or /design-system/storefront/.
  • OS-only edits go under /pages/dashboard/, /pages/settings/, /pages/workspace/,
    /components/layout/, or /design-system/os/.
  • If you need a primitive shared by both surfaces, DUPLICATE it.
```

## Target architecture (reached)

```
MOOD OS                                    Storefronts
─────────                                  ────────────
data-surface="os"                          data-surface="storefront"
/design-system/os/tokens.css               /design-system/storefront/tokens.css
                                           + runtime <style id="mfd-storefront-runtime-theme">

Dashboard · Studio · Settings · Workspace  Public site · Tenant storefronts
Members · Licensing · Diff · Revisions     Magazine · Projects landing

  (frozen tokens)                            (tenant-customisable)
```

Equivalent in spirit to **Shopify Admin vs Shopify Storefront**,
**Vercel Dashboard vs deployed sites**, **Notion Workspace vs public pages**.
