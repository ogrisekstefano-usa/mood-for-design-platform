/**
 * AdaptationOperationsPanel
 * ────────────────────────────────────────────────────────────────────
 * Inline action strip surfacing the 7 canonical Editorial Adaptation™
 * operations for the currently selected variant:
 *
 *   Compose From Master · Re-sync · Compare · Preserve Manual ·
 *   Restore Editorial Composition · Lock Manual · Open Public Preview
 *
 * Each action composes existing endpoints. Where a backend endpoint is
 * not yet specified, the UI surfaces a clear status (Coming Soon /
 * Locked) — never a silent no-op.
 */
import React, { useState } from 'react';
import { Sparkles, RefreshCw, GitCompare, ShieldCheck, RotateCcw, Lock, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useT } from "../../i18n/useT";
const Action = ({
  icon: Icon,
  label,
  description,
  onClick,
  disabled,
  danger,
  busy,
  testid,
  comingSoon
}) => <button type="button" onClick={onClick} disabled={disabled || busy || comingSoon} data-testid={testid} title={comingSoon ? 'Disponibile in P2' : description} className={`adop-action ${danger ? 'is-danger' : ''} ${comingSoon ? 'is-coming-soon' : ''}`}>
    <span className="adop-action__icon">
      {busy ? <Loader2 size={11} className="animate-spin" /> : <Icon size={11} strokeWidth={1.6} />}
    </span>
    <span className="adop-action__label">{label}</span>
    {comingSoon && <span className="adop-action__chip">soon</span>}
  </button>;
const AdaptationOperationsPanel = ({
  variant,
  master,
  onChanged,
  onOpenPreview
}) => {
  const {
    t
  } = useT();
  const [busy, setBusy] = useState(null);
  if (!variant?.id) return null;
  const isCanonical = !variant.target_locale || variant.target_locale.toLowerCase() === (variant.blueprint_review_locale || 'it-it').toLowerCase();
  const composeFromMaster = async () => {
    if (!confirm('Sostituire i body blocks attuali con la composizione dal master? Le modifiche manuali andranno perse.')) return;
    setBusy('compose');
    try {
      // Canonical endpoint: POST /api/editorial/variants/{vid}/compose
      // Calls editorial_ai.compose_variant() server-side, regenerates body_blocks
      // from the master's conceptual_direction, sets status to ready_for_editorial_review.
      const r = await api.post(`/api/editorial/variants/${variant.id}/compose`, {});
      const ms = r.data?.duration_ms;
      toast.success(`Composizione rigenerata dal master${ms ? ` · ${(ms / 1000).toFixed(1)}s` : ''}`);
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.response?.data?.error || 'Composizione fallita');
    } finally {
      setBusy(null);
    }
  };
  const resync = async () => {
    setBusy('resync');
    try {
      await api.post(`/api/editorial/variants/${variant.id}/transition`, {
        to_status: 'rebalancing'
      });
      toast.success('Re-sync avviato · ribilanciamento in corso');
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Re-sync fallito');
    } finally {
      setBusy(null);
    }
  };
  const compare = () => {
    // Open compare drawer (route-based)
    const u = new URL(window.location.href);
    u.searchParams.set('compareVariant', variant.id);
    window.history.replaceState(null, '', u.toString());
    toast.info('Compare Against Master · pannello in arrivo P2');
  };
  const preserveManual = async () => {
    setBusy('preserve');
    try {
      await api.patch(`/api/editorial/variants/${variant.id}`, {
        metadata_json: {
          ...(variant.metadata_json || {}),
          preserve_manual: true,
          locked_at: new Date().toISOString()
        }
      });
      toast.success('Adattamento manuale preservato — re-sync non sovrascriverà');
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Salvataggio fallito');
    } finally {
      setBusy(null);
    }
  };
  const restoreComposition = async () => {
    if (!confirm('Ripristinare la composizione editoriale rigenerata? Le modifiche manuali NON saranno preservate.')) return;
    setBusy('restore');
    try {
      await api.patch(`/api/editorial/variants/${variant.id}`, {
        metadata_json: {
          ...(variant.metadata_json || {}),
          preserve_manual: false,
          restored_at: new Date().toISOString()
        }
      });
      await composeFromMaster();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Restore fallito');
    } finally {
      setBusy(null);
    }
  };
  const lockManual = async () => {
    setBusy('lock');
    try {
      await api.patch(`/api/editorial/variants/${variant.id}`, {
        metadata_json: {
          ...(variant.metadata_json || {}),
          manual_locked: true,
          locked_at: new Date().toISOString()
        }
      });
      toast.success('Versione manuale bloccata');
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Lock fallito');
    } finally {
      setBusy(null);
    }
  };
  return <div className="adop-panel" data-testid="adaptation-operations-panel">
      <div className="adop-panel__head">
        <p className="adop-panel__eyebrow">Editorial Adaptation Operations</p>
        <span className="adop-panel__locale">
          {variant.target_locale || master?.canonical_locale || '—'}
        </span>
      </div>
      <div className="adop-panel__actions">
        <Action icon={Sparkles} label="Compose From Master" description={t("editorial.adaptation_operations.rigenera_i_body_blocks_partendo_dalla_direzione_ed")} onClick={composeFromMaster} disabled={isCanonical} busy={busy === 'compose'} testid="adop-compose" />
        <Action icon={RefreshCw} label="Re-sync" description={t("editorial.adaptation_operations.riallinea_l_adattamento_al_master_attuale_mantenen")} onClick={resync} disabled={isCanonical} busy={busy === 'resync'} testid="adop-resync" />
        <Action icon={GitCompare} label="Compare Against Master" description={t("editorial.adaptation_operations.apre_un_diff_lato_a_lato_tra_l_adattamento_e_la_di")} onClick={compare} comingSoon testid="adop-compare" />
        <Action icon={ShieldCheck} label="Preserve Manual" description={t("editorial.adaptation_operations.marca_le_modifiche_correnti_come_curate_manualment")} onClick={preserveManual} busy={busy === 'preserve'} testid="adop-preserve" />
        <Action icon={RotateCcw} label="Restore Composition" description={t("editorial.adaptation_operations.ripristina_la_composizione_editoriale_rigenerata_d")} onClick={restoreComposition} disabled={isCanonical} busy={busy === 'restore'} testid="adop-restore" danger />
        <Action icon={Lock} label="Lock Manual Version" description={t("editorial.adaptation_operations.blocca_la_versione_manuale_corrente_come_stabile")} onClick={lockManual} busy={busy === 'lock'} testid="adop-lock" />
        <Action icon={Eye} label="Open Public Preview" description={t("editorial.adaptation_operations.apre_l_anteprima_pubblica_nella_surface_di_destina")} onClick={() => onOpenPreview?.(variant)} testid="adop-preview" />
      </div>
    </div>;
};
export default AdaptationOperationsPanel;