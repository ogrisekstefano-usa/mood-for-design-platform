/**
 * Experience Studio™ — Specialized band renderers.
 *
 * Hybrid architecture (per user directive 1c):
 *   • TABULAR renderers — list + form compacts for structural data
 *     (nav_top, footer_columns, footer_socials, ordering, CTA maps)
 *   • CINEMATIC renderers — atmospheric editorial UX for experiential bands
 *     (stats_band, brand_logos, magazine_grid, newsletter, dual_cta)
 *
 * Each renderer exposes a unified contract:
 *   ({ section, localeTab, activeLocales, onPatchLocale, onPatchSetting }) =>
 *     JSX with section-aware fields wired to the BandEditor save loop.
 *
 * Traceability: each editor declares its `Controls public experience: ...`
 * label so the user can trace the public surface controlled from here.
 */
import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import EditorialMediaField from '../../components/common/EditorialMediaField';
import { useT } from '../../i18n/useT';

// ───────────────────────────────────────────────────────────────────────
// Traceability metadata — which public surface each section type controls.
// ───────────────────────────────────────────────────────────────────────
export const TRACEABILITY = {
  store_hero: 'Homepage · Hero',
  hero: 'Homepage · Hero',
  value_props: 'Homepage · Value Pillars',
  services: 'Homepage · Value Pillars',
  dual_cta: 'Homepage · Dual CTA cards',
  projects_preview: 'Homepage · Projects Rail (title only, items from Projects Studio)',
  projects: 'Homepage · Projects Rail',
  stats_band: 'Homepage · Stats Band',
  brand_logos: 'Homepage · Brand Logos Strip',
  magazine_grid: 'Homepage · Journal Grid',
  journal_intro: 'Homepage · Journal Grid',
  newsletter: 'Homepage · Newsletter Band',
  proposal_cta: 'Project Detail · Proposal CTA',
  footer_narrative: 'Footer · Editorial closing',
  nav_top: 'Header · Top navigation links',
  main_links: 'Header · Top navigation links',
  navigation_main: 'Header · Top navigation links',
  footer_columns: 'Footer · Columns, socials, showroom block',
  materials: 'Homepage · Materials Vocabulary'
};

// ───────────────────────────────────────────────────────────────────────
// Shared primitives
// ───────────────────────────────────────────────────────────────────────
export const TraceabilityChip = ({
  section_type
}) => {
  const {
    t
  } = useT();
  const surface = TRACEABILITY[section_type];
  if (!surface) return null;
  return <div className="ss-trace" data-testid={`ss-trace-${section_type}`}>
      <span className="ss-trace__dot" aria-hidden />
      <span className="ss-trace__label">Controls public experience:</span>
      <span className="ss-trace__surface">{surface}</span>
    </div>;
};
const TextField = ({
  label,
  value,
  onChange,
  placeholder,
  testid,
  display
}) => <div className="ss-section">
    <p className="ss-section__label">{label}</p>
    <input className={`ss-input${display ? ' ss-input--display' : ''}`} data-testid={testid} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </div>;
const AreaField = ({
  label,
  value,
  onChange,
  rows = 3,
  testid
}) => <div className="ss-section">
    <p className="ss-section__label">{label}</p>
    <textarea className="ss-textarea" data-testid={testid} rows={rows} value={value || ''} onChange={e => onChange(e.target.value)} />
  </div>;

