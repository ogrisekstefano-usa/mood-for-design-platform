/**
 * KnowledgeAnchorsRail · KE-005B.2
 *
 * Mostra le entità canoniche ancorate a una surface (design_journey
 * milestone · ma riusabile per moodboard / material_board / ecc.) e
 * permette di aggiungere / rimuovere / ispezionare.
 *
 * Usa il bus condiviso /api/surfaces/{type}/{id}/attach|detach|entities
 * scritto in KE-005B.1.
 *
 * Props:
 *   - surfaceType: 'design_journey' | 'moodboard' | …
 *   - surfaceId: string (uuid)
 *   - readOnly: bool
 *   - title: string (header, default 'Entità ancorate')
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Package, Layers, User, Tag, Plus, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import EntityPicker from './EntityPicker';
import EntityContextPanel from './EntityContextPanel';
import './knowledge-anchors.css';

const TYPE_ICON = {
  product: Package, material: Layers, finish: Layers,
  designer: User, brand: Tag,
};

const KnowledgeAnchorsRail = ({
  surfaceType, surfaceId,
  readOnly = false, title = 'Entità ancorate',
}) => {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [panel, setPanel]     = useState(null);

  const load = useCallback(() => {
    if (!surfaceId) return;
    let alive = true;
    api.get(`/api/surfaces/${surfaceType}/${surfaceId}/entities`)
      .then((r) => {
        if (!alive) return;
        setItems(r.data?.entities || []);
        setLoading(false);
      })
      .catch(() => { if (alive) { setItems([]); setLoading(false); } });
    return () => { alive = false; };
  }, [surfaceType, surfaceId]);

  useEffect(() => { load(); }, [load]);

  const onSelect = (entity) => {
    api.post(`/api/surfaces/${surfaceType}/${surfaceId}/attach`,
      { entity_id: entity.id })
      .then(() => { setPickerOpen(false); load(); })
      .catch(() => setPickerOpen(false));
  };

  const onRemove = (entityId) => {
    api.post(`/api/surfaces/${surfaceType}/${surfaceId}/detach`,
      { entity_id: entityId })
      .then(() => { setPanel(null); load(); })
      .catch(() => {});
  };

  if (!surfaceId) return null;

  return (
    <section className="kar" data-testid="knowledge-anchors-rail">
      <header className="kar__head">
        <p className="kar__eyebrow">Knowledge-Native</p>
        <h3 className="kar__title">{title}</h3>
        {!readOnly && (
          <button type="button" className="kar__add"
                  onClick={() => setPickerOpen(true)}
                  data-testid="knowledge-anchors-add">
            <Plus size={13} strokeWidth={1.7} />
            Ancora un&apos;entità
          </button>
        )}
      </header>

      {loading ? (
        <div className="kar__loading">
          <Loader2 size={14} strokeWidth={1.7} className="kar__spin" />
          Caricamento entità ancorate…
        </div>
      ) : items.length === 0 ? (
        <p className="kar__empty">
          Nessuna entità ancorata ancora a questa tappa. Clicca <em>Ancora un&apos;entità</em> per collegare prodotti, materiali o designer dal tuo Brand Atlas.
        </p>
      ) : (
        <ul className="kar__list">
          {items.map((it) => {
            const Icon = TYPE_ICON[it.entity_type] || Tag;
            return (
              <li key={it.entity_id} className="kar__chip"
                  data-testid={`knowledge-anchor-chip-${it.entity_id}`}>
                <button type="button" className="kar__chip-body"
                        onClick={() => setPanel({ entityId: it.entity_id })}>
                  <Icon size={11} strokeWidth={1.7} className="kar__chip-icon" />
                  <span className="kar__chip-name">{it.display_name || '—'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {pickerOpen && (
        <EntityPicker
          open
          onClose={() => setPickerOpen(false)}
          onSelect={onSelect}
          entityTypes={['product', 'material', 'finish', 'designer']}
          title={`Ancora un'entità a questo capitolo`}
        />
      )}

      {panel && (
        <EntityContextPanel
          open
          entityId={panel.entityId}
          onClose={() => setPanel(null)}
          surfaceContext={{ type: surfaceType, id: surfaceId }}
          onRemove={() => onRemove(panel.entityId)}
        />
      )}
    </section>
  );
};

export default KnowledgeAnchorsRail;
