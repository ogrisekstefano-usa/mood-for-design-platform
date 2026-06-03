/**
 * ActivityDrawer — M3 full-form activity create/edit drawer.
 *
 * Props:
 *   - apiBase     : "${BACKEND}/api/admin/tenants/{tid}" or "${BACKEND}/api/blueprint"
 *   - scope       : "admin" | "founder"
 *   - activityId  : null for create, uuid for edit
 *   - onClose()
 *   - onSaved(act)
 *   - contacts    : array (for contact_id picker)
 *   - users       : array (admin only — for owner picker)
 *   - selfUserId  : current user UUID
 */
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { X, Star, Trash2, CheckCircle2, RotateCcw } from 'lucide-react';
import useCatalog from '../../lib/useCatalog';

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('mood_auth_token') || ''}`,
});

const fmtDtLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function ActivityDrawer({
  apiBase, scope = 'admin', activityId, onClose, onSaved,
  contacts = [], users = [], selfUserId,
}) {
  const isEdit = !!activityId;
  const [data, setData] = useState({
    activity_type_code: 'call',
    contact_id: '',
    owner_user_id: selfUserId || '',
    subject: '',
    notes: '',
    outcome: '',
    activity_outcome_code: '',
    next_step: '',
    next_step_due_at: '',
    duration_min: '',
    occurred_at: fmtDtLocal(new Date().toISOString()),
    source_code: scope === 'founder' ? 'founder' : 'advisor',
    importance: '',
    sentiment: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [advanced, setAdvanced] = useState(false);

  const types    = useCatalog('activity-types');
  const outcomes = useCatalog('activity-outcomes');
  const sources  = useCatalog('activity-sources');

  // Load existing activity on edit
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const { data: a } = await axios.get(`${apiBase}/activities/${activityId}`,
                                              { headers: headers() });
        setData({
          activity_type_code: a.activity_type_code || 'call',
          contact_id: a.contact_id || '',
          owner_user_id: a.owner_user_id || '',
          subject: a.subject || '',
          notes: a.notes || '',
          outcome: a.outcome || '',
          activity_outcome_code: a.activity_outcome_code || '',
          next_step: a.next_step || '',
          next_step_due_at: a.next_step_due_at ? fmtDtLocal(a.next_step_due_at) : '',
          duration_min: a.duration_min ?? '',
          occurred_at: a.occurred_at ? fmtDtLocal(a.occurred_at) : '',
          source_code: a.source_code || '',
          importance: a.importance ?? '',
          sentiment: a.sentiment ?? '',
          _meta: { completed_at: a.completed_at, archived_at: a.archived_at,
                   created_by: a.created_by, created_by_display: a.created_by_display },
        });
      } catch (e) { setError(e?.message); }
    })();
  }, [isEdit, activityId, apiBase]);

  const canDelete = useMemo(() => {
    if (!isEdit || !data._meta) return false;
    if (scope === 'admin') return true;
    return data._meta.created_by === selfUserId;        // D1 enforcement
  }, [isEdit, scope, data._meta, selfUserId]);

  const submit = async () => {
    setLoading(true); setError(null);
    try {
      const body = { ...data };
      // strip empty strings → null
      Object.keys(body).forEach(k => { if (body[k] === '') body[k] = null; });
      if (body._meta) delete body._meta;
      const url = isEdit
        ? `${apiBase}/activities/${activityId}`
        : `${apiBase}/activities`;
      const method = isEdit ? 'patch' : 'post';
      const { data: saved } = await axios[method](url, body, { headers: headers() });
      onSaved && onSaved(saved);
      onClose && onClose();
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Errore');
    } finally { setLoading(false); }
  };

  const doComplete = async () => {
    const { data: saved } = await axios.post(
      `${apiBase}/activities/${activityId}/complete`,
      { activity_outcome_code: data.activity_outcome_code || null },
      { headers: headers() });
    onSaved && onSaved(saved); onClose && onClose();
  };
  const doReopen = async () => {
    const { data: saved } = await axios.post(
      `${apiBase}/activities/${activityId}/reopen`, {}, { headers: headers() });
    onSaved && onSaved(saved); onClose && onClose();
  };
  const doArchive = async () => {
    if (!window.confirm('Archiviare questa attività? Resterà nello storico.')) return;
    try {
      await axios.delete(`${apiBase}/activities/${activityId}`,
                          { headers: headers() });
      onSaved && onSaved(null); onClose && onClose();
    } catch (e) {
      setError(e?.response?.data?.detail?.message || e?.message);
    }
  };

  return (
    <div data-testid="activity-drawer"
         className="fixed inset-y-0 right-0 w-full sm:w-[560px] bg-white shadow-2xl border-l border-stone-200 z-50 overflow-y-auto">
      <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white">
        <h2 className="text-lg font-medium">
          {isEdit ? 'Modifica attività' : 'Nuova attività'}
        </h2>
        <button data-testid="activity-drawer-close" onClick={onClose}
                className="text-stone-400 hover:text-stone-900">
          <X size={20} />
        </button>
      </div>

      <div className="px-6 py-5 space-y-4">
        {error && (
          <div data-testid="activity-drawer-error"
               className="border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
            {typeof error === 'string' ? error : JSON.stringify(error)}
          </div>
        )}

        {/* Type + Contact */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500">Tipo</label>
            <select data-testid="activity-drawer-type"
                    value={data.activity_type_code}
                    onChange={(e) => setData({ ...data, activity_type_code: e.target.value })}
                    className="w-full border border-stone-300 px-3 py-2 text-sm">
              {types.map(t => <option key={t.code} value={t.code}>{t.label_it}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500">Contatto</label>
            <select data-testid="activity-drawer-contact"
                    value={data.contact_id}
                    onChange={(e) => setData({ ...data, contact_id: e.target.value })}
                    className="w-full border border-stone-300 px-3 py-2 text-sm">
              <option value="">— Nessuno —</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} {c.role_code && `(${c.role_code})`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Owner (admin only) */}
        {scope === 'admin' && users.length > 0 && (
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500">Responsabile</label>
            <select data-testid="activity-drawer-owner"
                    value={data.owner_user_id || ''}
                    onChange={(e) => setData({ ...data, owner_user_id: e.target.value })}
                    className="w-full border border-stone-300 px-3 py-2 text-sm">
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
            </select>
          </div>
        )}

        {/* Subject */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-stone-500">Soggetto</label>
          <input data-testid="activity-drawer-subject" type="text"
                 value={data.subject}
                 onChange={(e) => setData({ ...data, subject: e.target.value })}
                 placeholder="Es. Demo Master Deck"
                 className="w-full border border-stone-300 px-3 py-2 text-sm" />
        </div>

        {/* Notes */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-stone-500">Note (memory layer)</label>
          <textarea data-testid="activity-drawer-notes" rows={4}
                    value={data.notes}
                    onChange={(e) => setData({ ...data, notes: e.target.value })}
                    placeholder="Cosa è emerso, perché conta, eventuali rischi…"
                    className="w-full border border-stone-300 px-3 py-2 text-sm" />
        </div>

        {/* Outcome */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500">Esito (catalog)</label>
            <select data-testid="activity-drawer-outcome-code"
                    value={data.activity_outcome_code || ''}
                    onChange={(e) => setData({ ...data, activity_outcome_code: e.target.value })}
                    className="w-full border border-stone-300 px-3 py-2 text-sm">
              <option value="">— Non impostato —</option>
              {outcomes.map(o => (
                <option key={o.code} value={o.code}>{o.label_it}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500">Durata (min)</label>
            <input data-testid="activity-drawer-duration" type="number" min="0"
                   value={data.duration_min}
                   onChange={(e) => setData({ ...data, duration_min: e.target.value })}
                   className="w-full border border-stone-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-stone-500">Esito (testo libero)</label>
          <textarea data-testid="activity-drawer-outcome" rows={2}
                    value={data.outcome}
                    onChange={(e) => setData({ ...data, outcome: e.target.value })}
                    placeholder="Decisioni, riscontri specifici…"
                    className="w-full border border-stone-300 px-3 py-2 text-sm" />
        </div>

        {/* Next step */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-stone-500">Prossimo passo</label>
          <input data-testid="activity-drawer-next-step" type="text"
                 value={data.next_step}
                 onChange={(e) => setData({ ...data, next_step: e.target.value })}
                 placeholder="Es. Inviare proposta v2"
                 className="w-full border border-stone-300 px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500">Scadenza</label>
            <input data-testid="activity-drawer-due" type="datetime-local"
                   value={data.next_step_due_at}
                   onChange={(e) => setData({ ...data, next_step_due_at: e.target.value })}
                   className="w-full border border-stone-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-stone-500">Quando avvenuta</label>
            <input data-testid="activity-drawer-occurred" type="datetime-local"
                   value={data.occurred_at}
                   onChange={(e) => setData({ ...data, occurred_at: e.target.value })}
                   className="w-full border border-stone-300 px-3 py-2 text-sm" />
          </div>
        </div>

        {/* Advanced */}
        <button type="button"
                data-testid="activity-drawer-toggle-advanced"
                onClick={() => setAdvanced(v => !v)}
                className="text-xs text-stone-500 hover:text-stone-900 underline">
          {advanced ? 'Nascondi avanzato' : 'Mostra avanzato (sorgente · importanza · sentiment)'}
        </button>
        {advanced && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-stone-500">Sorgente</label>
              <select data-testid="activity-drawer-source"
                      value={data.source_code || ''}
                      onChange={(e) => setData({ ...data, source_code: e.target.value })}
                      className="w-full border border-stone-300 px-2 py-2 text-sm">
                <option value="">— —</option>
                {sources.map(s => <option key={s.code} value={s.code}>{s.label_it}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-stone-500">Importanza (1-5)</label>
              <input data-testid="activity-drawer-importance" type="number" min="1" max="5"
                     value={data.importance}
                     onChange={(e) => setData({ ...data, importance: e.target.value })}
                     className="w-full border border-stone-300 px-2 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-stone-500">Sentiment (-2..+2)</label>
              <input data-testid="activity-drawer-sentiment" type="number" min="-2" max="2"
                     value={data.sentiment}
                     onChange={(e) => setData({ ...data, sentiment: e.target.value })}
                     className="w-full border border-stone-300 px-2 py-2 text-sm" />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-stone-200 flex items-center justify-between sticky bottom-0 bg-white">
        {isEdit ? (
          <div className="flex items-center gap-2">
            {!data._meta?.completed_at ? (
              <button data-testid="activity-drawer-complete" onClick={doComplete}
                      className="flex items-center gap-1 border border-emerald-300 text-emerald-700 px-3 py-2 text-xs hover:bg-emerald-50">
                <CheckCircle2 size={12} /> Completa
              </button>
            ) : (
              <button data-testid="activity-drawer-reopen" onClick={doReopen}
                      className="flex items-center gap-1 border border-stone-300 px-3 py-2 text-xs hover:bg-stone-50">
                <RotateCcw size={12} /> Riapri
              </button>
            )}
            {canDelete ? (
              <button data-testid="activity-drawer-archive" onClick={doArchive}
                      className="flex items-center gap-1 border border-red-200 text-red-700 px-3 py-2 text-xs hover:bg-red-50">
                <Trash2 size={12} /> Archivia
              </button>
            ) : (
              <span title="Solo l'autore può archiviare. Le altre restano per audit trail."
                    className="text-[10px] text-stone-400">
                {data._meta?.created_by_display && `Autore: ${data._meta.created_by_display}`}
              </span>
            )}
          </div>
        ) : <span />}
        <div className="flex items-center gap-2">
          <button data-testid="activity-drawer-cancel" onClick={onClose}
                  className="border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50">
            Annulla
          </button>
          <button data-testid="activity-drawer-save" onClick={submit} disabled={loading}
                  className="bg-stone-900 text-white px-4 py-2 text-sm hover:bg-stone-800 disabled:opacity-50">
            {loading ? 'Salvataggio…' : (isEdit ? 'Salva modifiche' : 'Salva attività')}
          </button>
        </div>
      </div>
    </div>
  );
}