// ───────────────────────────────────────────────────────────────────────
// 1 · TABULAR — nav_top (Header navigation)
// ───────────────────────────────────────────────────────────────────────
export const NavTopEditor = ({
  section,
  localeTab,
  onPatchSetting
}) => {
  const items = Array.isArray(section.settings?.links) ? section.settings.links : [];
  const update = next => onPatchSetting('links', next);
  const addLink = () => update([...items, {
    id: `link-${Date.now().toString(36)}`,
    href: '/',
    label_i18n: {
      [localeTab]: 'Nuova voce'
    },
    visible: true
  }]);
  const removeLink = idx => update(items.filter((_, i) => i !== idx));
  const moveLink = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const copy = [...items];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    update(copy);
  };
  const patchField = (idx, field, value) => {
    const copy = [...items];
    copy[idx] = {
      ...copy[idx],
      [field]: value
    };
    update(copy);
  };
  const patchLabel = (idx, locale, value) => {
    const copy = [...items];
    copy[idx] = {
      ...copy[idx],
      label_i18n: {
        ...(copy[idx].label_i18n || {}),
        [locale]: value
      }
    };
    update(copy);
  };
  return <div className="ss-table" data-testid="ss-nav-top-editor">
      <div className="ss-table__head">
        <span style={{
        flex: '0 0 28px'
      }}>#</span>
        <span style={{
        flex: '0 0 130px'
      }}>ID</span>
        <span style={{
        flex: 1
      }}>Label ({localeTab})</span>
        <span style={{
        flex: '0 0 180px'
      }}>Destination</span>
        <span style={{
        flex: '0 0 70px'
      }}>Visible</span>
        <span style={{
        flex: '0 0 90px'
      }} />
      </div>
      {items.length === 0 && <p className="ss-table__empty">{t('storefront.band_editors.nessuna_voce_di_menu_aggiungi_la_prima')}</p>}
      {items.map((it, idx) => <div className="ss-table__row" key={it.id || idx} data-testid={`ss-nav-row-${idx}`}>
          <span className="ss-table__order" style={{
        flex: '0 0 28px'
      }}>{String(idx + 1).padStart(2, '0')}</span>
          <input className="ss-input ss-input--sm" style={{
        flex: '0 0 130px'
      }} data-testid={`ss-nav-id-${idx}`} value={it.id || ''} onChange={e => patchField(idx, 'id', e.target.value)} placeholder="slug-id" />
          <input className="ss-input ss-input--sm" style={{
        flex: 1
      }} data-testid={`ss-nav-label-${idx}`} value={(it.label_i18n || {})[localeTab] || ''} onChange={e => patchLabel(idx, localeTab, e.target.value)} placeholder="Etichetta visibile" />
          <input className="ss-input ss-input--sm" style={{
        flex: '0 0 180px'
      }} data-testid={`ss-nav-href-${idx}`} value={it.href || ''} onChange={e => patchField(idx, 'href', e.target.value)} placeholder="/projects" />
          <button type="button" className="ss-chip ss-chip--inline" style={{
        flex: '0 0 70px'
      }} data-active={it.visible !== false} data-testid={`ss-nav-visible-${idx}`} onClick={() => patchField(idx, 'visible', it.visible === false)}>
            {it.visible !== false ? 'On' : 'Off'}
          </button>
          <div className="ss-table__actions" style={{
        flex: '0 0 90px'
      }}>
            <button type="button" className="ss-icon-btn" onClick={() => moveLink(idx, -1)} title="Up" data-testid={`ss-nav-up-${idx}`}><ArrowUp size={12} /></button>
            <button type="button" className="ss-icon-btn" onClick={() => moveLink(idx, +1)} title="Down" data-testid={`ss-nav-down-${idx}`}><ArrowDown size={12} /></button>
            <button type="button" className="ss-icon-btn ss-icon-btn--danger" onClick={() => removeLink(idx)} title="Delete" data-testid={`ss-nav-del-${idx}`}><Trash2 size={12} /></button>
          </div>
        </div>)}
      <button type="button" className="ss-btn ss-btn--ghost" onClick={addLink} data-testid="ss-nav-add">
        <Plus size={12} /> {t("storefront.band_editors.aggiungi_voce_di_menu")}
      </button>
    </div>;
};

