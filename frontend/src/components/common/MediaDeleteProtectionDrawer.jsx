/**
 * MediaDeleteProtectionDrawer™
 * ────────────────────────────────────────────────────────────────────
 * P0 DAM safety net. Opens when a user tries to archive/replace/delete
 * an asset that is currently used in N editorial relationships.
 *
 * Shows:
 *   • the usage relationships graph (preview + entity_type + entity_title
 *     + locale/market + click-to-open deeplink)
 *   • 5 actions:
 *       1. Replace everywhere   (upload new file → media.replace, migrate_links=true)
 *       2. Replace selectively  (deferred — disabled UI with explanation)
 *       3. Archive but keep linked (soft archive, links stay pointing here)
 *       4. Force remove (archive with stern warning)
 *       5. Open usages (closes drawer + scrolls inspector to usage tab)
 *
 * Philosophy:
 *   "editorial relationships graph", NOT "file system".
 */
import React, { useRef, useState } from 'react';
import { X, AlertTriangle, RefreshCw, ListChecks, Archive, Trash2, ExternalLink, Loader2, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { media, uploadMediaFile } from '../../lib/mediaApi';
import { useT } from "../../i18n/useT";
const ENTITY_META = {
  project: {
    label: 'Project',
    icon: 'FolderOpen',
    href: id => `/workspace/projects/${id}`
  },
  moodboard: {
    label: 'Moodboard',
    icon: 'Layers',
    href: id => `/moodboards/${id}`
  },
  proposal: {
    label: 'Proposal',
    icon: 'FileText',
    href: id => `/workspace/proposals/${id}`
  },
  lead: {
    label: 'Lead',
    icon: 'Users',
    href: id => `/workspace/leads/${id}`
  },
  magazine_article: {
    label: 'Magazine Article',
    icon: 'BookOpen',
    href: id => `/blueprint/editorial?article=${id}`
  },
  cms_page: {
    label: 'Storefront Page',
    icon: 'Globe',
    href: () => '/blueprint/experience'
  },
  storefront_page: {
    label: 'Storefront Page',
    icon: 'Globe',
    href: () => '/blueprint/experience'
  },
  cms_section: {
    label: 'Storefront Section',
    icon: 'LayoutGrid',
    href: () => '/blueprint/experience'
  },
  material: {
    label: 'Material',
    icon: 'Gem',
    href: id => `/library/materials/${id}`
  },
  branding_asset: {
    label: 'Branding',
    icon: 'Palette',
    href: () => '/settings/brand'
  },
  design_reference: {
    label: 'Pinterest Research',
    icon: 'Compass',
    href: () => '/workspace/references'
  }
};
const RelationshipRow = ({
  link,
  assetUrl
}) => {
  const {
    t
  } = useT();
  const meta = ENTITY_META[link.entity_type] || {
    label: link.entity_type,
    icon: 'Circle',
    href: () => '#'
  };
  const title = link.entity_title || `${meta.label} · ${(link.entity_id || '').slice(0, 8)}`;
  const href = meta.href(link.entity_id);
  const localeChip = link.metadata_json?.locale || link.metadata_json?.market;
  const inner = <div className="flex items-center gap-3 p-3 rounded-[10px] bg-[var(--bp-surface-2)] border border-[var(--bp-border)] hover:border-[var(--bp-border-hover)] transition-colors group">
      <div className="w-12 h-12 rounded-[7px] overflow-hidden bg-[var(--bp-surface-3)] border border-[var(--bp-border)] flex-shrink-0">
        {assetUrl && <img src={assetUrl} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] font-body mb-0.5">
          {meta.label}{link.role ? ` · ${link.role}` : ''}{localeChip ? ` · ${localeChip}` : ''}
        </p>
        <p className="text-[12.5px] text-[var(--bp-text-primary)] truncate font-body">{title}</p>
      </div>
      <ExternalLink size={13} strokeWidth={1.5} className="text-[var(--bp-text-muted)] group-hover:text-[var(--bp-primary)] transition-colors flex-shrink-0" />
    </div>;
  return href !== '#' ? <Link to={href} data-testid={`mdp-usage-${link.id}`} className="block">{inner}</Link> : <div data-testid={`mdp-usage-${link.id}`}>{inner}</div>;
};
const ActionCard = ({
  icon: Icon,
  title,
  description,
  onClick,
  danger,
  disabled,
  testid,
  loading
}) => <button type="button" onClick={onClick} disabled={disabled || loading} data-testid={testid} className={`w-full text-left p-4 rounded-[10px] border transition-colors flex items-start gap-3 ${disabled ? 'border-[var(--bp-border)] bg-[var(--bp-surface-2)]/40 cursor-not-allowed opacity-60' : danger ? 'border-[var(--bp-border)] bg-[var(--bp-surface-2)] hover:border-red-400/40 hover:bg-red-500/5' : 'border-[var(--bp-border)] bg-[var(--bp-surface-2)] hover:border-[var(--bp-primary)] hover:bg-[var(--bp-primary-soft)]'}`}>
    <span className={`flex-shrink-0 w-9 h-9 rounded-[7px] flex items-center justify-center ${danger ? 'bg-red-500/10 text-red-400' : 'bg-[var(--bp-surface-3)] text-[var(--bp-text-secondary)]'}`}>
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} strokeWidth={1.6} />}
    </span>
    <div className="flex-1 min-w-0">
      <p className={`text-[13px] font-body font-medium leading-tight ${danger ? 'text-red-400' : 'text-[var(--bp-text-primary)]'}`}>
        {title}
      </p>
      <p className="text-[11.5px] text-[var(--bp-text-muted)] font-body mt-1 leading-relaxed">
        {description}
      </p>
      {disabled && <span className="inline-block mt-2 text-[9px] uppercase tracking-[0.2em] text-[var(--bp-text-faint)] font-mono">
          <Lock size={8} className="inline mr-1" />Coming soon
        </span>}
    </div>
  </button>;
