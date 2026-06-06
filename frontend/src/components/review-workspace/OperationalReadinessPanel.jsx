/**
 * KE-004 · P0-5 · Operational Readiness Panel
 *
 * Mostra READY FOR / NOT READY per ogni surface dell'ecosistema MOOD.
 * Dati reali dal backend `/operational-readiness` — niente placeholder.
 */
import React, { useEffect, useState, useCallback } from 'react';
import * as Icons from 'lucide-react';
import KE from '../../lib/knowledgeApi';

export default function OperationalReadinessPanel({ setId, entityId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (sid, eid) => {
    setLoading(true);
    try {
      const res = await KE.operationalReadiness(sid, eid);
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!setId || !entityId) { setData(null); return; }
    load(setId, entityId);
  }, [setId, entityId, load]);

  if (loading) {
    return (
      <div className="rw-readiness" data-testid="rw-readiness-loading">
        <div className="rw-readiness__title">Operational Readiness</div>
        <div className="rw-readiness__loading">Verifica in corso…</div>
      </div>
    );
  }
  if (!data) return null;

  const allReady = data.operational;
  return (
    <div
      className={`rw-readiness ${allReady ? 'is-all-ready' : ''}`}
      data-testid="rw-readiness-panel"
    >
      <div className="rw-readiness__header">
        <div className="rw-readiness__title">
          Operational Readiness · {data.ready_count}/{data.total_surfaces}
        </div>
        <span className={`rw-readiness__badge ${allReady ? 'rw-readiness__badge--ok' : 'rw-readiness__badge--warn'}`}>
          {allReady ? 'READY' : `${data.total_surfaces - data.ready_count} blocchi`}
        </span>
      </div>
      <ul className="rw-readiness__list">
        {(data.surfaces || []).map((s) => (
          <li
            key={s.key}
            className={`rw-readiness__row ${s.ready ? 'is-ready' : 'is-blocked'}`}
            data-testid={`rw-readiness-${s.key}`}
          >
            <span className="rw-readiness__icon">
              {s.ready
                ? <Icons.Check size={12} />
                : <Icons.X size={12} />}
            </span>
            <span className="rw-readiness__label">{s.label}</span>
            {!s.ready && s.reason && (
              <span className="rw-readiness__reason">· {s.reason}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
