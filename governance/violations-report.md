# MOOD for DESIGN™ — Governance Violations Report

**Sprint HARDENING-01.1** · governance baseline ufficiale.

Questo report NON è un debug log. È il **catalogo enforce-able** del debito sistemico.
La policy: il numero di violation **non può crescere**. Vedi `test_iteration_115_governance.py`.

## Progress log

| Sprint | Date | Delta |
|---|---|---|
| HARDENING-01.1 (baseline) | 18 Mag 2026 | 151 files · 828 hex · 214 font · 40 untranslated |
| HARDENING-I18N-CORRECTION | 21 Mag 2026 | Whitelist 6 operational locales enforced (no delta on debt — governance fix only) |
| HARDENING-I18N-GUARD (iter117) | 21 Mag 2026 | **−3 untranslated files** · `JourneyPulsePage.jsx` ✓ · `JourneyClosureCeremony.jsx` ✓ · `PublicTenantPage.jsx` (404) ✓ · added live missing-i18n KPI on overlay |
| Current | — | 151 files · 828 hex · 214 font · **37 untranslated** |

## Summary by surface

| Surface | Files | Hex hardcoded | Naked font-family | Files senza t() |
|---|---:|---:|---:|---:|
| **P0** | 39 | 123 | 70 | **15** (was 18) |
| **P1** | 109 | 683 | 134 | 22 |
| **P2** | 3 | 22 | 10 | 0 |
| **TOTAL** | **151** | **828** | **214** | **37** |

## P0 — Client-facing surfaces (highest priority)

These surfaces are visible to clients (Companion, Dossier, Journey, CRM workspace, Brand Atlas). Hex/font violations here cause visible theme inconsistency. i18n violations here cause mixed-language client experience.

| File | Hex | Font | i18n |
|---|---:|---:|:--:|
| `pages/workspace/ProjectsPage.jsx` | 36 | 0 | ✓ |
| `pages/insights/insights.css` | 0 | 19 | ✓ |
| `pages/crm/CrmAccountsPage.jsx` | 19 | 0 | ✓ |
| `pages/workspace/projects-page.css` | 3 | 15 | ✓ |
| `components/journey/JourneyClosureCeremony.jsx` | 5 | 0 | ✓ |
| `components/journey/milestone-dialogue.css` | 12 | 2 | ✓ |
| `pages/insights/InsightsPage.jsx` | 12 | 0 | ✓ |
| `pages/crm/AccountDetailPage.jsx` | 1 | 0 | ❌ |
| `pages/crm/RelationshipGraph.jsx` | 0 | 0 | ❌ |
| `pages/crm/AccountConstellation.jsx` | 0 | 0 | ❌ |
| `pages/crm/ActivityModal.jsx` | 0 | 0 | ❌ |
| `pages/workspace/AddReferenceModal.jsx` | 0 | 0 | ❌ |
| `pages/workspace/DesignJourneyTab.jsx` | 0 | 0 | ❌ |
| `pages/dashboard/JourneyPulsePage.jsx` | 0 | 0 | ✓ |
| `pages/public/PublicTenantPage.jsx` (404) | 0 | 0 | ✓ |
| `pages/inspirations/BrandDetailPage.jsx` | 0 | 0 | ❌ |
| `components/journey/MilestoneDialogue.jsx` | 0 | 0 | ❌ |
| `components/journey/ClientInteractionLayer.jsx` | 0 | 0 | ❌ |
| `components/journey/MaterialDirectionWorkspace.jsx` | 0 | 0 | ❌ |
| `components/journey/StepContextHeader.jsx` | 0 | 0 | ❌ |
| `components/journey/VersionStack.jsx` | 0 | 0 | ❌ |
| `components/journey/MoodboardDirectionWorkspace.jsx` | 0 | 0 | ❌ |
| `components/client/ClientDashboardLayout.jsx` | 0 | 0 | ❌ |
| `components/client/SiteEvolutionSection.jsx` | 0 | 0 | ❌ |
| `components/client/ClientSidebar.jsx` | 0 | 0 | ❌ |
| `pages/crm/constellation.css` | 0 | 9 | ✓ |
| `pages/client/site-evolution.css` | 0 | 9 | ✓ |
| `pages/dashboard/journey-pulse.css` | 0 | 8 | ✓ |
| `pages/crm/StageChangeModal.jsx` | 7 | 0 | ✓ |
| `pages/crm/AccountDetailDrawer.jsx` | 6 | 0 | ✓ |
| `pages/crm/relationship-os.css` | 6 | 0 | ✓ |
| `components/journey/journey-context.css` | 1 | 5 | ✓ |
| `pages/workspace/design-journey.css` | 2 | 2 | ✓ |
| `components/client/dossier.css` | 4 | 0 | ✓ |
| `pages/workspace/ProjectDetailPage.jsx` | 3 | 0 | ✓ |
| `components/layout/Sidebar.jsx` | 3 | 0 | ✓ |
| `pages/crm/crm.css` | 1 | 0 | ✓ |
| `pages/workspace/RelationshipsPage.jsx` | 1 | 0 | ✓ |
| `pages/inspirations/BrandModePage.jsx` | 1 | 0 | ✓ |
| `pages/client/client-companion.css` | 0 | 1 | ✓ |

