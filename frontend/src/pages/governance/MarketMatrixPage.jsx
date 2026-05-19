/**
 * Market Matrix™ — Humanized Market Intelligence Board
 * ────────────────────────────────────────────────────────────────────
 * Display-first surface: each market is a card with editorial keywords
 * (chips) and an expandable Market Insights drawer (tone · visual
 * style · CTA behavior · client expectations · imagery · headlines ·
 * cultural pitfalls).
 *
 * Content is humanized in 6 locales (it-IT · en-US · en-GB · es-ES ·
 * fr-FR · de-DE) stored in `markets.market_intelligence` JSONB.
 *
 * Mood: Financial Times × AD × Monocle × Wallpaper.
 * NEVER raw AI/internal jargon (no "serif-led", "magazine-led", etc).
 */
import './market-matrix.css';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Globe2, MapPin, Sparkles, Lightbulb, Camera, Type, AlertTriangle,
  Megaphone, Heart, ChevronRight, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBlueprint } from '../../contexts/BlueprintContext';
import api from '../../lib/api';

const REGION_LABEL = {
  europe:         { 'it-IT': 'Europa',          'en-US': 'Europe',         'en-GB': 'Europe',         'es-ES': 'Europa',         'fr-FR': 'Europe',          'de-DE': 'Europa' },
  north_america:  { 'it-IT': 'Nord America',    'en-US': 'North America',  'en-GB': 'North America',  'es-ES': 'Norteamérica',   'fr-FR': 'Amérique du Nord', 'de-DE': 'Nordamerika' },
  latam:          { 'it-IT': 'America Latina',  'en-US': 'Latin America',  'en-GB': 'Latin America',  'es-ES': 'Latinoamérica',  'fr-FR': 'Amérique latine',  'de-DE': 'Lateinamerika' },
  mena:           { 'it-IT': 'Medio Oriente',   'en-US': 'Middle East',    'en-GB': 'Middle East',    'es-ES': 'Oriente Medio',  'fr-FR': 'Moyen-Orient',     'de-DE': 'Naher Osten' },
  asia_pacific:   { 'it-IT': 'Asia Pacifico',   'en-US': 'Asia Pacific',   'en-GB': 'Asia Pacific',   'es-ES': 'Asia Pacífico',  'fr-FR': 'Asie Pacifique',   'de-DE': 'Asien-Pazifik' },
  africa:         { 'it-IT': 'Africa',          'en-US': 'Africa',         'en-GB': 'Africa',         'es-ES': 'África',         'fr-FR': 'Afrique',          'de-DE': 'Afrika' },
};

const REGION_ORDER = ['europe', 'north_america', 'mena', 'latam', 'asia_pacific', 'africa'];

const INSIGHT_FIELDS = [
  { key: 'tone',                icon: Megaphone,      labels: { 'it-IT': 'Tono editoriale',         'en-US': 'Editorial tone',        'en-GB': 'Editorial tone',        'es-ES': 'Tono editorial',         'fr-FR': 'Ton éditorial',          'de-DE': 'Editorialer Ton' } },
  { key: 'visual_style',        icon: Camera,         labels: { 'it-IT': 'Stile visuale',           'en-US': 'Visual style',          'en-GB': 'Visual style',          'es-ES': 'Estilo visual',          'fr-FR': 'Style visuel',           'de-DE': 'Visueller Stil' } },
  { key: 'cta_behavior',        icon: Sparkles,       labels: { 'it-IT': 'Comportamento CTA',       'en-US': 'CTA behavior',          'en-GB': 'CTA behaviour',         'es-ES': 'Comportamiento CTA',     'fr-FR': 'Comportement CTA',       'de-DE': 'CTA-Verhalten' } },
  { key: 'client_expectations', icon: Heart,          labels: { 'it-IT': 'Aspettative del cliente', 'en-US': 'Client expectations',   'en-GB': 'Client expectations',   'es-ES': 'Expectativas del cliente','fr-FR': 'Attentes du client',     'de-DE': 'Kundenerwartungen' } },
  { key: 'imagery',             icon: Camera,         labels: { 'it-IT': 'Tipo di immagini',        'en-US': 'Imagery that works',    'en-GB': 'Imagery that works',    'es-ES': 'Imágenes que funcionan', 'fr-FR': 'Imagerie qui fonctionne','de-DE': 'Funktionierende Bildwelt' } },
  { key: 'headlines',           icon: Type,           labels: { 'it-IT': 'Headline efficaci',       'en-US': 'Effective headlines',   'en-GB': 'Effective headlines',   'es-ES': 'Titulares efectivos',    'fr-FR': 'Titres efficaces',       'de-DE': 'Wirksame Headlines' } },
  { key: 'pitfalls',            icon: AlertTriangle,  labels: { 'it-IT': 'Errori da evitare',       'en-US': 'Pitfalls to avoid',     'en-GB': 'Pitfalls to avoid',     'es-ES': 'Errores a evitar',       'fr-FR': 'Erreurs à éviter',       'de-DE': 'Zu vermeidende Fehler' } },
];

