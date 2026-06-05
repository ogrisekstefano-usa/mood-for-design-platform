/**
 * NextActionsPanel — M6 · Column 3.
 *
 * Riusa M3 endpoint /activities/open-followups + /activities/v2 (completed).
 * Raggruppa client-side: OVERDUE / TODAY / THIS WEEK / COMPLETED RECENTLY.
 * Quick Actions sempre visibili: Complete / Reschedule / Edit.
 *
 * Complete    → PATCH /activities/{id}/complete
 * Reschedule  → PATCH /activities/{id} con nuovo next_step_due_at (prompt)
 * Edit        → apre ActivityDrawer esistente
 */
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import * as Icons from 'lucide-react';
import { AlertTriangle, Clock, CalendarDays, CheckCircle2, RefreshCw } from 'lucide-react';

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('mood_auth_token') || ''}`,
});

const iconFor = (name) => {
  if (!name) return Clock;
  const key = name.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  return Icons[key] || Clock;
};

const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('it-IT', {
  weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
}) : '—';

const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const startOfTomorrow = () => { const d = startOfToday(); d.setDate(d.getDate()+1); return d; };
const endOfWeek = () => {
  const d = startOfToday();
  const day = d.getDay() || 7;     // monday=1 … sunday=7
  d.setDate(d.getDate() + (7 - day));
  d.setHours(23,59,59,999);
  return d;
};

const groupActions = (open, completed) => {
  const now = new Date();
  const todayStart = startOfToday();
  const tomorrowStart = startOfTomorrow();
  const weekEnd = endOfWeek();
  const overdue = [], today = [], week = [], later = [];
  for (const a of open) {
    const due = a.next_step_due_at ? new Date(a.next_step_due_at) : null;
    if (!due) continue;
    if (due < todayStart) overdue.push(a);
    else if (due < tomorrowStart) today.push(a);
    else if (due <= weekEnd) week.push(a);
    else later.push(a);
  }
  overdue.sort((a,b) => new Date(a.next_step_due_at) - new Date(b.next_step_due_at));
  today.sort((a,b)   => new Date(a.next_step_due_at) - new Date(b.next_step_due_at));
  week.sort((a,b)    => new Date(a.next_step_due_at) - new Date(b.next_step_due_at));
  return { overdue, today, week, later, completed };
};

const ActionCard = ({ a, group, onComplete, onReschedule, onEdit }) => {
  const Icon = iconFor(a.type_icon);
  const due = a.next_step_due_at;
  const overdueDays = group === 'overdue' && due
    ? Math.floor((Date.now() - new Date(due)) / 86400000)
    : 0;

  const groupColor =
    group === 'overdue' ? '#FF453A' :
    group === 'today'   ? '#FF9F0A' :
    group === 'done'    ? '#32D74B' :
    '#A0A0A5';

  return (
    <div data-testid={`m6-action-${a.id}`}
         className={`p-3 rounded border border-stone-300 bg-white mb-2 ${group === 'done' ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 w-6 h-6 rounded border border-stone-300 bg-stone-100 inline-flex items-center justify-center">
          <Icon size={12} className="text-stone-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-[12.5px] font-medium ${group === 'done' ? 'line-through' : ''}`}>
            {a.next_step || a.subject || a.type_label_it || a.activity_type_code}
          </div>
          {a.contact_display && (
            <div className="text-[10.5px] text-stone-500 mt-0.5 truncate">
              Con {a.contact_display}
            </div>
          )}
          {group !== 'done' && due && (
            <div className="text-[10.5px] tabular-nums mt-1.5 inline-flex items-center gap-1.5" style={{ color: groupColor }}>
              {group === 'overdue' && <AlertTriangle size={10} />}
              {group === 'today' && <Clock size={10} />}
              {group !== 'overdue' && group !== 'today' && <CalendarDays size={10} />}
              {group === 'overdue'
                ? <>Overdue · {overdueDays}d</>
                : fmtDate(due)}
            </div>
          )}
          {group === 'done' && a.completed_at && (
            <div className="text-[10.5px] text-stone-400 mt-1">
              Completato · {a.owner_display || '—'} · {fmtDate(a.completed_at)}
            </div>
          )}
        </div>
      </div>
      {group !== 'done' && (
        <div className="flex gap-1 mt-2">
          <button onClick={() => onComplete(a)}
                  data-testid={`m6-action-complete-${a.id}`}
                  className="flex-1 py-1.5 text-[10px] uppercase tracking-wider border border-emerald-700/40 text-emerald-700 bg-emerald-50 hover:bg-emerald-100">
            <CheckCircle2 size={10} className="inline mr-1" />Complete
          </button>
          <button onClick={() => onReschedule(a)}
                  data-testid={`m6-action-reschedule-${a.id}`}
                  className="flex-1 py-1.5 text-[10px] uppercase tracking-wider border border-stone-300 hover:bg-stone-100">
            Reschedule
          </button>
          <button onClick={() => onEdit(a)}
                  data-testid={`m6-action-edit-${a.id}`}
                  className="flex-1 py-1.5 text-[10px] uppercase tracking-wider border border-stone-300 hover:bg-stone-100">
            Edit
          </button>
        </div>
      )}
    </div>
  );
};

