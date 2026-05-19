/**
 * Market Insights™ — Phase 1 Editorial Foundation.
 * ────────────────────────────────────────────────────────────────────
 * Route: /blueprint/intelligence
 *
 * Strategic Co-Pilot™ surface. Editorial intelligence narratives from
 * anonymous geo-cultural behavioral signals. NEVER analytics dashboard.
 * Mood: Financial Times × AD × Monocle × Wallpaper.
 *
 * Phase 1 = foundation only. AI generation lives in Phase 2.
 *
 * Sections:
 *   • Hero with "We are listening" framing
 *   • Health card (passive: submarkets covered + signal status)
 *   • Insight feed (empty editorial state when none yet)
 */
import './market-insights.css';
import React, { useEffect, useMemo, useState } from 'react';
import { Ear, Sparkles, MapPin, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useBlueprint } from '../../contexts/BlueprintContext';
import api from '../../lib/api';

const I18N = {
  eyebrow: {
    'it-IT': 'Market Intelligence Engine™ · Phase 1',
    'en-US': 'Market Intelligence Engine™ · Phase 1',
    'en-GB': 'Market Intelligence Engine™ · Phase 1',
    'es-ES': 'Market Intelligence Engine™ · Phase 1',
    'fr-FR': 'Market Intelligence Engine™ · Phase 1',
    'de-DE': 'Market Intelligence Engine™ · Phase 1',
  },
  title: {
    'it-IT': 'Market Insights™',
    'en-US': 'Market Insights™',
    'en-GB': 'Market Insights™',
    'es-ES': 'Market Insights™',
    'fr-FR': 'Market Insights™',
    'de-DE': 'Market Insights™',
  },
  lead: {
    'it-IT': 'MOOD osserva in forma anonima come culture e territori reagiscono ai tuoi contenuti progettuali — per aiutarti a comunicare meglio in ogni mercato. Le decisioni restano sempre tue.',
    'en-US': 'MOOD anonymously observes how cultures and territories respond to your project content — so you can communicate better in each market. Decisions always remain yours.',
    'en-GB': 'MOOD anonymously observes how cultures and territories respond to your project content — so you can communicate better in each market. Decisions always remain yours.',
    'es-ES': 'MOOD observa anónimamente cómo las culturas y los territorios reaccionan a tus contenidos — para ayudarte a comunicar mejor en cada mercado. Las decisiones siguen siendo tuyas.',
    'fr-FR': 'MOOD observe anonymement la façon dont les cultures et les territoires réagissent à vos contenus de projet — pour mieux communiquer sur chaque marché. Les décisions restent les vôtres.',
    'de-DE': 'MOOD beobachtet anonym, wie Kulturen und Territorien auf Ihre Projektinhalte reagieren — damit Sie auf jedem Markt besser kommunizieren. Die Entscheidungen bleiben immer bei Ihnen.',
  },
  health_kicker: {
    'it-IT': 'Stato del sistema',
    'en-US': 'System status',
    'en-GB': 'System status',
    'es-ES': 'Estado del sistema',
    'fr-FR': 'État du système',
    'de-DE': 'Systemstatus',
  },
  status_listening: {
    'it-IT': 'In ascolto',
    'en-US': 'Listening',
    'en-GB': 'Listening',
    'es-ES': 'En escucha',
    'fr-FR': 'À l’écoute',
    'de-DE': 'Hört zu',
  },
  hc_submarkets: {
    'it-IT': 'Geo-cultural cluster mappati',
    'en-US': 'Geo-cultural clusters mapped',
    'en-GB': 'Geo-cultural clusters mapped',
    'es-ES': 'Clústeres geo-culturales mapeados',
    'fr-FR': 'Clusters géo-culturels cartographiés',
    'de-DE': 'Erfasste geokulturelle Cluster',
  },
  hc_signals: {
    'it-IT': 'Segnali anonimi raccolti',
    'en-US': 'Anonymous signals collected',
    'en-GB': 'Anonymous signals collected',
    'es-ES': 'Señales anónimas recogidas',
    'fr-FR': 'Signaux anonymes collectés',
    'de-DE': 'Anonyme Signale erfasst',
  },
  hc_insights: {
    'it-IT': 'Narrative pubblicate',
    'en-US': 'Narratives published',
    'en-GB': 'Narratives published',
    'es-ES': 'Narrativas publicadas',
    'fr-FR': 'Récits publiés',
    'de-DE': 'Veröffentlichte Narrative',
  },
  feed_title: {
    'it-IT': 'Narrative editoriali',
    'en-US': 'Editorial narratives',
    'en-GB': 'Editorial narratives',
    'es-ES': 'Narrativas editoriales',
    'fr-FR': 'Récits éditoriaux',
    'de-DE': 'Editoriale Narrative',
  },
  empty_eyebrow: {
    'it-IT': 'Stiamo ascoltando',
    'en-US': 'We are listening',
    'en-GB': 'We are listening',
    'es-ES': 'Estamos escuchando',
    'fr-FR': 'Nous écoutons',
    'de-DE': 'Wir hören zu',
  },
  empty_lead: {
    'it-IT': 'Le prime narrative culturali appariranno qui non appena i tuoi contenuti raccoglieranno abbastanza segnali per generare una lettura strategica significativa. Niente fretta — è un atlante che si forma con il tempo.',
    'en-US': 'The first cultural narratives will appear here as soon as your content gathers enough signals to produce a meaningful strategic reading. No rush — this is an atlas that forms with time.',
    'en-GB': 'The first cultural narratives will appear here as soon as your content gathers enough signals to produce a meaningful strategic reading. No rush — this is an atlas that forms with time.',
    'es-ES': 'Las primeras narrativas culturales aparecerán aquí en cuanto tus contenidos reúnan señales suficientes para una lectura estratégica significativa. Sin prisa — es un atlas que se forma con el tiempo.',
    'fr-FR': 'Les premiers récits culturels apparaîtront ici dès que vos contenus auront recueilli assez de signaux pour une lecture stratégique significative. Sans hâte — c’est un atlas qui se construit avec le temps.',
    'de-DE': 'Die ersten kulturellen Narrative erscheinen hier, sobald Ihre Inhalte genügend Signale gesammelt haben, um eine aussagekräftige strategische Lesart zu erzeugen. Ohne Eile — es ist ein Atlas, der mit der Zeit entsteht.',
  },
  privacy_kicker: {
    'it-IT': 'Privacy by design',
    'en-US': 'Privacy by design',
    'en-GB': 'Privacy by design',
    'es-ES': 'Privacy by design',
    'fr-FR': 'Privacy by design',
    'de-DE': 'Privacy by design',
  },
  privacy_body: {
    'it-IT': 'Mai dati personali, mai geolocalizzazione precisa. Solo letture aggregate per regione e ora, raccolte con hash di sessione che ruotano ogni giorno.',
    'en-US': 'No personal data, no precise geolocation. Only aggregated regional and time-based readings, gathered through session hashes that rotate daily.',
    'en-GB': 'No personal data, no precise geolocation. Only aggregated regional and time-based readings, gathered through session hashes that rotate daily.',
    'es-ES': 'Sin datos personales, sin geolocalización precisa. Solo lecturas agregadas por región y hora, recogidas con hash de sesión que rotan cada día.',
    'fr-FR': 'Aucune donnée personnelle, aucune géolocalisation précise. Seulement des lectures agrégées par région et par heure, recueillies via des hash de session renouvelés chaque jour.',
    'de-DE': 'Keine persönlichen Daten, keine präzise Geolokalisierung. Nur aggregierte regionale und zeitbasierte Lesarten, erhoben durch tägliche rotierende Session-Hashes.',
  },
  loading: {
    'it-IT': 'Caricamento…',
    'en-US': 'Loading…',
    'en-GB': 'Loading…',
    'es-ES': 'Cargando…',
    'fr-FR': 'Chargement…',
    'de-DE': 'Lädt…',
  },
};