const I18N = {
  eyebrow:      { 'it-IT': 'Language Governance™ · Intelligence',        'en-US': 'Language Governance™ · Intelligence',          'en-GB': 'Language Governance™ · Intelligence',          'es-ES': 'Language Governance™ · Intelligence',                  'fr-FR': 'Language Governance™ · Intelligence',                    'de-DE': 'Language Governance™ · Intelligence' },
  title:        { 'it-IT': 'Market Matrix™',                              'en-US': 'Market Matrix™',                                'en-GB': 'Market Matrix™',                                'es-ES': 'Market Matrix™',                                       'fr-FR': 'Market Matrix™',                                          'de-DE': 'Market Matrix™' },
  lead:         {
    'it-IT': 'Ogni mercato parla con un tono, immagina con uno stile e legge con aspettative culturali precise. Questa è la mappa strategica con cui MOOD si adatta a ogni territorio — leggibile in italiano, ma riferita ai codici culturali di ciascun pubblico target.',
    'en-US': 'Every market speaks in a tone, imagines in a style, and reads with specific cultural expectations. This is the strategic map MOOD uses to adapt to each territory.',
    'en-GB': 'Every market speaks in a tone, imagines in a style, and reads with specific cultural expectations. This is the strategic map MOOD uses to adapt to each territory.',
    'es-ES': 'Cada mercado habla con un tono, imagina con un estilo y lee con expectativas culturales precisas. Este es el mapa estratégico con el que MOOD se adapta a cada territorio.',
    'fr-FR': 'Chaque marché parle avec un ton, imagine avec un style, et lit avec des attentes culturelles précises. Voici la carte stratégique avec laquelle MOOD s\'adapte à chaque territoire.',
    'de-DE': 'Jeder Markt spricht in einem Ton, denkt in einem Stil und liest mit spezifischen kulturellen Erwartungen. Dies ist die strategische Karte, mit der MOOD sich an jedes Territorium anpasst.',
  },
  hint_locale:  { 'it-IT': 'Vista nella tua lingua Blueprint',            'en-US': 'Shown in your Blueprint language',              'en-GB': 'Shown in your Blueprint language',              'es-ES': 'Mostrado en tu idioma Blueprint',                      'fr-FR': 'Affiché dans votre langue Blueprint',                     'de-DE': 'In Ihrer Blueprint-Sprache angezeigt' },
  view_insights:{ 'it-IT': 'Apri Market Insights',                        'en-US': 'Open Market Insights',                          'en-GB': 'Open Market Insights',                          'es-ES': 'Abrir Market Insights',                                 'fr-FR': 'Ouvrir Market Insights',                                  'de-DE': 'Market Insights öffnen' },
  loading:      { 'it-IT': 'Caricamento mercati…',                        'en-US': 'Loading markets…',                              'en-GB': 'Loading markets…',                              'es-ES': 'Cargando mercados…',                                    'fr-FR': 'Chargement des marchés…',                                 'de-DE': 'Märkte werden geladen…' },
  no_data:      { 'it-IT': 'Questo mercato non ha ancora una scheda di intelligence completa.', 'en-US': 'This market does not yet have a full intelligence brief.', 'en-GB': 'This market does not yet have a full intelligence brief.', 'es-ES': 'Este mercado aún no tiene una ficha de inteligencia completa.', 'fr-FR': 'Ce marché n\'a pas encore de fiche d\'intelligence complète.', 'de-DE': 'Dieser Markt verfügt noch nicht über ein vollständiges Intelligence-Briefing.' },
  drawer_intro: { 'it-IT': 'Una guida sintetica al modo in cui questo mercato pensa, comunica e compra design.', 'en-US': 'A short guide to how this market thinks, communicates and buys design.', 'en-GB': 'A short guide to how this market thinks, communicates and buys design.', 'es-ES': 'Una guía sintética sobre cómo este mercado piensa, comunica y compra diseño.', 'fr-FR': 'Un guide synthétique de la façon dont ce marché pense, communique et achète du design.', 'de-DE': 'Ein kurzer Leitfaden, wie dieser Markt denkt, kommuniziert und Design einkauft.' },
};

