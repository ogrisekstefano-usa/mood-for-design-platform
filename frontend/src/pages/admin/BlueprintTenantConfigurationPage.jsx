/**
 * ITER144 · Blueprint Tenant Configuration™
 *
 * /admin/tenant-configuration · ROOT SUPERADMIN only.
 *
 * Cinematic black-glass governance surface that lets root operators:
 *   1. flip platform default state of any module (enabled / disabled /
 *      beta / hidden / locked)
 *   2. inspect the live navigation tree
 *   3. audit recent configuration_change_events
 *
 * Pure runtime-driven. Reads from /api/blueprint-admin/feature-modules,
 * patches via /api/blueprint-admin/feature-modules/{code}.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import api from '../../lib/api';
import { useTenantConfiguration } from '../../contexts/TenantConfigurationContext';

const STATE_STYLES = {
  enabled:  { color: 'var(--atelier-cyan)',    glow: '0 0 0 1px rgba(124,228,245,0.45)' },
  beta:     { color: '#f4c97a',                 glow: '0 0 0 1px rgba(244,201,122,0.45)' },
  hidden:   { color: '#9ca3af',                 glow: '0 0 0 1px rgba(156,163,175,0.45)' },
  disabled: { color: '#ef6b6b',                 glow: '0 0 0 1px rgba(239,107,107,0.45)' },
  locked:   { color: '#c084fc',                 glow: '0 0 0 1px rgba(192,132,252,0.45)' },
};
const STATES = ['enabled', 'beta', 'hidden', 'disabled', 'locked'];

const StatePill = ({ state, onClick, current }) => {
  const s = STATE_STYLES[state] || STATE_STYLES.enabled;
  const active = current === state;
  return (
    <button
      type="button" onClick={onClick}
      data-testid={`module-state-${state}`}
      style={{
        padding: '5px 12px',
        fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase',
        fontFamily: 'var(--atelier-mono)',
        background: active ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: `1px solid ${active ? s.color : 'rgba(255,255,255,0.08)'}`,
        color: active ? s.color : 'rgba(255,255,255,0.45)',
        borderRadius: 999, cursor: 'pointer',
        boxShadow: active ? s.glow : 'none',
        transition: 'all 200ms var(--bp-ease-cinema)',
      }}>
      {state}
    </button>
  );
};

const BlueprintTenantConfigurationPage = () => {
  const { refresh } = useTenantConfiguration();
  const [modules, setModules] = useState([]);
  const [defaults, setDefaults] = useState({});
  const [events, setEvents] = useState([]);
  const [navigationPreview, setNavigationPreview] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mod, evs, me] = await Promise.all([
        api.get('/api/blueprint-admin/feature-modules'),
        api.get('/api/blueprint-admin/configuration-events?limit=50'),
        api.get('/api/tenant/configuration'),
      ]);
      setModules(mod.data.modules || []);
      const map = {};
      (mod.data.platform_defaults || []).forEach((d) => { map[d.module_code] = d.state; });
      setDefaults(map);
      setEvents(evs.data.events || []);
      setNavigationPreview(me.data?.navigation || []);
    } catch (e) {
      toast.error('Failed to load Blueprint governance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patchModule = async (code, state) => {
    try {
      await api.patch(`/api/blueprint-admin/feature-modules/${code}`, { state });
      toast.success(`${code} · ${state.toUpperCase()}`);
      // Refresh registry + current-tenant bundle so the sidebar reacts immediately
      await Promise.all([load(), refresh()]);
      // ITER144.1 · broadcast cross-page invalidation so the
      // TenantConfigurationProvider re-fetches on the next focus too.
      window.dispatchEvent(new CustomEvent('mfd:tenant-configuration:changed'));
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'patch failed');
    }
  };

  const categories = useMemo(() => {
    const set = new Set(['all']);
    modules.forEach((m) => set.add(m.category));
    return Array.from(set);
  }, [modules]);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return modules;
    return modules.filter((m) => m.category === activeCategory);
  }, [modules, activeCategory]);

  const styles = {
    page:    { padding: '40px 56px 80px', color: 'var(--bp-text-headline)' },
    eyebrow: { fontFamily: 'var(--atelier-mono)', fontSize: 10,
               letterSpacing: '0.32em', textTransform: 'uppercase',
               color: 'var(--atelier-cyan)', marginBottom: 8 },
    title:   { fontFamily: 'var(--atelier-serif)', fontStyle: 'italic',
               fontSize: 38, fontWeight: 400, letterSpacing: '-0.02em',
               color: '#f5f7fa', margin: 0 },
    lede:    { color: 'var(--bp-text-soft)', fontSize: 14, lineHeight: 1.6,
               maxWidth: 580, marginTop: 12 },
    section: { marginTop: 48 },
    sectionLabel: { fontFamily: 'var(--atelier-mono)', fontSize: 10,
                    letterSpacing: '0.30em', textTransform: 'uppercase',
                    color: 'var(--bp-text-faint)', marginBottom: 18 },
    chip:    (active) => ({
               padding: '5px 14px', fontSize: 10, letterSpacing: '0.22em',
               textTransform: 'uppercase', fontFamily: 'var(--atelier-mono)',
               background: active ? 'rgba(124,228,245,0.08)' : 'transparent',
               border: `1px solid ${active ? 'var(--atelier-cyan)' : 'rgba(255,255,255,0.08)'}`,
               color: active ? 'var(--atelier-cyan)' : 'rgba(255,255,255,0.55)',
               borderRadius: 999, cursor: 'pointer',
               transition: 'all 200ms var(--bp-ease-cinema)',
             }),
    moduleRow: { display: 'grid',
                 gridTemplateColumns: 'minmax(220px,1fr) auto auto',
                 alignItems: 'center', gap: 24,
                 padding: '18px 0',
                 borderTop: '1px solid rgba(255,255,255,0.04)' },
    moduleName: { fontFamily: 'var(--atelier-serif)', fontStyle: 'italic',
                  fontSize: 18, color: '#f5f7fa' },
    moduleMeta: { fontFamily: 'var(--atelier-mono)', fontSize: 10,
                  letterSpacing: '0.24em', textTransform: 'uppercase',
                  color: 'var(--bp-text-faint)' },
  };

  return (
    <div data-testid="tenant-configuration-governance" style={styles.page}>
      <div style={styles.eyebrow}>BLUEPRINT GOVERNANCE™ · ITER144</div>
      <h1 style={styles.title}>Configuration Foundation.</h1>
      <p style={styles.lede}>
        Una sola codebase. N tenant. N configurazioni. Da qui orchestri i
        moduli, accendi i pacchetti beta, congeli i flussi sensibili.
        Ogni modifica è loggata.
      </p>

      {/* Category filter */}
      <div style={{ ...styles.section, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {categories.map((c) => (
          <button key={c} data-testid={`category-filter-${c}`}
                  onClick={() => setActiveCategory(c)}
                  style={styles.chip(activeCategory === c)}>{c}</button>
        ))}
      </div>

      {/* Module governance */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>Module Registry · Platform Defaults</div>
        {loading && (
          <div data-testid="modules-loading"
               style={{ color: 'var(--bp-text-faint)', padding: '32px 0',
                        fontStyle: 'italic', fontFamily: 'var(--atelier-serif)' }}>
            Loading…
          </div>
        )}
        {!loading && filtered.map((m) => {
          const current = defaults[m.code] || m.default_state;
          return (
            <div key={m.code} data-testid={`module-row-${m.code}`} style={styles.moduleRow}>
              <div>
                <div style={styles.moduleName}>
                  {m.display_name}
                  {m.is_core && (
                    <span style={{ marginLeft: 12, ...styles.moduleMeta,
                                   color: 'var(--atelier-cyan)' }}>core</span>
                  )}
                </div>
                <div style={{ ...styles.moduleMeta, marginTop: 6 }}>
                  <span style={{ marginRight: 16 }}>{m.code}</span>
                  <span style={{ marginRight: 16 }}>{m.category}</span>
                  <span style={{ marginRight: 16 }}>{m.nav_visibility}</span>
                  {m.nav_route && <span>{m.nav_route}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STATES.map((s) => (
                  <StatePill key={s} state={s} current={current}
                             onClick={() => patchModule(m.code, s)} />
                ))}
              </div>
              <div style={{ ...styles.moduleMeta, minWidth: 72, textAlign: 'right' }}>
                {defaults[m.code] ? 'override' : 'default'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live navigation preview */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>Live Navigation Preview · root view</div>
        <div data-testid="navigation-preview"
             style={{
               border: '1px solid rgba(255,255,255,0.06)',
               background: 'rgba(255,255,255,0.015)',
               borderRadius: 14, padding: '20px 24px',
               display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))',
               gap: 24,
             }}>
          {navigationPreview.map((g) => (
            <div key={g.code}>
              <div style={{ ...styles.moduleMeta, marginBottom: 8 }}>{g.label}</div>
              {g.items.map((i) => {
                const Icon = Icons[i.icon] || Icons.Circle;
                return (
                  <div key={i.code} data-testid={`nav-preview-${i.code}`}
                       style={{ display: 'flex', alignItems: 'center', gap: 10,
                                fontSize: 13, padding: '4px 0',
                                color: i.state === 'beta'
                                  ? '#f4c97a' : 'var(--bp-text-soft)' }}>
                    <Icon size={13} strokeWidth={1.5} />
                    <span style={{ fontFamily: 'var(--atelier-serif)',
                                    fontStyle: 'italic' }}>{i.label}</span>
                    {i.state !== 'enabled' && (
                      <span style={{ ...styles.moduleMeta, marginLeft: 'auto',
                                      fontSize: 8.5 }}>{i.state}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Audit log */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>Configuration Audit Trail™ · last 50</div>
        <div data-testid="audit-feed"
             style={{ border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 14, overflow: 'hidden' }}>
          {events.length === 0 && (
            <div style={{ padding: 24, color: 'var(--bp-text-faint)',
                          fontStyle: 'italic',
                          fontFamily: 'var(--atelier-serif)' }}>
              Nessun evento registrato ancora.
            </div>
          )}
          {events.map((e) => (
            <div key={e.id} data-testid={`audit-event-${e.id}`}
                 style={{
                   display: 'grid',
                   gridTemplateColumns: '160px 220px minmax(180px,1fr) auto',
                   gap: 16, padding: '12px 20px',
                   borderTop: '1px solid rgba(255,255,255,0.03)',
                   fontSize: 12, color: 'var(--bp-text-soft)',
                 }}>
              <span style={{ fontFamily: 'var(--atelier-mono)', fontSize: 10,
                              color: 'var(--bp-text-faint)' }}>
                {new Date(e.created_at).toISOString().slice(0, 19).replace('T', ' ')}
              </span>
              <span style={{ fontFamily: 'var(--atelier-mono)', fontSize: 10,
                              letterSpacing: '0.16em',
                              color: 'var(--atelier-cyan)' }}>
                {e.event_type}
              </span>
              <span style={{ fontFamily: 'var(--atelier-serif)',
                              fontStyle: 'italic' }}>
                {e.actor_email || '—'}
                {e.module_code && (
                  <span style={{ marginLeft: 12, color: 'var(--bp-text-faint)',
                                  fontStyle: 'normal',
                                  fontFamily: 'var(--atelier-mono)',
                                  fontSize: 10 }}>{e.module_code}</span>
                )}
              </span>
              <span style={{ ...styles.moduleMeta, textAlign: 'right' }}>{e.source}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BlueprintTenantConfigurationPage;
