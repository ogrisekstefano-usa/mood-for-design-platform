/**
 * ActivityDrawer — M3 full-form activity drawer.
 * Style: aligned to Command Center tokens (bg-black, stone-200/300, no labels,
 * eyebrow text-[10px] uppercase tracking-wider, max-w-xl drawer with backdrop).
 * NO hardcoded values — types/outcomes/sources/icons via useCatalog.
 */
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import * as Icons from 'lucide-react';
import { X, Save, CheckCircle2, RotateCcw, Trash2, Clock } from 'lucide-react';
import useCatalog from '../../lib/useCatalog';

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('mood_auth_token') || ''}`,
});

const iconFor = (name) => {
  if (!name) return Clock;
  const key = name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  return Icons[key] || Clock;
};

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
  const types    = useCatalog('activity-types');
  const outcomes = useCatalog('activity-outcomes');
  const sources  = useCatalog('activity-sources');

  const [form, setForm] = useState(() => ({
    activity_type_code: '',
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
    source_code: '',
    importance: '',
    sentiment: '',
  }));
  const [meta, setMeta] = useState(null);
  const [advanced, setAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Default activity_type_code once catalog loads (no hardcode)
  useEffect(() => {
    if (!form.activity_type_code && types.length > 0) {
      setForm(f => ({ ...f, activity_type_code: types[0].code }));
    }
  }, [types]); // eslint-disable-line

  // Default source_code from catalog by scope
  useEffect(() => {
    if (!form.source_code && sources.length > 0) {
      const preferred = scope === 'founder' ? 'founder' : 'advisor';
      const found = sources.find(s => s.code === preferred) || sources[0];
      setForm(f => ({ ...f, source_code: found.code }));
    }
  }, [sources, scope]); // eslint-disable-line

  // Load existing activity on edit
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const { data: a } = await axios.get(
          `${apiBase}/activities/${activityId}`, { headers: headers() });
        setForm({
          activity_type_code: a.activity_type_code || '',
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
        });
        setMeta({
          completed_at: a.completed_at, archived_at: a.archived_at,
          created_by: a.created_by, created_by_display: a.created_by_display,
          type_label: a.type_label_it, type_icon: a.type_icon,
        });
      } catch (e) {
        setError(e?.response?.data?.detail || e?.message);
      }
    })();
  }, [isEdit, activityId, apiBase]);

  const set = (k, v) => setForm({ ...form, [k]: v });

  const canDelete = useMemo(() => {
    if (!isEdit || !meta) return false;
    if (scope === 'admin') return true;
    return meta.created_by === selfUserId;
  }, [isEdit, scope, meta, selfUserId]);

  const currentType = useMemo(
    () => types.find(t => t.code === form.activity_type_code),
    [types, form.activity_type_code]);
  const TitleIcon = iconFor(currentType?.icon);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const body = { ...form };
      Object.keys(body).forEach(k => { if (body[k] === '') body[k] = null; });
      const url = isEdit
        ? `${apiBase}/activities/${activityId}`
        : `${apiBase}/activities`;
      const method = isEdit ? 'patch' : 'post';
      const { data: saved } = await axios[method](url, body, { headers: headers() });
      onSaved && onSaved(saved);
      onClose && onClose();
    } catch (e) {
      const det = e?.response?.data?.detail;
      setError(typeof det === 'string' ? det : (det?.message || e?.message || 'Errore'));
    } finally { setSaving(false); }
  };

  const doComplete = async () => {
    try {
      const { data } = await axios.post(
        `${apiBase}/activities/${activityId}/complete`,
        { activity_outcome_code: form.activity_outcome_code || null },
        { headers: headers() });
      onSaved && onSaved(data); onClose && onClose();
    } catch (e) { setError(e?.response?.data?.detail?.message || e?.message); }
  };
  const doReopen = async () => {
    try {
      const { data } = await axios.post(
        `${apiBase}/activities/${activityId}/reopen`, {}, { headers: headers() });
      onSaved && onSaved(data); onClose && onClose();
    } catch (e) { setError(e?.response?.data?.detail?.message || e?.message); }
  };
  const doArchive = async () => {
    if (!window.confirm('Archiviare questa attività? Resterà nello storico per audit.')) return;
    try {
      await axios.delete(`${apiBase}/activities/${activityId}`, { headers: headers() });
      onSaved && onSaved(null); onClose && onClose();
    } catch (e) {
      setError(e?.response?.data?.detail?.message || e?.message);
    }
  };

  return (
    <div data-testid="activity-drawer" className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl">

        <header className="px-6 py-5 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TitleIcon size={18} className="text-stone-700" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-stone-400">
                {isEdit ? 'Modifica attività' : 'Nuova attività'}
              </div>
              <h2 className="text-xl mt-1">
                {form.subject || currentType?.label_it || 'Attività'}
              </h2>
            </div>
          </div>
          <button onClick={onClose} data-testid="activity-drawer-close"
                  className="text-stone-400 hover:text-stone-900">
            <X size={20} />
          </button>
        </header>

        <div className="px-6 py-5 space-y-6">
          {error && (
            <div data-testid="activity-drawer-error"
                 className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
              {String(error)}
            </div>
          )}
          {meta?.completed_at && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2 flex items-center gap-2">
              <CheckCircle2 size={14} />
              <span>Attività completata · {new Date(meta.completed_at).toLocaleString('it-IT')}</span>
            </div>
          )}

          {/* CONTEXT */}
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-stone-400 mb-3">Context</h3>
            <div className="grid grid-cols-2 gap-3">
              <select data-testid="activity-drawer-type"
                      className="border border-stone-300 px-3 py-2 text-sm"
                      value={form.activity_type_code}
                      onChange={(e) => set('activity_type_code', e.target.value)}>
                {types.map(t => <option key={t.code} value={t.code}>{t.label_it}</option>)}
              </select>
              <select data-testid="activity-drawer-contact"
                      className="border border-stone-300 px-3 py-2 text-sm"
                      value={form.contact_id}
                      onChange={(e) => set('contact_id', e.target.value)}>
                <option value="">— Nessun contatto —</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}{c.role_code ? ` · ${c.role_code}` : ''}
                  </option>
                ))}
              </select>
              {scope === 'admin' && users.length > 0 && (
                <select data-testid="activity-drawer-owner"
                        className="border border-stone-300 px-3 py-2 text-sm col-span-2"
                        value={form.owner_user_id || ''}
                        onChange={(e) => set('owner_user_id', e.target.value)}>
                  <option value="">— Responsabile relazione —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.display || u.full_name || u.email}{u.role ? ` · ${u.role}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </section>

          {/* MEMORY */}
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-stone-400 mb-3">Memory layer</h3>
            <input data-testid="activity-drawer-subject" type="text"
                   placeholder="Soggetto · es. Demo Master Deck"
                   className="w-full border border-stone-300 px-3 py-2 text-sm mb-3"
                   value={form.subject}
                   onChange={(e) => set('subject', e.target.value)} />
            <textarea data-testid="activity-drawer-notes" rows={4}
                      placeholder="Note · cosa è emerso, perché conta, eventuali rischi…"
                      className="w-full border border-stone-300 px-3 py-2 text-sm"
                      value={form.notes}
                      onChange={(e) => set('notes', e.target.value)} />
          </section>

          {/* OUTCOME */}
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-stone-400 mb-3">Esito</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <select data-testid="activity-drawer-outcome-code"
                      className="border border-stone-300 px-3 py-2 text-sm"
                      value={form.activity_outcome_code || ''}
                      onChange={(e) => set('activity_outcome_code', e.target.value)}>
                <option value="">— Esito (catalog) —</option>
                {outcomes.map(o => (
                  <option key={o.code} value={o.code}>{o.label_it}</option>
                ))}
              </select>
              <input data-testid="activity-drawer-duration" type="number" min="0"
                     placeholder="Durata (min)"
                     className="border border-stone-300 px-3 py-2 text-sm"
                     value={form.duration_min}
                     onChange={(e) => set('duration_min', e.target.value)} />
            </div>
            <textarea data-testid="activity-drawer-outcome" rows={2}
                      placeholder="Esito libero · decisioni, riscontri specifici…"
                      className="w-full border border-stone-300 px-3 py-2 text-sm"
                      value={form.outcome}
                      onChange={(e) => set('outcome', e.target.value)} />
          </section>

          {/* NEXT */}
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-stone-400 mb-3">Prossimo passo</h3>
            <input data-testid="activity-drawer-next-step" type="text"
                   placeholder="Es. Inviare proposta v2"
                   className="w-full border border-stone-300 px-3 py-2 text-sm mb-3"
                   value={form.next_step}
                   onChange={(e) => set('next_step', e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <input data-testid="activity-drawer-due" type="datetime-local"
                     placeholder="Scadenza"
                     className="border border-stone-300 px-3 py-2 text-sm"
                     value={form.next_step_due_at}
                     onChange={(e) => set('next_step_due_at', e.target.value)} />
              <input data-testid="activity-drawer-occurred" type="datetime-local"
                     placeholder="Quando avvenuta"
                     className="border border-stone-300 px-3 py-2 text-sm"
                     value={form.occurred_at}
                     onChange={(e) => set('occurred_at', e.target.value)} />
            </div>
          </section>

          {/* ADVANCED */}
          <section>
            <button type="button"
                    data-testid="activity-drawer-toggle-advanced"
                    onClick={() => setAdvanced(v => !v)}
                    className="text-[10px] uppercase tracking-wider text-stone-400 hover:text-stone-900">
              {advanced ? '— Nascondi avanzato' : '+ Sorgente · Importanza · Sentiment'}
            </button>
            {advanced && (
              <div className="grid grid-cols-3 gap-3 mt-3">
                <select data-testid="activity-drawer-source"
                        className="border border-stone-300 px-3 py-2 text-sm"
                        value={form.source_code || ''}
                        onChange={(e) => set('source_code', e.target.value)}>
                  <option value="">— Sorgente —</option>
                  {sources.map(s => <option key={s.code} value={s.code}>{s.label_it}</option>)}
                </select>
                <input data-testid="activity-drawer-importance" type="number" min="1" max="5"
                       placeholder="Importanza 1-5"
                       className="border border-stone-300 px-3 py-2 text-sm"
                       value={form.importance}
                       onChange={(e) => set('importance', e.target.value)} />
                <input data-testid="activity-drawer-sentiment" type="number" min="-2" max="2"
                       placeholder="Sentiment -2..+2"
                       className="border border-stone-300 px-3 py-2 text-sm"
                       value={form.sentiment}
                       onChange={(e) => set('sentiment', e.target.value)} />
              </div>
            )}
          </section>
        </div>

        <footer className="sticky bottom-0 bg-white px-6 py-4 border-t border-stone-200 flex justify-between gap-3">
          <div className="flex items-center gap-2">
            {isEdit && !meta?.completed_at && (
              <button data-testid="activity-drawer-complete" onClick={doComplete}
                      className="inline-flex items-center gap-2 px-3 py-2 text-xs border border-stone-300 hover:bg-stone-50">
                <CheckCircle2 size={12} /> Completa
              </button>
            )}
            {isEdit && meta?.completed_at && (
              <button data-testid="activity-drawer-reopen" onClick={doReopen}
                      className="inline-flex items-center gap-2 px-3 py-2 text-xs border border-stone-300 hover:bg-stone-50">
                <RotateCcw size={12} /> Riapri
              </button>
            )}
            {isEdit && canDelete && (
              <button data-testid="activity-drawer-archive" onClick={doArchive}
                      className="inline-flex items-center gap-2 px-3 py-2 text-xs border border-red-200 text-red-700 hover:bg-red-50">
                <Trash2 size={12} /> Archivia
              </button>
            )}
            {isEdit && !canDelete && meta?.created_by_display && (
              <span className="text-[10px] uppercase tracking-wider text-stone-400">
                Autore · {meta.created_by_display}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button data-testid="activity-drawer-cancel" onClick={onClose}
                    className="px-4 py-2 text-sm">
              Annulla
            </button>
            <button data-testid="activity-drawer-save" onClick={save} disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-black text-white disabled:opacity-50">
              <Save size={14} />
              {saving ? 'Salvataggio…' : (isEdit ? 'Salva modifiche' : 'Salva attività')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
