import React, { useState } from 'react';
import { adminApi } from '../adminApi';
import { Header } from './BlocksEditor';
import { Globe, GlobeLock, RefreshCw } from 'lucide-react';

const PublishConsole = () => {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);

  const run = async (fn, label) => {
    setBusy(true); setLast(null);
    try {
      const r = await fn();
      setLast({ ok: true, msg: `${label}: ${JSON.stringify(r.data)}` });
    } catch (e) {
      setLast({ ok: false, msg: `${label} failed: ${e?.response?.data?.detail || e.message}` });
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="publish-console">
      <Header title="Publishing" subtitle="Page-level status, cache invalidation. Granular preview/draft workflow lands in Phase E." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
        <Card title="Publish homepage" desc="Make the latest sections live." icon={Globe}
              onClick={() => run(() => adminApi.publish('home'), 'publish:home')}
              testid="publish-home" />
        <Card title="Unpublish homepage" desc="Hide the page from the public." icon={GlobeLock}
              onClick={() => run(() => adminApi.unpublish('home'), 'unpublish:home')}
              testid="unpublish-home" />
        <Card title="Invalidate cache" desc="Force-refresh all /api/site/* responses." icon={RefreshCw}
              onClick={() => run(() => adminApi.invalidate(), 'cache:invalidate')}
              testid="cache-invalidate" />
      </div>

      {last && (
        <div style={{ marginTop: '2rem', padding: '1rem 1.2rem', borderRadius: 8, background: last.ok ? 'rgba(0,201,179,0.08)' : 'rgba(255,180,162,0.08)', border: `1px solid ${last.ok ? 'rgba(0,201,179,0.3)' : 'rgba(255,180,162,0.3)'}`, color: last.ok ? '#00C9B3' : '#FFB4A2', fontSize: '0.8rem', fontFamily: 'Montserrat, sans-serif' }} data-testid="publish-result">
          {last.msg}
        </div>
      )}

      {busy && <p style={{ marginTop: '1rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Working…</p>}
    </div>
  );
};

const Card = ({ title, desc, icon: Icon, onClick, testid }) => (
  <button
    onClick={onClick}
    style={{
      textAlign: 'left', background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '1.5rem',
      cursor: 'pointer', color: '#FFFFFF', transition: 'all 0.2s',
    }}
    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#00C9B3')}
    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
    data-testid={testid}
  >
    <Icon size={22} color="#00C9B3" strokeWidth={1.4} />
    <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.2rem', marginTop: 12 }}>{title}</p>
    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', marginTop: 6, fontFamily: 'Montserrat, sans-serif' }}>{desc}</p>
  </button>
);

export default PublishConsole;
