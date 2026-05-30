import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { adminAuth, adminApi } from './adminApi';

import BlueprintApp from './BlueprintApp';
import CommandCenterApp from './CommandCenterApp';
import FounderWelcome from './pages/FounderWelcome';

const Field = ({ label, value, onChange, testid, type = 'text' }) => (
  <label className="block">
    <span style={{ display: 'block', fontFamily: 'Montserrat, sans-serif', fontSize: '0.65rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>
      {label}
    </span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%', background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
        padding: '0.75rem 0.9rem', color: '#FFFFFF', fontSize: '0.92rem', outline: 'none',
      }}
      onFocus={(e) => (e.target.style.borderColor = '#00C9B3')}
      onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
      data-testid={testid}
    />
  </label>
);

const AdminLogin = ({ workspaceLabel = 'Command Center', onSuccess }) => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [tenants, setTenants]   = useState(null);
  const [tenantSlug, setTenantSlug] = useState(null);
  const [err, setErr]           = useState(null);
  const [busy, setBusy]         = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [tenant, setTenant]     = useState(adminAuth.getTenant());
  const [key, setKey]           = useState(adminAuth.getKey());

  const submitJwt = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const data = await adminAuth.login(email, password, tenantSlug);
      if (data?.requires_tenant_selection) setTenants(data.tenants || []);
      else if (data?.token) onSuccess();
    } catch (e2) {
      const s = e2?.response?.status;
      if (s === 423)      setErr('Troppi tentativi falliti. Riprova fra 15 minuti.');
      else if (s === 401) setErr('Credenziali non valide.');
      else                setErr('Errore di connessione.');
    } finally { setBusy(false); }
  };

  const submitLegacy = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    adminAuth.setKey(key);
    adminAuth.setTenant(tenant);
    try {
      await adminApi.whoami();
      onSuccess();
    } catch (e2) {
      setErr(e2?.response?.status === 401 ? 'Chiave non valida' : 'Errore di connessione');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0A0B' }} data-testid="admin-login">
      <div style={{ width: 460, padding: '2.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 }}>
        <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.66rem', letterSpacing: '0.32em', textTransform: 'uppercase', color: '#00C9B3', marginBottom: '0.75rem' }}
           data-testid="admin-login-eyebrow">
          {workspaceLabel}
        </p>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem', color: '#FFFFFF', lineHeight: 1.1, marginBottom: '2rem' }}>
          Accesso amministratore
        </h1>

        <form onSubmit={submitJwt} className="space-y-5">
          <Field label="Email" value={email} onChange={setEmail} testid="admin-email" type="email" />
          <Field label="Password" value={password} onChange={setPassword} testid="admin-password" type="password" />

          {tenants && tenants.length > 0 && (
            <div data-testid="admin-tenant-picker">
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.66rem', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                Seleziona il tenant
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tenants.map((t) => (
                  <button key={t.slug} type="button" data-testid={`tenant-pick-${t.slug}`}
                    onClick={() => setTenantSlug(t.slug)}
                    style={{
                      background: tenantSlug === t.slug ? 'rgba(0,201,179,0.07)' : 'transparent',
                      border: `1px solid ${tenantSlug === t.slug ? 'rgba(0,201,179,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      color: '#FFF', padding: '0.6rem 0.9rem', borderRadius: 6,
                      cursor: 'pointer', textAlign: 'left',
                      fontFamily: 'Inter, sans-serif', fontSize: '0.85rem',
                    }}>
                    {t.name} <span style={{ color: 'rgba(255,255,255,0.4)' }}>· {t.slug}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {err && <p style={{ color: '#FFB4A2', fontSize: '0.8rem' }} data-testid="admin-error">{err}</p>}

          <button type="submit" disabled={busy} className="btn-pill-teal" style={{ width: '100%', padding: '0.9rem 1.2rem', fontSize: '0.78rem', opacity: busy ? 0.6 : 1 }} data-testid="admin-submit">
            {busy ? '…' : 'Entra'}
          </button>
        </form>

        <button type="button" onClick={() => setAdvanced((v) => !v)} data-testid="admin-toggle-advanced"
          style={{
            marginTop: '1.4rem', background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat, sans-serif',
            fontSize: '0.66rem', letterSpacing: '0.24em', textTransform: 'uppercase',
            cursor: 'pointer', padding: 0,
          }}>
          {advanced ? '— Nascondi accesso legacy' : '+ Accesso legacy (X-Admin-Key)'}
        </button>

        {advanced && (
          <form onSubmit={submitLegacy} className="space-y-4" style={{ marginTop: '1rem' }}>
            <Field label="Tenant slug" value={tenant} onChange={setTenant} testid="admin-tenant" />
            <Field label="Admin key" value={key} onChange={setKey} testid="admin-key" type="password" />
            <button type="submit" disabled={busy} style={{
              width: '100%', padding: '0.7rem 1rem',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
              color: '#FFF', borderRadius: 999, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', fontSize: '0.75rem',
              letterSpacing: '0.18em', textTransform: 'uppercase',
              opacity: busy ? 0.6 : 1,
            }} data-testid="admin-submit-legacy">
              {busy ? '…' : 'Entra con chiave'}
            </button>
            <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
              In produzione <code>ADMIN_API_KEY</code> non è configurata. Usa email + password.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

/**
 * AuthGate — wraps any workspace surface with the login modal when the
 * caller has no valid admin session.
 */
const AuthGate = ({ workspaceLabel, children }) => {
  const [authed, setAuthed]     = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    adminApi.whoami()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0A0B' }}>
        <div className="w-8 h-8 border border-[#00C9B3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!authed) return <AdminLogin workspaceLabel={workspaceLabel} onSuccess={() => setAuthed(true)} />;
  return children;
};

/**
 * LegacyAdminRedirect — keeps every bookmarked /admin/... URL working
 * by mapping it onto the new /command-center namespace. Specific path
 * mappings translate every old Blueprint sub-path to the corresponding
 * /command-center entry (super admin's unified workspace), the MOOD
 * Core ones to /command-center, and the founder Welcome to its
 * full-bleed route. Tail + query string are preserved.
 */
const LegacyAdminRedirect = () => {
  const location = useLocation();
  const path = location.pathname.replace(/^\/admin/, '') || '/';
  const search = location.search || '';

  // Founder cinematic landing
  if (path === '/welcome' || path === '/welcome/') {
    return <Navigate to={`/command-center/welcome${search}`} replace />;
  }

  // CMS surfaces — now lived inside Command Center for the super admin.
  const CMS_PATHS = ['/pages', '/blocks', '/sections', '/media', '/footer', '/seo', '/publish'];
  for (const p of CMS_PATHS) {
    if (path === p || path.startsWith(p + '/')) {
      return <Navigate to={`/command-center${path}${search}`} replace />;
    }
  }

  // MOOD Core surfaces (advisor + studio requests + advisors mgmt)
  const COMMAND_PATHS = ['/advisor-console', '/studio-requests', '/advisors', '/overview'];
  for (const p of COMMAND_PATHS) {
    if (path === p || path.startsWith(p + '/')) {
      return <Navigate to={`/command-center${path}${search}`} replace />;
    }
  }

  // Root /admin → Command Center (MOOD Core default surface)
  return <Navigate to={`/command-center${search}`} replace />;
};

/**
 * Default AdminApp export — mounted at /admin/* by App.js to keep
 * existing bookmarks working. Always redirects to the new namespaces.
 */
const AdminApp = () => <LegacyAdminRedirect />;

export default AdminApp;

// Named exports used directly from App.js to mount the two real shells.
export const CommandCenterRoot = () => (
  <Routes>
    <Route path="welcome" element={<AuthGate workspaceLabel="MOOD · Founder"><FounderWelcome /></AuthGate>} />
    <Route path="*"       element={<AuthGate workspaceLabel="MOOD · Command Center"><CommandCenterApp /></AuthGate>} />
  </Routes>
);

export const BlueprintRoot = () => (
  <AuthGate workspaceLabel="Blueprint · Tenant">
    <BlueprintApp />
  </AuthGate>
);
