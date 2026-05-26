import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { LogOut, FileText, Layout, Image, Settings as SettingsIcon, RefreshCw, ExternalLink, BookOpen, AlignEndHorizontal } from 'lucide-react';
import { adminAuth, adminApi } from './adminApi';
import BlocksEditor from './pages/BlocksEditor';
import SectionsManager from './pages/SectionsManager';
import MediaLibrary from './pages/MediaLibrary';
import PublishConsole from './pages/PublishConsole';
import PagesEditor from './pages/PagesEditor';
import FooterEditor from './pages/FooterEditor';

const AdminLogin = ({ onSuccess }) => {
  const [tenant, setTenant] = useState(adminAuth.getTenant());
  const [key, setKey]       = useState(adminAuth.getKey());
  const [err, setErr]       = useState(null);
  const [busy, setBusy]     = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    adminAuth.setKey(key);
    adminAuth.setTenant(tenant);
    try {
      await adminApi.whoami();
      onSuccess();
    } catch (e2) {
      setErr(e2?.response?.status === 401 ? 'Invalid admin key' : 'Connection error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0A0B' }} data-testid="admin-login">
      <div style={{ width: 420, padding: '2.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 }}>
        <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.66rem', letterSpacing: '0.32em', textTransform: 'uppercase', color: '#00C9B3', marginBottom: '0.75rem' }}>
          Blueprint Command Center
        </p>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem', color: '#FFFFFF', lineHeight: 1.1, marginBottom: '2rem' }}>
          Admin access
        </h1>
        <form onSubmit={submit} className="space-y-5">
          <Field label="Tenant slug" value={tenant} onChange={setTenant} testid="admin-tenant" />
          <Field label="Admin key"  value={key}    onChange={setKey}    testid="admin-key" type="password" />
          {err && <p style={{ color: '#FFB4A2', fontSize: '0.8rem' }} data-testid="admin-error">{err}</p>}
          <button type="submit" disabled={busy} className="btn-pill-teal" style={{ width: '100%', padding: '0.9rem 1.2rem', fontSize: '0.78rem', opacity: busy ? 0.6 : 1 }} data-testid="admin-submit">
            {busy ? '…' : 'Enter'}
          </button>
          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', fontFamily: 'Montserrat, sans-serif', lineHeight: 1.5 }}>
            Set <code>ADMIN_API_KEY</code> in backend .env. In dev mode without it, any key works.
          </p>
        </form>
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
        <div style={{ padding: location?.pathname === '/admin/pages' ? 0 : '2.5rem 3rem' }}>
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
        <Route path="footer"    element={<FooterEditor />} />
        <Route path="publish"   element={<PublishConsole />} />
        <Route path="*"         element={<Navigate to="/admin/pages" replace />} />
      </Routes>
    </AdminShell>
  );
};

export default AdminApp;