## P1 — Admin / Studio shell surfaces

Tenant-facing operational tools. Lower priority but should follow the same enforcement rules.

<details><summary>Show P1 file list (109 files)</summary>

| File | Hex | Font | i18n |
|---|---:|---:|:--:|
| `blueprint/moodboard/premiumTemplates.js` | 58 | 0 | ✓ |
| `lib/curatedPalettes.js` | 48 | 0 | ✓ |
| `pages/inspirations/product-gallery.css` | 8 | 33 | ✓ |
| `blueprint/moodboard/PremiumTemplatePreview.jsx` | 34 | 0 | ✓ |
| `pages/settings/asset-picker.css` | 26 | 3 | ✓ |
| `pages/site/magazine.css` | 17 | 10 | ✓ |
| `pages/journey/step-workspace.css` | 0 | 23 | ✓ |
| `pages/editorial/editorialCalendar.css` | 22 | 0 | ✓ |
| `pages/client-preview.css` | 1 | 17 | ✓ |
| `site/mood.css` | 18 | 0 | ✓ |
| `components/storefront/renderers/TeamIdentityCardRenderer.jsx` | 7 | 0 | ❌ |
| `blueprint/moodboard/PagesFilmstrip.jsx` | 16 | 0 | ✓ |
| `blueprint/moodboard/SkeletonPicker.jsx` | 16 | 0 | ✓ |
| `components/demo/demo.css` | 11 | 5 | ✓ |
| `site/site.css` | 15 | 0 | ✓ |
| `components/common/PaletteSwitcher.jsx` | 15 | 0 | ✓ |
| `components/storefront/NavigationRenderer.jsx` | 14 | 1 | ✓ |
| `pages/ClientPreviewPage.jsx` | 4 | 0 | ❌ |
| `components/storefront/FooterColumnsRenderer.jsx` | 14 | 0 | ✓ |
| `blueprint/moodboard/curatorial-modal.css` | 4 | 9 | ✓ |
| `pages/auth/SignupPage.jsx` | 13 | 0 | ✓ |
| `pages/editorial/EditorialContextRail.jsx` | 13 | 0 | ✓ |
| `components/common/editorial-media-field.css` | 13 | 0 | ✓ |
| `blueprint/moodboard/EditorialSkeletonPreview.jsx` | 12 | 0 | ✓ |
| `pages/site/StartProjectWizard.jsx` | 2 | 0 | ❌ |
| `pages/auth/LoginPage.jsx` | 12 | 0 | ✓ |
| `site/content/onboarding.js` | 12 | 0 | ✓ |
| `pages/storefront/StorefrontStudioPage.jsx` | 1 | 0 | ❌ |
| `pages/inspirations/material-view.css` | 1 | 10 | ✓ |
| `pages/editorial/editorial.css` | 11 | 0 | ✓ |
| `site/exe.css` | 11 | 0 | ✓ |
| `pages/settings/AssetPickerModal.jsx` | 0 | 0 | ❌ |
| `pages/settings/MagazineAdminPage.jsx` | 0 | 0 | ❌ |
| `pages/projects/ProjectsStudioPage.jsx` | 0 | 0 | ❌ |
| `pages/journey/StepWorkspacePage.jsx` | 0 | 0 | ❌ |
| `pages/cultural/CulturalEditionReviewPage.jsx` | 0 | 0 | ❌ |
| `pages/site/ProfessionalIntakePage.jsx` | 0 | 0 | ❌ |
| `pages/site/JourneyWelcomePage.jsx` | 0 | 0 | ❌ |
| `pages/storefront/bandEditors.jsx` | 0 | 0 | ❌ |
| `pages/inspirations/CuratedCollectionDrawer.jsx` | 0 | 0 | ❌ |
| `pages/inspirations/InspirationDetailDrawer.jsx` | 0 | 0 | ❌ |
| `pages/inspirations/ProductGalleryPage.jsx` | 0 | 0 | ❌ |
| `pages/inspirations/CollectionFormModal.jsx` | 0 | 0 | ❌ |
| `pages/inspirations/AddInspirationModal.jsx` | 0 | 0 | ❌ |
| `pages/editorial/EditorialStudioPage.jsx` | 0 | 0 | ❌ |
| `pages/editorial/editorialStatus.js` | 10 | 0 | ✓ |
| `pages/editorial/MarketEditionsToolbar.jsx` | 0 | 0 | ❌ |
| `pages/editorial/ArticleEditorPanel.jsx` | 0 | 0 | ❌ |
| `components/cultural/CulturalEditionWizard.jsx` | 0 | 0 | ❌ |
| `components/common/HotspotEditor.jsx` | 0 | 0 | ❌ |
| `styles/begin-journey.css` | 0 | 10 | ✓ |
| `pages/inspirations/supplier-catalog.css` | 9 | 0 | ✓ |
| `components/common/BlueprintColorPicker.css` | 6 | 3 | ✓ |
| `blueprint/moodboard/TemplateProgressOverlay.jsx` | 8 | 0 | ✓ |
| `pages/projects/projectsStudio.css` | 8 | 0 | ✓ |
| `pages/inspirations/inspirations.css` | 8 | 0 | ✓ |
| `pages/inspirations/brand-form.css` | 7 | 1 | ✓ |
| `pages/public/LeadFormPage.jsx` | 8 | 0 | ✓ |
| `App.css` | 6 | 1 | ✓ |
| `pages/settings/MagazineEditorPage.jsx` | 7 | 0 | ✓ |
| `pages/advisor/advisor.css` | 7 | 0 | ✓ |
| `pages/editorial/CompositionRoomRail.jsx` | 7 | 0 | ✓ |
| `components/common/hotspot-editor.css` | 7 | 0 | ✓ |
| `lib/themeApply.js` | 7 | 0 | ✓ |
| `index.css` | 6 | 0 | ✓ |
| `pages/admin/AdvisorDetailPage.jsx` | 6 | 0 | ✓ |
| `pages/advisor/AdvisorDashboardPage.jsx` | 6 | 0 | ✓ |
| `pages/governance/market-matrix.css` | 6 | 0 | ✓ |
| `components/common/BlueprintColorPicker.jsx` | 6 | 0 | ✓ |
| `components/storefront/blocks/team-identity.css` | 1 | 5 | ✓ |
| `pages/settings/BrandStudioPage.jsx` | 5 | 0 | ✓ |
| `pages/settings/magazine-editor.css` | 5 | 0 | ✓ |
| `pages/collab/ReviewMode.jsx` | 5 | 0 | ✓ |
| `components/media/universal-cropper.css` | 4 | 1 | ✓ |
| `components/storytelling/storytelling.css` | 5 | 0 | ✓ |
| `blueprint/collab/CommentPin.jsx` | 4 | 0 | ✓ |
| `pages/auth/ForgotPasswordPage.jsx` | 4 | 0 | ✓ |
| `site/components/BlueprintGenesisOverlay.jsx` | 4 | 0 | ✓ |
| `components/common/image-edit-modal.css` | 4 | 0 | ✓ |
| `components/common/PlatformFooterBar.jsx` | 4 | 0 | ✓ |
| `design-system/client/tokens.css` | 3 | 0 | ✓ |
| `blueprint/collab/ActivityTimeline.jsx` | 3 | 0 | ✓ |
| `blueprint/moodboard/inline-regia.css` | 2 | 1 | ✓ |
| `pages/admin/PlatformCapabilitiesPage.jsx` | 3 | 0 | ✓ |
| `pages/storefront/storefrontStudio.css` | 3 | 0 | ✓ |
| `components/common/LocaleSwitcher.jsx` | 3 | 0 | ✓ |
| `components/storefront/renderers/MagazineGridRenderer.jsx` | 3 | 0 | ✓ |
| `components/storefront/renderers/BrandLogosRenderer.jsx` | 3 | 0 | ✓ |
| `components/storefront/renderers/StatsBandRenderer.jsx` | 3 | 0 | ✓ |
| `components/advisor/territory-selector.css` | 3 | 0 | ✓ |
| `blueprint/moodboard/mood-panel.css` | 1 | 1 | ✓ |
| `pages/site/PreviewBanner.jsx` | 2 | 0 | ✓ |
| `pages/admin/advisor-edit-drawer.css` | 2 | 0 | ✓ |
| `components/cultural/cultural-edition-wizard.css` | 2 | 0 | ✓ |
| `components/onboarding/OwnerIntroductionModal.jsx` | 2 | 0 | ✓ |
| `components/layout/admin-control-center.css` | 2 | 0 | ✓ |
| `components/layout/AdminLayout.jsx` | 2 | 0 | ✓ |
| `App.js` | 1 | 0 | ✓ |
| `blueprint/moodboard/PageInspector.jsx` | 1 | 0 | ✓ |
| `blueprint/moodboard/BlockRegistry.js` | 1 | 0 | ✓ |
| `blueprint/moodboard/blocks/NoteBlock.jsx` | 1 | 0 | ✓ |
| `pages/settings/LanguagesPage.jsx` | 1 | 0 | ✓ |
| `pages/cultural/cultural-editions.css` | 1 | 0 | ✓ |
| `pages/governance/brand-voice.css` | 1 | 0 | ✓ |
| `site/components/CountryLanguageSelector.jsx` | 1 | 0 | ✓ |
| `components/media/image-editor.css` | 1 | 0 | ✓ |
| `components/common/EditorialMediaField.jsx` | 1 | 0 | ✓ |
| `components/storefront/AssetPicker.jsx` | 1 | 0 | ✓ |
| `styles/mood-atmosphere.css` | 1 | 0 | ✓ |