const tr = (dict, locale) => dict?.[locale] || dict?.['en-US'] || dict?.['it-IT'] || '';

const SUPPORTED = ['it-IT', 'en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE'];

const MarketInsightsPage = () => {
  const { locale: bpLocale } = useBlueprint();
  const locale = useMemo(() => {
    if (SUPPORTED.includes(bpLocale)) return bpLocale;
    return SUPPORTED.find((l) => l.split('-')[0] === (bpLocale || '').split('-')[0]) || 'en-US';
  }, [bpLocale]);

  const [health, setHealth] = useState(null);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [h, i] = await Promise.all([
          api.get('/api/market-intelligence/health'),
          api.get('/api/market-intelligence/insights'),
        ]);
        setHealth(h.data);
        setInsights(i.data?.insights || []);
      } catch {
        toast.error(tr(I18N.loading, locale));
      } finally { setLoading(false); }
    })();
  }, [locale]);

  return (
    <div className="mxi-page" data-testid="market-insights-page" data-surface="os">
      <header className="mxi-hero">
        <p className="mxi-hero__eyebrow">{tr(I18N.eyebrow, locale)}</p>
        <h1 className="mxi-hero__title">{tr(I18N.title, locale)}</h1>
        <p className="mxi-hero__lead">{tr(I18N.lead, locale)}</p>
      </header>

      {/* ── Health card ──────────────────────────────────────────── */}
      <section className="mxi-health" data-testid="mxi-health">
        <header className="mxi-health__head">
          <p className="mxi-health__kicker">{tr(I18N.health_kicker, locale)}</p>
          <span className="mxi-health__status">
            <span className="mxi-pulse-dot" />
            {tr(I18N.status_listening, locale)}
          </span>
        </header>
        <div className="mxi-health__grid">
          <div className="mxi-stat">
            <MapPin size={11} strokeWidth={1.5} />
            <p className="mxi-stat__num">{loading ? '—' : (health?.submarkets_active ?? 0)}</p>
            <p className="mxi-stat__lbl">{tr(I18N.hc_submarkets, locale)}</p>
          </div>
          <div className="mxi-stat">
            <Ear size={11} strokeWidth={1.5} />
            <p className="mxi-stat__num">{loading ? '—' : (health?.events_total ?? 0)}</p>
            <p className="mxi-stat__lbl">{tr(I18N.hc_signals, locale)}</p>
          </div>
          <div className="mxi-stat">
            <Sparkles size={11} strokeWidth={1.5} />
            <p className="mxi-stat__num">{loading ? '—' : (health?.insights_published ?? 0)}</p>
            <p className="mxi-stat__lbl">{tr(I18N.hc_insights, locale)}</p>
          </div>
        </div>
      </section>

      {/* ── Insight feed ─────────────────────────────────────────── */}
      <section className="mxi-feed" data-testid="mxi-feed">
        <header className="mxi-feed__head">
          <h2 className="mxi-feed__title">{tr(I18N.feed_title, locale)}</h2>
        </header>

        {insights.length === 0 ? (
          <div className="mxi-empty" data-testid="mxi-empty">
            <p className="mxi-empty__eyebrow">{tr(I18N.empty_eyebrow, locale)}</p>
            <p className="mxi-empty__lead">{tr(I18N.empty_lead, locale)}</p>
          </div>
        ) : (
          <ul className="mxi-list">
            {insights.map((it) => (
              <li key={it.id} className="mxi-narrative" data-testid={`mxi-insight-${it.id}`}>
                <header className="mxi-narrative__head">
                  <span className="mxi-narrative__type">{it.insight_type || 'editorial'}</span>
                  {it.submarket_code && <span className="mxi-narrative__loc">· {it.submarket_code}</span>}
                </header>
                <h3 className="mxi-narrative__headline">{it.headline}</h3>
                <p className="mxi-narrative__body">{it.narrative}</p>
                {it.recommendation && (
                  <p className="mxi-narrative__reco">
                    <Sparkles size={11} strokeWidth={1.5} /> {it.recommendation}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Privacy note ─────────────────────────────────────────── */}
      <footer className="mxi-privacy" data-testid="mxi-privacy">
        <ShieldCheck size={13} strokeWidth={1.5} />
        <div>
          <p className="mxi-privacy__kicker">{tr(I18N.privacy_kicker, locale)}</p>
          <p className="mxi-privacy__body">{tr(I18N.privacy_body, locale)}</p>
        </div>
      </footer>
    </div>
  );
};

export default MarketInsightsPage;
