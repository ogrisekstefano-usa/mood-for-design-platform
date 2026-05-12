/**
 * BlueprintContext — tenant config + theme + i18n + module registry + permissions + impersonation.
 *
 * Tenant impersonation: when set, axios sends `X-Tenant-Override` header so backend
 * scopes queries to that tenant (super_admin only). Stored in sessionStorage.
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import api from '../lib/api';
import { useAuth } from './AuthContext';

const BlueprintContext = createContext(null);
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const LOCALE_KEY = 'mfd_locale';
const IMPERSONATE_KEY = 'mfd_impersonate_tenant';
const DEFAULT_LOCALE = 'en-US';

const FALLBACK_LOCALES = [
  { code: 'en-US', label: 'English (US)', native: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)', native: 'English (UK)' },
  { code: 'it', label: 'Italian', native: 'Italiano' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'de', label: 'German', native: 'Deutsch' },
  { code: 'es', label: 'Spanish', native: 'Español' },
];

function detectInitialLocale() {
  const stored = localStorage.getItem(LOCALE_KEY);
  if (stored) return stored;
  if (typeof navigator !== 'undefined' && navigator.language) {
    const nl = navigator.language;
    if (FALLBACK_LOCALES.find((l) => l.code === nl)) return nl;
    const base = nl.split('-')[0];
    if (FALLBACK_LOCALES.find((l) => l.code === base)) return base;
  }
  return DEFAULT_LOCALE;
}

// Lookup of loaded Google Fonts URLs to avoid duplicate <link> tags
const _loadedFonts = new Set();

const loadGoogleFont = (familyString) => {
  if (!familyString) return;
  // Extract first family name from CSS font stack
  const match = familyString.match(/^['"]?([^'",]+)['"]?/);
  if (!match) return;
  const family = match[1].trim();
  // Skip system fonts and generic families
  const systemFonts = ['Georgia', 'Arial', 'Helvetica', 'system-ui', 'sans-serif', 'serif', 'monospace', 'ui-monospace'];
  if (systemFonts.includes(family)) return;
  const key = family.replace(/ /g, '+');
  if (_loadedFonts.has(key)) return;
  _loadedFonts.add(key);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${key}:wght@300;400;500;600;700&display=swap`;
  document.head.appendChild(link);
};

export const applyTheme = (effective) => {
  if (!effective) return;
  const root = document.documentElement;
  const p = effective.palette || {};
  const t = effective.typography || {};
  const s = effective.shape || {};
  const e = effective.elevation || {};
  const m = effective.motion || {};
  const sp = effective.spacing || {};
  const ed = effective.editorial || {};
  const at = effective.atmosphere || {};
  const cp = effective.components || {};

  // Palette
  if (p.primary) root.style.setProperty('--bp-primary', p.primary);
  if (p.accent)  root.style.setProperty('--bp-accent',  p.accent);
  if (p.background) root.style.setProperty('--bp-bg', p.background);
  if (p.surface_1) root.style.setProperty('--bp-surface-1', p.surface_1);
  if (p.surface_2) root.style.setProperty('--bp-surface-2', p.surface_2);
  if (p.surface_3) root.style.setProperty('--bp-surface-3', p.surface_3);
  if (p.overlay)   root.style.setProperty('--bp-overlay', p.overlay);
  if (p.border) root.style.setProperty('--bp-border', p.border);
  if (p.border_strong) root.style.setProperty('--bp-border-strong', p.border_strong);
  if (p.text_primary)   root.style.setProperty('--bp-text-primary', p.text_primary);
  if (p.text_secondary) root.style.setProperty('--bp-text-secondary', p.text_secondary);
  if (p.text_muted) root.style.setProperty('--bp-text-muted', p.text_muted);
  if (p.text_subtle) root.style.setProperty('--bp-text-subtle', p.text_subtle);
  if (p.selection_bg) root.style.setProperty('--bp-selection-bg', p.selection_bg);
  if (p.selection_fg) root.style.setProperty('--bp-selection-fg', p.selection_fg);

  // Typography
  if (t.font_heading) root.style.setProperty('--bp-font-heading', t.font_heading);
  if (t.font_body) root.style.setProperty('--bp-font-body', t.font_body);
  if (t.font_mono) root.style.setProperty('--bp-font-mono', t.font_mono);
  if (t.font_size_base) root.style.setProperty('--bp-font-size-base', `${t.font_size_base}px`);
  if (t.line_height_base) root.style.setProperty('--bp-line-height', t.line_height_base);
  if (t.letter_spacing_heading) root.style.setProperty('--bp-tracking-heading', t.letter_spacing_heading);
  if (t.letter_spacing_caps) root.style.setProperty('--bp-tracking-caps', t.letter_spacing_caps);

  // Editorial scale
  if (ed.display) root.style.setProperty('--bp-display', ed.display);
  if (ed.h1) root.style.setProperty('--bp-h1', ed.h1);
  if (ed.h2) root.style.setProperty('--bp-h2', ed.h2);
  if (ed.h3) root.style.setProperty('--bp-h3', ed.h3);
  if (ed.lead) root.style.setProperty('--bp-lead', ed.lead);
  if (ed.body) root.style.setProperty('--bp-body', ed.body);
  if (ed.caption) root.style.setProperty('--bp-caption', ed.caption);
  if (ed.eyebrow) root.style.setProperty('--bp-eyebrow', ed.eyebrow);
  if (ed.display_line) root.style.setProperty('--bp-display-line', ed.display_line);
  if (ed.heading_line) root.style.setProperty('--bp-heading-line', ed.heading_line);
  if (ed.body_line) root.style.setProperty('--bp-body-line', ed.body_line);
  if (ed.tracking_eyebrow) root.style.setProperty('--bp-tracking-eyebrow', ed.tracking_eyebrow);
  if (ed.tracking_display) root.style.setProperty('--bp-tracking-display', ed.tracking_display);

  // Load fonts
  loadGoogleFont(t.font_heading);
  loadGoogleFont(t.font_body);
  loadGoogleFont(t.font_mono);

  // Shape
  Object.entries(s).forEach(([k, v]) => {
    if (typeof v === 'string') root.style.setProperty(`--bp-${k.replace(/_/g, '-')}`, v);
  });

  // Elevation
  if (e.sm) root.style.setProperty('--bp-shadow-sm', e.sm);
  if (e.md) root.style.setProperty('--bp-shadow-md', e.md);
  if (e.lg) root.style.setProperty('--bp-shadow-lg', e.lg);
  if (e.xl) root.style.setProperty('--bp-shadow-xl', e.xl);
  if (e.glow) root.style.setProperty('--bp-shadow-glow', e.glow);
  if (e.inset_soft) root.style.setProperty('--bp-inset-soft', e.inset_soft);

  // Motion
  if (m.duration_fast) root.style.setProperty('--bp-duration-fast', m.duration_fast);
  if (m.duration_normal) root.style.setProperty('--bp-duration-normal', m.duration_normal);
  if (m.duration_slow) root.style.setProperty('--bp-duration-slow', m.duration_slow);
  if (m.duration_cinematic) root.style.setProperty('--bp-duration-cinematic', m.duration_cinematic);
  if (m.ease) root.style.setProperty('--bp-ease', m.ease);
  if (m.ease_emphasis) root.style.setProperty('--bp-ease-emphasis', m.ease_emphasis);
  if (m.ease_entrance) root.style.setProperty('--bp-ease-entrance', m.ease_entrance);
  if (m.stagger) root.style.setProperty('--bp-stagger', m.stagger);
  if (m.hover_lift) root.style.setProperty('--bp-hover-lift', m.hover_lift);

  // Atmosphere
  if (at.grain_intensity != null) root.style.setProperty('--bp-grain-intensity', at.grain_intensity);
  if (at.glow_intensity != null) root.style.setProperty('--bp-glow-intensity', at.glow_intensity);
  if (at.vignette_intensity != null) root.style.setProperty('--bp-vignette-intensity', at.vignette_intensity);
  if (at.glass_blur) root.style.setProperty('--bp-glass-blur', at.glass_blur);
  if (at.glass_opacity != null) root.style.setProperty('--bp-glass-opacity', at.glass_opacity);
  if (at.hero_gradient) root.style.setProperty('--bp-hero-gradient', at.hero_gradient);
  if (at.section_divider) root.style.setProperty('--bp-section-divider', at.section_divider);

  // Spacing tokens
  if (sp.unit) root.style.setProperty('--bp-spacing-unit', `${sp.unit}px`);
  if (sp.section_y) root.style.setProperty('--bp-section-y', sp.section_y);
  if (sp.section_x) root.style.setProperty('--bp-section-x', sp.section_x);
  if (sp.gutter) root.style.setProperty('--bp-gutter', sp.gutter);
  if (sp.max_width) root.style.setProperty('--bp-max-width', sp.max_width);
  if (sp.stack_tight) root.style.setProperty('--bp-stack-tight', sp.stack_tight);
  if (sp.stack_default) root.style.setProperty('--bp-stack-default', sp.stack_default);
  if (sp.stack_loose) root.style.setProperty('--bp-stack-loose', sp.stack_loose);
  if (sp.stack_editorial) root.style.setProperty('--bp-stack-editorial', sp.stack_editorial);
  const densityClass = { compact: 'density-compact', comfortable: 'density-comfortable', spacious: 'density-spacious' };
  document.body.classList.remove('density-compact', 'density-comfortable', 'density-spacious');
  document.body.classList.add(densityClass[sp.scale] || 'density-comfortable');

  // Cursor mode
  document.body.classList.remove('cursor-default', 'cursor-refined');
  document.body.classList.add(`cursor-${cp.cursor_style || 'refined'}`);
};

const interpolate = (template, vars) => {
  if (!template || !vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
};

export const BlueprintProvider = ({ children }) => {
  const { user } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [navigation, setNavigation] = useState(null);
  const [dashboardConfig, setDashboardConfig] = useState(null);
  const [modules, setModules] = useState(null);
  const [featureFlags, setFeatureFlags] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [impersonating, setImpersonating] = useState(() => sessionStorage.getItem(IMPERSONATE_KEY));
  const [locale, setLocaleState] = useState(detectInitialLocale());
  const [messages, setMessages] = useState({});
  const [availableLocales, setAvailableLocales] = useState(FALLBACK_LOCALES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/blueprint/i18n`)
      .then((r) => setAvailableLocales(r.data.locales || FALLBACK_LOCALES))
      .catch(() => {});
  }, []);

  const loadMessages = useCallback(async (loc, slug) => {
    try {
      const params = slug ? `?tenant_slug=${encodeURIComponent(slug)}` : '';
      const { data } = await axios.get(`${BACKEND_URL}/api/blueprint/i18n/${loc}${params}`);
      setMessages(data.messages || {});
    } catch (_) { setMessages({}); }
  }, []);

  // Load tenant/modules/flags/permissions on user change OR impersonation change
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setTenant(null); setNavigation(null); setDashboardConfig(null);
        setModules(null); setFeatureFlags(null); setPermissions([]); setIsSuperAdmin(false);
        await loadMessages(locale, null);
        setLoading(false);
        return;
      }
      const results = await Promise.allSettled([
        api.get('/api/blueprint/tenant/me'),
        api.get('/api/blueprint/navigation'),
        api.get('/api/blueprint/dashboard'),
        api.get('/api/blueprint/modules'),
        api.get('/api/blueprint/feature-flags'),
        api.get('/api/blueprint/me/permissions'),
      ]);
      if (cancelled) return;
      const [tRes, nRes, dRes, mRes, fRes, pRes] = results;
      let tData = null;
      if (tRes.status === 'fulfilled') {
        tData = tRes.value.data;
        setTenant(tData);
        applyTheme(tData?.theme);
        if (!localStorage.getItem(LOCALE_KEY) && tData?.locales?.default) {
          setLocaleState(tData.locales.default);
        }
      }
      if (nRes.status === 'fulfilled') setNavigation(nRes.value.data);
      if (dRes.status === 'fulfilled') setDashboardConfig(dRes.value.data);
      if (mRes.status === 'fulfilled') setModules(mRes.value.data);
      if (fRes.status === 'fulfilled') setFeatureFlags(fRes.value.data);
      if (pRes.status === 'fulfilled') {
        setPermissions(pRes.value.data.permissions || []);
        setIsSuperAdmin(!!pRes.value.data.is_super_admin);
      }
      await loadMessages(locale, tData?.slug);
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.tenant_id, user?.profile_id, impersonating]);

  useEffect(() => { loadMessages(locale, tenant?.slug); }, [locale, tenant?.slug, loadMessages]);

  const setLocale = useCallback((newLocale) => {
    localStorage.setItem(LOCALE_KEY, newLocale);
    setLocaleState(newLocale);
  }, []);

  const startImpersonation = useCallback((tenantId) => {
    sessionStorage.setItem(IMPERSONATE_KEY, tenantId);
    setImpersonating(tenantId);
  }, []);

  const stopImpersonation = useCallback(() => {
    sessionStorage.removeItem(IMPERSONATE_KEY);
    setImpersonating(null);
  }, []);

  const t = useCallback((key, vars, fallback) => {
    const value = messages[key];
    if (value === undefined) return interpolate(fallback || key, vars);
    return interpolate(value, vars);
  }, [messages]);

  const can = useCallback((perm) => permissions.includes(perm), [permissions]);

  const enabledModuleIds = useMemo(() => new Set(modules?.modules?.map((m) => m.id) || []), [modules]);
  const isModuleEnabled = useCallback((id) => enabledModuleIds.has(id), [enabledModuleIds]);

  const value = useMemo(() => ({
    tenant, navigation, dashboardConfig, modules, featureFlags,
    permissions, isSuperAdmin, can, isModuleEnabled,
    impersonating, startImpersonation, stopImpersonation,
    locale, setLocale, availableLocales, messages, t, loading,
  }), [tenant, navigation, dashboardConfig, modules, featureFlags,
       permissions, isSuperAdmin, can, isModuleEnabled,
       impersonating, startImpersonation, stopImpersonation,
       locale, setLocale, availableLocales, messages, t, loading]);

  return <BlueprintContext.Provider value={value}>{children}</BlueprintContext.Provider>;
};

export const useBlueprint = () => {
  const ctx = useContext(BlueprintContext);
  if (!ctx) throw new Error('useBlueprint must be inside BlueprintProvider');
  return ctx;
};

export const useT = () => {
  const { t } = useBlueprint();
  return t;
};

export default BlueprintContext;
