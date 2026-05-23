/**
 * ITER144 · Runtime Context Inspector™
 *
 * /admin/runtime-inspector · ROOT SUPERADMIN only.
 *
 * Critical debugging surface that surfaces, for the active runtime
 * resolution, every signal layered into the platform:
 *
 *  • Resolved subdomain + tenant + source (wildcard tenant runtime)
 *  • Branding source (tenant_runtime | tenant_legacy | platform_default)
 *  • Email identity source (tenant_runtime | tenant_legacy | platform)
 *  • Locale source + default + enabled set
 *  • Effective module state counts + resolution sources
 *  • Navigation tree size
 *  • Feature flags + nav overrides + custom domain
 */
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import api from '../../lib/api';

const Stat = ({ label, value, accent }) => (
  <div data-testid={`runtime-stat-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
    style={{
      padding: '14px 18px',
      borderTop: '1px solid rgba(255,255,255,0.04)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: 24,
    }}>
    <span style={{ fontFamily: 'var(--atelier-mono)', fontSize: 10,
                    letterSpacing: '0.24em', textTransform: 'uppercase',
                    color: 'var(--bp-text-faint)' }}>{label}</span>
    <span style={{ fontFamily: 'var(--atelier-serif)', fontStyle: 'italic',
                    fontSize: 15, color: accent || '#f5f7fa',
                    textAlign: 'right', maxWidth: '70%' }}>
      {value}
    </span>
  </div>
);

const Block = ({ title, eyebrow, children }) => (
  <section style={{ marginTop: 36 }}>
    <div style={{ fontFamily: 'var(--atelier-mono)', fontSize: 10,
                    letterSpacing: '0.32em', textTransform: 'uppercase',
                    color: 'var(--atelier-cyan)', marginBottom: 6 }}>
      {eyebrow}
    </div>
    <h2 style={{ fontFamily: 'var(--atelier-serif)', fontStyle: 'italic',
                  fontSize: 22, fontWeight: 400, color: '#f5f7fa',
                  margin: 0, marginBottom: 14 }}>
      {title}
    </h2>
    <div style={{ border: '1px solid rgba(255,255,255,0.05)',
                   background: 'rgba(255,255,255,0.015)',
                   borderRadius: 14 }}>
      {children}
    </div>
  </section>
);

const Json = ({ value }) => (
  <pre style={{
    background: 'transparent', padding: '14px 18px', margin: 0,
    fontFamily: 'var(--atelier-mono)', fontSize: 11,
    color: 'var(--bp-text-soft)',
    overflowX: 'auto', borderTop: '1px solid rgba(255,255,255,0.04)',
  }}>{JSON.stringify(value ?? {}, null, 2)}</pre>
);

const RuntimeInspectorPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/blueprint-admin/runtime-inspector');
      setData(data);
    } catch (e) {
      toast.error('Failed to load runtime inspector');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return (
      <div data-testid="runtime-inspector-loading"
           style={{ padding: 80, textAlign: 'center',
                    color: 'var(--bp-text-faint)',
                    fontFamily: 'var(--atelier-serif)',
                    fontStyle: 'italic' }}>
        Inspecting runtime…
      </div>
    );
  }

  if (!data) return null;

  const ri = data.resolved_runtime_identity || {};
  const brand = data.branding || {};
  const ident = data.email_identity || {};
  const mods = data.modules || {};
  const nav = data.navigation || {};

  const SOURCE_COLOR = {
    tenant_runtime:   'var(--atelier-cyan)',
    tenant_legacy:    '#f4c97a',
    platform:         '#9ca3af',
    platform_default: '#9ca3af',
  };

  return (
    <div data-testid="runtime-inspector"
         style={{ padding: '40px 56px 80px', color: '#f5f7fa' }}>
      <div style={{ fontFamily: 'var(--atelier-mono)', fontSize: 10,
                    letterSpacing: '0.32em', textTransform: 'uppercase',
                    color: 'var(--atelier-cyan)', marginBottom: 8 }}>
        BLUEPRINT GOVERNANCE™ · RUNTIME CONTEXT INSPECTOR™
      </div>
      <h1 style={{ fontFamily: 'var(--atelier-serif)', fontStyle: 'italic',
                    fontSize: 38, fontWeight: 400, letterSpacing: '-0.02em',
                    color: '#f5f7fa', margin: 0 }}>
        Where this runtime is breathing.
      </h1>
      <p style={{ color: 'var(--bp-text-soft)', fontSize: 14, lineHeight: 1.6,
                   maxWidth: 580, marginTop: 12 }}>
        Inspecta in tempo reale come la piattaforma sta risolvendo questo
        tenant: subdomain, branding, identità email, locale, moduli, override.
      </p>

      <button type="button" onClick={load}
              data-testid="runtime-inspector-refresh"
              style={{
                marginTop: 18, padding: '8px 18px',
                fontFamily: 'var(--atelier-mono)', fontSize: 10,
                letterSpacing: '0.26em', textTransform: 'uppercase',
                color: 'var(--atelier-cyan)',
                background: 'transparent',
                border: '1px solid var(--atelier-cyan)',
                borderRadius: 999, cursor: 'pointer',
              }}>
        <Icons.RefreshCw size={12} style={{ marginRight: 8, verticalAlign: -2 }} />
        Refresh
      </button>

      <Block eyebrow="Wildcard Tenant Runtime™"
             title="Resolved runtime identity">
        <Stat label="Tenant ID"          value={data.tenant_id || '—'} />
        <Stat label="Request Host"       value={ri.request_host || '—'} />
        <Stat label="Resolved Subdomain" value={ri.subdomain || '—'}
              accent={ri.subdomain ? 'var(--atelier-cyan)' : undefined} />
        <Stat label="Tenant Slug"        value={ri.tenant_slug || '—'} />
        <Stat label="Resolution Source"  value={ri.resolution_source || 'jwt_default'} />
      </Block>

      <Block eyebrow="Runtime Branding Continuity™"
             title="Branding source">
        <Stat label="Source"          value={brand.source}
              accent={SOURCE_COLOR[brand.source]} />
        <Stat label="Color Primary"   value={brand.tokens?.color_primary || '—'} />
        <Stat label="Color Secondary" value={brand.tokens?.color_secondary || '—'} />
        <Stat label="Font Heading"    value={brand.tokens?.font_heading || '—'} />
        <Stat label="Font Body"       value={brand.tokens?.font_body || '—'} />
        <Stat label="Monogram"        value={brand.tokens?.monogram || '—'} />
      </Block>

      <Block eyebrow="Email Identity Runtime™"
             title="Sender resolution">
        <Stat label="Source"        value={ident.source}
              accent={SOURCE_COLOR[ident.source]} />
        <Stat label="From Address"  value={ident.from_address || '—'} />
        <Stat label="Reply To"      value={ident.reply_to || '—'} />
        <Stat label="Support Email" value={ident.support_email || '—'} />
        <Stat label="Logo URL"      value={ident.logo_url || '—'} />
      </Block>

      <Block eyebrow="Locale source"
             title="Active locale resolution">
        <Stat label="Source"        value={data.locale?.source} />
        <Stat label="Default"       value={data.locale?.default || '—'} />
        <Stat label="Enabled"       value={(data.locale?.enabled || []).join(', ') || '—'} />
      </Block>

      <Block eyebrow="Modules · Navigation"
             title="Module state breakdown">
        <Stat label="Total modules"      value={mods.total} />
        <Stat label="State counts"
              value={Object.entries(mods.state_counts || {})
                .map(([k, v]) => `${k}:${v}`).join('  ·  ')} />
        <Stat label="Resolution sources"
              value={(mods.sources || []).join(', ')} />
        <Stat label="Navigation groups"  value={nav.groups} />
        <Stat label="Navigation items"   value={nav.items} />
      </Block>

      <Block eyebrow="Overrides snapshot"
             title="Per-tenant overrides">
        <Json value={{
          feature_flags:        data.feature_flags,
          enabled_modules:      data.enabled_modules,
          navigation_overrides: data.navigation_overrides,
          custom_domain:        data.custom_domain,
        }} />
      </Block>
    </div>
  );
};

export default RuntimeInspectorPage;
