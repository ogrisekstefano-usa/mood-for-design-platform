import React from 'react';
import {
  Image as ImageIcon, Plus, X, ChevronLeft, ChevronRight, Star, Link2,
} from 'lucide-react';
import InlineText from '../InlineText';
import {
  getField, getSetting,
  BlockToolbar, ToolbarSegment, ToolbarChip,
} from './shared';

// ─── brand_logos ────────────────────────────────────────────────────────
// Partner logos row. Upload, reorder, dark/light/grayscale, density, link
// URL, featured pin.

const BrandLogos = ({ section, locale, draft, updateContent, updateSettings, openAssetPicker }) => {
  const logos = getSetting(section, 'logos') || [];
  const s = section.settings || {};
  const theme     = s.logo_theme || 'auto';     // 'auto' | 'dark' | 'light'
  const grayscale = s.grayscale !== false;
  const density   = s.density || 'comfortable'; // 'tight' | 'comfortable' | 'spacious'

  const writeLogos = (next) => updateSettings('logos', next);
  const patchLogo  = (idx, patcher) => writeLogos(logos.map((l, i) => (i === idx ? patcher(l) : l)));
  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= logos.length) return;
    const next = logos.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    writeLogos(next);
  };
  const remove = (idx) => writeLogos(logos.filter((_, i) => i !== idx));
  const toggleFeatured = (idx) => patchLogo(idx, (l) => ({ ...l, featured: !l.featured }));
  const addLogo = () => {
    const id = `brand_${Date.now().toString(36)}`;
    writeLogos([...logos, { id, wordmark: 'Brand', image_url: '', href: '' }]);
  };

  const gapCls = density === 'tight' ? 'gap-6' : density === 'spacious' ? 'gap-16' : 'gap-10';
  const bgCls  = theme === 'dark' ? 'bg-[#0F0F12] text-white' : theme === 'light' ? 'bg-[#F7F4EE] text-[#1E1E22]' : 'bg-[var(--bp-bg)] text-[var(--bp-text-primary)]';

  return (
    <div className={`${bgCls} py-14 px-12 relative`} data-testid={`section-${section.id}`}>
      <BlockToolbar testid={`brand-toolbar-${section.id}`}>
        <ToolbarSegment label="Theme">
          {['auto', 'dark', 'light'].map((k) => (
            <ToolbarChip key={k} active={theme === k} onClick={() => updateSettings('logo_theme', k)} testid={`brand-theme-${k}-${section.id}`}>
              {k}
            </ToolbarChip>
          ))}
        </ToolbarSegment>
        <ToolbarSegment label="Grayscale">
          <ToolbarChip active={grayscale} onClick={() => updateSettings('grayscale', !grayscale)} testid={`brand-gray-${section.id}`}>
            {grayscale ? 'On' : 'Off'}
          </ToolbarChip>
        </ToolbarSegment>
        <ToolbarSegment label="Density">
          {['tight', 'comfortable', 'spacious'].map((k) => (
            <ToolbarChip key={k} active={density === k} onClick={() => updateSettings('density', k)} testid={`brand-density-${k}-${section.id}`}>
              {k}
            </ToolbarChip>
          ))}
        </ToolbarSegment>
      </BlockToolbar>

      <div className="max-w-6xl mx-auto">
        <InlineText
          value={getField(section, draft, locale, 'section_kicker')}
          onChange={(v) => updateContent(locale, 'section_kicker', v)}
          placeholder="TRUSTED BY"
          as="p"
          className="text-current opacity-50 text-[10px] font-body uppercase tracking-[0.3em] text-center mb-10"
          testid={`brand-kicker-${section.id}`}
        />

        <div className={`flex flex-wrap items-center justify-center ${gapCls}`}>
          {logos.map((l, i) => (
            <div
              key={l.id || i}
              className={`group relative flex items-center justify-center min-w-[120px] h-[60px] px-3 ${l.featured ? 'ring-1 ring-[#C9A36E]/60 ring-offset-2 ring-offset-transparent' : ''}`}
              data-testid={`brand-${l.id || i}`}
            >
              {l.image_url ? (
                <img
                  src={l.image_url}
                  alt={l.wordmark || ''}
                  className={`max-h-[44px] w-auto transition-all ${grayscale ? 'grayscale opacity-70 group-hover:opacity-100 group-hover:grayscale-0' : 'opacity-90 group-hover:opacity-100'}`}
                />
              ) : (
                <InlineText
                  value={l.wordmark || ''}
                  onChange={(v) => patchLogo(i, (x) => ({ ...x, wordmark: v }))}
                  placeholder="BRAND"
                  as="span"
                  className="font-heading text-lg tracking-[0.25em] uppercase opacity-70 group-hover:opacity-100"
                  testid={`brand-${l.id || i}-wordmark`}
                />
              )}

              <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={() => openAssetPicker((a) => patchLogo(i, (x) => ({ ...x, image_url: a.public_url })))}
                        className="px-2 py-1 rounded-[2px] bg-black/85 backdrop-blur-md border border-white/15 text-white/85 hover:text-white text-[9px] uppercase tracking-[0.18em]"
                        title="Upload logo" data-testid={`brand-${l.id || i}-upload`}>
                  <ImageIcon size={10} strokeWidth={1.6} />
                </button>
                <button type="button" onClick={() => toggleFeatured(i)}
                        className={`px-2 py-1 rounded-[2px] bg-black/85 backdrop-blur-md border ${l.featured ? 'border-[#C9A36E] text-[#C9A36E]' : 'border-white/15 text-white/85'}`}
                        title="Featured" data-testid={`brand-${l.id || i}-feature`}>
                  <Star size={10} strokeWidth={1.6} className={l.featured ? 'fill-current' : ''} />
                </button>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                        className="px-2 py-1 rounded-[2px] bg-black/85 backdrop-blur-md border border-white/15 text-white/85 hover:text-white disabled:opacity-30"
                        title="Move left" data-testid={`brand-${l.id || i}-left`}>
                  <ChevronLeft size={10} strokeWidth={1.6} />
                </button>
                <button type="button" onClick={() => move(i, +1)} disabled={i === logos.length - 1}
                        className="px-2 py-1 rounded-[2px] bg-black/85 backdrop-blur-md border border-white/15 text-white/85 hover:text-white disabled:opacity-30"
                        title="Move right" data-testid={`brand-${l.id || i}-right`}>
                  <ChevronRight size={10} strokeWidth={1.6} />
                </button>
                <button type="button" onClick={() => remove(i)}
                        className="px-2 py-1 rounded-[2px] bg-black/85 backdrop-blur-md border border-white/15 text-white/85 hover:text-rose-300"
                        title="Remove" data-testid={`brand-${l.id || i}-remove`}>
                  <X size={10} strokeWidth={1.6} />
                </button>
              </div>

              <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-1 px-2 py-1 rounded-[2px] bg-black/85 backdrop-blur-md border border-white/15">
                  <Link2 size={9} strokeWidth={1.6} className="text-white/60" />
                  <input
                    type="text"
                    value={l.href || ''}
                    onChange={(e) => patchLogo(i, (x) => ({ ...x, href: e.target.value }))}
                    placeholder="https://…"
                    data-testid={`brand-${l.id || i}-href`}
                    className="w-40 px-1 bg-transparent text-white/85 text-[10px] font-mono outline-none placeholder:text-white/30"
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addLogo}
            data-testid={`brand-add-${section.id}`}
            className="flex flex-col items-center justify-center min-w-[120px] h-[60px] border border-dashed border-current/30 opacity-60 hover:opacity-100 transition-opacity"
          >
            <Plus size={16} strokeWidth={1.4} />
            <span className="text-[9px] font-body uppercase tracking-[0.22em] mt-1">Brand</span>
          </button>
        </div>

        {logos.length === 0 && (
          <p className="text-current opacity-50 text-xs font-body italic text-center pt-6">
            Add partner brand logos above.
          </p>
        )}
      </div>
    </div>
  );
};

export default BrandLogos;
