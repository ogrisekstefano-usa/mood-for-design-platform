import React, { useEffect, useState } from 'react';
import { adminApi } from '../adminApi';
import { Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react';
import { Header } from './BlocksEditor';

const SectionsManager = () => {
  const [page, setPage]         = useState(null);
  const [sections, setSections] = useState([]);
  const [busy, setBusy]         = useState(false);

  const load = () => {
    adminApi.listSections('home').then((r) => {
      setPage(r.data?.page || null);
      setSections((r.data?.sections || []).sort((a, b) => a.sort_order - b.sort_order));
    });
  };
  useEffect(load, []);

  const toggleVisible = async (s) => {
    setBusy(true);
    try {
      await adminApi.patchSection(s.id, { visible: !s.visible });
      load();
    } finally { setBusy(false); }
  };

  const move = async (idx, dir) => {
    const newSecs = [...sections];
    const j = idx + dir;
    if (j < 0 || j >= newSecs.length) return;
    [newSecs[idx], newSecs[j]] = [newSecs[j], newSecs[idx]];
    setBusy(true);
    try {
      await adminApi.reorderSections(newSecs.map((s) => s.id));
      load();
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="sections-manager">
      <Header title="Sections" subtitle={`Layout skeleton for the public homepage. Visibility + order only — text comes from Editorial Blocks.`} />

      {page && (
        <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', marginBottom: '1.5rem' }}>
          Page: <span style={{ color: '#00C9B3' }}>{page.slug}</span> · Status: <span style={{ color: '#00C9B3' }}>{page.status}</span>
        </p>
      )}

      <div className="space-y-3">
        {sections.map((s, i) => (
          <div
            key={s.id}
            style={{
              display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '1.2rem', alignItems: 'center',
              padding: '1rem 1.25rem',
              background: s.visible ? 'rgba(0,201,179,0.04)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${s.visible ? 'rgba(0,201,179,0.18)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 8,
            }}
            data-testid={`section-row-${s.section_type}`}
          >
            <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.5rem', color: 'rgba(255,255,255,0.3)' }}>
              {String(s.sort_order + 1).padStart(2, '0')}
            </p>
            <div>
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.72rem', color: '#00C9B3', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                {s.section_type.replace(/_/g, ' ')}
              </p>
              <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: 4, fontFamily: 'Montserrat, sans-serif' }}>
                {Object.keys((s.settings || {}).blocks || {}).length} content keys ·
                {' '}{Object.keys((s.settings || {}).media  || {}).length} media slots
              </p>
            </div>
            <div className="flex gap-1.5">
              <IconBtn onClick={() => move(i, -1)} disabled={i === 0 || busy} testid={`section-up-${i}`}><ArrowUp size={14} /></IconBtn>
              <IconBtn onClick={() => move(i, +1)} disabled={i === sections.length - 1 || busy} testid={`section-down-${i}`}><ArrowDown size={14} /></IconBtn>
            </div>
            <IconBtn onClick={() => toggleVisible(s)} disabled={busy} testid={`section-toggle-${i}`}>
              {s.visible ? <Eye size={16} color="#00C9B3" /> : <EyeOff size={16} color="rgba(255,255,255,0.5)" />}
            </IconBtn>
          </div>
        ))}
      </div>
    </div>
  );
};

const IconBtn = ({ children, onClick, disabled, testid }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: '0.5rem', border: '1px solid rgba(255,255,255,0.1)',
      background: 'transparent', color: '#FFFFFF', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
    }}
    data-testid={testid}
  >
    {children}
  </button>
);

export default SectionsManager;
