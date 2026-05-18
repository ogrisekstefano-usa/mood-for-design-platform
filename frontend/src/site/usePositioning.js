/**
 * usePositioning — Step B Phase 3 · Public Positioning Consumption™
 *
 * Reads the normalised Positioning Runtime™ for the active market locale
 * and exposes it to public storefront surfaces so they can adapt:
 *
 *   • CTA verbs           (cta_style_default + positioning_mode + audience)
 *   • Hero pacing         (storefront_behavior + emotional_pacing)
 *   • Project storytelling vocabulary (editorial_lens)
 *   • Navigation copy nuance (positioning_mode)
 *
 * IMPORTANT — Editorial Cultural Lens™ guardrail:
 *   The lens is the studio's editorial sensibility, NOT a pretend-nationality
 *   swap. A USA studio targeting USA clients THROUGH `italian_material_culture`
 *   gets slower pacing + restrained luxury copy — but STILL in English, with
 *   USA conversion psychology. We never substitute the locale.
 *
 * Endpoint: GET /api/storefront/public/{tenant_slug}/positioning?locale_code=…
 */
import { useEffect, useState } from 'react';
import axios from 'axios';
import { tenantConfig } from './content/tenant';
import { toBcp47Storefront } from './localeBcp47';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const CACHE_PREFIX = 'mfd_positioning_v1_';

export function usePositioning(locale) {
  const [state, setState] = useState({ loading: true, positioning: null, resolution: null });

  useEffect(() => {
    let alive = true;
    const slug = tenantConfig.slug;
    const bcp = toBcp47Storefront(locale);

    axios.get(`${BACKEND_URL}/api/storefront/public/${slug}/positioning?locale_code=${encodeURIComponent(bcp)}`)
      .then((r) => {
        if (!alive) return;
        const positioning = r.data?.positioning || {};
        const resolution  = r.data?.resolution || null;
        setState({ loading: false, positioning, resolution });
      })
      .catch(() => {
        if (!alive) return;
        setState((s) => ({ ...s, loading: false }));
      });
    return () => { alive = false; };
  }, [locale]);

  return state;
}

/**
 * Resolve a CTA label that respects:
 *   • the market's `cta_style_default` (locale-native phrase)
 *   • the positioning_mode (verb register)
 *   • the audience (architects ≠ private clients)
 *
 * Returns an object: { primary, secondary } so call-sites can render
 * a dual-CTA layout without inventing copy.
 */
