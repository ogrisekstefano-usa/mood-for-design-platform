/**
 * ClientProfileAdminPage · ITER162 rev3
 *
 * Command Center · `/blueprint/client-profile`
 *
 * Permette allo studio di configurare:
 *   1. Preset Chameleon Atelier™ attivo (atelier · axis · gallery · residence)
 *   2. Le 6 immagini placeholder usate dal Welcome Panel Atelier™
 *      (hero, atmosphere, lifestyle, materials, priority, nextStep)
 *
 * Riusa EditorialMediaField per l'upload (firma signed URL bucket privato).
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Sparkles, ImageIcon, Save } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import EditorialMediaField from '../../components/common/EditorialMediaField';
import '../storefront/pagesAdmin.css';
import './clientProfileAdmin.css';

const SLOT_LABELS = {
  hero:       { label: 'Hero · cinematic background', sub: 'Immagine grande dietro al messaggio di benvenuto.' },
  atmosphere: { label: 'Card · Atmosfera',            sub: 'Thumbnail della prima card delle indicazioni.' },
  lifestyle:  { label: 'Card · Stile di vita',        sub: 'Thumbnail della seconda card.' },
  materials:  { label: 'Card · Preferenze (materiali)', sub: 'Thumbnail della terza card.' },
  priority:   { label: 'Card · Priorità',             sub: 'Thumbnail della quarta card.' },
  nextStep:   { label: 'Prossimo passo · accessoria', sub: 'Piccola immagine quadrata accanto al testo.' },
};

const PRESET_META = {
  atelier:   { label: 'Atelier™',   sub: 'Cinematic editorial · DISPONIBILE',           available: true  },
  axis:      { label: 'Axis™',      sub: 'Minimal precision · in arrivo',                available: false },
  gallery:   { label: 'Gallery™',   sub: 'Curatorial · in arrivo',                        available: false },
  residence: { label: 'Residence™', sub: 'Quiet warmth · in arrivo',                      available: false },
};

const ClientProfileAdminPage = () => {
  const [cfg, setCfg]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty]   = useState(false);
  const [saving, setSaving] = useState(false);

  // Local working copy (we save the diff vs. server)
  const [presetKey, setPresetKey]       = useState('atelier');
  const [placeholders, setPlaceholders] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/admin/client-profile-config');
      setCfg(r.data);
      setPresetKey(r.data.preset_key || 'atelier');
      setPlaceholders(r.data.placeholders_custom || {});
      setDirty(false);
    } catch (err) {
      toast.error('Non riesco a caricare la configurazione.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateSlot = (slot, value) => {
    setPlaceholders((p) => {
      const next = { ...p };
      if (!value || !value.url) delete next[slot];
      else next[slot] = { url: value.url, asset_id: value.asset_id, alt: value.alt };
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.put('/api/admin/client-profile-config', {
        preset_key:   presetKey,
        placeholders: placeholders,
      });
      setCfg(r.data);
      setDirty(false);
      toast.success('Configurazione salvata.');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Salvataggio fallito.');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    if (!cfg) return;
    setPresetKey(cfg.preset_key || 'atelier');
    setPlaceholders(cfg.placeholders_custom || {});
    setDirty(false);
  };

  const effective = cfg?.placeholders || {};

  return (
    <div className="cpa-shell" data-testid="client-profile-admin">
      {/* Rail (riuso quella di PagesAdminPage) */}
      <aside className="pa-rail">
        <Link to="/dashboard" className="pa-rail__backlink" data-testid="cpa-rail-back">
          ← Dashboard Blueprint
        </Link>
        <nav className="pa-rail__nav">
          <Link className="pa-rail__link" to="/blueprint/experience" data-testid="cpa-rail-pages">
            ← Pagine pubbliche
          </Link>
          <button className="pa-rail__link" data-active="true" data-testid="cpa-rail-active">
            <Sparkles size={14} strokeWidth={1.7} /> Client Profile
          </button>
        </nav>
      </aside>

      {/* Main */}
      <main className="cpa-main">
        <header className="cpa-head" data-testid="cpa-head">
          <div>
            <p className="cpa-eyebrow">Command Center · Client Profile</p>
            <h1 className="cpa-title">
              <em>Chameleon Atelier™</em> & immagini editoriali
            </h1>
            <p className="cpa-lede">
              Da qui scegli l'estetica del Client Profile e personalizzi le
              immagini placeholder che il cliente vede al primo ingresso.
            </p>
          </div>
          <div className="cpa-head__actions">
            <button
              type="button"
              className="cpa-btn cpa-btn--ghost"
              onClick={reset}
              disabled={!dirty || saving}
              data-testid="cpa-reset"
            >Annulla</button>
            <button
              type="button"
              className="cpa-btn cpa-btn--primary"
              onClick={save}
              disabled={!dirty || saving}
              data-testid="cpa-save"
            >
              <Save size={14} strokeWidth={1.7} />
              <span>{saving ? 'Salvo…' : 'Salva configurazione'}</span>
            </button>
          </div>
        </header>

        {/* ── PRESET ─────────────────────────────────────── */}
        <section className="cpa-section" data-testid="cpa-section-preset">
          <h2 className="cpa-section__title">Preset attivo</h2>
          <p className="cpa-section__lede">
            La scelta determina layout, palette e densità del Client Profile.
          </p>
          <div className="cpa-presets" data-testid="cpa-presets">
            {Object.entries(PRESET_META).map(([key, meta]) => {
              const active = presetKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`cpa-preset ${active ? 'is-active' : ''} ${meta.available ? '' : 'is-locked'}`}
                  disabled={!meta.available}
                  onClick={() => { if (meta.available) { setPresetKey(key); setDirty(true); } }}
                  data-testid={`cpa-preset-${key}`}
                  aria-pressed={active}
                >
                  <span className="cpa-preset__check">
                    {active && <Check size={14} strokeWidth={2.2} aria-hidden />}
                  </span>
                  <span className="cpa-preset__body">
                    <span className="cpa-preset__label">{meta.label}</span>
                    <span className="cpa-preset__sub">{meta.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── PLACEHOLDERS ───────────────────────────────── */}
        <section className="cpa-section" data-testid="cpa-section-placeholders">
          <h2 className="cpa-section__title">Immagini editoriali placeholder</h2>
          <p className="cpa-section__lede">
            Carica un'immagine per ogni slot. Se non carichi nulla, viene
            usato un fallback editoriale curato. Le immagini sono
            mostrate al cliente prima che il suo Journey sviluppi i propri
            asset (moodboard, materioteca…).
          </p>

          {loading ? (
            <p className="cpa-loading" data-testid="cpa-loading">Caricamento…</p>
          ) : (
            <div className="cpa-slots">
              {Object.entries(SLOT_LABELS).map(([slot, meta]) => {
                const customUrl  = placeholders[slot]?.url;
                const effectiveUrl = effective[slot]?.url;
                const usingCustom = !!customUrl;
                return (
                  <article
                    key={slot}
                    className="cpa-slot"
                    data-testid={`cpa-slot-${slot}`}
                  >
                    <header className="cpa-slot__head">
                      <p className="cpa-slot__label">{meta.label}</p>
                      <p className="cpa-slot__sub">{meta.sub}</p>
                      <p className={`cpa-slot__badge ${usingCustom ? 'is-custom' : 'is-default'}`}>
                        {usingCustom ? 'Custom' : 'Default editoriale'}
                      </p>
                    </header>

                    <div className="cpa-slot__preview">
                      {effectiveUrl && (
                        <img src={effectiveUrl} alt="" loading="lazy" />
                      )}
                    </div>

                    <div className="cpa-slot__field">
                      <EditorialMediaField
                        valueShape="object"
                        value={customUrl
                          ? { url: customUrl, asset_id: placeholders[slot]?.asset_id, alt_text: placeholders[slot]?.alt }
                          : { url: '' }}
                        onChange={(obj) => updateSlot(slot, obj?.url ? obj : null)}
                        preset="gallery"
                        label=""
                        folder={`client-profile/${slot}`}
                        entityType="client_profile_placeholder"
                        entityId={slot}
                        testId={`cpa-media-${slot}`}
                      />
                      {usingCustom && (
                        <button
                          type="button"
                          className="cpa-slot__reset"
                          onClick={() => updateSlot(slot, null)}
                          data-testid={`cpa-slot-reset-${slot}`}
                        >
                          Torna al default
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Footer save bar */}
        {dirty && (
          <div className="cpa-savebar" data-testid="cpa-savebar">
            <span>Hai modifiche non salvate</span>
            <div>
              <button className="cpa-btn cpa-btn--ghost" onClick={reset} disabled={saving}>
                Annulla
              </button>
              <button className="cpa-btn cpa-btn--primary" onClick={save} disabled={saving}>
                {saving ? 'Salvo…' : 'Salva ora'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ClientProfileAdminPage;