// ───────────────────────────────────────────────────────────────────────
// 2 · TABULAR — footer_columns (Footer columns + socials + showroom)
// ───────────────────────────────────────────────────────────────────────
export const FooterColumnsEditor = ({
  section,
  localeTab,
  onPatchSetting
}) => {
  const settings = section.settings || {};
  const columns = Array.isArray(settings.columns) ? settings.columns : [];
  const socials = Array.isArray(settings.socials) ? settings.socials : [];
  const updateCols = next => onPatchSetting('columns', next);
  const updateSocials = next => onPatchSetting('socials', next);
  const addColumn = () => updateCols([...columns, {
    id: `col-${Date.now().toString(36)}`,
    title: {
      [localeTab]: 'Nuova colonna'
    },
    links: [],
    visible: true
  }]);
  const removeColumn = idx => updateCols(columns.filter((_, i) => i !== idx));
  const moveColumn = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= columns.length) return;
    const c = [...columns];
    [c[idx], c[j]] = [c[j], c[idx]];
    updateCols(c);
  };
  const patchCol = (idx, field, value) => {
    const c = [...columns];
    c[idx] = {
      ...c[idx],
      [field]: value
    };
    updateCols(c);
  };
  const patchColTitle = (idx, value) => {
    const c = [...columns];
    c[idx] = {
      ...c[idx],
      title: {
        ...(c[idx].title || {}),
        [localeTab]: value
      }
    };
    updateCols(c);
  };
  const addLink = colIdx => {
    const c = [...columns];
    c[colIdx] = {
      ...c[colIdx],
      links: [...(c[colIdx].links || []), {
        href: '/',
        label: {
          [localeTab]: 'Nuovo link'
        },
        visible: true
      }]
    };
    updateCols(c);
  };
  const patchLink = (colIdx, linkIdx, field, value) => {
    const c = [...columns];
    const links = [...(c[colIdx].links || [])];
    links[linkIdx] = {
      ...links[linkIdx],
      [field]: value
    };
    c[colIdx] = {
      ...c[colIdx],
      links
    };
    updateCols(c);
  };
  const patchLinkLabel = (colIdx, linkIdx, value) => {
    const c = [...columns];
    const links = [...(c[colIdx].links || [])];
    links[linkIdx] = {
      ...links[linkIdx],
      label: {
        ...(links[linkIdx].label || {}),
        [localeTab]: value
      }
    };
    c[colIdx] = {
      ...c[colIdx],
      links
    };
    updateCols(c);
  };
  const removeLink = (colIdx, linkIdx) => {
    const c = [...columns];
    c[colIdx] = {
      ...c[colIdx],
      links: (c[colIdx].links || []).filter((_, i) => i !== linkIdx)
    };
    updateCols(c);
  };
  const addSocial = () => updateSocials([...socials, {
    id: 'instagram',
    href: 'https://instagram.com/'
  }]);
  const patchSocial = (idx, field, value) => {
    const s = [...socials];
    s[idx] = {
      ...s[idx],
      [field]: value
    };
    updateSocials(s);
  };
  const removeSocial = idx => updateSocials(socials.filter((_, i) => i !== idx));
  return <div className="ss-table" data-testid="ss-footer-cols-editor">
      <div className="ss-subhead">Footer columns ({columns.length})</div>
      {columns.length === 0 && <p className="ss-table__empty">{t('storefront.band_editors.nessuna_colonna_aggiungi_la_prima')}</p>}
      {columns.map((col, idx) => <div className="ss-footer-col-card" key={col.id || idx} data-testid={`ss-footer-col-${idx}`}>
          <div className="ss-footer-col-card__head">
            <input className="ss-input ss-input--sm" style={{
          flex: '0 0 120px'
        }} value={col.id || ''} onChange={e => patchCol(idx, 'id', e.target.value)} placeholder="col-id" />
            <input className="ss-input ss-input--display ss-input--sm" style={{
          flex: 1
        }} value={(col.title || {})[localeTab] || ''} onChange={e => patchColTitle(idx, e.target.value)} placeholder={`Titolo colonna (${localeTab})`} />
            <button type="button" className="ss-chip ss-chip--inline" data-active={col.visible !== false} onClick={() => patchCol(idx, 'visible', col.visible === false)}>
              {col.visible !== false ? 'On' : 'Off'}
            </button>
            <button type="button" className="ss-icon-btn" onClick={() => moveColumn(idx, -1)}><ArrowUp size={12} /></button>
            <button type="button" className="ss-icon-btn" onClick={() => moveColumn(idx, +1)}><ArrowDown size={12} /></button>
            <button type="button" className="ss-icon-btn ss-icon-btn--danger" onClick={() => removeColumn(idx)}><Trash2 size={12} /></button>
          </div>
          <div className="ss-footer-col-card__links">
            {(col.links || []).map((lk, j) => <div className="ss-table__row ss-table__row--inset" key={j}>
                <input className="ss-input ss-input--sm" style={{
            flex: 1
          }} value={(lk.label || {})[localeTab] || ''} onChange={e => patchLinkLabel(idx, j, e.target.value)} placeholder="Label" />
                <input className="ss-input ss-input--sm" style={{
            flex: '0 0 200px'
          }} value={lk.href || ''} onChange={e => patchLink(idx, j, 'href', e.target.value)} placeholder="/path or #anchor" />
                <button type="button" className="ss-icon-btn ss-icon-btn--danger" onClick={() => removeLink(idx, j)}><Trash2 size={11} /></button>
              </div>)}
            <button type="button" className="ss-btn ss-btn--ghost ss-btn--sm" onClick={() => addLink(idx)}>
              <Plus size={11} /> {t("storefront.band_editors.aggiungi_link")}
            </button>
          </div>
        </div>)}
      <button type="button" className="ss-btn ss-btn--ghost" onClick={addColumn} data-testid="ss-footer-col-add">
        <Plus size={12} /> {t("storefront.band_editors.aggiungi_colonna")}
      </button>

      <div className="ss-subhead" style={{
      marginTop: 32
    }}>Socials</div>
      {socials.map((s, idx) => <div className="ss-table__row" key={idx}>
          <select className="ss-select ss-input--sm" style={{
        flex: '0 0 140px'
      }} value={s.id || 'instagram'} onChange={e => patchSocial(idx, 'id', e.target.value)}>
            <option value="instagram">Instagram</option>
            <option value="linkedin">LinkedIn</option>
            <option value="pinterest">Pinterest</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube">YouTube</option>
            <option value="facebook">Facebook</option>
          </select>
          <input className="ss-input ss-input--sm" style={{
        flex: 1
      }} value={s.href || ''} onChange={e => patchSocial(idx, 'href', e.target.value)} placeholder="https://..." />
          <button type="button" className="ss-icon-btn ss-icon-btn--danger" onClick={() => removeSocial(idx)}><Trash2 size={12} /></button>
        </div>)}
      <button type="button" className="ss-btn ss-btn--ghost ss-btn--sm" onClick={addSocial} data-testid="ss-social-add">
        <Plus size={11} /> {t("storefront.band_editors.aggiungi_social")}
      </button>
    </div>;
};

