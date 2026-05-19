/**
 * BrandVoiceAdaptersPage — Tenant-owned editorial dimensions.
 * ────────────────────────────────────────────────────────────────────
 * Route: /blueprint/voice
 *
 * 8 dimensions, each a small signed integer (-2 … +2) centered at 0
 * (neutral — let the cultural foundation speak). The tenant can orient
 * the brand voice within the strategic foundation, but NEVER modify
 * the foundation itself.
 *
 * UX: editorial sliders with poetic anchor labels at each end. NO admin
 * form vibes. NO percentages. Mood: FT Weekend × AD × Monocle.
 */
import './brand-voice.css';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck, Save, RotateCcw } from 'lucide-react';
import api from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';

// ── i18n minimal ────────────────────────────────────────────────────
const tr = (dict, locale) => dict?.[locale] || dict?.['en-US'] || dict?.['it-IT'] || '';

const I18N = {
  eyebrow: { 'it-IT': 'Market Intelligence Engine™ · Brand Voice', 'en-US': 'Market Intelligence Engine™ · Brand Voice', 'fr-FR': 'Market Intelligence Engine™ · Voix de marque', 'de-DE': 'Market Intelligence Engine™ · Markenstimme', 'es-ES': 'Market Intelligence Engine™ · Voz de marca', 'en-GB': 'Market Intelligence Engine™ · Brand Voice' },
  title:   { 'it-IT': 'Voce del brand', 'en-US': 'Brand Voice', 'fr-FR': 'Voix de marque', 'de-DE': 'Markenstimme', 'es-ES': 'Voz de marca', 'en-GB': 'Brand Voice' },
  lead: {
    'it-IT': 'Le fondamenta culturali di ogni mercato restano stabili. Qui orienti come la voce del tuo studio si esprime al loro interno — più calda o più fresca, più scenografica o più discreta. Sempre dentro la logica strategica, mai contro.',
    'en-US': 'The cultural foundations of each market remain stable. Here you orient how your studio voice expresses itself within them — warmer or cooler, more scenic or more restrained. Always within the strategic logic, never against.',
    'en-GB': 'The cultural foundations of each market remain stable. Here you orient how your studio voice expresses itself within them — warmer or cooler, more scenic or more restrained.',
    'es-ES': 'Las fundaciones culturales de cada mercado permanecen estables. Aquí orientas cómo se expresa la voz de tu estudio dentro de ellas — más cálida o más fresca, más escenográfica o más discreta.',
    'fr-FR': 'Les fondations culturelles de chaque marché restent stables. Vous orientez ici comment la voix de votre studio s\'exprime à l\'intérieur — plus chaude ou plus fraîche, plus scénique ou plus retenue.',
    'de-DE': 'Die kulturellen Grundlagen jedes Marktes bleiben stabil. Hier orientieren Sie, wie Ihre Studio-Stimme sich darin ausdrückt — wärmer oder kühler, szenischer oder zurückhaltender.',
  },
  neutral_hint: { 'it-IT': 'Neutro — segui la cultura del mercato', 'en-US': 'Neutral — follow the market culture', 'en-GB': 'Neutral — follow the market culture', 'es-ES': 'Neutro — sigue la cultura del mercado', 'fr-FR': 'Neutre — suivre la culture du marché', 'de-DE': 'Neutral — der Marktkultur folgen' },
  save:    { 'it-IT': 'Salva voce',     'en-US': 'Save voice',     'en-GB': 'Save voice',     'es-ES': 'Guardar voz',     'fr-FR': 'Enregistrer',         'de-DE': 'Stimme speichern' },
  saved:   { 'it-IT': 'Voce salvata',   'en-US': 'Voice saved',    'en-GB': 'Voice saved',    'es-ES': 'Voz guardada',    'fr-FR': 'Voix enregistrée',    'de-DE': 'Stimme gespeichert' },
  reset:   { 'it-IT': 'Reimposta tutto','en-US': 'Reset all',      'en-GB': 'Reset all',      'es-ES': 'Restablecer todo','fr-FR': 'Tout réinitialiser', 'de-DE': 'Alles zurücksetzen' },
  protect_kicker: { 'it-IT': 'Foundation protetta', 'en-US': 'Foundation protected', 'en-GB': 'Foundation protected', 'es-ES': 'Fundación protegida', 'fr-FR': 'Fondation protégée', 'de-DE': 'Geschützte Grundlage' },
  protect_body: {
    'it-IT': 'Le foundation culturali dei mercati macro sono curate strategicamente e non si modificano da qui. Tu adatti la TUA voce dentro la cultura del mercato — la cultura del mercato resta intatta.',
    'en-US': 'The cultural foundations of macro markets are strategically curated and cannot be modified here. You adapt YOUR voice within the market culture — the market culture itself stays untouched.',
    'en-GB': 'The cultural foundations of macro markets are strategically curated and cannot be modified here.',
    'es-ES': 'Las fundaciones culturales de los mercados macro son estratégicamente curadas y no se modifican desde aquí.',
    'fr-FR': 'Les fondations culturelles des macro-marchés sont stratégiquement organisées et ne peuvent être modifiées ici.',
    'de-DE': 'Die kulturellen Grundlagen der Makromärkte sind strategisch kuratiert und können hier nicht geändert werden.',
  },
};