</details>

## P2 — Legacy / stub / deprecated

Soft-deprecated surfaces. Will be removed in cleanup sprints. Out of enforcement scope.

<details><summary>Show P2 file list (3 files)</summary>

| File | Hex | Font | i18n |
|---|---:|---:|:--:|
| `pages/moodboards/moodboards-atelier.css` | 6 | 10 | ✓ |
| `pages/moodboards/MoodboardsPage.jsx` | 11 | 0 | ✓ |
| `pages/moodboards/MoodboardEditor.jsx` | 5 | 0 | ✓ |

</details>

## Enforcement policy

1. **HEX FREEZE**: the total hex hardcoded count `H_total` is frozen at the value below. New PRs cannot increase it.
   - Baseline `H_total` = **828**
2. **FONT FREEZE**: naked `font-family` must remain at zero. UI-SYS-01 already drove this to 0.
   - Baseline `F_total` = **214**
3. **I18N FREEZE**: the list of files without `useT()` in P0/P1 is frozen. New PRs cannot add a new untranslated file. Each file in the list has a deadline (Sprint I18N-03).
4. **DESIGN SYSTEM KERNEL™** is the single source of truth. New tokens go into `frontend/src/design-system/kernel.css`. No new per-page CSS variable declarations.
5. **HEX whitelist**: hex inside `var(--token, #fallback)` is permitted (token fallback is governance-friendly).