// ───────────────────────────────────────────────────────────────────────
// 3 · CINEMATIC — stats_band (KPI cinematic strip)
// ───────────────────────────────────────────────────────────────────────
export const StatsBandEditor = ({
  section,
  localeTab,
  onPatchLocale,
  onPatchSetting
}) => {
  const localeData = (section.locale_content || {})[localeTab] || {};
  const items = Array.isArray(section.settings?.stats) ? section.settings.stats : [];
  const updateStats = next => onPatchSetting('stats', next);
  const addStat = () => updateStats([...items, {
    value: '100+',
    label_i18n: {
      [localeTab]: 'Nuovo KPI'
    }
  }]);
  const patchStat = (idx, field, value) => {
    const c = [...items];
    c[idx] = {
      ...c[idx],
      [field]: value
    };
    updateStats(c);
  };
  const patchLabel = (idx, value) => {
    const c = [...items];
    c[idx] = {
      ...c[idx],
      label_i18n: {
        ...(c[idx].label_i18n || {}),
        [localeTab]: value
      }
    };
    updateStats(c);
  };
  const removeStat = idx => updateStats(items.filter((_, i) => i !== idx));
  return <>
      <TextField label={t("storefront.band_editors.eyebrow_editoriale")} value={localeData.eyebrow} testid="ss-field-eyebrow" onChange={v => onPatchLocale('eyebrow', v)} placeholder="Sopra-titolo" />
      <TextField label="Title cinematico" value={localeData.title} testid="ss-field-title" display onChange={v => onPatchLocale('title', v)} placeholder="L'esperienza in numeri" />
      <AreaField label="Body" value={localeData.body} testid="ss-field-body" rows={2} onChange={v => onPatchLocale('body', v)} />

      <div className="ss-section">
        <p className="ss-section__label">KPI Items ({items.length})</p>
        {items.map((it, idx) => <div className="ss-table__row" key={idx}>
            <input className="ss-input ss-input--sm ss-input--display" style={{
          flex: '0 0 140px'
        }} data-testid={`ss-stat-value-${idx}`} value={it.value || ''} onChange={e => patchStat(idx, 'value', e.target.value)} placeholder="100+" />
            <input className="ss-input ss-input--sm" style={{
          flex: 1
        }} data-testid={`ss-stat-label-${idx}`} value={(it.label_i18n || {})[localeTab] || ''} onChange={e => patchLabel(idx, e.target.value)} placeholder={`Etichetta (${localeTab})`} />
            <button type="button" className="ss-icon-btn ss-icon-btn--danger" onClick={() => removeStat(idx)}><Trash2 size={12} /></button>
          </div>)}
        <button type="button" className="ss-btn ss-btn--ghost ss-btn--sm" onClick={addStat} data-testid="ss-stat-add">
          <Plus size={11} /> {t("storefront.band_editors.aggiungi_kpi")}
        </button>
      </div>
    </>;
};

