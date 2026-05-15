import React from 'react';
import {
  Plus, X, AlignLeft, AlignCenter, ChevronLeft, ChevronRight,
} from 'lucide-react';
import InlineText from '../InlineText';
import { pickLocale } from '../storefrontApi';
import {
  FALLBACK_CHAIN, getField, getSetting,
  BlockToolbar, ToolbarSegment, ToolbarChip,
} from './shared';

// ─── stats_band ─────────────────────────────────────────────────────────
// Dark editorial KPI band. Inline-edit value + label, reorder, add/remove,
// alignment + accent toggles. Framer-style direct manipulation.

const StatsBand = ({ section, locale, draft, updateContent, updateSettings }) => {
  const stats = getSetting(section, 'stats') || [];
  const s = section.settings || {};
  const accent = s.accent_color || 'gold'; // 'gold' | 'teal' | 'mono'
  const align  = s.text_align || 'center'; // 'left' | 'center'

  const writeStats = (next) => updateSettings('stats', next);
  const patchStat  = (idx, patcher) => writeStats(stats.map((st, i) => (i === idx ? patcher(st) : st)));
  const setLocalized = (idx, field, value) => patchStat(idx, (st) => {
    const bag = (st[field] && typeof st[field] === 'object') ? st[field] : {};
    return { ...st, [field]: { ...bag, [locale]: value } };
  });
  const move   = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= stats.length) return;
    const next = stats.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    writeStats(next);
  };
  const remove = (idx) => writeStats(stats.filter((_, i) => i !== idx));
  const addStat = () => {
    const id = `stat_${Date.now().toString(36)}`;
    writeStats([...stats, { id, value: '0', label: { [locale]: '' } }]);
  };

  const accentColor = accent === 'gold' ? '#C9A36E' : accent === 'teal' ? 'var(--bp-primary)' : 'var(--bp-text-primary)';
  const headCls = align === 'left' ? 'text-left items-start' : 'text-center items-center';

  return (
    <div className="bg-[#0F0F12] text-white py-20 px-12 relative" data-testid={`section-${section.id}`}>
      <BlockToolbar testid={`stats-toolbar-${section.id}`}>
        <ToolbarSegment label="Accent">
          {['gold', 'teal', 'mono'].map((k) => (
            <ToolbarChip key={k} active={accent === k} onClick={() => updateSettings('accent_color', k)} testid={`stats-accent-${k}-${section.id}`}>
              <span className="w-2 h-2 rounded-full mr-1.5" style={{ background: k === 'gold' ? '#C9A36E' : k === 'teal' ? 'var(--bp-primary)' : '#F5F3EE' }} />
              {k}
            </ToolbarChip>
          ))}
        </ToolbarSegment>
        <ToolbarSegment label="Align">
          <ToolbarChip active={align === 'left'} onClick={() => updateSettings('text_align', 'left')} testid={`stats-align-left-${section.id}`}>
            <AlignLeft size={10} strokeWidth={1.6} />
          </ToolbarChip>
          <ToolbarChip active={align === 'center'} onClick={() => updateSettings('text_align', 'center')} testid={`stats-align-center-${section.id}`}>
            <AlignCenter size={10} strokeWidth={1.6} />
          </ToolbarChip>
        </ToolbarSegment>
      </BlockToolbar>

      <div className={`max-w-6xl mx-auto flex flex-col gap-10 ${headCls}`}>
        <div className={`flex flex-col gap-3 max-w-3xl ${align === 'left' ? '' : 'mx-auto'}`}>
          <InlineText
            value={getField(section, draft, locale, 'section_kicker')}
            onChange={(v) => updateContent(locale, 'section_kicker', v)}
            placeholder="SECTION KICKER"
            as="p"
            className="text-[10px] font-body uppercase tracking-[0.3em]"
            style={{ color: accentColor }}
            testid={`stats-kicker-${section.id}`}
          />
          <InlineText
            value={getField(section, draft, locale, 'section_title')}
            onChange={(v) => updateContent(locale, 'section_title', v)}
            placeholder="Editorial title"
            multiline
            as="h2"
            className="font-heading text-3xl md:text-4xl font-light leading-tight text-white whitespace-pre-line"
            testid={`stats-title-${section.id}`}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 w-full">
          {stats.map((st, i) => (
            <div
              key={st.id || i}
              className="relative group text-center px-3 py-4 hover:bg-white/[0.03] transition-colors"
              data-testid={`stat-${st.id || i}`}
            >
              <InlineText
                value={st.value || ''}
                onChange={(v) => patchStat(i, (x) => ({ ...x, value: v }))}
                placeholder="0+"
                as="p"
                className="font-heading text-4xl md:text-5xl font-light tabular-nums mb-2"
                style={{ color: accentColor }}
                testid={`stat-${st.id || i}-value`}
              />
              <InlineText
                value={pickLocale(st.label, locale, FALLBACK_CHAIN)}
                onChange={(v) => setLocalized(i, 'label', v)}
                placeholder="Label"
                as="p"
                className="text-white/70 text-[11px] font-body uppercase tracking-[0.2em]"
                testid={`stat-${st.id || i}-label`}
              />
              <div className="absolute top-1 right-1 z-10 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                        className="w-5 h-5 flex items-center justify-center text-white/60 hover:text-white disabled:opacity-30"
                        title="Move left" data-testid={`stat-${st.id || i}-left`}>
                  <ChevronLeft size={11} strokeWidth={1.6} />
                </button>
                <button type="button" onClick={() => move(i, +1)} disabled={i === stats.length - 1}
                        className="w-5 h-5 flex items-center justify-center text-white/60 hover:text-white disabled:opacity-30"
                        title="Move right" data-testid={`stat-${st.id || i}-right`}>
                  <ChevronRight size={11} strokeWidth={1.6} />
                </button>
                <button type="button" onClick={() => remove(i)}
                        className="w-5 h-5 flex items-center justify-center text-white/60 hover:text-rose-300"
                        title="Remove" data-testid={`stat-${st.id || i}-remove`}>
                  <X size={11} strokeWidth={1.6} />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addStat}
            data-testid={`stats-add-${section.id}`}
            className="flex flex-col items-center justify-center min-h-[120px] border border-dashed border-white/15 text-white/45 hover:text-white hover:border-white/35 transition-colors"
          >
            <Plus size={18} strokeWidth={1.4} />
            <span className="text-[9px] font-body uppercase tracking-[0.22em] mt-2">Add stat</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatsBand;
