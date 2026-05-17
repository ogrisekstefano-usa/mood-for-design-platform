/**
 * CountryLanguageSelector — luxury locale + market picker.
 *
 * Modal-style mega-menu opened from the footer link "Country · Language".
 * Groups markets by macro_region (Europe · North America · MENA · LatAm …).
 * Clicking a market navigates to `/{primary_locale}` and persists the
 * choice via LocaleRuntimeContext.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Search, Globe, ChevronRight } from 'lucide-react';
import api from '../../lib/api';
import { useLocaleRuntime } from '../../contexts/LocaleRuntimeContext';
import { toBcp47 } from '../../i18n';
import { useSite } from '../SiteContext';

const REGION_ORDER = ['europe', 'north_america', 'mena', 'latam', 'asia_pacific'];
const REGION_LABELS = {
  europe:        'Europe',
  north_america: 'North America',
  mena:          'Middle East',
  latam:         'Latin America',
  asia_pacific:  'Asia Pacific',
};

export const CountryLanguageSelector = ({ open, onClose }) => {
  const [markets, setMarkets] = useState([]);
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const runtime = useLocaleRuntime();
  const { tenant } = useSite() || {};
  const slug = tenant?.slug || 'mood-demo-studio-81a09e';

  useEffect(() => {
    if (!open) return;
    api.get(`/api/storefront/public/${slug}/markets`)
       .then((r) => setMarkets(r.data?.markets || []))
       .catch(() => setMarkets([]));
  }, [open, slug]);

  const grouped = useMemo(() => {
    const k = q.trim().toLowerCase();
    const filt = !k ? markets : markets.filter((m) =>
      (Object.values(m.display_name || {}).join(' ').toLowerCase().includes(k))
      || (m.countries || []).some((c) => c.toLowerCase().includes(k))
      || (m.primary_locale || '').toLowerCase().includes(k));
    const g = {};
    filt.forEach((m) => { (g[m.macro_region] = g[m.macro_region] || []).push(m); });
    return g;
  }, [markets, q]);

  if (!open) return null;
  const onPick = (m) => {
    const locale = toBcp47(m.primary_locale);
    try { runtime?.setLocale?.(locale); } catch { /* noop */ }
    // Replace first path segment if it's a locale-shaped token, else prepend.
    const path = location.pathname.replace(/^\/[a-z]{2}-[A-Z]{2}(?=\/|$)/, '') || '/';
    navigate(`/${locale}${path === '/' ? '' : path}`);
    onClose();
  };

  return (
    <div
      data-testid="country-language-modal"
      className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-md flex items-start justify-center p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a1a] border border-white/10 rounded-[4px] w-full max-w-[920px] mt-12 mb-12 text-[#e8e3d8]"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: '0 60px 120px -40px rgba(0,0,0,0.7)' }}
      >
        <header className="flex items-start justify-between p-8 border-b border-white/10">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-amber-100/60 mb-2">
              <Globe size={12} className="inline mr-2 -mt-0.5" strokeWidth={1.6} />
              MOOD for DESIGN™ · Market & Locale
            </p>
            <h2 className="font-heading font-light text-[28px] leading-tight">
              Country · Language
            </h2>
            <p className="font-body text-[12.5px] italic text-white/55 mt-2 max-w-[52ch]">
              Choose your market. Editorial content, hospitality codes and CTA
              language adapt to where you are.
            </p>
          </div>
          <button onClick={onClose} data-testid="country-language-close"
                  className="text-white/55 hover:text-white p-1 -m-1">
            <X size={20} strokeWidth={1.6} />
          </button>
        </header>

        <div className="px-8 py-5 border-b border-white/10 flex items-center gap-3">
          <Search size={14} className="text-white/40" strokeWidth={1.6} />
          <input
            type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search country, region or language…"
            data-testid="country-language-search"
            className="flex-1 bg-transparent outline-none font-body text-[13px] text-white placeholder:text-white/40"
          />
        </div>

        <div className="px-8 py-7 max-h-[60vh] overflow-y-auto space-y-9">
          {REGION_ORDER.filter((r) => grouped[r]).map((region) => (
            <section key={region}>
              <p className="text-[9.5px] uppercase tracking-[0.32em] text-amber-100/55 font-body mb-4">
                {REGION_LABELS[region] || region}
              </p>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
                {grouped[region].map((m) => {
                  const name = m.display_name?.['en-US'] || m.display_name?.['en-GB'] || m.display_name?.['it-IT'] || m.code;
                  return (
                    <li key={m.id}>
                      <button
                        type="button" onClick={() => onPick(m)}
                        data-testid={`country-language-pick-${m.code}`}
                        className="w-full flex items-center justify-between gap-4 py-2.5 text-left group"
                      >
                        <div className="min-w-0">
                          <div className="font-heading text-[15px] text-white/90 group-hover:text-amber-100 transition-colors truncate">
                            {name}{m.is_default && <span className="ml-2 text-[9.5px] uppercase tracking-[0.22em] text-amber-100/70">default</span>}
                          </div>
                          <div className="font-body text-[10.5px] uppercase tracking-[0.2em] text-white/40 mt-0.5">
                            {m.primary_locale} · {m.currency}
                          </div>
                        </div>
                        <ChevronRight size={14} strokeWidth={1.6} className="text-white/30 group-hover:text-amber-100/80 transition-colors" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {Object.keys(grouped).length === 0 && (
            <p className="font-body italic text-white/55 text-center py-10">
              No markets match this search.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CountryLanguageSelector;
