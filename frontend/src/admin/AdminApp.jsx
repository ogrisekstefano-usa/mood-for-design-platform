import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { LogOut, FileText, Layout, Image, Settings as SettingsIcon, RefreshCw, ExternalLink, BookOpen, AlignEndHorizontal, Search, Building2, Compass } from 'lucide-react';
import { adminAuth, adminApi } from './adminApi';
import BlocksEditor from './pages/BlocksEditor';
import SectionsManager from './pages/SectionsManager';
import MediaLibrary from './pages/MediaLibrary';
import PublishConsole from './pages/PublishConsole';
import PagesEditor from './pages/PagesEditor';
import FooterEditor from './pages/FooterEditor';
import SearchConsoleHelper from './pages/SearchConsoleHelper';
import StudioRequestsAdmin from './pages/StudioRequestsAdmin';
import AdvisorConsole from './pages/AdvisorConsole';
import RelationDetail from './pages/RelationDetail';

const AdminLogin = ({ onSuccess }) => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [tenants, setTenants]   = useState(null);  // array if backend returns picker
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
      if (data?.requires_tenant_selection) {
        setTenants(data.tenants || []);
      } else if (data?.token) {
        onSuccess();
      }
    } catch (e2) {
      const s = e2?.response?.status;
      if (s === 423)      setErr('Troppi tentativi falliti. Riprova fra 15 minuti.');
      else if (s === 401) setErr('Credenziali non valide.');
      else                setErr('Errore di connessione.');
    } finally {
      setBusy(false);
    }
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
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0A0B' }} data-testid="admin-login">
      <div style={{ width: 460, padding: '2.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 }}>
        <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.66rem', letterSpacing: '0.32em', textTransform: 'uppercase', color: '#00C9B3', marginBottom: '0.75rem' }}>
          Blueprint Command Center
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

const NavItem = ({ to, icon: Icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
    style={({ isActive }) => ({
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.65rem 0.9rem', borderRadius: 8,
      color: isActive ? '#00C9B3' : 'rgba(255,255,255,0.75)',
      background: isActive ? 'rgba(0,201,179,0.08)' : 'transparent',
      fontFamily: 'Montserrat, sans-serif', fontSize: '0.82rem', fontWeight: 500,
      letterSpacing: '0.04em', textDecoration: 'none',
      transition: 'all 0.2s',
    })}
    data-testid={`admin-nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
  >
    <Icon size={16} strokeWidth={1.6} /> {label}
  </NavLink>
);

const AdminShell = ({ children }) => {
  const nav = useNavigate();
  const location = useLocation();
  const logout = () => { adminAuth.clear(); nav('/admin'); window.location.reload(); };
  const refresh = async () => { try { await adminApi.invalidate(); window.alert('Cache cleared'); } catch {} };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0A0A0B', color: '#FFFFFF' }}>
      <aside style={{
        width: 260, padding: '2rem 1rem', borderRight: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', background: '#0A0A0B',
      }}>
        <div style={{ padding: '0 0.5rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.6rem', letterSpacing: '0.32em', textTransform: 'uppercase', color: '#00C9B3' }}>
            Blueprint
          </p>
          <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.2rem', color: '#FFFFFF', marginTop: 2 }}>
            Command Center
          </p>
        </div>

        <nav className="space-y-1 mt-6">
          <NavItem to="/admin/pages"    icon={BookOpen}     label="Pagine" />
          <NavItem to="/admin/blocks"   icon={FileText}     label="Editorial Blocks" />
          <NavItem to="/admin/sections" icon={Layout}       label="Sections" />
          <NavItem to="/admin/media"    icon={Image}        label="Media Library" />
          <NavItem to="/admin/footer"   icon={AlignEndHorizontal} label="Footer" />
          <NavItem to="/admin/advisor-console" icon={Compass}  label="Advisor Console" />
          <NavItem to="/admin/studio-requests" icon={Building2} label="Studio Requests" />
          <NavItem to="/admin/seo"      icon={Search}       label="SEO & Indexing" />
          <NavItem to="/admin/publish"  icon={SettingsIcon} label="Publishing" />
        </nav>

        <div style={{ position: 'absolute', bottom: '2rem', left: '1rem', right: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <a href="/" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', textDecoration: 'none', padding: '0.5rem 0.6rem' }} data-testid="admin-view-site">
            <ExternalLink size={14} /> View site
          </a>
          <button onClick={refresh} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem 0.6rem', textAlign: 'left' }} data-testid="admin-refresh-cache">
            <RefreshCw size={14} /> Clear cache
          </button>
          <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,180,162,0.7)', fontSize: '0.78rem', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem 0.6rem', textAlign: 'left' }} data-testid="admin-logout">
            <LogOut size={14} /> Logout
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0 }} data-testid="admin-main">
        <div style={{ padding: (location?.pathname === '/admin/pages' || location?.pathname?.startsWith('/admin/advisor-console')) ? 0 : '2.5rem 3rem' }}>
          {children}
        </div>
      </main>
    </div>
  );
};

const AdminApp = () => {
  const [authed, setAuthed]   = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const k = adminAuth.getKey();
    // Even with empty key, backend allows in dev mode if ADMIN_API_KEY isn't set
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

  if (!authed) {
    return <AdminLogin onSuccess={() => setAuthed(true)} />;
  }

  return (
    <AdminShell>
      <Routes>
        <Route index            element={<Navigate to="/admin/pages" replace />} />
        <Route path="pages"     element={<PagesEditor />} />
        <Route path="blocks"    element={<BlocksEditor />} />
        <Route path="sections"  element={<SectionsManager />} />
        <Route path="media"     element={<MediaLibrary />} />
        <Route path="footer"          element={<FooterEditor />} />
        <Route path="studio-requests" element={<StudioRequestsAdmin />} />
        <Route path="advisor-console" element={<AdvisorConsole />} />
        <Route path="advisor-console/relations/:id" element={<RelationDetail />} />
        <Route path="seo"             element={<SearchConsoleHelper />} />
        <Route path="publish"   element={<PublishConsole />} />
        <Route path="*"         element={<Navigate to="/admin/pages" replace />} />
      </Routes>
    </AdminShell>
  );
};

export default AdminApp;
