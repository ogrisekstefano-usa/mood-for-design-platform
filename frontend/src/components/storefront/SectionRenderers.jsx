/**
 * SectionRenderers — Cinematic editable previews for storefront sections.
 *
 * Every renderer accepts: { section, locale, draft, updateContent, updateSettings, openAssetPicker }
 *   - section: the cms_sections row { id, section_type, locale_content, settings, visible }
 *   - locale:  active locale code (canonical, e.g. 'it', 'en-US')
 *   - draft:   the *current* edited content for this section
 *   - updateContent(localeKey, fieldKey, value)  — patches draft + queues autosave
 *   - updateSettings(key, value)                 — patches settings + queues autosave
 *   - openAssetPicker(onPick)                    — opens drawer with callback
 */
import React, { useState } from 'react';
import {
  Image as ImageIcon, Plus, X, Gem, Users, Sparkles, Globe, ShieldCheck,
  Sliders, AlignLeft, AlignCenter, AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import InlineText from './InlineText';
import NavigationRenderer from './NavigationRenderer';
import FooterColumnsRenderer from './FooterColumnsRenderer';
import { pickLocale } from './storefrontApi';

const FALLBACK_CHAIN = ['it', 'en-US', 'en-GB', 'fr', 'de', 'es'];

const PILLAR_ICONS = [
  { key: 'gem',          Icon: Gem },
  { key: 'users',        Icon: Users },
  { key: 'sparkles',     Icon: Sparkles },
  { key: 'globe',        Icon: Globe },
  { key: 'shield-check', Icon: ShieldCheck },
];
const ICON_MAP = Object.fromEntries(PILLAR_ICONS.map(({ key, Icon }) => [key, Icon]));

const getField = (section, draft, locale, field) => {
  const bag = draft || section.locale_content || {};
  if (bag[locale] && bag[locale][field] != null) return bag[locale][field];
  return pickLocale(
    Object.fromEntries(
      Object.entries(bag).filter(([, v]) => v && typeof v === 'object' && field in v).map(([k, v]) => [k, v[field]])
    ),
    locale,
    FALLBACK_CHAIN,
  );
};

const getSetting = (section, key) => (section.settings || {})[key];

const EditableImage = ({ url, openAssetPicker, onPick, label = 'Replace image', testid, aspect = 'aspect-[16/9]' }) => (
  <button
    onClick={() => openAssetPicker(onPick)}
    data-testid={testid}
    className={`relative w-full ${aspect} overflow-hidden bg-[var(--bp-surface-2)] border border-[var(--bp-border)] group cursor-pointer block`}
  >
    {url ? (
      <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
    ) : (
      <div className="absolute inset-0 flex items-center justify-center">
        <ImageIcon size={36} strokeWidth={1} className="text-[var(--bp-text-muted)]" />
      </div>
    )}
    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
      <p className="text-white text-[10px] font-body uppercase tracking-[0.2em] flex items-center gap-2">
        <Plus size={12} strokeWidth={1.6} /> {label}
      </p>
    </div>
  </button>
);

// ─── HERO SETTINGS POPOVER ──────────────────────────────────────────────────
const HeroSettingsPopover = ({ section, updateSettings }) => {
  const [open, setOpen] = useState(false);
  const s = section.settings || {};
  const textAlign = s.text_align || 'center';
  const vAnchor = s.vertical_anchor || 'middle';
  const hAnchor = s.horizontal_anchor || 'center';
  const veilStyle = s.veil_style || 'gradient-bottom';
  const veilOpacity = s.veil_opacity != null ? s.veil_opacity : 60;
  const showItalic = s.show_italic !== false;

  const Btn = ({ active, onClick, label, testid, children }) => (
    <button
      type="button"
      onClick={onClick}
      title={label}
      data-testid={testid}
      className={`flex-1 flex items-center justify-center px-2 py-1.5 rounded-[2px] border text-[10px] uppercase tracking-[0.15em] transition-colors
        ${active
          ? 'border-[var(--bp-primary)] text-[var(--bp-primary)] bg-[var(--bp-primary)]/10'
          : 'border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] hover:border-[var(--bp-text-secondary)]'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="absolute top-3 left-3 z-20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid={`hero-settings-toggle-${section.id}`}
        title="Hero settings"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[2px] bg-black/60 backdrop-blur-md border border-white/15 text-white/85 hover:text-white hover:border-white/35 transition-colors text-[10px] uppercase tracking-[0.2em]"
      >
        <Sliders size={11} strokeWidth={1.5} /> Hero
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-2 w-[280px] p-4 rounded-[2px] bg-black/85 backdrop-blur-xl border border-white/15 text-white space-y-4 shadow-2xl"
          data-testid={`hero-settings-panel-${section.id}`}
        >
          {/* Text alignment */}
          <div>
            <p className="text-white/55 text-[9px] uppercase tracking-[0.25em] mb-2">Text alignment</p>
            <div className="flex gap-1.5">
              <Btn active={textAlign === 'left'} onClick={() => updateSettings('text_align', 'left')} label="Left" testid={`hero-align-left-${section.id}`}>
                <AlignLeft size={12} strokeWidth={1.5} />
              </Btn>
              <Btn active={textAlign === 'center'} onClick={() => updateSettings('text_align', 'center')} label="Center" testid={`hero-align-center-${section.id}`}>
                <AlignCenter size={12} strokeWidth={1.5} />
              </Btn>
            </div>
          </div>

          {/* Vertical anchor */}
          <div>
            <p className="text-white/55 text-[9px] uppercase tracking-[0.25em] mb-2">Vertical position</p>
            <div className="flex gap-1.5">
              <Btn active={vAnchor === 'top'} onClick={() => updateSettings('vertical_anchor', 'top')} label="Top" testid={`hero-v-top-${section.id}`}>
                <AlignVerticalJustifyStart size={12} strokeWidth={1.5} />
              </Btn>
              <Btn active={vAnchor === 'middle'} onClick={() => updateSettings('vertical_anchor', 'middle')} label="Middle" testid={`hero-v-mid-${section.id}`}>
                <AlignVerticalJustifyCenter size={12} strokeWidth={1.5} />
              </Btn>
              <Btn active={vAnchor === 'bottom'} onClick={() => updateSettings('vertical_anchor', 'bottom')} label="Bottom" testid={`hero-v-bot-${section.id}`}>
                <AlignVerticalJustifyEnd size={12} strokeWidth={1.5} />
              </Btn>
            </div>
          </div>

          {/* Horizontal anchor */}
          <div>
            <p className="text-white/55 text-[9px] uppercase tracking-[0.25em] mb-2">Horizontal position</p>
            <div className="flex gap-1.5">
              <Btn active={hAnchor === 'start'} onClick={() => updateSettings('horizontal_anchor', 'start')} label="Start" testid={`hero-h-start-${section.id}`}>Start</Btn>
              <Btn active={hAnchor === 'center'} onClick={() => updateSettings('horizontal_anchor', 'center')} label="Center" testid={`hero-h-center-${section.id}`}>Center</Btn>
              <Btn active={hAnchor === 'end'} onClick={() => updateSettings('horizontal_anchor', 'end')} label="End" testid={`hero-h-end-${section.id}`}>End</Btn>
            </div>
          </div>

          {/* Veil style */}
          <div>
            <p className="text-white/55 text-[9px] uppercase tracking-[0.25em] mb-2">Veil style</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { k: 'none',            l: 'None' },
                { k: 'soft',            l: 'Soft' },
                { k: 'gradient-bottom', l: 'Bottom' },
                { k: 'gradient-top',    l: 'Top' },
                { k: 'strong',          l: 'Strong' },
              ].map(({ k, l }) => (
                <Btn key={k} active={veilStyle === k} onClick={() => updateSettings('veil_style', k)} label={l} testid={`hero-veil-${k}-${section.id}`}>{l}</Btn>
              ))}
            </div>
          </div>

          {/* Veil opacity */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/55 text-[9px] uppercase tracking-[0.25em]">Veil opacity</p>
              <span className="text-white/85 text-[10px] tabular-nums">{veilOpacity}%</span>
            </div>
            <input
              type="range" min="0" max="100" step="5"
              value={veilOpacity}
              data-testid={`hero-veil-opacity-${section.id}`}
              onChange={(e) => updateSettings('veil_opacity', parseInt(e.target.value, 10))}
              className="w-full accent-[var(--bp-primary)]"
            />
          </div>

          {/* Italic line toggle */}
          <div className="flex items-center justify-between pt-1 border-t border-white/10">
            <p className="text-white/85 text-[10px]">Italic accent line</p>
            <button
              type="button"
              onClick={() => updateSettings('show_italic', !showItalic)}
              data-testid={`hero-italic-toggle-${section.id}`}
              className={`w-9 h-[18px] rounded-full transition-colors relative
                ${showItalic ? 'bg-[var(--bp-primary)]' : 'bg-white/15'}`}
            >
              <span className={`absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full transition-transform
                ${showItalic ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Compute veil className from style + opacity
const veilFor = (style, opacity) => {
  const o = Math.max(0, Math.min(100, opacity)) / 100;
  if (style === 'none') return null;
  if (style === 'soft') return { background: `rgba(0,0,0,${(o * 0.55).toFixed(3)})` };
  if (style === 'strong') return { background: `rgba(0,0,0,${(o * 0.85).toFixed(3)})` };
  if (style === 'gradient-top') {
    return { background: `linear-gradient(to bottom, rgba(0,0,0,${o.toFixed(3)}) 0%, rgba(0,0,0,0) 100%)` };
  }
  // default: gradient-bottom
  return { background: `linear-gradient(to top, rgba(0,0,0,${o.toFixed(3)}) 0%, rgba(0,0,0,0) 100%)` };
};

// ─── STORE_HERO ─────────────────────────────────────────────────────────────
const StoreHero = ({ section, locale, draft, updateContent, updateSettings, openAssetPicker }) => {
  const bgUrl = getSetting(section, 'background_image_url') || getField(section, draft, '_default', 'background_image_url');
  const s = section.settings || {};
  const textAlign = s.text_align || 'center';
  const vAnchor = s.vertical_anchor || 'middle';
  const hAnchor = s.horizontal_anchor || 'center';
  const showItalic = s.show_italic !== false;

  const justifyCls = vAnchor === 'top' ? 'justify-start' : vAnchor === 'bottom' ? 'justify-end' : 'justify-center';
  const itemsCls   = hAnchor === 'start' ? 'items-start' : hAnchor === 'end' ? 'items-end' : 'items-center';
  const textCls    = textAlign === 'left' ? 'text-left' : 'text-center';
  const veilStyle  = veilFor(s.veil_style || 'gradient-bottom', s.veil_opacity != null ? s.veil_opacity : 60);

  return (
    <div className="relative bg-black text-white overflow-hidden" data-testid={`section-${section.id}`}>
      <div className="relative h-[560px]">
        <EditableImage
          url={bgUrl}
          openAssetPicker={openAssetPicker}
          onPick={(a) => { updateSettings('background_image_url', a.public_url); updateContent('_default', 'background_image_url', a.public_url); }}
          aspect="absolute inset-0 h-full"
          testid={`hero-bg-${section.id}`}
          label="Replace hero background"
        />
        {veilStyle && <div className="absolute inset-0 pointer-events-none" style={veilStyle} />}

        <HeroSettingsPopover section={section} updateSettings={updateSettings} />

        <div className={`absolute inset-0 flex flex-col p-10 lg:p-16 pointer-events-none ${justifyCls} ${itemsCls} ${textCls}`}>
          <div className="max-w-3xl pointer-events-auto w-full">
            <InlineText
              value={getField(section, draft, locale, 'overline')}
              onChange={(v) => updateContent(locale, 'overline', v)}
              placeholder="OVERLINE"
              as="p"
              className="text-white/70 text-[10px] font-body uppercase tracking-[0.3em] mb-4"
              testid={`hero-overline-${section.id}`}
            />
            <InlineText
              value={getField(section, draft, locale, 'headline')}
              onChange={(v) => updateContent(locale, 'headline', v)}
              placeholder="Editorial headline"
              multiline
              as="h1"
              className="font-heading text-[clamp(2.25rem,6vw,4rem)] font-light leading-[1.05] mb-4 whitespace-pre-line"
              testid={`hero-headline-${section.id}`}
            />
            <InlineText
              value={getField(section, draft, locale, 'sub')}
              onChange={(v) => updateContent(locale, 'sub', v)}
              placeholder="Sub-headline lead text"
              multiline
              as="p"
              className={`text-white/80 text-[clamp(0.875rem,1.4vw,1rem)] font-body leading-relaxed whitespace-pre-line ${textAlign === 'center' ? 'mx-auto' : ''}`}
              testid={`hero-sub-${section.id}`}
            />
            {showItalic && (
              <InlineText
                value={getField(section, draft, locale, 'overline_italic')}
                onChange={(v) => updateContent(locale, 'overline_italic', v)}
                placeholder="Italic accent line"
                as="p"
                className="font-heading italic text-white/85 text-[clamp(1rem,1.6vw,1.25rem)] mt-5"
                testid={`hero-overline-italic-${section.id}`}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── DUAL_CTA ───────────────────────────────────────────────────────────────
const DualCta = ({ section, locale, draft, updateContent, updateSettings, openAssetPicker }) => {
  const clientImg = getSetting(section, 'client_image_url');
  const proImg = getSetting(section, 'pro_image_url');
  return (
    <div className="bg-[var(--bp-surface-1)] py-16 px-12" data-testid={`section-${section.id}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
        {[
          { side: 'client', img: clientImg, kicker: 'client_kicker', title: 'client_title', body: 'client_body', cta: 'client_cta_label' },
          { side: 'pro',    img: proImg,    kicker: 'pro_kicker',    title: 'pro_title',    body: 'pro_body',    cta: 'pro_cta_label'    },
        ].map(({ side, img, kicker, title, body, cta }) => (
          <div key={side} className="relative aspect-[3/4] overflow-hidden bg-black text-white" data-testid={`dual-${side}-${section.id}`}>
            <EditableImage
              url={img}
              openAssetPicker={openAssetPicker}
              onPick={(a) => updateSettings(`${side}_image_url`, a.public_url)}
              aspect="absolute inset-0 h-full"
              testid={`dual-${side}-image-${section.id}`}
              label={`Replace ${side} image`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
            <div className="absolute inset-0 flex flex-col justify-end p-8 pointer-events-none">
              <div className="pointer-events-auto">
                <InlineText
                  value={getField(section, draft, locale, kicker)}
                  onChange={(v) => updateContent(locale, kicker, v)}
                  placeholder="KICKER" as="p"
                  className="text-white/70 text-[10px] font-body uppercase tracking-[0.25em] mb-3"
                />
                <InlineText
                  value={getField(section, draft, locale, title)}
                  onChange={(v) => updateContent(locale, title, v)}
                  placeholder="Title" as="h3"
                  className="font-heading text-3xl font-light mb-3"
                />
                <InlineText
                  value={getField(section, draft, locale, body)}
                  onChange={(v) => updateContent(locale, body, v)}
                  placeholder="Body copy" multiline as="p"
                  className="text-white/80 text-sm font-body leading-relaxed mb-5 whitespace-pre-line"
                />
                <InlineText
                  value={getField(section, draft, locale, cta)}
                  onChange={(v) => updateContent(locale, cta, v)}
                  placeholder="CTA LABEL" as="span"
                  className="inline-block px-5 py-2.5 border border-white text-white text-[10px] font-body uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-colors"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── VALUE_PROPS ────────────────────────────────────────────────────────────
const ValueProps = ({ section, locale, draft, updateContent, updateSettings }) => {
  const pillars = getSetting(section, 'pillars') || [];

  const writePillars = (next) => updateSettings('pillars', next);
  const patchPillar = (idx, patcher) => writePillars(pillars.map((p, i) => (i === idx ? patcher(p) : p)));
  const setLocalized = (idx, field, value) => patchPillar(idx, (p) => {
    const bag = (p[field] && typeof p[field] === 'object') ? p[field] : {};
    return { ...p, [field]: { ...bag, [locale]: value } };
  });
  const removePillar = (idx) => writePillars(pillars.filter((_, i) => i !== idx));
  const cycleIcon = (idx) => patchPillar(idx, (p) => {
    const keys = PILLAR_ICONS.map((x) => x.key);
    const cur = Math.max(0, keys.indexOf(p.icon || 'gem'));
    return { ...p, icon: keys[(cur + 1) % keys.length] };
  });
  const addPillar = () => {
    const id = `pillar_${Date.now().toString(36)}`;
    writePillars([...pillars, { id, icon: 'gem', title: { [locale]: '' }, body: { [locale]: '' } }]);
  };

  return (
    <div className="bg-[var(--bp-bg)] py-16 px-12" data-testid={`section-${section.id}`}>
      <div className="max-w-6xl mx-auto">
        <InlineText
          value={getField(section, draft, locale, 'section_title')}
          onChange={(v) => updateContent(locale, 'section_title', v)}
          placeholder="SECTION TITLE"
          as="h2"
          className="text-[var(--bp-text-primary)] text-2xl font-body uppercase tracking-[0.18em] text-center mb-10"
          testid={`vp-section-title-${section.id}`}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {pillars.map((p, i) => {
            const Icon = ICON_MAP[p.icon] || Gem;
            return (
              <div
                key={p.id || i}
                className="relative text-center group px-3 py-4 hover:bg-[var(--bp-surface-2)]/40 transition-colors"
                data-testid={`pillar-${p.id || i}`}
              >
                <button
                  type="button"
                  onClick={() => cycleIcon(i)}
                  title="Cycle icon"
                  data-testid={`pillar-${p.id || i}-icon`}
                  className="mx-auto mb-3 flex items-center justify-center w-10 h-10 text-[var(--bp-text-primary)] hover:text-[var(--bp-primary)] transition-colors"
                >
                  <Icon size={26} strokeWidth={1.2} />
                </button>
                <InlineText
                  value={pickLocale(p.title, locale, FALLBACK_CHAIN)}
                  onChange={(v) => setLocalized(i, 'title', v)}
                  placeholder="PILLAR TITLE"
                  as="p"
                  className="font-heading text-base text-[var(--bp-text-primary)] uppercase tracking-[0.1em] mb-2"
                  testid={`pillar-${p.id || i}-title`}
                />
                <InlineText
                  value={pickLocale(p.body, locale, FALLBACK_CHAIN)}
                  onChange={(v) => setLocalized(i, 'body', v)}
                  placeholder="Short description"
                  multiline
                  as="p"
                  className="text-[var(--bp-text-muted)] text-xs font-body leading-relaxed whitespace-pre-line"
                  testid={`pillar-${p.id || i}-body`}
                />
                <button
                  type="button"
                  onClick={() => removePillar(i)}
                  title="Remove pillar"
                  data-testid={`pillar-${p.id || i}-remove`}
                  className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center text-[var(--bp-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} strokeWidth={1.5} />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={addPillar}
            data-testid={`pillar-add-${section.id}`}
            className="flex flex-col items-center justify-center min-h-[140px] border border-dashed border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:text-[var(--bp-primary)] hover:border-[var(--bp-primary)] transition-colors"
          >
            <Plus size={20} strokeWidth={1.4} />
            <span className="text-[10px] font-body uppercase tracking-[0.2em] mt-2">Add pillar</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── PROJECTS_PREVIEW ───────────────────────────────────────────────────────
const ProjectsPreview = ({ section, locale, draft, updateContent, updateSettings, openAssetPicker }) => {
  const items = getSetting(section, 'items') || [];

  const writeItems = (next) => updateSettings('items', next);
  const patchItem = (idx, patcher) => writeItems(items.map((p, i) => (i === idx ? patcher(p) : p)));
  const setLocalized = (idx, field, value) => patchItem(idx, (p) => {
    const bag = (p[field] && typeof p[field] === 'object') ? p[field] : {};
    return { ...p, [field]: { ...bag, [locale]: value } };
  });
  const setSlug = (idx, slug) => patchItem(idx, (p) => ({ ...p, slug }));
  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    writeItems(next);
  };
  const remove = (idx) => writeItems(items.filter((_, i) => i !== idx));
  const addItem = () => {
    const id = `proj_${Date.now().toString(36)}`;
    writeItems([...items, {
      id,
      slug: id,
      image_url: '',
      category: { [locale]: '' },
      location: { [locale]: '' },
    }]);
  };

  return (
    <div className="bg-[var(--bp-surface-1)] py-16 px-12" data-testid={`section-${section.id}`}>
      <div className="max-w-6xl mx-auto">
        <InlineText
          value={getField(section, draft, locale, 'section_title')}
          onChange={(v) => updateContent(locale, 'section_title', v)}
          placeholder="PROJECTS THAT INSPIRE"
          as="h2"
          className="text-[var(--bp-text-primary)] text-2xl font-body uppercase tracking-[0.18em] text-center mb-10"
          testid={`projects-section-title-${section.id}`}
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {items.slice(0, 5).map((it, i) => (
            <div key={it.id || it.slug || i}
                 data-testid={`proj-${it.slug || i}`}
                 className="aspect-[4/5] relative overflow-hidden bg-black group">
              <EditableImage
                url={it.image_url}
                openAssetPicker={openAssetPicker}
                onPick={(a) => patchItem(i, (p) => ({ ...p, image_url: a.public_url }))}
                aspect="absolute inset-0 h-full"
                testid={`proj-${it.slug || i}-img`}
                label="Replace cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />
              <div className="absolute bottom-3 left-3 right-3 z-10 space-y-1">
                <InlineText
                  value={pickLocale(it.category, locale, FALLBACK_CHAIN)}
                  onChange={(v) => setLocalized(i, 'category', v)}
                  placeholder="CATEGORY"
                  as="p"
                  className="text-white/80 text-[10px] font-body uppercase tracking-[0.18em]"
                  testid={`proj-${it.slug || i}-category`}
                />
                <InlineText
                  value={pickLocale(it.location, locale, FALLBACK_CHAIN)}
                  onChange={(v) => setLocalized(i, 'location', v)}
                  placeholder="Location"
                  as="p"
                  className="text-white font-heading text-sm leading-tight"
                  testid={`proj-${it.slug || i}-location`}
                />
              </div>
              {/* Slug editor — tiny inspector top-left */}
              <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <input
                  type="text"
                  value={it.slug || ''}
                  onChange={(e) => setSlug(i, e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 60))}
                  placeholder="slug"
                  data-testid={`proj-${it.slug || i}-slug`}
                  className="w-24 px-2 py-1 bg-black/70 backdrop-blur-md border border-white/15 rounded-[2px] text-white/85 text-[10px] font-mono outline-none focus:border-white/45"
                />
              </div>
              {/* Reorder + remove */}
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={() => move(i, -1)} title="Move left"
                        data-testid={`proj-${it.slug || i}-left`}
                        className="w-6 h-6 flex items-center justify-center rounded-[2px] bg-black/60 border border-white/15 text-white/85 hover:text-white">
                  <ChevronLeft size={12} strokeWidth={1.5} />
                </button>
                <button type="button" onClick={() => move(i, +1)} title="Move right"
                        data-testid={`proj-${it.slug || i}-right`}
                        className="w-6 h-6 flex items-center justify-center rounded-[2px] bg-black/60 border border-white/15 text-white/85 hover:text-white">
                  <ChevronRight size={12} strokeWidth={1.5} />
                </button>
                <button type="button" onClick={() => remove(i)} title="Remove"
                        data-testid={`proj-${it.slug || i}-remove`}
                        className="w-6 h-6 flex items-center justify-center rounded-[2px] bg-black/60 border border-white/15 text-white/85 hover:text-rose-300">
                  <X size={12} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ))}
          {items.length < 5 && (
            <button
              type="button"
              onClick={addItem}
              data-testid={`proj-add-${section.id}`}
              className="aspect-[4/5] flex flex-col items-center justify-center border border-dashed border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:text-[var(--bp-primary)] hover:border-[var(--bp-primary)] transition-colors">
              <Plus size={20} strokeWidth={1.4} />
              <span className="text-[10px] font-body uppercase tracking-[0.2em] mt-2">Add project</span>
            </button>
          )}
        </div>
        {items.length === 0 && (
          <p className="text-[var(--bp-text-muted)] text-xs font-body italic text-center pt-8">
            Add up to 5 curated projects above.
          </p>
        )}
      </div>
    </div>
  );
};

// ─── NEWSLETTER ─────────────────────────────────────────────────────────────
const Newsletter = ({ section, locale, draft, updateContent, updateSettings, openAssetPicker }) => {
  const decor = getSetting(section, 'decor_image_url');
  return (
    <div className="bg-[var(--bp-bg)] py-20 px-12" data-testid={`section-${section.id}`}>
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        <div>
          <InlineText
            value={getField(section, draft, locale, 'title')}
            onChange={(v) => updateContent(locale, 'title', v)}
            placeholder="INSPIRATION & NEWS"
            as="h2"
            className="font-heading text-3xl text-[var(--bp-text-primary)] uppercase tracking-[0.1em] mb-6"
          />
          <InlineText
            value={getField(section, draft, locale, 'body')}
            onChange={(v) => updateContent(locale, 'body', v)}
            placeholder="Sub" multiline as="p"
            className="text-[var(--bp-text-secondary)] text-sm font-body leading-relaxed mb-6 whitespace-pre-line"
          />
          <div className="flex gap-2 max-w-md">
            <span className="flex-1 px-4 py-3 bg-[var(--bp-surface-2)] border border-[var(--bp-border)] text-[var(--bp-text-muted)] text-sm">
              <InlineText
                value={getField(section, draft, locale, 'placeholder')}
                onChange={(v) => updateContent(locale, 'placeholder', v)}
                placeholder="Your email" as="span"
              />
            </span>
            <InlineText
              value={getField(section, draft, locale, 'cta_label')}
              onChange={(v) => updateContent(locale, 'cta_label', v)}
              placeholder="SUBSCRIBE" as="span"
              className="px-6 py-3 bg-[var(--bp-primary)] text-black text-[10px] font-body uppercase tracking-[0.2em] hover:opacity-90 transition-opacity"
            />
          </div>
        </div>
        <EditableImage
          url={decor}
          openAssetPicker={openAssetPicker}
          onPick={(a) => updateSettings('decor_image_url', a.public_url)}
          aspect="aspect-[4/5]"
          testid={`newsletter-decor-${section.id}`}
          label="Replace decor image"
        />
      </div>
    </div>
  );
};

// ─── GENERIC LEGACY FALLBACK ────────────────────────────────────────────────
// For sections that are still stored as raw legacy bags (start_project,
// professionals, navigation, ui), render a schema-driven editor.
const LegacySectionRaw = ({ section, locale, draft, updateContent }) => {
  const bag = draft || section.locale_content || {};
  const localeBag = bag[locale] || {};
  const defaultBag = bag._default || {};
  const fields = Object.keys({ ...defaultBag, ...localeBag })
    .filter((k) => typeof (localeBag[k] ?? defaultBag[k]) !== 'object' || (localeBag[k] ?? defaultBag[k]) === null);
  if (fields.length === 0) {
    return (
      <div className="bg-[var(--bp-surface-1)] p-8 border border-dashed border-[var(--bp-border)]" data-testid={`section-${section.id}`}>
        <p className="text-[var(--bp-text-muted)] text-xs font-body italic">
          Structural section — content will be editable when its dedicated renderer is added.
        </p>
        <p className="text-[var(--bp-text-subtle)] text-[10px] font-body mt-2">
          Section type: <code>{section.section_type}</code>
        </p>
      </div>
    );
  }
  return (
    <div className="bg-[var(--bp-surface-1)] p-8 border border-[var(--bp-border)]" data-testid={`section-${section.id}`}>
      <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.2em] font-semibold mb-4">
        {section.section_type}
      </p>
      <div className="space-y-4">
        {fields.map((f) => (
          <div key={f}>
            <p className="text-[var(--bp-text-muted)] text-[10px] font-body uppercase tracking-[0.15em] mb-1">{f}</p>
            <InlineText
              value={localeBag[f] ?? defaultBag[f] ?? ''}
              onChange={(v) => updateContent(locale, f, v)}
              placeholder={`(empty ${locale})`}
              multiline
              as="p"
              className="text-[var(--bp-text-primary)] text-sm font-body leading-relaxed whitespace-pre-line min-h-[1.5em] hover:bg-[var(--bp-surface-2)] px-2 -mx-2 py-1 transition-colors"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export const RENDERERS = {
  store_hero:        StoreHero,
  dual_cta:          DualCta,
  value_props:       ValueProps,
  projects_preview:  ProjectsPreview,
  newsletter:        Newsletter,
  nav_top:           NavigationRenderer,
  footer_columns:    FooterColumnsRenderer,
};

export const renderSection = (section, props) => {
  const Comp = RENDERERS[section.section_type] || LegacySectionRaw;
  return <Comp section={section} {...props} />;
};