// ── 8 dimensions with editorial anchor labels (poetic, never sliders' % ──
const DIMENSIONS = [
  {
    key: 'tone_warmth',
    label:    { 'it-IT': 'Calore del tono',         'en-US': 'Tone warmth',          'fr-FR': 'Chaleur du ton',         'de-DE': 'Tonwärme',         'es-ES': 'Calor del tono',           'en-GB': 'Tone warmth' },
    leftAnchor:  { 'it-IT': 'Più fresco · misurato', 'en-US': 'Cooler · measured',    'fr-FR': 'Plus frais · mesuré',    'de-DE': 'Kühler · gemessen','es-ES': 'Más fresco · medido',      'en-GB': 'Cooler · measured' },
    rightAnchor: { 'it-IT': 'Più caldo · relazionale','en-US': 'Warmer · relational', 'fr-FR': 'Plus chaud · relationnel','de-DE': 'Wärmer · relational','es-ES': 'Más cálido · relacional','en-GB': 'Warmer · relational' },
  },
  {
    key: 'hospitality_level',
    label:    { 'it-IT': 'Livello di ospitalità',    'en-US': 'Hospitality level',     'fr-FR': 'Niveau d\'hospitalité',  'de-DE': 'Hospitality-Niveau','es-ES': 'Nivel de hospitalidad',  'en-GB': 'Hospitality level' },
    leftAnchor:  { 'it-IT': 'Residenziale intimo',   'en-US': 'Quietly residential',   'fr-FR': 'Résidentiel intime',     'de-DE': 'Privat-wohnlich',  'es-ES': 'Residencial íntimo',     'en-GB': 'Quietly residential' },
    rightAnchor: { 'it-IT': 'Hospitality scenografica','en-US':'Resort-scaled hospitality','fr-FR':'Hospitalité scénique','de-DE':'Hotelresort-Hospitality','es-ES':'Hospitalidad escenográfica','en-GB':'Hospitality at resort scale' },
  },
  {
    key: 'visual_boldness',
    label:    { 'it-IT': 'Audacia visuale',          'en-US': 'Visual boldness',       'fr-FR': 'Audace visuelle',        'de-DE': 'Visuelle Kühnheit','es-ES': 'Audacia visual',         'en-GB': 'Visual boldness' },
    leftAnchor:  { 'it-IT': 'Sussurrato · materico', 'en-US': 'Whispered · tactile',   'fr-FR': 'Murmuré · tactile',      'de-DE': 'Geflüstert · taktil','es-ES': 'Susurrado · táctil',   'en-GB': 'Whispered · tactile' },
    rightAnchor: { 'it-IT': 'Scenografico · dichiarato','en-US':'Scenic · declared',  'fr-FR': 'Scénique · déclaré',     'de-DE': 'Szenisch · markant','es-ES': 'Escenográfico · declarado','en-GB': 'Scenic · declared' },
  },
  {
    key: 'editorial_pacing',
    label:    { 'it-IT': 'Ritmo editoriale',         'en-US': 'Editorial pacing',      'fr-FR': 'Rythme éditorial',       'de-DE': 'Editoriales Tempo','es-ES': 'Ritmo editorial',        'en-GB': 'Editorial pacing' },
    leftAnchor:  { 'it-IT': 'Lento · contemplativo', 'en-US': 'Slow · contemplative',  'fr-FR': 'Lent · contemplatif',    'de-DE': 'Langsam · kontemplativ','es-ES': 'Lento · contemplativo','en-GB': 'Slow · contemplative' },
    rightAnchor: { 'it-IT': 'Denso · ritmato',       'en-US': 'Dense · cadenced',      'fr-FR': 'Dense · cadencé',        'de-DE': 'Dicht · rhythmisch','es-ES': 'Denso · cadenciado',    'en-GB': 'Dense · cadenced' },
  },
  {
    key: 'architectural_intensity',
    label:    { 'it-IT': 'Intensità architettonica', 'en-US': 'Architectural intensity','fr-FR': 'Intensité architecturale','de-DE': 'Architektonische Intensität','es-ES': 'Intensidad arquitectónica','en-GB': 'Architectural intensity' },
    leftAnchor:  { 'it-IT': 'Domestico · vissuto',   'en-US': 'Domestic · lived-in',   'fr-FR': 'Domestique · vécu',      'de-DE': 'Häuslich · gelebt','es-ES': 'Doméstico · vivido',     'en-GB': 'Domestic · lived-in' },
    rightAnchor: { 'it-IT': 'Architettonico · monumentale','en-US':'Architectural · monumental','fr-FR':'Architectural · monumental','de-DE':'Architektonisch · monumental','es-ES':'Arquitectónico · monumental','en-GB':'Architectural · monumental' },
  },
  {
    key: 'emotional_intensity',
    label:    { 'it-IT': 'Intensità emotiva',        'en-US': 'Emotional intensity',   'fr-FR': 'Intensité émotionnelle', 'de-DE': 'Emotionale Intensität','es-ES': 'Intensidad emocional','en-GB': 'Emotional intensity' },
    leftAnchor:  { 'it-IT': 'Sobrio · misurato',     'en-US': 'Restrained · measured', 'fr-FR': 'Sobre · mesuré',         'de-DE': 'Zurückhaltend · gemessen','es-ES': 'Sobrio · medido',  'en-GB': 'Restrained · measured' },
    rightAnchor: { 'it-IT': 'Emotivo · narrativo',   'en-US': 'Emotional · narrative', 'fr-FR': 'Émotionnel · narratif',  'de-DE': 'Emotional · erzählerisch','es-ES': 'Emotivo · narrativo','en-GB':'Emotional · narrative' },
  },
  {
    key: 'material_storytelling',
    label:    { 'it-IT': 'Storytelling dei materiali','en-US': 'Material storytelling','fr-FR':'Récit des matériaux',     'de-DE': 'Material-Erzählung','es-ES': 'Narrativa de materiales','en-GB': 'Material storytelling' },
    leftAnchor:  { 'it-IT': 'Implicito · ambientale','en-US': 'Implicit · ambient',    'fr-FR': 'Implicite · ambiant',    'de-DE': 'Implizit · ambient','es-ES': 'Implícito · ambiental','en-GB': 'Implicit · ambient' },
    rightAnchor: { 'it-IT': 'Esplicito · documentale','en-US':'Explicit · documentary','fr-FR':'Explicite · documentaire','de-DE':'Explizit · dokumentarisch','es-ES':'Explícito · documental','en-GB':'Explicit · documentary' },
  },
  {
    key: 'cta_style',
    label:    { 'it-IT': 'Stile della CTA',          'en-US': 'CTA style',             'fr-FR': 'Style des CTA',          'de-DE': 'CTA-Stil',         'es-ES': 'Estilo de CTA',          'en-GB': 'CTA style' },
    leftAnchor:  { 'it-IT': 'Invito · sussurrato',   'en-US': 'Invitation · whispered','fr-FR': 'Invitation · murmurée',  'de-DE': 'Einladung · geflüstert','es-ES':'Invitación · susurrada','en-GB': 'Invitation · whispered' },
    rightAnchor: { 'it-IT': 'Diretto · deciso',      'en-US': 'Direct · decisive',     'fr-FR': 'Direct · décisif',       'de-DE': 'Direkt · entschlossen','es-ES': 'Directo · decisivo',  'en-GB': 'Direct · decisive' },
  },
];