// ───────────────────────────────────────────────────────────────────────
// 4 · CINEMATIC — brand_logos (Trusted Logos strip)
// ───────────────────────────────────────────────────────────────────────
export const BrandLogosEditor = ({
  section,
  localeTab,
  onPatchLocale,
  onPatchSetting
}) => {
  const localeData = (section.locale_content || {})[localeTab] || {};
  const items = Array.isArray(section.settings?.logos) ? section.settings.logos : [];
  const updateLogos = next => onPatchSetting('logos', next);
  const addLogo = () => updateLogos([...items, {
    name: 'Brand',
    logo_url: '',
    href: ''
  }]);
  const patch = (idx, field, value) => {
    const c = [...items];
    c[idx] = {
      ...c[idx],
      [field]: value
    };
    updateLogos(c);
  };
  const remove = idx => updateLogos(items.filter((_, i) => i !== idx));
  return <>
      <TextField label="Eyebrow" value={localeData.eyebrow} testid="ss-field-eyebrow" onChange={v => onPatchLocale('eyebrow', v)} placeholder="Trusted by" />
      <TextField label="Title" value={localeData.title} testid="ss-field-title" display onChange={v => onPatchLocale('title', v)} placeholder={t("storefront.band_editors.le_case_che_ci_scelgono")} />

      <div className="ss-section">
        <p className="ss-section__label">Logos ({items.length})</p>
        {items.map((it, idx) => <div className="ss-logo-row ss-logo-row--field" key={idx} style={{
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 10
      }}>
            <div className="ss-logo-row__fields" style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr auto',
          gap: 8
        }}>
              <input className="ss-input ss-input--sm" data-testid={`ss-logo-name-${idx}`} value={it.name || ''} onChange={e => patch(idx, 'name', e.target.value)} placeholder="Nome brand" />
              <input className="ss-input ss-input--sm" value={it.href || ''} onChange={e => patch(idx, 'href', e.target.value)} placeholder="https://brand.com (opzionale)" />
              <button type="button" className="ss-icon-btn ss-icon-btn--danger" onClick={() => remove(idx)}><Trash2 size={12} /></button>
            </div>
            <EditorialMediaField value={it.logo_url || ''} onChange={v => patch(idx, 'logo_url', v)} preset="logo" label={`Logo ${idx + 1}${it.name ? ` · ${it.name}` : ''}`} bucket="tenant-assets" folder="storefront/brand-logos" entityType="cms_section" entityId={section.id} role={`brand_logo_${idx}`} testId={`ss-logo-media-${idx}`} />
          </div>)}
        <button type="button" className="ss-btn ss-btn--ghost ss-btn--sm" onClick={addLogo} data-testid="ss-logo-add">
          <Plus size={11} /> {t("storefront.band_editors.aggiungi_logo")}
        </button>
      </div>
    </>;
};

