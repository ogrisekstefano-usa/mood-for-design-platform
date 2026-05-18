/**
 * VariantApprovalInboxPage — Phase post-P0.2.D hardening.
 *
 * Cinematic editorial cruscotto: the editor reviews every AI-composed
 * cultural variant pending approval — article and hotspot — in a single
 * newsroom view. Approve/reject each one in place. AI feels like a
 * newsroom assistant, NOT an uncontrolled generator.
 *
 * Endpoint:   GET    /api/magazine/variant-approval-inbox
 * Approve:    PATCH  /api/magazine/articles/{id}/locale-variants/{loc}/approve
 *             PATCH  /api/magazine/hotspots/{id}/locale-variants/{loc}/approve
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, X, ChevronRight, Clock, Globe, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import { useLocaleRuntime } from '../../contexts/LocaleRuntimeContext';

const LOCALE_LABEL = {
  IT_IT: 'Italia · Editorial craftsmanship',
  EN_US: 'US · Aspirational lifestyle',
  EN_GB: 'UK · Editorial restraint',
  EN_AE: 'UAE · Sensorial prestige',
  DE_DE: 'DE · Architectural precision',
  FR_FR: 'FR · Editorial sophistication',
  ES_ES: 'ES · Warm Mediterranean',
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const now = new Date();
    const min = Math.round((now - d) / 60000);
    if (min < 1) return 'pochi istanti fa';
    if (min < 60) return `${min} min fa`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h}h fa`;
    return d.toLocaleDateString();
  } catch (_) { return '—'; }
};

// ── Card components ────────────────────────────────────────────────────

const ArticleCard = ({ item, onApprove, onReject, busy }) => (
  <article className="bp-card p-6 mb-4"
           data-testid={`variant-card-article-${item.article_id}-${item.locale_code}`}>
    <header className="flex items-baseline justify-between gap-4 mb-4">
      <div>
        <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--bp-primary)] font-body mb-1">
          Editorial perspective · {item.locale_code}
        </p>
        <h3 className="font-heading text-[22px] font-light text-[var(--bp-text-primary)] leading-tight">
          {item.title}
        </h3>
        {item.subtitle && (
          <p className="text-[14px] text-[var(--bp-text-secondary)] font-body italic mt-1">
            {item.subtitle}
          </p>
        )}
      </div>
      <span className="text-[10px] uppercase tracking-[0.18em] text-amber-300/70 font-body whitespace-nowrap">
        Editorial pending
      </span>
    </header>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--bp-text-muted)] font-body mb-1">Direction</p>
        <p className="text-[13.5px] text-[var(--bp-text-primary)] font-body leading-relaxed">
          {item.intro || '—'}
        </p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--bp-text-muted)] font-body mb-1">Reading invitation</p>
        <p className="text-[13.5px] text-[var(--bp-text-primary)] font-body leading-relaxed italic">
          {item.cta_copy || '—'}
        </p>
      </div>
    </div>

    <footer className="flex items-center justify-between gap-3 pt-4 border-t border-[var(--bp-border)]">
      <div className="flex items-center gap-3 text-[11px] text-[var(--bp-text-muted)] font-body">
        <Globe size={11} strokeWidth={1.6} className="text-[var(--bp-primary)]" />
        <span>{LOCALE_LABEL[item.locale_code] || item.locale_code}</span>
        <span aria-hidden>·</span>
        <Clock size={11} strokeWidth={1.6} />
        <span>{fmtTime(item.generated_at)}</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onReject(item)} disabled={busy}
                data-testid={`variant-reject-${item.article_id}-${item.locale_code}`}
                className="px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)]
                           border border-[var(--bp-border)] hover:border-[var(--bp-border-strong)]
                           hover:text-[var(--bp-text-primary)] transition-colors disabled:opacity-50">
          <X size={10} strokeWidth={1.8} className="inline mr-1 -mt-0.5" /> Set aside
        </button>
        <button onClick={() => onApprove(item)} disabled={busy}
                data-testid={`variant-approve-${item.article_id}-${item.locale_code}`}
                className="px-4 py-1.5 text-[11px] uppercase tracking-[0.18em] font-semibold
                           bg-[var(--bp-primary)] text-[var(--bp-bg)] hover:opacity-90 transition-opacity
                           disabled:opacity-50">
          {busy ? <Loader2 size={10} className="inline animate-spin" /> : <Check size={10} strokeWidth={1.8} className="inline mr-1 -mt-0.5" />}
          Publish perspective
        </button>
      </div>
    </footer>
  </article>
);

const HotspotCard = ({ item, onApprove, onReject, busy }) => (
  <article className="bp-card p-6 mb-4"
           data-testid={`variant-card-hotspot-${item.hotspot_id}-${item.locale_code}`}>
    <header className="flex items-baseline justify-between gap-4 mb-3">
      <div>
        <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--bp-primary)] font-body mb-1">
          Hotspot perspective · {item.locale_code}
        </p>
        <h3 className="font-heading text-[18px] font-light text-[var(--bp-text-primary)] leading-tight">
          {item.title || '—'}
        </h3>
      </div>
      <span className="text-[10px] uppercase tracking-[0.18em] text-amber-300/70 font-body whitespace-nowrap">
        Editorial pending
      </span>
    </header>

    <p className="text-[13.5px] text-[var(--bp-text-primary)] font-body leading-relaxed mb-3">
      {item.narrative || '—'}
    </p>

    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4 text-[11px] text-[var(--bp-text-secondary)] font-body">
      {item.cta_copy && <span><span className="text-[var(--bp-text-muted)] uppercase tracking-[0.18em] text-[9px] mr-1.5">cta</span>{item.cta_copy}</span>}
      {item.emotional_framing && <span><span className="text-[var(--bp-text-muted)] uppercase tracking-[0.18em] text-[9px] mr-1.5">framing</span>{item.emotional_framing}</span>}
      {item.atmosphere && <span><span className="text-[var(--bp-text-muted)] uppercase tracking-[0.18em] text-[9px] mr-1.5">atmosphere</span>{item.atmosphere}</span>}
    </div>

    <footer className="flex items-center justify-between gap-3 pt-4 border-t border-[var(--bp-border)]">
      <div className="flex items-center gap-3 text-[11px] text-[var(--bp-text-muted)] font-body">
        <Globe size={11} strokeWidth={1.6} className="text-[var(--bp-primary)]" />
        <span>{LOCALE_LABEL[item.locale_code] || item.locale_code}</span>
        <span aria-hidden>·</span>
        <Clock size={11} strokeWidth={1.6} />
        <span>{fmtTime(item.generated_at)}</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onReject(item)} disabled={busy}
                data-testid={`variant-reject-hotspot-${item.hotspot_id}-${item.locale_code}`}
                className="px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)]
                           border border-[var(--bp-border)] hover:border-[var(--bp-border-strong)]
                           hover:text-[var(--bp-text-primary)] transition-colors disabled:opacity-50">
          <X size={10} strokeWidth={1.8} className="inline mr-1 -mt-0.5" /> Set aside
        </button>
        <button onClick={() => onApprove(item)} disabled={busy}
                data-testid={`variant-approve-hotspot-${item.hotspot_id}-${item.locale_code}`}
                className="px-4 py-1.5 text-[11px] uppercase tracking-[0.18em] font-semibold
                           bg-[var(--bp-primary)] text-[var(--bp-bg)] hover:opacity-90 transition-opacity
                           disabled:opacity-50">
          {busy ? <Loader2 size={10} className="inline animate-spin" /> : <Check size={10} strokeWidth={1.8} className="inline mr-1 -mt-0.5" />}
          Publish perspective
        </button>
      </div>
    </footer>
  </article>
);

// ── Page ───────────────────────────────────────────────────────────────

const VariantApprovalInboxPage = () => {
  const runtime = useLocaleRuntime();
  const [pending, setPending] = useState([]);
  const [tab, setTab] = useState('all'); // all | article | hotspot
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyKey, setBusyKey] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.get('/api/magazine/variant-approval-inbox');
      setPending(r.data?.pending || []);
    } catch (e) {
      setError('Non siamo riusciti a recuperare le prospettive in attesa. Riprova fra un istante.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (tab === 'all') return pending;
    return pending.filter((p) => p.kind === tab);
  }, [pending, tab]);

  const counts = useMemo(() => ({
    all:      pending.length,
    article:  pending.filter((p) => p.kind === 'article').length,
    hotspot:  pending.filter((p) => p.kind === 'hotspot').length,
  }), [pending]);

  const handleAction = useCallback(async (item, approved) => {
    const url = item.kind === 'article'
      ? `/api/magazine/articles/${item.article_id}/locale-variants/${item.locale_code}/approve`
      : `/api/magazine/hotspots/${item.hotspot_id}/locale-variants/${item.locale_code}/approve`;
    const key = `${item.kind}-${item.article_id || item.hotspot_id}-${item.locale_code}`;
    setBusyKey(key); setError(null);
    try {
      await api.patch(url, { approved });
      // Remove from local list immediately for snappy feel.
      setPending((prev) => prev.filter((p) => {
        if (p.kind !== item.kind) return true;
        if (p.locale_code !== item.locale_code) return true;
        if (item.kind === 'article' && p.article_id !== item.article_id) return true;
        if (item.kind === 'hotspot' && p.hotspot_id !== item.hotspot_id) return true;
        return false;
      }));
    } catch (e) {
      setError('Azione editoriale non completata. Riprova fra un istante.');
    } finally { setBusyKey(null); }
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-8 py-12" data-testid="variant-approval-inbox"
         data-locale-code={runtime.localeCode}>
      <header className="mb-10">
        <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.24em] font-semibold mb-2">
          Editorial Operations · Publication Review
        </p>
        <h1 className="font-heading text-4xl text-[var(--bp-text-primary)] leading-tight mb-2"
            data-testid="inbox-title">
          Publication Review<sup>™</sup>
        </h1>
        <p className="text-[var(--bp-text-muted)] text-[14px] font-body max-w-2xl leading-relaxed">
          Approva i contenuti prima del rilascio pubblico. Ogni Market Edition culturale viene
          composta nel registro nativo del mercato di destinazione. Una volta approvata, raggiunge
          i lettori pubblici del Magazine. Senza la tua revisione, resta privata.
        </p>
      </header>

      {/* Tabs */}
      <nav className="flex items-center gap-1 mb-6 border-b border-[var(--bp-border)]"
           data-testid="inbox-tabs">
        {[
          { key: 'all',     label: 'Tutte' },
          { key: 'article', label: 'Articoli' },
          { key: 'hotspot', label: 'Riferimenti' },
        ].map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
                  data-testid={`inbox-tab-${t.key}`}
                  className={`px-4 py-3 text-[11px] uppercase tracking-[0.2em] font-body transition-colors
                              ${tab === t.key
                                ? 'text-[var(--bp-primary)] border-b-2 border-[var(--bp-primary)] -mb-px'
                                : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'}`}>
            {t.label}
            <span className="ml-2 text-[10px] opacity-70">{counts[t.key]}</span>
          </button>
        ))}
        <button onClick={load} disabled={loading}
                data-testid="inbox-refresh"
                className="ml-auto px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-[var(--bp-text-muted)]
                           hover:text-[var(--bp-text-primary)] font-body disabled:opacity-50">
          {loading ? 'Aggiorno…' : 'Aggiorna'}
        </button>
      </nav>

      {error && (
        <div className="bp-card border-amber-700/40 bg-amber-950/20 px-5 py-3 mb-5"
             data-testid="inbox-error">
          <p className="text-[13px] text-amber-200/90 font-body">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-4" data-testid="inbox-loading">
          {[0,1,2].map((i) => (
            <div key={i} className="bp-card p-6 opacity-70">
              <div className="h-3 w-32 bg-[var(--bp-surface-2)] mb-3 rounded animate-pulse"></div>
              <div className="h-5 w-2/3 bg-[var(--bp-surface-2)] mb-4 rounded animate-pulse"></div>
              <div className="h-3 w-full bg-[var(--bp-surface-2)] mb-2 rounded animate-pulse"></div>
              <div className="h-3 w-5/6 bg-[var(--bp-surface-2)] rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bp-card p-12 text-center" data-testid="inbox-empty">
          <p className="text-[var(--bp-primary)] text-[10px] uppercase tracking-[0.24em] font-body mb-3">
            Editorial calm
          </p>
          <h3 className="font-heading text-[22px] font-light text-[var(--bp-text-primary)] mb-2">
            Nessuna prospettiva in attesa.
          </h3>
          <p className="text-[var(--bp-text-muted)] text-[13.5px] font-body max-w-md mx-auto leading-relaxed">
            Quando il sistema compone una nuova lettura culturale di un articolo o di un riferimento,
            la troverai qui per l'approvazione.
          </p>
        </div>
      ) : (
        <div data-testid="inbox-list">
          {filtered.map((item) => {
            const key = `${item.kind}-${item.article_id || item.hotspot_id}-${item.locale_code}`;
            const busy = busyKey === key;
            const Card = item.kind === 'article' ? ArticleCard : HotspotCard;
            return (
              <Card key={key} item={item}
                    busy={busy}
                    onApprove={(it) => handleAction(it, true)}
                    onReject={(it) => handleAction(it, false)} />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VariantApprovalInboxPage;