export function resolveCtaLabels(positioning, locale) {
  const mode = positioning?.positioning_mode;
  const lens = positioning?.editorial_lens;
  const audiences = positioning?.primary_audiences || [];
  const ctaDefault = positioning?.cta_style_default;

  // 1. Studio-level positioning mode wins (most specific intent).
  const MODE_PRIMARY = {
    domestic_luxury_authority:   { 'it-IT': 'Parliamone in studio',          'en-US': 'Schedule a consultation',     'en-GB': 'Schedule a consultation',    'fr-FR': 'Prendre rendez-vous',           'de-DE': 'Beratungstermin vereinbaren',     'es-ES': 'Concertar una visita',         'es-MX': 'Reservar una consulta privada',  'ar-AE': 'حدد موعدًا للاستشارة' },
    international_editorial:     { 'it-IT': 'Inizia il dialogo editoriale',  'en-US': 'Begin the editorial dialogue', 'en-GB': 'Begin the editorial dialogue', 'fr-FR': 'Commencer le dialogue éditorial', 'de-DE': 'Editorialen Dialog beginnen', 'es-ES': 'Iniciar el diálogo editorial', 'es-MX': 'Iniciar el diálogo editorial',   'ar-AE': 'ابدأ الحوار التحريري' },
    hospitality_contract:        { 'it-IT': 'Discutiamo l\'atmosfera',        'en-US': 'Discuss the hospitality atmosphere', 'en-GB': 'Discuss the hospitality atmosphere', 'fr-FR': 'Discuter de l\'atmosphère', 'de-DE': 'Atmosphäre besprechen', 'es-ES': 'Conversemos sobre la atmósfera', 'es-MX': 'Conversemos sobre la atmósfera', 'ar-AE': 'دعنا نناقش أجواء الضيافة' },
    luxury_residential_advisory: { 'it-IT': 'Prenota una consulenza privata', 'en-US': 'Arrange a private consultation', 'en-GB': 'Arrange a private consultation', 'fr-FR': 'Réserver une consultation privée', 'de-DE': 'Private Beratung vereinbaren', 'es-ES': 'Reservar una consulta privada', 'es-MX': 'Reservar una consulta privada', 'ar-AE': 'حدد استشارة خاصة' },
    material_consultancy:        { 'it-IT': 'Approfondisci la narrativa materica', 'en-US': 'Review the material narrative', 'en-GB': 'Review the material narrative', 'fr-FR': 'Explorer la narration matérielle', 'de-DE': 'Materialnarrativ ansehen', 'es-ES': 'Explorar la narrativa material', 'es-MX': 'Explorar la narrativa material', 'ar-AE': 'استعرض السرد المادي' },
    ad_specification_partner:    { 'it-IT': 'Richiedi documentazione tecnica', 'en-US': 'Request specification documentation', 'en-GB': 'Request specification documentation', 'fr-FR': 'Demander la documentation technique', 'de-DE': 'Spezifikation anfordern', 'es-ES': 'Solicitar documentación técnica', 'es-MX': 'Solicitar documentación técnica', 'ar-AE': 'اطلب الوثائق الفنية' },
    collectible_bespoke:         { 'it-IT': 'Esplora il pezzo unico',         'en-US': 'Explore the bespoke piece',  'en-GB': 'Explore the bespoke piece', 'fr-FR': 'Découvrir la pièce unique',  'de-DE': 'Das Einzelstück erkunden', 'es-ES': 'Explorar la pieza única', 'es-MX': 'Explorar la pieza única', 'ar-AE': 'اكتشف القطعة الفريدة' },
  };

  const MODE_SECONDARY = {
    domestic_luxury_authority:   { 'it-IT': 'Esplora i progetti',     'en-US': 'Explore the projects',  'en-GB': 'Explore the projects',  'fr-FR': 'Découvrir les projets',  'de-DE': 'Projekte ansehen',  'es-ES': 'Descubrir los proyectos',  'es-MX': 'Descubrir los proyectos',  'ar-AE': 'استكشف المشاريع' },
    international_editorial:     { 'it-IT': 'Leggi il magazine',      'en-US': 'Read the magazine',     'en-GB': 'Read the magazine',     'fr-FR': 'Lire le magazine',       'de-DE': 'Magazin lesen',     'es-ES': 'Leer la revista',          'es-MX': 'Leer la revista',           'ar-AE': 'اقرأ المجلة' },
    hospitality_contract:        { 'it-IT': 'Vedi i progetti hospitality', 'en-US': 'See hospitality projects', 'en-GB': 'See hospitality projects', 'fr-FR': 'Voir les projets d\'hospitalité', 'de-DE': 'Hospitality-Projekte', 'es-ES': 'Ver proyectos de hospitalidad', 'es-MX': 'Ver proyectos de hospitalidad', 'ar-AE': 'مشاريع الضيافة' },
    luxury_residential_advisory: { 'it-IT': 'Esplora le residenze',   'en-US': 'Explore the residences', 'en-GB': 'Explore the residences', 'fr-FR': 'Découvrir les résidences', 'de-DE': 'Residenzen entdecken', 'es-ES': 'Descubrir las residencias', 'es-MX': 'Descubrir las residencias', 'ar-AE': 'اكتشف المساكن' },
    material_consultancy:        { 'it-IT': 'Sfoglia il vocabolario materico', 'en-US': 'Browse the material vocabulary', 'en-GB': 'Browse the material vocabulary', 'fr-FR': 'Parcourir le vocabulaire matériel', 'de-DE': 'Materialvokabular durchsuchen', 'es-ES': 'Explorar el vocabulario material', 'es-MX': 'Explorar el vocabulario material', 'ar-AE': 'تصفح المفردات المادية' },
    ad_specification_partner:    { 'it-IT': 'Vedi le referenze',      'en-US': 'See the references',     'en-GB': 'See the references',     'fr-FR': 'Voir les références',      'de-DE': 'Referenzen ansehen',  'es-ES': 'Ver las referencias',       'es-MX': 'Ver las referencias',       'ar-AE': 'انظر المراجع' },
    collectible_bespoke:         { 'it-IT': 'Esplora gli autori',     'en-US': 'Explore the authors',    'en-GB': 'Explore the authors',    'fr-FR': 'Découvrir les auteurs',    'de-DE': 'Autoren erkunden',  'es-ES': 'Descubrir los autores',     'es-MX': 'Descubrir los autores',     'ar-AE': 'اكتشف المؤلفين' },
  };

  const pickLocale = (bag) => {
    if (!bag) return null;
    const bcp = toBcp47Storefront(locale);
    return bag[bcp] || bag[locale] || bag['en-US'] || bag['it-IT'] || Object.values(bag)[0] || null;
  };

  const primary = (mode && pickLocale(MODE_PRIMARY[mode]))
                || ctaDefault
                || pickLocale({ 'it-IT': 'Iniziamo il dialogo', 'en-US': 'Begin the dialogue', 'fr-FR': 'Commencer le dialogue', 'de-DE': 'Den Dialog beginnen', 'es-ES': 'Iniciar el diálogo' });

  const secondary = (mode && pickLocale(MODE_SECONDARY[mode]))
                 || pickLocale({ 'it-IT': 'Esplora i progetti', 'en-US': 'Explore the projects', 'fr-FR': 'Découvrir les projets', 'de-DE': 'Projekte ansehen', 'es-ES': 'Descubrir los proyectos' });

  return { primary, secondary, mode, lens, audiences };
}

