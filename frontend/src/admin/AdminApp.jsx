import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { adminAuth, adminApi } from './adminApi';

import BlueprintApp from './BlueprintApp';
import CommandCenterApp from './CommandCenterApp';
import FounderWelcome from './pages/FounderWelcome';
import AccessRecoveryModal from './components/AccessRecoveryModal';

const Field = ({ label, value, onChange, testid, type = 'text', autoComplete }) => (
  <label className="block">
    <span style={{ display: 'block', fontFamily: 'Montserrat, sans-serif', fontSize: '0.65rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>
      {label}
    </span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
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
  const [modal, setModal]       = useState(null); // null | 'forgot' | 'magic_link' | 'resend' | 'recovery'

  const submitJwt = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const data = await adminAuth.login(email, password, tenantSlug);
      if (data?.requires_tenant_selection) setTenants(data.tenants || []);
      else if (data?.token) onSuccess(data);
    } catch (e2) {
      const s = e2?.response?.status;
      if (s === 423)      setErr('Troppi tentativi falliti. Riprova fra 15 minuti.');
      else if (s === 401) setErr('Credenziali non valide.');
      else                setErr('Errore di connessione.');
    } finally { setBusy(false); }
  };

  const linkStyle = {
    background: 'transparent', border: 'none',
    color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', fontSize: '0.78rem',
    padding: 0, textDecoration: 'underline', textUnderlineOffset: 4,
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0A0B' }} data-testid="admin-login">
      <div style={{ width: 460, padding: '2.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 }}>
        <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.66rem', letterSpacing: '0.32em', textTransform: 'uppercase', color: '#00C9B3', marginBottom: '0.75rem' }}
           data-testid="admin-login-eyebrow">
          {workspaceLabel}
        </p>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem', color: '#FFFFFF', lineHeight: 1.1, marginBottom: '2rem' }}>
          Accedi al tuo workspace
        </h1>

        <form onSubmit={submitJwt} className="space-y-5">
          <Field label="Email"    value={email}    onChange={setEmail}    testid="admin-email"    type="email"    autoComplete="email" />
          <Field label="Password" value={password} onChange={setPassword} testid="admin-password" type="password" autoComplete="current-password" />

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

        {/* P0-B Secondary CTAs — 4 self-service flows, anti-enumeration */}
        <div style={{
          marginTop: '1.6rem', display: 'flex', flexDirection: 'column',
          gap: 12, paddingTop: '1.4rem',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <button type="button" data-testid="cta-forgot-password"
            onClick={() => setModal('forgot')} style={linkStyle}>
            Password dimenticata?
          </button>
          <button type="button" data-testid="cta-magic-link"
            onClick={() => setModal('magic_link')} style={linkStyle}>
            Ricevi un Magic Link
          </button>
          <button type="button" data-testid="cta-resend-invite"
            onClick={() => setModal('resend')} style={linkStyle}>
            Reinvia invito (per Founder appena attivati)
          </button>
          <button type="button" data-testid="cta-workspace-recovery"
            onClick={() => setModal('recovery')} style={linkStyle}>
            Non trovi il tuo workspace?
          </button>
        </div>
      </div>
      {modal && (
        <AccessRecoveryModal kind={modal} onClose={() => setModal(null)} />
      )}
    </div>
  );
};

/**
 * AuthGate — wraps any workspace surface with the login modal when the
 * caller has no valid admin session.
 *
 * After a successful login, AuthGate enforces the role-correct landing:
 *   • admin/editor → /command-center/overview
 *   • advisor      → /command-center/advisor-console
 *   • owner        → /command-center/welcome (cinematic) then /blueprint
 * If the user is ALREADY logged in but landed on the wrong workspace
 * (e.g. a Founder loading /command-center/overview), AuthGate redirects
 * them to their `redirect_url` from /auth/me.
 */
const AuthGate = ({ workspaceLabel, allowedRoles, children }) => {
  const [authed, setAuthed]     = useState(false);
  const [checking, setChecking] = useState(true);
  const [me, setMe]             = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    adminApi.whoami()
      .then((r) => { setMe(r.data); setAuthed(true); })
      .catch(() => setAuthed(false))
      .finally(() => setChecking(false));
  }, []);

  // P0-G enforcement: redirect to role-correct surface if user landed
  // on a workspace they shouldn't see.
  useEffect(() => {
    if (!authed || !me || !allowedRoles) return;
    const role = (me.role || '').toLowerCase();
    if (!allowedRoles.includes(role)) {
      const target = role === 'owner'   ? '/command-center/welcome'
                    : role === 'advisor' ? '/command-center/advisor-console'
                    : '/command-center/overview';
      if (location.pathname !== target) navigate(target, { replace: true });
    }
  }, [authed, me, allowedRoles, location.pathname, navigate]);

  const onLoginSuccess = (data) => {
    setAuthed(true);
    setMe(data?.user || null);
    if (data?.redirect_url && data.redirect_url !== location.pathname) {
      navigate(data.redirect_url, { replace: true });
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0A0B' }}>
        <div className="w-8 h-8 border border-[#00C9B3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!authed) return <AdminLogin workspaceLabel={workspaceLabel} onSuccess={onLoginSuccess} />;
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
    <Route path="welcome" element={
      <AuthGate workspaceLabel="MOOD · Founder"
                allowedRoles={['owner']}>
        <FounderWelcome />
      </AuthGate>
    } />
    <Route path="*" element={
      <AuthGate workspaceLabel="MOOD · Command Center"
                allowedRoles={['admin', 'editor', 'advisor']}>
        <CommandCenterApp />
      </AuthGate>
    } />
  </Routes>
);

export const BlueprintRoot = () => (
  <AuthGate workspaceLabel="Blueprint · Tenant"
            allowedRoles={['admin', 'editor', 'owner']}>
    <BlueprintApp />
  </AuthGate>
);