## Files in i18n debt (deadline: Sprint I18N-03)

- `components/journey/JourneyClosureCeremony.jsx` (P0)
- `pages/crm/AccountDetailPage.jsx` (P0)
- `pages/crm/RelationshipGraph.jsx` (P0)
- `pages/crm/AccountConstellation.jsx` (P0)
- `pages/crm/ActivityModal.jsx` (P0)
- `pages/workspace/AddReferenceModal.jsx` (P0)
- `pages/workspace/DesignJourneyTab.jsx` (P0)
- `pages/dashboard/JourneyPulsePage.jsx` (P0)
- `pages/inspirations/BrandDetailPage.jsx` (P0)
- `components/journey/MilestoneDialogue.jsx` (P0)
- `components/journey/ClientInteractionLayer.jsx` (P0)
- `components/journey/MaterialDirectionWorkspace.jsx` (P0)
- `components/journey/StepContextHeader.jsx` (P0)
- `components/journey/VersionStack.jsx` (P0)
- `components/journey/MoodboardDirectionWorkspace.jsx` (P0)
- `components/client/ClientDashboardLayout.jsx` (P0)
- `components/client/SiteEvolutionSection.jsx` (P0)
- `components/client/ClientSidebar.jsx` (P0)
- `components/storefront/renderers/TeamIdentityCardRenderer.jsx` (P1)
- `pages/ClientPreviewPage.jsx` (P1)
- `pages/site/StartProjectWizard.jsx` (P1)
- `pages/storefront/StorefrontStudioPage.jsx` (P1)
- `pages/settings/AssetPickerModal.jsx` (P1)
- `pages/settings/MagazineAdminPage.jsx` (P1)
- `pages/projects/ProjectsStudioPage.jsx` (P1)
- `pages/journey/StepWorkspacePage.jsx` (P1)
- `pages/cultural/CulturalEditionReviewPage.jsx` (P1)
- `pages/site/ProfessionalIntakePage.jsx` (P1)
- `pages/site/JourneyWelcomePage.jsx` (P1)
- `pages/storefront/bandEditors.jsx` (P1)
- `pages/inspirations/CuratedCollectionDrawer.jsx` (P1)
- `pages/inspirations/InspirationDetailDrawer.jsx` (P1)
- `pages/inspirations/ProductGalleryPage.jsx` (P1)
- `pages/inspirations/CollectionFormModal.jsx` (P1)
- `pages/inspirations/AddInspirationModal.jsx` (P1)
- `pages/editorial/EditorialStudioPage.jsx` (P1)
- `pages/editorial/MarketEditionsToolbar.jsx` (P1)
- `pages/editorial/ArticleEditorPanel.jsx` (P1)
- `components/cultural/CulturalEditionWizard.jsx` (P1)
- `components/common/HotspotEditor.jsx` (P1)

---

_Generated by Sprint HARDENING-01.1 audit script. Re-run via the same script in `kernel.css` companion or via `test_iteration_115_governance.py`._