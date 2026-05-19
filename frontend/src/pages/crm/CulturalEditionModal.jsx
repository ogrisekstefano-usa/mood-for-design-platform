/**
 * CulturalEditionModal — Foundation UX for "Create a Cultural Edition™".
 *
 * Picks a target submarket (Miami · NYC · Dubai · Milano · …) from the
 * 48-cluster taxonomy seeded in 048_market_intelligence_engine.
 * Logs the intent on the account timeline + returns the submarket
 * cultural profile so the editorial studio can adapt tone/rhythm/CTA.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { X, Globe } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';

export const CulturalEditionModal = ({ open, accountId, sourceType = 'project',
                                      sourceId = '', onClose, onCreated }) => {
  const [submarkets, setSubmarkets] = useState([]);
  const [marketFilter, setMarketFilter] = useState('');
  const [selected, setSelected] = useState('');
  const [locale, setLocale] = useState('en-US');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [srcType, setSrcType] = useState(sourceType);
  const [srcId, setSrcId] = useState(sourceId);

  useEffect(() => {
    if (!open) return;
    setSelected(''); setMarketFilter(''); setNote('');
    setSrcType(sourceType); setSrcId(sourceId);
    api.get('/api/market-intelligence/submarkets').then((r) => {
      setSubmarkets(r.data?.submarkets || []);
    }).catch(() => setSubmarkets([]));
  }, [open, sourceType, sourceId]);

  const markets = useMemo(() => {
    const s = new Set(submarkets.map((x) => x.macro_market_code).filter(Boolean));
    return Array.from(s).sort();
  }, [submarkets]);

  const filtered = useMemo(() => {
    if (!marketFilter) return submarkets;
    return submarkets.filter((x) => x.macro_market_code === marketFilter);
  }, [submarkets, marketFilter]);

  const selectedSub = useMemo(
    () => submarkets.find((x) => x.code === selected),
    [submarkets, selected]
  );

  // Helper: resolve localized display name from the submarket row.
  const subLabel = (s) => {
    if (!s) return '';
    const dn = s.display_name || s.name || {};
    if (typeof dn === 'string') return dn;
    return dn['it-IT'] || dn['en-US'] || s.code;
  };
  const subProfile = (s) => {
    if (!s) return '';
    const ep = s.editorial_profile || {};
    const arr = ep['it-IT'] || ep['en-US'];
    return Array.isArray(arr) ? arr.join(' · ') : (typeof arr === 'string' ? arr : '');
  };

  if (!open) return null;

  const save = async () => {
    if (!selectedSub) return;
    setSaving(true);
    try {
      const r = await api.post(`/api/relationships/accounts/${accountId}/cultural-editions`, {
        source_type: srcType,
        source_id:   srcId || accountId,
        target_market_code:    selectedSub.macro_market_code,
        target_submarket_code: selectedSub.code,
        target_locale:         locale,
        note,
      });
      toast.success(`Cultural Edition™ avviata · ${subLabel(selectedSub)}`);
      onCreated?.(r.data);
      onClose?.();
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.detail || 'Operazione fallita');
    } finally { setSaving(false); }
  };

  return (
    <div className="rl-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="rl-modal" data-testid="cultural-edition-modal">
        <div className="rl-modal__head">
          <div>
            <p className="rl-modal__eyebrow">Create a Cultural Edition™</p>
            <h2 className="rl-modal__title">Adatta tono, ritmo, CTA al mercato</h2>
          </div>
          <button className="rl-modal__close" onClick={onClose} aria-label="Chiudi" data-testid="ce-close">
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--rl-ink-soft)', lineHeight: 1.6, marginBottom: 18 }}>
          MOOD adatta tono, ritmo, CTA e narrativa al mercato selezionato. Il sistema
          tiene conto di hospitality expectations, visual rhythm e luxury perception
          del cluster scelto.
        </p>

        <div className="rl-field">
          <label className="rl-field__label">Origine</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="rl-field__select" value={srcType}
                    onChange={(e) => setSrcType(e.target.value)}
                    style={{ maxWidth: 200 }}
                    data-testid="ce-source-type">
              <option value="project">Progetto</option>
              <option value="article">Articolo</option>
              <option value="moodboard">Moodboard</option>
              <option value="account">Account</option>
            </select>
            <input className="rl-field__input" value={srcId}
                   onChange={(e) => setSrcId(e.target.value)}
                   placeholder="ID origine (opzionale per account)"
                   data-testid="ce-source-id" />
          </div>
        </div>

        <div className="rl-field">
          <label className="rl-field__label">Macro mercato</label>
          <select className="rl-field__select" value={marketFilter}
                  onChange={(e) => setMarketFilter(e.target.value)}
                  data-testid="ce-market-select">
            <option value="">Tutti i mercati</option>
            {markets.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="rl-field">
          <label className="rl-field__label">Submarket · cluster culturale</label>
          <select className="rl-field__select" value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  data-testid="ce-submarket-select">
            <option value="">Seleziona…</option>
            {filtered.map((s) => (
              <option key={s.code} value={s.code}>
                {subLabel(s)} · {s.macro_market_code}
              </option>
            ))}
          </select>
        </div>

        {selectedSub && (
          <div className="rl-insight" style={{ marginBottom: 14 }}>
            <Globe size={14} className="rl-insight__icon" />
            <div className="rl-insight__text">
              <strong style={{ fontStyle: 'normal', color: 'var(--rl-ink)' }}>{subLabel(selectedSub)}</strong>
              {subProfile(selectedSub) && (<> · {subProfile(selectedSub)}</>)}
            </div>
          </div>
        )}

        <div className="rl-field">
          <label className="rl-field__label">Lingua di destinazione</label>
          <select className="rl-field__select" value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  data-testid="ce-locale-select">
            <option value="it-IT">Italiano</option>
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="fr-FR">Français</option>
            <option value="de-DE">Deutsch</option>
            <option value="es-ES">Español</option>
          </select>
        </div>

        <div className="rl-field">
          <label className="rl-field__label">Note (opzionale)</label>
          <textarea className="rl-field__textarea" value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Briefing editoriale — angle desiderato, vincoli…"
                    data-testid="ce-note" />
        </div>

        <div className="rl-modal__actions">
          <button className="rl-btn rl-btn--ghost" onClick={onClose} data-testid="ce-cancel">
            Annulla
          </button>
          <button className="rl-btn rl-btn--primary" onClick={save}
                  disabled={!selected || saving} data-testid="ce-create">
            {saving ? 'Avvio…' : 'Crea Cultural Edition™'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CulturalEditionModal;