const tr = (dict, locale) => dict?.[locale] || dict?.['en-US'] || dict?.['it-IT'] || '';

const MarketMatrixPage = () => {
  const { locale: bpLocale } = useBlueprint();
  // Normalize to supported palette of 6 locales
  const SUPPORTED = ['it-IT', 'en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE'];
  const locale = SUPPORTED.includes(bpLocale) ? bpLocale
    : SUPPORTED.find((l) => l.split('-')[0] === (bpLocale || '').split('-')[0]) || 'en-US';

  const [markets, setMarkets] = useState([]);
  const [submarketsByMacro, setSubmarketsByMacro] = useState({});
  const [loading, setLoading] = useState(true);
  const [openMarket, setOpenMarket] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [mr, sr] = await Promise.all([
        api.get('/api/markets'),
        api.get('/api/market-intelligence/submarkets'),
      ]);
      const list = mr.data?.markets || mr.data || [];
      setMarkets(Array.isArray(list) ? list : []);
      const sm = sr.data?.submarkets || [];
      const groupedSm = {};
      sm.forEach((s) => {
        const macro = s.macro_market_code || 'unknown';
        (groupedSm[macro] = groupedSm[macro] || []).push(s);
      });
      setSubmarketsByMacro(groupedSm);
    } catch {
      toast.error(tr(I18N.loading, locale));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const map = {};
    [...markets]
      .filter((m) => m.active !== false)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || (a.code || '').localeCompare(b.code || ''))
      .forEach((m) => {
        const region = m.macro_region || 'unknown';
        (map[region] = map[region] || []).push(m);
      });
    return map;
  }, [markets]);

  const orderedRegions = useMemo(() => {
    const known = REGION_ORDER.filter((r) => grouped[r]);
    const extra = Object.keys(grouped).filter((r) => !REGION_ORDER.includes(r));
    return [...known, ...extra];
  }, [grouped]);

  return (
    <div className="mxm-page" data-testid="market-matrix-page" data-surface="os">
      <header className="mxm-hero">
        <p className="mxm-hero__eyebrow">{tr(I18N.eyebrow, locale)}</p>
        <h1 className="mxm-hero__title">{tr(I18N.title, locale)}</h1>
        <p className="mxm-hero__lead">{tr(I18N.lead, locale)}</p>
        <p className="mxm-hero__locale-hint">
          <Globe2 size={11} strokeWidth={1.5} /> {tr(I18N.hint_locale, locale)} · <strong>{locale}</strong>
        </p>
      </header>

      {loading ? (
        <p className="mxm-loading">{tr(I18N.loading, locale)}</p>
      ) : (
        <div className="mxm-board">
          {orderedRegions.map((region) => (
            <section key={region} className="mxm-region" data-testid={`mxm-region-${region}`}>
              <header className="mxm-region__head">
                <MapPin size={12} strokeWidth={1.5} />
                <h2 className="mxm-region__title">{REGION_LABEL[region]?.[locale] || region}</h2>
                <span className="mxm-region__count">{grouped[region].length}</span>
              </header>
              <div className="mxm-region__grid">
                {grouped[region].map((m) => (
                  <MarketCard
                    key={m.id}
                    market={m}
                    submarkets={submarketsByMacro[m.code] || []}
                    locale={locale}
                    onOpen={() => setOpenMarket(m)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {openMarket && (
        <InsightsDrawer
          market={openMarket}
          locale={locale}
          onClose={() => setOpenMarket(null)}
        />
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────
const MarketCard = ({ market, submarkets = [], locale, onOpen }) => {
  const intel = market.market_intelligence || {};
  const keywords = intel.keywords?.[locale] || intel.keywords?.['en-US'] || [];
  const insights = intel.insights?.[locale] || intel.insights?.['en-US'] || null;
  const displayName = (market.display_name || {})[locale]
    || (market.display_name || {})['en-US']
    || market.code;

  // Submarket cluster labels (max 6 visible)
  const subLabels = submarkets
    .slice(0, 6)
    .map((s) => (s.display_name?.[locale] || s.display_name?.['en-US'] || s.code));

  return (
    <article className="mxm-card" data-testid={`mxm-card-${market.code}`}>
      <header className="mxm-card__head">
        <div>
          <p className="mxm-card__name">{displayName}</p>
          <p className="mxm-card__locale">{market.primary_locale}</p>
        </div>
      </header>

      {keywords.length > 0 ? (
        <ul className="mxm-chips" data-testid={`mxm-chips-${market.code}`}>
          {keywords.map((k, i) => (
            <li key={`${market.code}-kw-${i}`} className="mxm-chip">{k}</li>
          ))}
        </ul>
      ) : (
        <p className="mxm-card__nodata">{tr(I18N.no_data, locale)}</p>
      )}

      {subLabels.length > 0 && (
        <div className="mxm-submarkets" data-testid={`mxm-subs-${market.code}`}>
          <p className="mxm-submarkets__label">
            {locale.startsWith('it') ? 'Geo-cultural cluster' : 'Geo-cultural clusters'}
          </p>
          <ul className="mxm-sub-chips">
            {subLabels.map((s, i) => (
              <li key={`${market.code}-sub-${i}`} className="mxm-sub-chip">{s}</li>
            ))}
            {submarkets.length > subLabels.length && (
              <li className="mxm-sub-chip mxm-sub-chip--more">+{submarkets.length - subLabels.length}</li>
            )}
          </ul>
        </div>
      )}

      {insights && (
        <button
          type="button"
          className="mxm-card__cta"
          onClick={onOpen}
          data-testid={`mxm-open-${market.code}`}
        >
          <Lightbulb size={11} strokeWidth={1.6} />
          {tr(I18N.view_insights, locale)}
          <ChevronRight size={11} strokeWidth={2} />
        </button>
      )}
    </article>
  );
};

// ────────────────────────────────────────────────────────────────────
const InsightsDrawer = ({ market, locale, onClose }) => {
  const intel = market.market_intelligence || {};
  const insights = intel.insights?.[locale] || intel.insights?.['en-US'] || {};
  const keywords = intel.keywords?.[locale] || intel.keywords?.['en-US'] || [];
  const displayName = (market.display_name || {})[locale]
    || (market.display_name || {})['en-US']
    || market.code;

  return (
    <div className="mxm-drawer-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} data-testid="mxm-drawer-bg">
      <aside className="mxm-drawer" data-testid={`mxm-drawer-${market.code}`}>
        <header className="mxm-drawer__head">
          <div>
            <p className="mxm-drawer__eyebrow">Market Insights · {market.primary_locale}</p>
            <h2 className="mxm-drawer__title">{displayName}</h2>
            <p className="mxm-drawer__intro">{tr(I18N.drawer_intro, locale)}</p>
            {keywords.length > 0 && (
              <ul className="mxm-chips mxm-chips--drawer">
                {keywords.map((k, i) => <li key={i} className="mxm-chip">{k}</li>)}
              </ul>
            )}
          </div>
          <button className="mxm-drawer__close" onClick={onClose} data-testid="mxm-drawer-close">
            <X size={16} strokeWidth={1.5} />
          </button>
        </header>

        <div className="mxm-drawer__body">
          {INSIGHT_FIELDS.map((field) => {
            const value = insights?.[field.key];
            if (!value) return null;
            const Icon = field.icon;
            return (
              <section key={field.key} className={`mxm-insight mxm-insight--${field.key}`} data-testid={`mxm-insight-${market.code}-${field.key}`}>
                <header className="mxm-insight__head">
                  <Icon size={12} strokeWidth={1.5} />
                  <h3 className="mxm-insight__title">{tr(field.labels, locale)}</h3>
                </header>
                <p className="mxm-insight__body">{value}</p>
              </section>
            );
          })}
        </div>
      </aside>
    </div>
  );
};

export default MarketMatrixPage;