const SUPPORTED = ['it-IT', 'en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE'];

const BrandVoiceAdaptersPage = () => {
  const { locale: bpLocale } = useBlueprint();
  const locale = useMemo(() => {
    if (SUPPORTED.includes(bpLocale)) return bpLocale;
    return SUPPORTED.find((l) => l.split('-')[0] === (bpLocale || '').split('-')[0]) || 'en-US';
  }, [bpLocale]);

  const [adapters, setAdapters] = useState({});
  const [original, setOriginal] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get('/api/market-intelligence/adapters');
        const a = r.data?.adapters || {};
        setAdapters(a); setOriginal(a);
      } finally { setLoading(false); }
    })();
  }, []);

  const dirty = useMemo(() => {
    return DIMENSIONS.some((d) => (adapters[d.key] ?? 0) !== (original[d.key] ?? 0));
  }, [adapters, original]);

  const setVal = (key, v) => setAdapters((a) => ({ ...a, [key]: v }));
  const reset  = () => setAdapters(Object.fromEntries(DIMENSIONS.map((d) => [d.key, 0])));

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.patch('/api/market-intelligence/adapters', { adapters });
      const a = r.data?.adapters || {};
      setAdapters(a); setOriginal(a);
      toast.success(tr(I18N.saved, locale));
    } catch {
      toast.error('Errore');
    } finally { setSaving(false); }
  };

  return (
    <div className="bva-page" data-surface="os" data-testid="brand-voice-page">
      <header className="bva-hero">
        <p className="bva-hero__eyebrow">{tr(I18N.eyebrow, locale)}</p>
        <h1 className="bva-hero__title">{tr(I18N.title, locale)}</h1>
        <p className="bva-hero__lead">{tr(I18N.lead, locale)}</p>
      </header>

      <section className="bva-grid" data-testid="bva-grid">
        {DIMENSIONS.map((d) => {
          const v = adapters[d.key] ?? 0;
          return (
            <article key={d.key} className="bva-dim" data-testid={`bva-dim-${d.key}`}>
              <h3 className="bva-dim__label">{tr(d.label, locale)}</h3>
              <div className="bva-track">
                <div className="bva-track__line" />
                <div className="bva-track__center" />
                {[-2, -1, 0, 1, 2].map((stop) => (
                  <button
                    key={stop}
                    type="button"
                    onClick={() => setVal(d.key, stop)}
                    className={`bva-stop ${v === stop ? 'is-active' : ''} ${stop === 0 ? 'bva-stop--neutral' : ''}`}
                    data-testid={`bva-stop-${d.key}-${stop}`}
                    aria-label={`${tr(d.label, locale)}: ${stop}`}
                  >
                    <span className="bva-stop__dot" />
                  </button>
                ))}
              </div>
              <div className="bva-anchors">
                <span className="bva-anchor bva-anchor--left">{tr(d.leftAnchor, locale)}</span>
                <span className="bva-anchor bva-anchor--right">{tr(d.rightAnchor, locale)}</span>
              </div>
              {v === 0 && <p className="bva-neutral-hint">{tr(I18N.neutral_hint, locale)}</p>}
            </article>
          );
        })}
      </section>

      <footer className="bva-actions" data-testid="bva-actions">
        <button type="button" className="bva-btn bva-btn--ghost" onClick={reset} data-testid="bva-reset">
          <RotateCcw size={11} strokeWidth={1.6} /> {tr(I18N.reset, locale)}
        </button>
        <button type="button" className="bva-btn bva-btn--primary"
                onClick={save} disabled={!dirty || saving || loading} data-testid="bva-save">
          <Save size={11} strokeWidth={1.6} /> {saving ? '…' : tr(I18N.save, locale)}
        </button>
      </footer>

      <section className="bva-protect" data-testid="bva-protect">
        <ShieldCheck size={13} strokeWidth={1.5} />
        <div>
          <p className="bva-protect__kicker">{tr(I18N.protect_kicker, locale)}</p>
          <p className="bva-protect__body">{tr(I18N.protect_body, locale)}</p>
        </div>
      </section>
    </div>
  );
};

export default BrandVoiceAdaptersPage;
