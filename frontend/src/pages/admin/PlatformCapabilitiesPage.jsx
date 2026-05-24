/**
 * PlatformCapabilitiesPage — Blueprint OS™ · Platform Capabilities™.
 *
 * Replaces the old "Modules" registry. This page is NOT a feature-toggle
 * matrix: it's an editorial ecosystem map. Each card describes WHAT a
 * tenant can orchestrate — surfaces involved, intelligence linkages,
 * maturity, license tier, activation state.
 *
 * Tone: international editorial operating system. No checkboxes, no KPI
 * overload, no enterprise admin clichés.
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
  Pen, Globe2, Users, Sparkles, Layers, Activity, Handshake, MapPinned,
  ClipboardList, FolderTree, Compass, ChevronRight,
} from 'lucide-react';
import api from '../../lib/api';
import './platform-capabilities.css';
import { useT } from '../../i18n/useT';

// ─── Editorial taxonomy ───────────────────────────────────────────
// 11 platform capabilities. Each is mapped to surfaces it lives on,
// linkages with the intelligence layers, maturity (stable / beta /
// vision), and the minimum license tier needed to enable it.
const CAPABILITIES = [
  {
    key: 'editorial_studio',
    icon: Pen,
    name: 'Editorial Studio™',
    description: 'Orchestrazione editoriale multilingua per articoli, lookbook e narrative di progetto. Modular blocks, AI assist, market variants.',
    surfaces: ['Workspace · /editorial', 'Storefront · /magazine'],
    linkages: ['DAM', 'Market Intelligence', 'CRM'],
    maturity: 'stable',
    tier: 'studio',
  },
  {
    key: 'market_editions',
    icon: Globe2,
    name: 'Market Editions™',
    description: 'Varianti editoriali per submarket. Tono, ritmo, CTA e visual rhythm adattati al cluster culturale di destinazione.',
    surfaces: ['Editorial Studio', 'Storefront i18n routes'],
    linkages: ['Market Intelligence', 'Editorial Studio'],
    maturity: 'stable',
    tier: 'studio',
  },
  {
    key: 'relationship_crm',
    icon: Users,
    name: 'Relationship Intelligence CRM™',
    description: 'Memoria viva della relazione cliente — timeline editoriale, stage evolutivi, voice notes, mood prevalente calcolato.',
    surfaces: ['Workspace · /crm'],
    linkages: ['DAM', 'Market Signals', 'Advisor Network'],
    maturity: 'stable',
    tier: 'studio',
  },
  {
    key: 'moodboards',
    icon: Layers,
    name: 'Moodboard Intelligence™',
    description: 'Composizione visiva di atmosfere, hotspot interattivi, condivisione cliente con tracking dell\'engagement materico.',
    surfaces: ['Workspace · /moodboards', 'Client Portal'],
    linkages: ['DAM', 'CRM', 'Market Signals'],
    maturity: 'stable',
    tier: 'core',
  },
  {
    key: 'inspirations',
    icon: Sparkles,
    name: 'Inspirations™',
    description: 'Archivio curatoriale culturale dello studio · layer editoriale sopra la Media Library con Market Resonance™.',
    surfaces: ['Workspace · /inspirations'],
    linkages: ['Media Library', 'Moodboards', 'Cultural Editions™'],
    maturity: 'beta',
    tier: 'studio',
  },
  {
    key: 'market_signals',
    icon: Activity,
    name: 'Market Signals™',
    description: 'Aggregazione anonima dei comportamenti geo-culturali · suggerimenti editoriali adattivi.',
    surfaces: ['Workspace · /markets · /market-insights'],
    linkages: ['Editorial Studio', 'CRM'],
    maturity: 'beta',
    tier: 'studio',
  },
  {
    key: 'advisor_network',
    icon: Handshake,
    name: 'Advisor Network™',
    description: 'Rappresentanze territoriali con relazione editoriale · referral, commissioni, visit reports.',
    surfaces: ['Control Center · /admin/advisors', 'Tenant referral banner'],
    linkages: ['CRM', 'Territory Intelligence'],
    maturity: 'stable',
    tier: 'studio',
  },
  {
    key: 'international_presence',
    icon: MapPinned,
    name: 'International Presence™',
    description: 'Coordinamento dei mercati internazionali · domini, lingue, presenza editoriale per paese.',
    surfaces: ['Settings · International Presence', 'Storefront'],
    linkages: ['Editorial Studio', 'Market Editions'],
    maturity: 'stable',
    tier: 'studio',
  },
  {
    key: 'forms_journeys',
    icon: ClipboardList,
    name: 'Forms & Journeys™',
    description: 'Luxury lead architecture · form editoriali con domande dirette al brief progettuale.',
    surfaces: ['Storefront', 'CRM intake'],
    linkages: ['CRM', 'Editorial Studio'],
    maturity: 'vision',
    tier: 'studio',
  },
  {
    key: 'dam_media',
    icon: FolderTree,
    name: 'DAM & Media Library™',
    description: 'Sistema di asset · cataloghi materici, varianti localizzate, filter intelligence editoriale.',
    surfaces: ['Library', 'Editorial Studio', 'Moodboards'],
    linkages: ['Editorial Studio', 'Moodboards', 'CRM'],
    maturity: 'stable',
    tier: 'core',
  },
  {
    key: 'cultural_intelligence',
    icon: Compass,
    name: 'Cultural Design Intelligence™',
    description: 'Layer di lettura culturale che permea l\'intera piattaforma · linguaggio, hospitality, mood per market cluster.',
    surfaces: ['Editorial Studio', 'CRM', 'Market Signals'],
    linkages: ['Market Editions', 'Market Signals'],
    maturity: 'vision',
    tier: 'studio',
  },
];

const MATURITY_META = {
  stable: { lbl: 'Stable',  color: '#C9A26B' },
  beta:   { lbl: 'Beta',    color: '#E0C088' },
  vision: { lbl: 'Vision',  color: '#7AA8E0' },
};
const TIER_META = {
  core:   { lbl: 'Core',    desc: 'Incluso in ogni piano' },
  studio: { lbl: 'Studio',  desc: 'Disponibile per studi attivati' },
  atelier:{ lbl: 'Atelier', desc: 'Tier alto · accesso curato' },
};

const PlatformCapabilitiesPage = () => {
  const { t } = useT();
  const [activations, setActivations] = useState({}); // tenant_id agnostic — global toggles
  const [loading, setLoading] = useState(true);

  // Best-effort: pull the existing module registry to seed activations from
  // the legacy table. New keys default to "active = true" — this page is
  // about WHAT is orchestrated, not WHETHER each module is installed.
  useEffect(() => {
    api.get('/api/super/catalog/modules').then((r) => {
      const seeded = {};
      (r.data.modules || []).forEach((m) => { seeded[m.id] = m.enabled !== false; });
      setActivations(seeded);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const counters = useMemo(() => ({
    total:  CAPABILITIES.length,
    stable: CAPABILITIES.filter((c) => c.maturity === 'stable').length,
    beta:   CAPABILITIES.filter((c) => c.maturity === 'beta').length,
    vision: CAPABILITIES.filter((c) => c.maturity === 'vision').length,
  }), []);

  return (
    <div className="pcap-page" data-testid="platform-capabilities-page">
      {/* ── Editorial header ─────────────────────────────────────── */}
      <header className="pcap-hero">
        <p className="pcap-hero__eyebrow">Platform · Ecosystem map</p>
        <h1 className="pcap-hero__title">Platform Capabilities™</h1>
        <p className="pcap-hero__lede">
          Ciò che la piattaforma orchestra per ogni studio, showroom o gruppo.
          Non un elenco di moduli, ma una mappa editoriale di possibilità
          relazionali, materiche e culturali.
        </p>
        <div className="pcap-hero__counters">
          <div className="pcap-hero__counter"><strong>{counters.total}</strong><span>Capabilities</span></div>
          <div className="pcap-hero__counter"><strong>{counters.stable}</strong><span>Stable</span></div>
          <div className="pcap-hero__counter"><strong>{counters.beta}</strong><span>Beta</span></div>
          <div className="pcap-hero__counter"><strong>{counters.vision}</strong><span>Vision</span></div>
        </div>
      </header>

      {/* ── Cards grid ───────────────────────────────────────────── */}
      <div className="pcap-grid">
        {CAPABILITIES.map((cap) => {
          const Icon = cap.icon;
          const maturity = MATURITY_META[cap.maturity];
          const tier = TIER_META[cap.tier];
          const active = activations[cap.key] !== false;
          return (
            <article key={cap.key} className="pcap-card"
                     data-testid={`pcap-card-${cap.key}`}
                     data-active={active}>
              <div className="pcap-card__head">
                <span className="pcap-card__mark" aria-hidden>
                  <Icon size={18} strokeWidth={1.4} />
                </span>
                <div className="pcap-card__title-block">
                  <h3 className="pcap-card__title">{cap.name}</h3>
                  <span className="pcap-card__maturity"
                        style={{ color: maturity.color, borderColor: `${maturity.color}40` }}>
                    {maturity.lbl}
                  </span>
                </div>
                <label className="pcap-toggle"
                       title={active ? 'Disattiva globalmente' : 'Attiva globalmente'}>
                  <input type="checkbox" checked={active}
                         onChange={(e) => setActivations((p) => ({ ...p, [cap.key]: e.target.checked }))}
                         data-testid={`pcap-toggle-${cap.key}`} />
                  <span className="pcap-toggle__slider" />
                </label>
              </div>

              <p className="pcap-card__desc">{cap.description}</p>

              <div className="pcap-card__row">
                <span className="pcap-card__row-label">Surfaces</span>
                <div className="pcap-card__chips">
                  {cap.surfaces.map((s, i) => <span key={i} className="pcap-chip">{s}</span>)}
                </div>
              </div>
              <div className="pcap-card__row">
                <span className="pcap-card__row-label">Linkages</span>
                <div className="pcap-card__chips">
                  {cap.linkages.map((l, i) => (
                    <span key={i} className="pcap-chip pcap-chip--linkage">
                      <ChevronRight size={9} strokeWidth={2} /> {l}
                    </span>
                  ))}
                </div>
              </div>

              <footer className="pcap-card__foot">
                <span className="pcap-card__tier">
                  <strong>{tier.lbl}</strong> · {tier.desc}
                </span>
              </footer>
            </article>
          );
        })}
      </div>

      {loading && (
        <p className="pcap-loading">{t('admin.platform_capabilities.sincronizzo_lo_stato_attivazioni')}</p>
      )}
    </div>
  );
};

export default PlatformCapabilitiesPage;