// ───────────────────────────────────────────────────────────────────────
// 5 · CINEMATIC — magazine_grid (Journal grid)
// ───────────────────────────────────────────────────────────────────────
export const MagazineGridEditor = ({
  section,
  localeTab,
  onPatchLocale,
  onPatchSetting
}) => {
  const localeData = (section.locale_content || {})[localeTab] || {};
  const limit = section.settings?.limit ?? 3;
  const mode = section.settings?.mode || 'auto'; // auto | manual

  return <>
      <TextField label="Eyebrow" value={localeData.eyebrow} testid="ss-field-eyebrow" onChange={v => onPatchLocale('eyebrow', v)} placeholder="Journal" />
      <TextField label="Title cinematico" value={localeData.title} testid="ss-field-title" display onChange={v => onPatchLocale('title', v)} placeholder="Stories from the studio" />
      <AreaField label="Intro body" value={localeData.body} testid="ss-field-body" rows={2} onChange={v => onPatchLocale('body', v)} />

      <div className="ss-section">
        <p className="ss-section__label">Strategia di selezione</p>
        <select className="ss-select" data-testid="ss-mag-mode" value={mode} onChange={e => onPatchSetting('mode', e.target.value)}>
          <option value="auto">{t('storefront.band_editors.automatica_ultimi_articoli_pubblicati_nel_locale')}</option>
          <option value="manual">Manuale · seleziona slug specifici</option>
        </select>
      </div>

      <div className="ss-section">
        <p className="ss-section__label">Numero di articoli</p>
        <input className="ss-input" type="number" min={1} max={12} data-testid="ss-mag-limit" value={limit} onChange={e => onPatchSetting('limit', parseInt(e.target.value || '3', 10))} />
      </div>

      {mode === 'manual' && <div className="ss-section">
          <p className="ss-section__label">Slug articoli (uno per riga)</p>
          <textarea className="ss-textarea" rows={4} data-testid="ss-mag-slugs" value={(section.settings?.slugs || []).join('\n')} onChange={e => onPatchSetting('slugs', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))} />
        </div>}

      <TextField label="CTA · label" value={localeData.cta_label} testid="ss-field-cta-label" onChange={v => onPatchLocale('cta_label', v)} placeholder={t("storefront.band_editors.leggi_tutti_gli_articoli")} />
      <TextField label="CTA · destination" value={localeData.cta_href} testid="ss-field-cta-href" onChange={v => onPatchLocale('cta_href', v)} placeholder="/magazine" />
    </>;
};