const MediaDeleteProtectionDrawer = ({
  asset,
  links = [],
  onClose,
  onCompleted,
  onForceArchive
}) => {
  const {
    t
  } = useT();
  const fileInputRef = useRef(null);
  const [pending, setPending] = useState(null); // 'replace' | 'archive_keep' | 'force_remove'
  const [confirmForce, setConfirmForce] = useState(false);
  const usageCount = links.length;
  const assetUrl = asset?.display_url || asset?.file_url;

  // Group by entity_type for visual grouping
  const grouped = links.reduce((acc, l) => {
    (acc[l.entity_type] = acc[l.entity_type] || []).push(l);
    return acc;
  }, {});

  // ── Action 1: Replace everywhere (upload new + migrate_links)
  const handleReplaceFile = async file => {
    if (!file?.type?.startsWith('image/')) {
      toast.error('Solo immagini');
      return;
    }
    setPending('replace');
    try {
      const newAsset = await uploadMediaFile({
        file,
        bucket: asset.bucket || 'tenant-assets',
        folder: 'library/replacements'
      });
      await media.replace(asset.id, {
        new_asset_id: newAsset.id,
        migrate_links: true
      });
      toast.success(`Asset sostituito · ${usageCount} ${usageCount === 1 ? 'relazione migrata' : 'relazioni migrate'}`);
      onCompleted?.();
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Sostituzione fallita');
      setPending(null);
    }
  };

  // ── Action 3: Archive but keep linked
  const handleArchiveKeep = async () => {
    setPending('archive_keep');
    try {
      await media.archive(asset.id);
      toast.success('Asset archiviato · relazioni preservate (lo show pubblico mostrerà l\'asset finché non viene sostituito)');
      onCompleted?.();
      onClose?.();
    } catch {
      toast.error('Archiviazione fallita');
      setPending(null);
    }
  };

  // ── Action 4: Force remove (stern flow)
  const handleForceRemove = async () => {
    if (!confirmForce) {
      setConfirmForce(true);
      return;
    }
    setPending('force_remove');
    try {
      if (onForceArchive) {
        await onForceArchive();
      } else {
        await media.archive(asset.id);
      }
      toast.success('Asset rimosso forzatamente · le relazioni restano orfane');
      onCompleted?.();
      onClose?.();
    } catch {
      toast.error('Rimozione fallita');
      setPending(null);
    }
  };

  // ── Action 5: Open usages (jump to usage tab inside inspector)
  const handleOpenUsages = () => {
    onClose?.({
      jumpToUsage: true
    });
  };
  return <div data-testid="media-delete-protection" className="fixed inset-0 z-[60] bg-black/72 backdrop-blur-sm flex items-stretch justify-end" onClick={() => onClose?.()}>
      <aside onClick={e => e.stopPropagation()} className="w-full max-w-[680px] h-full bg-[var(--bp-surface-elevated)] border-l border-[var(--bp-border)] shadow-2xl flex flex-col">
        {/* Header (sticky) */}
        <header className="flex items-start justify-between gap-4 px-7 pt-7 pb-5 border-b border-[var(--bp-border)] flex-shrink-0">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-[10px] bg-amber-500/12 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} strokeWidth={1.5} className="text-amber-400" />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-amber-400 font-body font-medium mb-1.5">
                Editorial Relationships Graph
              </p>
              <h2 className="text-[22px] font-heading text-[var(--bp-text-primary)] leading-tight">
                {t("common.media_delete_protection.questo_asset_e_utilizzato_in")} {usageCount} {usageCount === 1 ? 'luogo' : 'luoghi'}
              </h2>
              <p className="text-[12.5px] text-[var(--bp-text-muted)] font-body mt-1.5 italic max-w-md leading-relaxed">
                {t("common.media_delete_protection.rimuoverlo_senza_sostituirlo_lascera_spazi_vuoti_s")}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => onClose?.()} data-testid="mdp-close" className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors flex-shrink-0">
            <X size={17} strokeWidth={1.5} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-7">
          {/* Asset preview */}
          <div className="flex items-center gap-4 p-3 rounded-[12px] bg-[var(--bp-surface-2)] border border-[var(--bp-border)]">
            <div className="w-16 h-16 rounded-[8px] overflow-hidden bg-[var(--bp-surface-3)] flex-shrink-0">
              {assetUrl && <img src={assetUrl} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] font-body mb-1">In archiviazione</p>
              <p className="text-[13.5px] text-[var(--bp-text-primary)] truncate font-mono">{asset.file_name}</p>
            </div>
          </div>

          {/* Usage relationships */}
          <section>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] font-body font-medium mb-3">
              Usato in
            </p>
            <div className="space-y-4">
              {Object.entries(grouped).map(([etype, list]) => <div key={etype}>
                  <p className="text-[11px] text-[var(--bp-text-muted)] font-body mb-2 uppercase tracking-[0.16em]">
                    {ENTITY_META[etype]?.label || etype} · {list.length}
                  </p>
                  <div className="space-y-1.5">
                    {list.map(l => <RelationshipRow key={l.id} link={l} assetUrl={assetUrl} />)}
                  </div>
                </div>)}
            </div>
          </section>

          {/* Actions */}
          <section>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-faint)] font-body font-medium mb-3">
              Azioni disponibili
            </p>
            <div className="space-y-2.5">
              <ActionCard icon={RefreshCw} title="Sostituisci ovunque" description={t("common.media_delete_protection.carica_un_nuovo_file_tutte_le_relazioni_vengono_mi")} testid="mdp-action-replace-everywhere" loading={pending === 'replace'} onClick={() => fileInputRef.current?.click()} />
              <ActionCard icon={ListChecks} title="Sostituisci selettivamente" description={t("common.media_delete_protection.scegli_su_quali_superfici_aggiornare_l_asset_e_qua")} testid="mdp-action-replace-selective" disabled />
              <ActionCard icon={Archive} title="Archivia mantenendo i collegamenti" description={t("common.media_delete_protection.l_asset_viene_archiviato_non_piu_visibile_nella_li")} testid="mdp-action-archive-keep" loading={pending === 'archive_keep'} onClick={handleArchiveKeep} />
              <ActionCard icon={Trash2} title={confirmForce ? 'Conferma rimozione forzata' : 'Rimuovi forzatamente'} description={confirmForce ? `⚠ Le ${usageCount} relazioni resteranno orfane e le superfici pubbliche mostreranno placeholder vuoti. Operazione SCONSIGLIATA.` : 'Forza l\'archiviazione senza migrare le relazioni. Le superfici pubbliche perderanno l\'immagine.'} testid="mdp-action-force-remove" danger loading={pending === 'force_remove'} onClick={handleForceRemove} />
              <ActionCard icon={ExternalLink} title={t("common.media_delete_protection.apri_le_superfici_interessate")} description={t("common.media_delete_protection.chiudi_questo_drawer_e_apri_la_tab_usage_dell_insp")} testid="mdp-action-open-usages" onClick={handleOpenUsages} />
            </div>
          </section>
        </div>

        {/* Footer (sticky) */}
        <footer className="px-7 py-4 border-t border-[var(--bp-border)] bg-[var(--bp-surface-1)] flex-shrink-0">
          <p className="text-[11px] text-[var(--bp-text-faint)] font-body italic leading-relaxed">
            {t("common.media_delete_protection.il_dam_ragiona_come_un_editorial_relationships_gra")}
          </p>
        </footer>

        {/* Hidden file input for "Replace everywhere" */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
        const f = e.target.files?.[0];
        if (f) handleReplaceFile(f);
        e.target.value = '';
      }} data-testid="mdp-replace-file-input" />
      </aside>
    </div>;
};
export default MediaDeleteProtectionDrawer;