const GroupHeader = ({ label, count, tone }) => {
  const colorMap = {
    critical: { c: '#FF453A', bg: 'rgba(255,69,58,0.12)' },
    warning:  { c: '#FF9F0A', bg: 'rgba(255,159,10,0.12)' },
    normal:   { c: '#A0A0A5', bg: 'rgba(160,160,165,0.12)' },
    success:  { c: '#32D74B', bg: 'rgba(50,215,75,0.12)' },
  };
  const { c, bg } = colorMap[tone] || colorMap.normal;
  return (
    <div className="flex items-center justify-between mt-3 mb-1 px-1">
      <h4 className="text-[10px] uppercase tracking-[0.14em] font-medium" style={{ color: c }}>{label}</h4>
      <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full" style={{ color: c, background: bg }}>{count}</span>
    </div>
  );
};

export default function NextActionsPanel({ apiBase, onEdit, onActionDone }) {
  const [open, setOpen] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [oR, cR] = await Promise.allSettled([
        axios.get(`${apiBase}/activities/open-followups`, { headers: headers(), params: { limit: 50 } }),
        axios.get(`${apiBase}/activities/v2`,            { headers: headers(), params: { limit: 5, status: 'completed' } }),
      ]);
      setOpen(oR.status === 'fulfilled' ? (oR.value.data.items || []) : []);
      setCompleted(cR.status === 'fulfilled' ? (cR.value.data.items || []) : []);
    } finally { setLoading(false); }
  }, [apiBase]);

  useEffect(() => { refresh(); }, [refresh]);

  const groups = groupActions(open, completed);
  const totalOpen = open.length;

  const handleComplete = async (a) => {
    try {
      await axios.post(`${apiBase}/activities/${a.id}/complete`,
                       {}, { headers: headers() });
      await refresh();
      if (onActionDone) onActionDone();
    } catch (e) {
      // fallback path: PATCH if /complete endpoint not present
      try {
        await axios.patch(`${apiBase}/activities/${a.id}`,
                          { completed_at: new Date().toISOString() },
                          { headers: headers() });
        await refresh();
        if (onActionDone) onActionDone();
      } catch (e2) {
        window.alert('Impossibile completare l\'attività.');
      }
    }
  };

  const handleReschedule = async (a) => {
    const cur = a.next_step_due_at ? new Date(a.next_step_due_at) : new Date();
    const def = cur.toISOString().slice(0, 16);
    const input = window.prompt('Nuova scadenza (YYYY-MM-DD HH:MM):', def.replace('T', ' '));
    if (!input) return;
    let iso;
    try {
      iso = new Date(input.replace(' ', 'T')).toISOString();
    } catch {
      window.alert('Formato data non valido.');
      return;
    }
    try {
      await axios.patch(`${apiBase}/activities/${a.id}`,
                        { next_step_due_at: iso },
                        { headers: headers() });
      await refresh();
      if (onActionDone) onActionDone();
    } catch {
      window.alert('Impossibile riprogrammare l\'attività.');
    }
  };

  return (
    <div data-testid="m6-next-actions-panel" className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-3 border-b border-stone-200 sticky top-0 bg-[#0A0A0B] z-[5]">
        <h3 className="text-[10.5px] uppercase tracking-[0.14em] text-stone-400 font-medium">
          Next Actions <span className="tabular-nums text-stone-500 ml-1">· {totalOpen}</span>
        </h3>
        <button onClick={refresh}
                data-testid="m6-next-refresh"
                className="text-[10.5px] uppercase tracking-wider px-2 py-1 border border-stone-300 hover:bg-stone-100">
          <RefreshCw size={11} className={`inline ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-6">
        {totalOpen === 0 && completed.length === 0 && !loading && (
          <div data-testid="m6-next-empty" className="px-3 py-12 text-center text-[12px] text-stone-400">
            Nessuna azione aperta.<br />
            <span className="text-stone-500 text-[11px]">Crea una nuova attività con next step dalla colonna centrale.</span>
          </div>
        )}

        {groups.overdue.length > 0 && (
          <>
            <GroupHeader label="Overdue" count={groups.overdue.length} tone="critical" />
            {groups.overdue.map((a) => (
              <ActionCard key={a.id} a={a} group="overdue"
                          onComplete={handleComplete} onReschedule={handleReschedule} onEdit={onEdit} />
            ))}
          </>
        )}
        {groups.today.length > 0 && (
          <>
            <GroupHeader label="Today" count={groups.today.length} tone="warning" />
            {groups.today.map((a) => (
              <ActionCard key={a.id} a={a} group="today"
                          onComplete={handleComplete} onReschedule={handleReschedule} onEdit={onEdit} />
            ))}
          </>
        )}
        {groups.week.length > 0 && (
          <>
            <GroupHeader label="This Week" count={groups.week.length} tone="normal" />
            {groups.week.map((a) => (
              <ActionCard key={a.id} a={a} group="week"
                          onComplete={handleComplete} onReschedule={handleReschedule} onEdit={onEdit} />
            ))}
          </>
        )}
        {groups.later.length > 0 && (
          <>
            <GroupHeader label="Later" count={groups.later.length} tone="normal" />
            {groups.later.map((a) => (
              <ActionCard key={a.id} a={a} group="later"
                          onComplete={handleComplete} onReschedule={handleReschedule} onEdit={onEdit} />
            ))}
          </>
        )}
        {groups.completed.length > 0 && (
          <>
            <GroupHeader label="Completed Recently" count={groups.completed.length} tone="success" />
            {groups.completed.map((a) => (
              <ActionCard key={a.id} a={a} group="done"
                          onComplete={handleComplete} onReschedule={handleReschedule} onEdit={onEdit} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