// ───────────────────────────────────────────────────────────────────────
// 6 · CINEMATIC — newsletter
// ───────────────────────────────────────────────────────────────────────
export const NewsletterEditor = ({
  section,
  localeTab,
  onPatchLocale
}) => {
  const localeData = (section.locale_content || {})[localeTab] || {};
  return <>
      <TextField label="Title" value={localeData.title} testid="ss-field-title" display onChange={v => onPatchLocale('title', v)} placeholder="Ispirazione e novità" />
      <AreaField label={t("storefront.band_editors.body_editoriale")} value={localeData.body} testid="ss-field-body" rows={2} onChange={v => onPatchLocale('body', v)} />
      <TextField label="Placeholder input" value={localeData.placeholder} testid="ss-field-placeholder" onChange={v => onPatchLocale('placeholder', v)} placeholder={t("storefront.band_editors.la_tua_email")} />
      <TextField label="CTA label" value={localeData.cta} testid="ss-field-cta-label" onChange={v => onPatchLocale('cta', v)} placeholder="Iscriviti" />
      <TextField label="Success message" value={localeData.success} testid="ss-field-success" onChange={v => onPatchLocale('success', v)} placeholder="Grazie per esserti iscritto." />
    </>;
};

// ───────────────────────────────────────────────────────────────────────
// 7 · CINEMATIC — dual_cta (Private + Professional cards)
// ───────────────────────────────────────────────────────────────────────
export const DualCtaEditor = ({
  section,
  localeTab,
  onPatchLocale
}) => {
  const localeData = (section.locale_content || {})[localeTab] || {};
  const card = (kind, label) => <div className="ss-dual-card-block" data-testid={`ss-dualcta-${kind}`}>
      <p className="ss-subhead">{label}</p>
      <TextField label="Eyebrow" value={localeData[`${kind}_eyebrow`]} onChange={v => onPatchLocale(`${kind}_eyebrow`, v)} testid={`ss-dual-${kind}-eyebrow`} placeholder={kind === 'private' ? 'Sei un privato?' : 'Sei un professionista?'} />
      <TextField label="Title" value={localeData[`${kind}_title`]} display onChange={v => onPatchLocale(`${kind}_title`, v)} testid={`ss-dual-${kind}-title`} placeholder={kind === 'private' ? 'Inizia il tuo progetto' : 'Collabora con noi'} />
      <AreaField label="Body" value={localeData[`${kind}_body`]} rows={3} onChange={v => onPatchLocale(`${kind}_body`, v)} testid={`ss-dual-${kind}-body`} />
      <TextField label="CTA label" value={localeData[`${kind}_cta`]} onChange={v => onPatchLocale(`${kind}_cta`, v)} testid={`ss-dual-${kind}-cta`} />
      <TextField label="CTA destination" value={localeData[`${kind}_href`]} onChange={v => onPatchLocale(`${kind}_href`, v)} testid={`ss-dual-${kind}-href`} placeholder={kind === 'private' ? '/start-project/private' : '/start-project/professional'} />
      <EditorialMediaField value={localeData[`${kind}_image`] || ''} onChange={v => onPatchLocale(`${kind}_image`, v)} preset="hero" label="Immagine card" bucket="tenant-assets" folder={`storefront/dual-cta/${kind}`} entityType="cms_section" entityId={section.id} role={`dual_cta_${kind}_image`} testId={`ss-dual-${kind}-image-field`} />
    </div>;
  return <>
      {card('private', 'Card · Cliente privato')}
      <div style={{
      height: 18
    }} />
      {card('professional', 'Card · Professionista')}
    </>;
};

// ───────────────────────────────────────────────────────────────────────
// Dispatcher
// ───────────────────────────────────────────────────────────────────────
export const renderBandEditor = props => {
  const {
    section
  } = props;
  const NAV_TYPES = new Set(['nav_top', 'main_links', 'navigation_main']);
  if (NAV_TYPES.has(section.section_type)) return <NavTopEditor {...props} />;
  switch (section.section_type) {
    case 'footer_columns':
      return <FooterColumnsEditor {...props} />;
    case 'stats_band':
      return <StatsBandEditor {...props} />;
    case 'brand_logos':
      return <BrandLogosEditor {...props} />;
    case 'magazine_grid':
    case 'journal_intro':
      return <MagazineGridEditor {...props} />;
    case 'newsletter':
      return <NewsletterEditor {...props} />;
    case 'dual_cta':
      return <DualCtaEditor {...props} />;
    default:
      return null;
    // fallback to generic cinematic editor
  }
};