/**
 * ReferencesPage — Phase P0.3.C
 *
 * `/workspace/references` — the first visible manifestation of
 * Cultural Design Intelligence™.
 *
 * NOT inspiration browsing. NOT a media gallery. NOT a Pinterest clone.
 * A curated international design intelligence archive.
 *
 * Architecture:
 *   01  Editorial Hero       — page-level cinematic opening
 *   02  Curated Collections  — 3 vertical editorial sequences
 *   03  Reference Cards      — atmosphere-first, image second
 *   04  Vertical Perspective — perspective lives INSIDE the card narrative
 *   05  Advisor Actions      — Add to Design Direction · Discuss · …
 *
 * Absolute rules:
 *   ❌ NO masonry · NO infinite scroll · NO feed pacing
 *   ❌ NO flags · NO "AI generated" · NO developer wording
 *   ✅ Atmosphere FIRST, image SECOND
 *   ✅ Perspective change TRANSFORMS the reading (slow fade), never refreshes
 */
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useLocaleRuntime } from '../../contexts/LocaleRuntimeContext';

// Market codes derived from locale_codes. Five-market Phase 1 set.
// NO FLAGS — labels are intentionally minimal typography.
const PERSPECTIVE_ORDER = ['IT_IT', 'EN_US', 'EN_AE', 'DE_DE', 'FR_FR'];
const MARKET_LABEL = {
  IT_IT: 'IT',
  EN_US: 'US',
  EN_AE: 'UAE',
  DE_DE: 'DE',
  FR_FR: 'FR',
};

// ─── Primitive components ────────────────────────────────────────────────

const EditorialHero = () => (
  <section
    data-testid="references-editorial-hero"
    className="px-12 pt-20 pb-24 border-b border-[var(--bp-border)]"
  >
    <p className="text-[10px] uppercase tracking-[0.34em] text-[var(--bp-primary)] font-body mb-6">
      Cultural Design Intelligence™
    </p>
    <h1 className="font-heading font-light text-[var(--bp-text-primary)] text-[56px] leading-[1.05] tracking-[-0.01em] max-w-[18ch]">
      Curated references read through cultural lenses.
    </h1>
    <p className="font-body text-[17px] leading-[1.7] text-[var(--bp-text-secondary)] max-w-[58ch] mt-7 italic">
      Not inspiration management. A private research room where every design reference
      is repositioned through the perspective of the market it must speak to —
      so the studio enters a client conversation already fluent in the right cultural register.
    </p>
  </section>
);


const PerspectiveSelector = ({ available, active, onChange, busy }) => (
  <div
    data-testid="card-perspective-selector"
    className="flex flex-col gap-[14px] pl-6 border-l border-[var(--bp-border)]"
  >
    <p className="text-[9px] uppercase tracking-[0.34em] text-[var(--bp-text-muted)] font-body">
      Perspective
    </p>
    {PERSPECTIVE_ORDER.filter((code) => available.includes(code)).map((code) => {
      const isActive = code === active;
      return (
        <button
          key={code}
          type="button"
          disabled={busy || isActive}
          onClick={() => onChange(code)}
          data-testid={`perspective-${code}`}
          className={`text-left font-heading font-light leading-none transition-all duration-700 ease-out ${
            isActive
              ? 'text-[var(--bp-primary)] text-[20px]'
              : 'text-[var(--bp-text-muted)] text-[15px] hover:text-[var(--bp-text-primary)]'
          }`}
        >
          {MARKET_LABEL[code] || code}
          {isActive && (
            <span
              className="block mt-2 h-px w-6 bg-[var(--bp-primary)] transition-all duration-700"
              aria-hidden
            />
          )}
        </button>
      );
    })}
  </div>
);


const MaterialAnnotation = ({ text, testid }) => (
  <span
    data-testid={testid}
    className="inline-flex items-center px-[10px] py-[5px] rounded-[3px] bg-[var(--bp-surface-2)]/60
               text-[10.5px] uppercase tracking-[0.18em] text-[var(--bp-text-secondary)]
               font-body whitespace-nowrap"
  >
    {text}
  </span>
);