/**
 * Resolve the navigation label nuance for the Projects link.
 * Domestic → Projects · Luxury Residential → Private Residences ·
 * Hospitality → Spaces & Hospitality · Editorial → Residential Narratives.
 * Subtle. Returns null when nothing to override.
 */
export function resolveProjectsNavLabel(positioning, locale) {
  const mode = positioning?.positioning_mode;
  if (!mode) return null;
  const MAP = {
    international_editorial:     { 'it-IT': 'Narrazioni residenziali',  'en-US': 'Residential Narratives', 'en-GB': 'Residential Narratives', 'fr-FR': 'Récits Résidentiels',  'de-DE': 'Wohnerzählungen',     'es-ES': 'Narrativas Residenciales' },
    hospitality_contract:        { 'it-IT': 'Spazi & Hospitality',      'en-US': 'Spaces & Hospitality',   'en-GB': 'Spaces & Hospitality',   'fr-FR': 'Espaces & Hospitalité', 'de-DE': 'Räume & Hospitality', 'es-ES': 'Espacios & Hospitalidad' },
    luxury_residential_advisory: { 'it-IT': 'Residenze Private',        'en-US': 'Private Residences',     'en-GB': 'Private Residences',     'fr-FR': 'Résidences Privées',    'de-DE': 'Privatresidenzen',    'es-ES': 'Residencias Privadas' },
    collectible_bespoke:         { 'it-IT': 'Pezzi d\'Autore',           'en-US': 'Authored Pieces',        'en-GB': 'Authored Pieces',        'fr-FR': 'Pièces d\'Auteur',      'de-DE': 'Autorenstücke',       'es-ES': 'Piezas de Autor' },
  };
  const bag = MAP[mode];
  if (!bag) return null;
  const bcp = toBcp47Storefront(locale);
  return bag[bcp] || bag[locale] || bag['en-US'] || null;
}
