/**
 * CompositionRoomRail — Editorial Calendar (left rail).
 *
 * Lists masters with their variants per market. Calm typographic list
 * (NOT a "table"). Filter chips on market and status. Click a variant
 * → opens it in the right pane.
 *
 * Status badge: editorial dot + label. NEVER an enterprise pill.
 */
import React, { useEffect, useMemo, useState } from 'react';
import api from '../../lib/api';
import { Calendar } from 'lucide-react';
import { statusMeta, SPINE_STATUSES } from './editorialStatus';

function fmtDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  } catch { return null; }
}

export const CompositionRoomRail = ({
  selectedVariantId,
  selectedMasterId,
  onSelectVariant,
  onSelectMaster,
}) => {
  const [masters, setMasters] = useState([]);
  const [variants, setVariants] = useState([]);     // flat list, indexed by master_id
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMarket, setFilterMarket] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 1) masters (with variant_count)
        const m = await api.get('/api/editorial/masters');
        // 2) calendar (returns variants for the tenant)
        const cal = await api.get('/api/editorial/calendar');
        // 3) tenant markets (active)
        const mk = await api.get('/api/tenants/me/markets');
        if (!alive) return;
        setMasters(m.data?.masters || []);
        setVariants(cal.data?.items || []);
        setMarkets((mk.data?.markets || []).filter((x) => x.is_active));
      } catch (e) {
        // Allow surfaces with no editorial seeded yet
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const variantsByMaster = useMemo(() => {
    const idx = {};
    variants.forEach((v) => {
      (idx[v.master_id] = idx[v.master_id] || []).push(v);
    });
    return idx;
  }, [variants]);

  const filteredMasters = useMemo(() => {
    return masters.filter((m) => {
      const vs = variantsByMaster[m.id] || [];
      if (filterMarket && !vs.some((v) => v.market_id === filterMarket)) return false;
      if (filterStatus && !vs.some((v) => v.status === filterStatus)) return false;
      return true;
    });
  }, [masters, variantsByMaster, filterMarket, filterStatus]);

  const marketLabel = (mid) => {
    const m = markets.find((x) => x.id === mid);
    return m?.code || '—';
  };
  const marketLocale = (mid) => {
    const m = markets.find((x) => x.id === mid);
    return m?.primary_locale || '';
  };

  return (
    <aside className="ed-rail" data-testid="ed-rail">
      <header className="ed-rail__head">
        <p className="ed-rail__eyebrow">Editorial Studio</p>
        <h1 className="ed-rail__title">Composition Room</h1>
      </header>

      {/* Market chips */}
      <div className="ed-filters" data-testid="ed-filters">
        <button
          type="button"
          className="ed-chip"
          data-active={filterMarket === null}
          data-testid="ed-filter-market-all"
          onClick={() => setFilterMarket(null)}
        >Tutti i mercati</button>
        {markets.map((m) => (
          <button key={m.id} type="button" className="ed-chip"
            data-active={filterMarket === m.id}
            data-testid={`ed-filter-market-${m.code}`}
            onClick={() => setFilterMarket(filterMarket === m.id ? null : m.id)}>
            {m.code}
          </button>
        ))}
      </div>

      {/* Status chips — the 5 canonical spine states */}
      <div className="ed-filters" data-testid="ed-filters-status">
        <button type="button" className="ed-chip"
          data-active={filterStatus === null}
          data-testid="ed-filter-status-all"
          onClick={() => setFilterStatus(null)}>
          Tutti gli stati
        </button>
        {SPINE_STATUSES.map((s) => (
          <button key={s} type="button" className="ed-chip"
            data-active={filterStatus === s}
            data-testid={`ed-filter-status-${s}`}
            onClick={() => setFilterStatus(filterStatus === s ? null : s)}>
            <span className="ed-chip__dot" style={{ backgroundColor: statusMeta(s).dot }} />
            {statusMeta(s).label}
          </button>
        ))}
      </div>

      <div className="ed-rail__list" data-testid="ed-rail-list">
        {loading && (
          <p style={{ padding: '32px 24px', fontSize: 12, color: 'rgba(28,24,20,0.5)' }}>
            Caricamento del calendario editoriale…
          </p>
        )}
        {!loading && filteredMasters.length === 0 && (
          <p style={{ padding: '40px 24px', fontSize: 13, color: 'rgba(28,24,20,0.55)', fontStyle: 'italic' }}>
            Nessun Master corrisponde ai filtri attivi.
          </p>
        )}
        {filteredMasters.map((m) => {
          const vs = (variantsByMaster[m.id] || []).filter((v) => {
            if (filterMarket && v.market_id !== filterMarket) return false;
            if (filterStatus && v.status !== filterStatus) return false;
            return true;
          });
          return (
            <div
              key={m.id}
              className="ed-master"
              data-testid={`ed-master-${m.id}`}
              data-selected={selectedMasterId === m.id}
              onClick={() => onSelectMaster?.(m)}
            >
              <h2 className="ed-master__title">{m.title || m.code}</h2>
              <div className="ed-master__meta">
                <span>{m.code}</span>
                <span>· {vs.length} variant{vs.length === 1 ? 'e' : 'i'}</span>
              </div>
              {vs.length > 0 && (
                <div className="ed-master__variants">
                  {vs.map((v) => {
                    const meta = statusMeta(v.status);
                    return (
                      <div
                        key={v.id}
                        className="ed-variant"
                        data-testid={`ed-variant-${v.id}`}
                        data-selected={selectedVariantId === v.id}
                        onClick={(e) => { e.stopPropagation(); onSelectVariant?.(v); }}
                      >
                        <span
                          className="ed-variant__status-dot"
                          style={{ backgroundColor: meta.dot }}
                          title={meta.label}
                        />
                        <span className="ed-variant__market">{marketLabel(v.market_id)}</span>
                        <span className="ed-variant__locale">{v.target_locale || marketLocale(v.market_id)}</span>
                        {v.scheduled_at && (
                          <span className="ed-variant__sched">
                            <Calendar size={10} strokeWidth={1.5} style={{ marginRight: 3 }} />
                            {fmtDate(v.scheduled_at)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default CompositionRoomRail;
