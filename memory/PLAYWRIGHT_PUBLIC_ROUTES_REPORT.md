# Public Routes Playwright Test Report
**Sprint:** PARTNER AUTH FIX SPRINT  
**Date:** 2026-02-19  
**Testing mode:** Anonymous user (no cookies / no session)

## Summary
All 9 public routes load correctly without redirecting to `/auth/login`. The fix in `frontend/src/lib/api.js` (isPublicSurface whitelist) is working as intended.

---

## Route Test Results

| Route | URL Tested | HTTP Status | Redirected to /auth/login | Key DOM Elements | Console Errors |
|-------|-----------|-------------|--------------------------|-----------------|----------------|
| Homepage | `/` | 200 | NO | Site nav, hero content | 401 (background, no redirect) |
| About | `/about` | 200 | NO | Page content loaded | 401 (background, no redirect) |
| Services | `/services` | 200 | NO | Page content loaded | 401 (background, no redirect) |
| Projects | `/projects` | 200 | NO | Page content loaded | 401 (background, no redirect) |
| Magazine | `/magazine` | 200 | NO | Page content loaded | 401 (background, no redirect) |
| Professionals | `/professionals` | 200 | NO | Page content loaded | 401 (background, no redirect) |
| Begin Journey | `/begin-journey` | 200 | NO | Page content loaded | 401 (background, no redirect) |
| Consulenza | `/consulenza` | 200 | NO | Page content loaded | 401 (background, no redirect) |
| Partner Application | `/partner-application` | 200 | NO | CANDIDATURA PARTNER eyebrow, title, form fields | 401 (background, no redirect) |

---

## /partner-application Detailed Verification

| Check | Result |
|-------|--------|
| Eyebrow "CANDIDATURA PARTNER" present | ✅ YES |
| Title "Proponi una collaborazione." present | ✅ YES (renders across 2 lines) |
| Form field: Nome | ✅ YES |
| Form field: Cognome | ✅ YES |
| Form field: Studio / Azienda | ✅ YES |
| Form field: Email Professionale | ✅ YES |
| No redirect to /auth/login | ✅ CONFIRMED |
| ERR_ABORTED errors in console | ✅ NONE (only 401 background calls, no navigation abort) |

---

## Console Error Analysis

There are ~60 console errors on the partner-application page, all of type `Failed to load resource: 401` or `404`. These are **background API calls** (e.g., `/api/branding`, `/api/blueprint/i18n`) returning 401 for anonymous users. **They do NOT trigger any redirect** thanks to the isPublicSurface fix.

No `ERR_ABORTED` errors were detected. The cinematic visitor experience is intact.

---

## Verdict
**FIX CERTIFIED ✅** — All public surfaces load correctly as anonymous users. No redirects to `/auth/login` detected on any tested route.
