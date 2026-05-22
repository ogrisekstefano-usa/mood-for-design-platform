/**
 * SemanticEditorialReview · ITER135.
 *
 * Side-by-side editorial rewrite cockpit. The studio types (or pastes,
 * or drops in from the registry) one source phrase, picks markets, and
 * sees seven distinct editorial voices — each written by Claude Sonnet 4.5
 * with the in-market voice directive. NOT literal translation.
 *
 * UX shape:
 *   ┌──────────────────────────────────────────────┐
 *   │ source · it-IT                               │
 *   │ [Materia che parla.]                         │
 *   │ key: material_view.header.title  · Rewrite ▶│
 *   └──────────────────────────────────────────────┘
 *   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
 *   │ EN-US       │ │ FR-FR       │ │ AR          │  ← cards
 *   │ rewrite     │ │ rewrite     │ │ rewrite     │
 *   │ rationale   │ │ rationale   │ │ rationale   │
 *   └─────────────┘ └─────────────┘ └─────────────┘
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchVoiceProfiles, requestSemanticRewrite,
} from './RuntimeLocalizationApi';

const ALL_LOCALES = ['it-IT', 'en-US', 'en-GB', 'fr-FR', 'de-DE', 'es-ES', 'ar'];

const FLAGS = {
  'it-IT': '🇮🇹', 'en-US': '🇺🇸', 'en-GB': '🇬🇧',
  'fr-FR': '🇫🇷', 'de-DE': '🇩🇪', 'es-ES': '🇪🇸', 'ar': '🇦🇪',
};

const isRTL = (loc) => loc === 'ar';

const SemanticEditorialReview = () => {
  const [profiles, setProfiles]    = useState({});
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [sourceText, setSourceText] = useState('Materia che parla.');
  const [sourceLocale, setSourceLocale] = useState('it-IT');
  const [registryKey, setRegistryKey] = useState('material_view.header.title');
  const [selectedTargets, setSelectedTargets] = useState(
    ALL_LOCALES.filter((l) => l !== 'it-IT')
  );
  const [marketAudience, setMarketAudience] = useState('studio_owners');
  const [luxuryTier, setLuxuryTier] = useState('ultra_luxury');
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);

  useEffect(() => {
    fetchVoiceProfiles()
      .then((d) => { setProfiles(d.profiles || {}); setProfilesLoaded(true); })
      .catch(() => setProfilesLoaded(true));
  }, []);

  const toggleTarget = (lc) => {
    setSelectedTargets((cur) =>
      cur.includes(lc) ? cur.filter((x) => x !== lc) : [...cur, lc]);
  };

  const onRewrite = async () => {
    if (!sourceText.trim()) {
      toast.error('Source text is empty');
      return;
    }
    if (selectedTargets.length === 0) {
      toast.error('Select at least one target market');
      return;
    }
    setLoading(true);
    try {
      const data = await requestSemanticRewrite({
        sourceText,
        sourceLocale,
        key: registryKey || null,
        targetLocales: selectedTargets,
        marketContext: { audience: marketAudience, luxury_tier: luxuryTier },
        useCache: true,
      });
      setResult(data);
      const fallbacks = (data.rewrites || []).filter((r) => r.fallback).length;
      if (fallbacks > 0) {
        toast.warning(`${fallbacks} locale${fallbacks === 1 ? '' : 's'} fell back to literal`);
      } else {
        toast.success(`${(data.rewrites || []).length} editorial rewrites generated`);
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail?.reason || 'Rewrite failed');
    } finally {
      setLoading(false);
    }
  };

  const onRewriteSingle = async (lc) => {
    setLoading(true);
    try {
      const data = await requestSemanticRewrite({
        sourceText,
        sourceLocale,
        key: registryKey || null,
        targetLocales: [lc],
        marketContext: { audience: marketAudience, luxury_tier: luxuryTier },
        useCache: false,  // force a regeneration
      });
      // merge into existing result so other cards stay
      setResult((cur) => {
        const merged = { ...(cur || data) };
        const all = [...(merged.rewrites || [])];
        const idx = all.findIndex((x) => x.target_locale === lc);
        const fresh = (data.rewrites || [])[0];
        if (fresh) {
          if (idx >= 0) all[idx] = fresh;
          else all.push(fresh);
        }
        merged.rewrites = all;
        return merged;
      });
      toast.success(`Regenerated · ${lc}`);
    } catch (_) {
      toast.error(`Regenerate failed · ${lc}`);
    } finally {
      setLoading(false);
    }
  };

  const totalDuration = useMemo(() => {
    if (!result?.rewrites) return 0;
    return result.rewrites.reduce((s, r) => s + (r.duration_ms || 0), 0);
  }, [result]);

  return (
    <section data-testid="locgov-semantic-review" className="mt-2">
      <div className="mb-7">
        <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--mood-accent, #d9b285)] mb-2">
          05 · Semantic Editorial Review™
        </p>
        <h2 className="font-heading text-[28px] leading-[1.15] text-[var(--mood-text, #f0ebe0)] tracking-[-0.005em] mb-2">
          Reinterpret, never translate
        </h2>
        <p className="text-[13px] leading-[1.7] text-[var(--mood-text-muted, rgba(240,235,224,0.6))] font-body max-w-[68ch]">
          Each market reads like the work of an editor based there — Milan
          rigour, American cinematic hospitality, British curatorial
          restraint, French sensorial narration, German architectural
          precision, Spanish narrative warmth, Gulf monumentality. Powered by
          Claude Sonnet 4.5 with seven in-market voice directives.
        </p>
      </div>

      {/* Source editor */}
      <div className="mb-7 p-7 border border-[var(--mood-border, rgba(255,255,255,0.07))] bg-[var(--mood-surface, #11141a)]">
        <div className="flex items-center gap-4 mb-4">
          <span className="text-[10px] uppercase tracking-[0.26em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.6))]">
            Source
          </span>
          <select
            value={sourceLocale}
            onChange={(e) => setSourceLocale(e.target.value)}
            data-testid="locgov-sem-source-locale"
            className="bg-transparent border border-[var(--mood-border, rgba(255,255,255,0.08))] py-1.5 px-2 text-[10.5px] uppercase tracking-[0.18em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.75))]"
          >
            {ALL_LOCALES.map((l) => (
              <option key={l} value={l}>{FLAGS[l]} {l}</option>
            ))}
          </select>
        </div>
        <textarea
          rows={3}
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          data-testid="locgov-sem-source-text"
          dir={isRTL(sourceLocale) ? 'rtl' : 'ltr'}
          className="w-full bg-transparent border border-[var(--mood-border, rgba(255,255,255,0.08))] py-3 px-4 font-heading italic text-[18px] text-[var(--mood-text, #f0ebe0)] outline-none focus:border-[var(--mood-accent-soft, rgba(217,178,133,0.5))] mb-4 resize-y"
          placeholder="Materia che parla. Il tuo studio in viaggio. Una stagione di racconto…"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="text-[9.5px] uppercase tracking-[0.26em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.55))] block mb-1.5">
              Registry key (optional)
            </label>
            <input
              value={registryKey}
              onChange={(e) => setRegistryKey(e.target.value)}
              data-testid="locgov-sem-key"
              className="w-full bg-transparent border border-[var(--mood-border, rgba(255,255,255,0.08))] py-2 px-3 text-[12px] font-mono text-[var(--mood-text, #f0ebe0)] outline-none focus:border-[var(--mood-accent-soft, rgba(217,178,133,0.4))]"
              placeholder="e.g. material_view.header.title"
            />
          </div>
          <div>
            <label className="text-[9.5px] uppercase tracking-[0.26em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.55))] block mb-1.5">
              Audience
            </label>
            <select
              value={marketAudience}
              onChange={(e) => setMarketAudience(e.target.value)}
              data-testid="locgov-sem-audience"
              className="w-full bg-transparent border border-[var(--mood-border, rgba(255,255,255,0.08))] py-2 px-3 text-[11px] uppercase tracking-[0.18em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.75))]"
            >
              <option value="studio_owners">Studio owners</option>
              <option value="senior_designers">Senior designers</option>
              <option value="end_clients">End clients</option>
              <option value="press_editors">Press editors</option>
            </select>
          </div>
          <div>
            <label className="text-[9.5px] uppercase tracking-[0.26em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.55))] block mb-1.5">
              Luxury tier
            </label>
            <select
              value={luxuryTier}
              onChange={(e) => setLuxuryTier(e.target.value)}
              data-testid="locgov-sem-luxury"
              className="w-full bg-transparent border border-[var(--mood-border, rgba(255,255,255,0.08))] py-2 px-3 text-[11px] uppercase tracking-[0.18em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.75))]"
            >
              <option value="approachable_luxury">Approachable luxury</option>
              <option value="contemporary_luxury">Contemporary luxury</option>
              <option value="ultra_luxury">Ultra luxury</option>
              <option value="heritage">Heritage / legacy</option>
            </select>
          </div>
        </div>

        {/* Target picker */}
        <p className="text-[9.5px] uppercase tracking-[0.26em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.55))] mb-2">
          Target markets
        </p>
        <div className="flex flex-wrap gap-2 mb-5" data-testid="locgov-sem-targets">
          {ALL_LOCALES.filter((l) => l !== sourceLocale).map((lc) => {
            const sel = selectedTargets.includes(lc);
            return (
              <button
                key={lc}
                type="button"
                onClick={() => toggleTarget(lc)}
                data-testid={`locgov-sem-target-${lc}`}
                className={`px-3 py-1.5 text-[10.5px] uppercase tracking-[0.2em] font-mono border transition-colors
                  ${sel
                    ? 'border-[var(--mood-accent, #d9b285)] text-[var(--mood-accent, #d9b285)]'
                    : 'border-[var(--mood-border, rgba(255,255,255,0.1))] text-[var(--mood-text-muted, rgba(240,235,224,0.5))] hover:text-[var(--mood-text, #f0ebe0)]'}`}
              >
                {FLAGS[lc]} {lc}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onRewrite}
          disabled={loading}
          data-testid="locgov-sem-rewrite"
          className="px-5 py-3 text-[10.5px] uppercase tracking-[0.22em] font-mono border border-[var(--mood-accent, #d9b285)] text-[var(--mood-accent, #d9b285)] hover:bg-[var(--mood-accent-soft, rgba(217,178,133,0.06))] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? <Loader2 size={12} className="animate-spin" strokeWidth={1.7} />
            : <Sparkles size={12} strokeWidth={1.7} />}
          Rewrite for market
        </button>
      </div>

      {/* Result cards */}
      {result?.rewrites && result.rewrites.length > 0 && (
        <div className="mb-12">
          <div className="flex items-baseline justify-between mb-5">
            <p className="text-[10px] uppercase tracking-[0.26em] font-mono text-[var(--mood-accent, #d9b285)]">
              In-market editorial voices · {result.rewrites.length}
            </p>
            <p className="text-[10.5px] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">
              total {totalDuration}ms · model claude-sonnet-4.5
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
               data-testid="locgov-sem-cards">
            {result.rewrites.map((r) => {
              const profile = profiles[r.target_locale];
              const rtl = isRTL(r.target_locale);
              return (
                <article
                  key={r.target_locale}
                  data-testid={`locgov-sem-card-${r.target_locale}`}
                  className={`p-6 border border-[var(--mood-border, rgba(255,255,255,0.07))] bg-[var(--mood-surface, #11141a)] flex flex-col gap-4
                    ${r.fallback ? 'border-dashed' : ''}`}
                >
                  <header className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-mono text-[var(--mood-accent, #d9b285)]">
                        {FLAGS[r.target_locale]} {r.target_locale}
                      </p>
                      {profile?.label && (
                        <p className="mt-0.5 text-[9.5px] uppercase tracking-[0.22em] font-mono text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">
                          {profile.label}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRewriteSingle(r.target_locale)}
                      disabled={loading}
                      data-testid={`locgov-sem-regen-${r.target_locale}`}
                      title="Regenerate this market"
                      className="text-[var(--mood-text-muted, rgba(240,235,224,0.5))] hover:text-[var(--mood-accent, #d9b285)]"
                    >
                      <Repeat size={11} strokeWidth={1.7} />
                    </button>
                  </header>

                  <p
                    dir={rtl ? 'rtl' : 'ltr'}
                    className="font-heading italic text-[20px] leading-[1.35] text-[var(--mood-text, #f0ebe0)] tracking-[-0.005em] flex-1"
                  >
                    «{r.text}»
                  </p>

                  <footer className="text-[10px] font-mono text-[var(--mood-text-faint, rgba(240,235,224,0.45))] space-y-1.5">
                    {profile && (
                      <p className="leading-[1.5]">
                        <span className="text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">Tone</span>
                        {' · '}{profile.tone}
                      </p>
                    )}
                    <p className="flex items-center gap-3">
                      <span>{r.duration_ms}ms</span>
                      {r.cached  && <span className="text-[var(--mood-accent, #d9b285)]">cached</span>}
                      {r.fallback && <span className="text-[var(--mood-danger, #c25b5b)]">fallback</span>}
                    </p>
                  </footer>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {!result && profilesLoaded && (
        <p data-testid="locgov-sem-empty"
           className="py-14 font-heading italic text-[15px] text-[var(--mood-text-muted, rgba(240,235,224,0.55))]">
          Type or paste a source phrase, choose markets, and let Claude
          rewrite — never translate — the copy for each editorial voice.
        </p>
      )}
    </section>
  );
};

export default SemanticEditorialReview;
