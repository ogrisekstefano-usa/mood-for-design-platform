/**
 * CuratedCollectionDrawer — Phase F2.1.
 *
 * Premium drawer to create a new Curated Collection.
 * Fields: title · description · tags[] · visibility.
 */
import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useT } from '../../i18n/useT';

const VISIBILITY_OPTIONS = [
  { key: 'team',           label: 'Studio',        hint: 'Visibile a tutto il team' },
  { key: 'private',        label: 'Privata',       hint: 'Solo per te' },
  { key: 'client_visible', label: 'Cliente',       hint: 'Condivisibile col cliente' },
];

export default function CuratedCollectionDrawer({ onClose, onCreated }) {
  const { t } = useT();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [visibility, setVisibility] = useState('team');
  const [busy, setBusy] = useState(false);

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) { setTagInput(''); return; }
    setTags(arr => [...arr, t].slice(0, 12));
    setTagInput('');
  };

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    if (!title.trim()) { toast.error('Indica un titolo'); return; }
    setBusy(true);
    try {
      const r = await api.post('/api/inspirations/references/collections', {
        title: title.trim(),
        description: description.trim() || undefined,
        tags: tags.length ? tags : undefined,
        visibility,
      });
      toast.success('Collezione creata');
      onCreated && onCreated(r.data?.item);
    } catch {
      toast.error('Creazione non riuscita');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="cc-drawer"
      role="dialog"
      aria-modal="true"
      data-testid="cc-drawer"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form className="cc-drawer__panel" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <header className="cc-drawer__head">
          <div>
            <p className="cc-drawer__eyebrow">Curated References™</p>
            <h3 className="cc-drawer__title"><em>{t('atelier_voice.curated_collection.new_collection', null, 'New collection')}</em></h3>
            <p className="cc-drawer__sub">
              Un capitolo curatoriale del tuo atelier. Lo userai per organizzare
              riferimenti per cliente, materia, mercato o atmosfera.
            </p>
          </div>
          <button
            type="button"
            className="cc-drawer__close"
            onClick={onClose}
            aria-label={t('common.close')}
            data-testid="cc-close"
          >
            <Icons.X size={14} />
          </button>
        </header>

        <div className="cc-drawer__body">
          <label className="cc-field">
            <span>Titolo</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="es. Cliente Riva — Miami warm"
              autoFocus
              maxLength={140}
              data-testid="cc-title"
            />
          </label>

          <label className="cc-field">
            <span>{t('inspirations.curated_collection.descrizione_editoriale')}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t('inspirations.curated_collection.description_placeholder')}
              data-testid="cc-description"
            />
          </label>

          <div className="cc-field">
            <span>Tag liberi</span>
            <div className="cc-tags">
              {tags.map(t => (
                <span key={t} className="cc-tag">
                  {t}
                  <button type="button" onClick={() => setTags(arr => arr.filter(x => x !== t))}
                    aria-label={`rimuovi ${t}`}>
                    <Icons.X size={10} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
                  else if (e.key === 'Backspace' && !tagInput && tags.length) {
                    setTags(arr => arr.slice(0, -1));
                  }
                }}
                placeholder={tags.length ? '' : 'es. Miami warm · Cliente Riva · Hospitality'}
                data-testid="cc-tag-input"
              />
            </div>
          </div>

          <div className="cc-field">
            <span>Visibilità</span>
            <div className="cc-visibility">
              {VISIBILITY_OPTIONS.map(v => (
                <button
                  key={v.key}
                  type="button"
                  className={`cc-vis ${visibility === v.key ? 'is-on' : ''}`}
                  onClick={() => setVisibility(v.key)}
                  data-testid={`cc-vis-${v.key}`}
                >
                  <p className="cc-vis__name">{v.label}</p>
                  <p className="cc-vis__hint">{v.hint}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="cc-drawer__foot">
          <button type="button" className="cc-btn" onClick={onClose}>
            Annulla
          </button>
          <button
            type="submit"
            className="cc-btn cc-btn--primary"
            disabled={busy}
            data-testid="cc-submit"
          >
            {busy ? 'Creo…' : 'Crea capitolo'}
          </button>
        </footer>
      </form>
    </div>
  );
}