const AdvisorActionBar = ({ reference, projectChoices, onAction, busy }) => {
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const primaryRef = `cta-add-to-direction-${reference.id}`;
  return (
    <div
      data-testid={`reference-actions-${reference.id}`}
      className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4 pt-7
                 border-t border-[var(--bp-border)]/60"
    >
      <button
        type="button"
        disabled={busy}
        data-testid={primaryRef}
        onClick={() => setShowProjectPicker((v) => !v)}
        className="inline-flex items-center gap-2 px-5 py-[11px] rounded-[3px]
                   bg-[var(--bp-primary)] text-[var(--bp-on-primary,#1a1a1a)]
                   font-body text-[12px] uppercase tracking-[0.22em]
                   hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        Add to Design Direction
      </button>

      {['discuss', 'moodboard', 'material_study'].map((act) => (
        <button
          key={act}
          type="button"
          disabled={busy}
          data-testid={`cta-${act.replace('_', '-')}-${reference.id}`}
          onClick={() => onAction(act)}
          className="font-body text-[12px] uppercase tracking-[0.22em]
                     text-[var(--bp-text-secondary)] hover:text-[var(--bp-primary)]
                     transition-colors disabled:opacity-40"
        >
          {act === 'discuss' && 'Discuss with Advisor'}
          {act === 'moodboard' && 'Use in Moodboard'}
          {act === 'material_study' && 'Reference for Material Study'}
        </button>
      ))}

      {showProjectPicker && (
        <div
          data-testid={`project-picker-${reference.id}`}
          className="basis-full mt-3 p-5 bg-[var(--bp-surface-2)]/40 rounded-[6px]
                     border border-[var(--bp-border)]"
        >
          <p className="font-body text-[10px] uppercase tracking-[0.28em]
                        text-[var(--bp-text-muted)] mb-3">
            Connect to a project direction
          </p>
          {projectChoices.length === 0 ? (
            <p className="font-body text-[13px] text-[var(--bp-text-secondary)] italic">
              No active projects available. Open a project from the Workspace first.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {projectChoices.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={busy}
                  data-testid={`project-pick-${p.id}-${reference.id}`}
                  onClick={() => {
                    setShowProjectPicker(false);
                    onAction('link_project', { project_id: p.id, project_title: p.title });
                  }}
                  className="text-left font-body text-[14px] text-[var(--bp-text-primary)]
                             hover:text-[var(--bp-primary)] transition-colors flex items-baseline gap-3"
                >
                  <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)]">
                    {p.project_type || 'Project'}
                  </span>
                  <span>{p.title || 'Untitled project'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};


const ReferenceCard = ({ reference, projects, layout = 'left', onAction, runtimeLocale }) => {
  const interpretations = reference.interpretations || [];
  const availableLocales = interpretations.map((i) => i.locale);
  // Default to the user's runtime locale if available; else fall back to
  // the first interpretation that exists in our supported perspective set.
  const initial = useMemo(() => {
    if (runtimeLocale && availableLocales.includes(runtimeLocale)) return runtimeLocale;
    for (const code of PERSPECTIVE_ORDER) {
      if (availableLocales.includes(code)) return code;
    }
    return availableLocales[0] || 'IT_IT';
  }, [runtimeLocale, availableLocales]);
  const [active, setActive] = useState(initial);
  const [fading, setFading] = useState(false);
  const [busy, setBusy] = useState(false);

  const current = interpretations.find((i) => i.locale === active) || interpretations[0];

  const handlePerspective = (code) => {
    if (code === active) return;
    // Slow editorial transition — fade out, swap, fade in.
    setFading(true);
    setTimeout(() => {
      setActive(code);
      setTimeout(() => setFading(false), 30);
    }, 380);
  };

  const handleAction = async (action, extra = {}) => {
    setBusy(true);
    try {
      const res = await api.post(`/api/references/${reference.id}/actions`, {
        action,
        project_id: extra.project_id,
      });
      if (res.data?.ok) {
        const human = {
          link_project:   `Connected to ${extra.project_title || 'the project'}.`,
          discuss:        'Reference shared with the advisor.',
          moodboard:      'Noted for the moodboard composition.',
          material_study: 'Flagged for the material study.',
        }[action] || 'Action recorded.';
        toast(human);
      }
    } catch (e) {
      toast.error('Could not complete this editorial action.');
    } finally {
      setBusy(false);
    }
  };

  // Material annotations — split material_language into 3-5 chips.
  const annotations = useMemo(() => {
    const raw = current?.material_language || '';
    return raw
      .split(/[,;·]/g)
      .map((s) => s.trim())
      .filter((s) => s && s.length < 60)
      .slice(0, 5);
  }, [current]);

  const imageOnLeft = layout === 'left';

  return (
    <article
      data-testid={`reference-card-${reference.id}`}
      data-active-locale={active}
      className="border-b border-[var(--bp-border)] py-20 first:pt-12 last:border-b-0"
    >
      <div className="grid grid-cols-12 gap-x-10 gap-y-10">
        {/* Image — atmosphere supports the reading, never leads it */}
        <div className={`col-span-12 lg:col-span-5 ${imageOnLeft ? 'lg:order-1' : 'lg:order-2'}`}>
          <div
            data-testid={`reference-image-${reference.id}`}
            className="aspect-[4/5] overflow-hidden bg-[var(--bp-surface-2)]/50 relative"
          >
            {reference.imported_image_url ? (
              <img
                src={reference.imported_image_url}
                alt=""
                className={`w-full h-full object-cover transition-all duration-[1100ms] ease-out
                            ${fading ? 'opacity-70 scale-[1.012]' : 'opacity-100 scale-100'}`}
                loading="lazy"
              />
            ) : null}
            {/* Quiet ambient overlay synced with the active perspective */}
            <div
              className={`pointer-events-none absolute inset-0 mix-blend-multiply transition-opacity duration-[1100ms]
                          ${fading ? 'opacity-30' : 'opacity-10'}
                          bg-gradient-to-b from-transparent via-transparent to-[var(--bp-bg)]/60`}
              aria-hidden
            />
          </div>
          {reference.curator_name && (
            <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-[var(--bp-text-muted)] font-body">
              Curated by · {reference.curator_name}
            </p>
          )}
        </div>

        {/* Reading — atmosphere first, oversize heading */}
        <div className={`col-span-12 lg:col-span-7 ${imageOnLeft ? 'lg:order-2' : 'lg:order-1'}`}>
          <div className="grid grid-cols-12 gap-x-8">
            <div className="col-span-12 md:col-span-10">
              <p className="text-[10px] uppercase tracking-[0.34em] text-[var(--bp-primary)] font-body mb-5">
                Atmosphere · {MARKET_LABEL[active] || active} perspective
              </p>
              <h3
                data-testid={`reference-atmosphere-${reference.id}`}
                className={`font-heading font-light text-[var(--bp-text-primary)]
                            text-[34px] leading-[1.12] tracking-[-0.005em] max-w-[22ch]
                            transition-opacity duration-500 ${fading ? 'opacity-30' : 'opacity-100'}`}
              >
                {current?.atmosphere || '—'}
              </h3>

              <div
                data-testid={`reference-reading-${reference.id}`}
                className={`mt-7 font-body text-[15.5px] leading-[1.85] text-[var(--bp-text-primary)]/85
                            max-w-[62ch] transition-opacity duration-500 ${fading ? 'opacity-20' : 'opacity-100'}`}
              >
                {current?.editorial_reading || '—'}
              </div>

              {/* Material annotations */}
              {annotations.length > 0 && (
                <div
                  data-testid={`reference-annotations-${reference.id}`}
                  className={`mt-7 flex flex-wrap gap-2 transition-opacity duration-500
                              ${fading ? 'opacity-30' : 'opacity-100'}`}
                >
                  {annotations.map((a, i) => (
                    <MaterialAnnotation
                      key={`${a}-${i}`}
                      text={a}
                      testid={`material-chip-${reference.id}-${i}`}
                    />
                  ))}
                </div>
              )}

              {/* Architectural tone + hospitality (terse, editorial) */}
              <dl className={`mt-8 grid grid-cols-2 gap-x-10 gap-y-3 max-w-[62ch]
                              transition-opacity duration-500 ${fading ? 'opacity-30' : 'opacity-100'}`}>
                {current?.architectural_tone && (
                  <div className="col-span-2 md:col-span-1">
                    <dt className="text-[9.5px] uppercase tracking-[0.28em] text-[var(--bp-text-muted)] font-body">
                      Architectural tone
                    </dt>
                    <dd className="mt-1 font-body text-[13.5px] text-[var(--bp-text-secondary)] leading-[1.6]">
                      {current.architectural_tone}
                    </dd>
                  </div>
                )}
                {current?.hospitality_level && (
                  <div className="col-span-2 md:col-span-1">
                    <dt className="text-[9.5px] uppercase tracking-[0.28em] text-[var(--bp-text-muted)] font-body">
                      Hospitality signal
                    </dt>
                    <dd className="mt-1 font-body text-[13.5px] text-[var(--bp-text-secondary)] leading-[1.6]">
                      {current.hospitality_level}
                    </dd>
                  </div>
                )}
              </dl>

              {/* Advisor note — italic, signed */}
              {reference.advisor_notes && (
                <div className="mt-9 pt-7 border-t border-[var(--bp-border)]/60 max-w-[62ch]">
                  <p className="text-[9.5px] uppercase tracking-[0.28em] text-[var(--bp-text-muted)] font-body mb-2">
                    Advisor note
                  </p>
                  <p
                    data-testid={`reference-advisor-note-${reference.id}`}
                    className="font-body italic text-[14.5px] leading-[1.7] text-[var(--bp-text-primary)]/90"
                  >
                    {reference.advisor_notes}
                  </p>
                </div>
              )}

              <AdvisorActionBar
                reference={reference}
                projectChoices={projects}
                onAction={handleAction}
                busy={busy}
              />
            </div>

            {/* Vertical Market Perspective™ — lives inside the card narrative */}
            <aside className="col-span-12 md:col-span-2 md:pl-4 mt-2">
              <PerspectiveSelector
                available={availableLocales}
                active={active}
                onChange={handlePerspective}
                busy={fading}
              />
            </aside>
          </div>
        </div>
      </div>
    </article>
  );
};


const CollectionSection = ({ collection, references, projects, runtimeLocale, layoutIndex }) => (
  <section
    data-testid={`collection-${collection.id}`}
    className="px-12 pt-24 pb-12 border-b border-[var(--bp-border)]"
  >
    <header className="mb-14 max-w-[80ch]">
      <p className="text-[10px] uppercase tracking-[0.34em] text-[var(--bp-text-muted)] font-body mb-5">
        {collection.project_vertical && `${collection.project_vertical} · `}Editorial direction
      </p>
      <h2
        data-testid={`collection-title-${collection.id}`}
        className="font-heading font-light text-[var(--bp-text-primary)]
                   text-[44px] leading-[1.08] tracking-[-0.01em]"
      >
        {collection.title}
      </h2>
      {collection.subtitle && (
        <p className="mt-5 font-body text-[16px] italic text-[var(--bp-text-secondary)] leading-[1.7] max-w-[60ch]">
          {collection.subtitle}
        </p>
      )}
      {collection.atmosphere_direction && (
        <p className="mt-6 font-body text-[14.5px] text-[var(--bp-text-primary)]/80 leading-[1.75] max-w-[64ch]">
          {collection.atmosphere_direction}
        </p>
      )}
    </header>

    {references.map((ref, i) => (
      <ReferenceCard
        key={ref.id}
        reference={ref}
        projects={projects}
        runtimeLocale={runtimeLocale}
        layout={(layoutIndex + i) % 2 === 0 ? 'left' : 'right'}
      />
    ))}
  </section>
);


const EmptyState = () => (
  <section
    data-testid="references-empty-state"
    className="px-12 py-28 max-w-[60ch]"
  >
    <p className="text-[10px] uppercase tracking-[0.34em] text-[var(--bp-text-muted)] font-body mb-5">
      Cultural Design Intelligence™
    </p>
    <h2 className="font-heading font-light text-[32px] text-[var(--bp-text-primary)] leading-[1.15] mb-5">
      The research room is being assembled.
    </h2>
    <p className="font-body text-[15.5px] text-[var(--bp-text-secondary)] leading-[1.8] italic">
      Curated editorial collections appear here once the studio's advisors begin
      compiling design references. Each reference is read through the cultural lens
      of the target market — never translated, always reinterpreted.
    </p>
  </section>
);


const LoadingState = () => (
  <section data-testid="references-loading" className="px-12 py-28 max-w-[60ch]">
    <p className="font-body text-[13px] italic text-[var(--bp-text-muted)]">
      Composing the editorial readings…
    </p>
  </section>
);


// ─── Page ────────────────────────────────────────────────────────────────

const ReferencesPage = () => {
  const runtime = useLocaleRuntime();
  const [collections, setCollections] = useState([]);
  const [refsById, setRefsById] = useState({});
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Fetch collections + all references in parallel.
        const [colsR, refsR, projR] = await Promise.all([
          api.get('/api/reference-collections'),
          api.get('/api/references'),
          api.get('/api/projects').catch(() => ({ data: { projects: [] } })),
        ]);
        if (cancelled) return;
        const cols = colsR.data?.collections || [];
        const refs = refsR.data?.references || [];
        const byId = Object.fromEntries(refs.map((r) => [r.id, r]));
        // Hydrate collection items in a second pass (uses cached refs).
        const hydrated = await Promise.all(cols.map(async (col) => {
          try {
            const r = await api.get(`/api/reference-collections/${col.id}`);
            return { ...col, references: r.data?.references || [] };
          } catch (_) {
            return { ...col, references: [] };
          }
        }));
        if (cancelled) return;
        setCollections(hydrated);
        setRefsById(byId);
        // /api/projects responds as `{ data: [...], total }` — accommodate
        // alternate shapes defensively.
        const pd = projR.data;
        const projectList = pd?.data
          || pd?.projects
          || (Array.isArray(pd) ? pd : []);
        setProjects(Array.isArray(projectList) ? projectList.slice(0, 12) : []);
      } catch (e) {
        if (!cancelled) setError('runtime_unreachable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const meaningfulCollections = useMemo(
    () => collections.filter((c) => (c.references || []).length > 0),
    [collections],
  );

  return (
    <div
      data-testid="references-page"
      data-surface="os"
      className="min-h-full bg-[var(--bp-bg)]"
    >
      <EditorialHero />

      {loading && <LoadingState />}

      {!loading && error && (
        <section data-testid="references-error" className="px-12 py-28 max-w-[60ch]">
          <p className="font-body italic text-[var(--bp-text-secondary)] text-[14px]">
            We couldn't complete this editorial action right now. Try again shortly.
          </p>
        </section>
      )}

      {!loading && !error && meaningfulCollections.length === 0 && <EmptyState />}

      {!loading && !error && meaningfulCollections.map((col, idx) => (
        <CollectionSection
          key={col.id}
          collection={col}
          references={col.references}
          projects={projects}
          runtimeLocale={runtime?.localeCode}
          layoutIndex={idx}
        />
      ))}

      {/* Closing breath — calm whitespace, no footer chrome */}
      <div className="h-32" aria-hidden />
    </div>
  );
};

export default ReferencesPage;
