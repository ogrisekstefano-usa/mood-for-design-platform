/**
 * MessageAssociationsPanel — ITER187.B.
 * Right column of MessageDetailPage. Lets the user MANUALLY associate the
 * current message to a Lead / Prospect / Customer / Design Journey.
 * NO AI suggestions. NO automatic association.
 */
import React, { useCallback, useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import api from '../../../lib/api';
import JM from '../../../lib/journeyMailApi';
import EntityPicker from './EntityPicker';

const TYPE_LABELS = {
  lead: 'Lead', prospect: 'Prospect', customer: 'Customer',
  account: 'Account', journey: 'Design Journey', contact: 'Contact',
};
const PICK_TYPES = ['lead', 'prospect', 'customer', 'journey'];

const ENTITY_ENDPOINT = {
  lead:     '/api/relations/leads',
  prospect: '/api/relations/prospects',
  customer: '/api/relations/accounts',
  account:  '/api/relations/accounts',
  journey:  '/api/projects',
};
const NAME_KEY = {
  lead: 'name', prospect: 'name', customer: 'account_name',
  account: 'account_name', journey: 'title', contact: 'name',
};

export default function MessageAssociationsPanel({ messageId, initialLinks = [], onChanged }) {
  const [links, setLinks] = useState(initialLinks);
  const [nameMap, setNameMap] = useState({});      // `${type}:${id}` -> displayName
  const [pickType, setPickType] = useState('lead');
  const [picked, setPicked] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setLinks(initialLinks); }, [initialLinks]);

  // Resolve display names for existing links by fetching the relevant lists once.
  // Cheap for Phase 1: we hit 1 endpoint per type used in links (≤ 4 calls).
  const resolveNames = useCallback(async () => {
    const usedTypes = Array.from(new Set(links.map((l) => l.linked_type)));
    const map = { ...nameMap };
    await Promise.all(usedTypes.map(async (t) => {
      const ep = ENTITY_ENDPOINT[t]; if (!ep) return;
      try {
        const r = await api.get(ep, { params: { limit: 200 } });
        const data = r.data;
        const rows = Array.isArray(data) ? data
                    : (data?.items || data?.results || data?.projects || data?.data || []);
        rows.forEach((row) => {
          const name = row[NAME_KEY[t]] || row.title || row.name || row.id;
          map[`${t}:${row.id}`] = name;
        });
      } catch (_) { /* tolerated */ }
    }));
    setNameMap(map);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links]);

  useEffect(() => { if (links.length > 0) resolveNames(); }, [links, resolveNames]);

  const addLink = async () => {
    if (!picked) { toast.warning('Seleziona prima un’entità'); return; }
    setBusy(true);
    try {
      const { data } = await JM.createLink(messageId, {
        linked_type: pickType,
        linked_id: picked.id,
        note: note.trim() || null,
      });
      setLinks((arr) => [...arr, data]);
      setNameMap((m) => ({ ...m, [`${pickType}:${picked.id}`]: picked.name }));
      setPicked(null); setNote('');
      toast.success('Associazione creata');
      onChanged?.();
    } catch (err) {
      if (err?.response?.status === 409) toast.error('Associazione già esistente');
      else toast.error(err?.response?.data?.detail || 'Operazione fallita');
    } finally { setBusy(false); }
  };

  const removeLink = async (lid) => {
    try {
      await JM.removeLink(messageId, lid);
      setLinks((arr) => arr.filter((l) => l.id !== lid));
      toast.success('Associazione rimossa');
      onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Errore');
    }
  };

  return (
    <aside className="cm-assoc-panel" data-testid="cm-assoc-panel">
      <h3 className="cm-assoc-title">Collegamenti</h3>

      <div className="cm-assoc-list">
        {links.length === 0 ? (
          <div style={{ color: 'var(--cm-ink-mute)', fontSize: 13 }} data-testid="cm-assoc-empty">
            Nessun collegamento. Associa questo messaggio a un Lead, Prospect,
            Customer o Design Journey.
          </div>
        ) : links.map((l) => (
          <div key={l.id} className="cm-assoc-pill" data-testid={`cm-assoc-pill-${l.id}`}>
            <span>
              <span className="cm-assoc-pill-type">{TYPE_LABELS[l.linked_type] || l.linked_type}</span>
              {nameMap[`${l.linked_type}:${l.linked_id}`] || `${l.linked_id.slice(0, 8)}…`}
              {l.note && <em style={{ color: 'var(--cm-ink-mute)', marginLeft: 6, fontStyle: 'normal' }}>· {l.note}</em>}
            </span>
            <button type="button" className="cm-btn cm-btn-ghost cm-btn-sm"
                     onClick={() => removeLink(l.id)} aria-label="Rimuovi collegamento"
                     data-testid={`cm-assoc-remove-${l.id}`}>
              <Icons.X size={12} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <div className="cm-field">
        <label className="cm-label">Associa a…</label>
        <select className="cm-select" value={pickType}
                 onChange={(e) => { setPickType(e.target.value); setPicked(null); }}
                 data-testid="cm-assoc-type">
          {PICK_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
      </div>
      <div className="cm-field">
        <EntityPicker linkedType={pickType} value={picked} onPick={setPicked}
                       placeholder={`Cerca ${TYPE_LABELS[pickType].toLowerCase()}…`} />
      </div>
      <div className="cm-field">
        <label className="cm-label">Nota (opzionale)</label>
        <input className="cm-input" value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Es. Prima offerta inviata"
                data-testid="cm-assoc-note" />
      </div>
      <button type="button" className="cm-btn cm-btn-primary"
               onClick={addLink} disabled={busy || !picked}
               style={{ width: '100%', justifyContent: 'center' }}
               data-testid="cm-assoc-add">
        <Icons.Link2 size={13} aria-hidden="true" />
        {busy ? 'Salvataggio…' : 'Crea collegamento'}
      </button>
    </aside>
  );
}
