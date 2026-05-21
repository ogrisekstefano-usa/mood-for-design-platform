/**
 * PublicPreviewDrawer — when clicking a calendar event, this drawer opens
 * showing the PUBLIC face of the content (cover image, market badge,
 * status, public URL, excerpt) and the operational actions the user
 * can take (open public preview, edit market edition, reschedule,
 * publish now, duplicate to market).
 *
 * Zero confusion policy: NEVER redirects directly to Blueprint internals.
 * The drawer is the contract between calendar and editor.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { X, ExternalLink, Edit3, CalendarClock, Copy, Globe } from 'lucide-react';
import { useT } from '../../i18n/useT';

const STATUS_LABEL_IT = {
  published: 'Pubblicato',
  draft:     'In bozza',
  scheduled: 'Programmato',
  archived:  'Archiviato',
};

const TYPE_LABEL = {
  article: 'Magazine · Articolo',
  project: 'Portfolio · Progetto',
  page:    'Storefront · Pagina',
};

const fmtFull = (iso) => {
  try {
    return new Date(iso).toLocaleString('it-IT', {
      dateStyle: 'full', timeStyle: 'short',
    });
  } catch (_) { return iso; }
};

const PublicPreviewDrawer = ({ event, onClose, onPublishNow }) => {
  const { t } = useT();
  if (!event) return null;
  const tone = event.status === 'published' ? 'live'
            : event.status === 'scheduled' ? 'scheduled'
            : event.status === 'archived' ? 'archived' : 'draft';

  return (
    <>
      <div className="ecp-backdrop" onClick={onClose} aria-hidden />
      <aside className="ecp-drawer" data-testid="ec-preview-drawer" role="dialog" aria-modal="true">
        <header className="ecp-drawer__head">
          <div className="ecp-drawer__kicker">
            <span className="ecp-drawer__flag" aria-hidden>{event.country.flag}</span>
            <span className="ecp-drawer__locale">
              Edizione · {event.country.country} · {event.locale}
            </span>
          </div>
          <button type="button" className="ecp-drawer__close" onClick={onClose}
                  data-testid="ec-preview-close" aria-label="Close">
            <X size={14} strokeWidth={1.7} />
          </button>
        </header>

        <div className="ecp-drawer__cover" data-tone={tone}>
          {event.cover_url ? (
            <img src={event.cover_url} alt={event.title} />
          ) : (
            <div className="ecp-drawer__cover-placeholder">
              <span>{TYPE_LABEL[event.type]}</span>
            </div>
          )}
          <span className="ecp-drawer__status" data-tone={tone}>
            {STATUS_LABEL_IT[event.status] || event.status}
          </span>
        </div>

        <div className="ecp-drawer__body">
          <p className="ecp-drawer__type">{TYPE_LABEL[event.type]}</p>
          <h2 className="ecp-drawer__title">{event.title}</h2>
          {event.excerpt && (
            <p className="ecp-drawer__excerpt">{event.excerpt}</p>
          )}

          <dl className="ecp-drawer__meta">
            <div>
              <dt>Pianificazione</dt>
              <dd>{fmtFull(event.datetime)}</dd>
            </div>
            <div>
              <dt>{t('editorial.public_preview.mercato_editoriale')}</dt>
              <dd>
                <span className="ecp-drawer__market">
                  {event.country.flag} {event.country.country}
                </span>
                <small> · {event.locale}</small>
              </dd>
            </div>
            <div>
              <dt>{t('editorial.public_preview.cta_editoriale')}</dt>
              <dd>{event.cta_target}</dd>
            </div>
            <div>
              <dt>SEO goal</dt>
              <dd>{event.seo_goal}</dd>
            </div>
            <div>
              <dt>Approval state</dt>
              <dd className="ecp-drawer__approval" data-state={event.approval_state}>
                {event.approval_state === 'approved' ? 'Approvato' : 'In attesa di revisione'}
              </dd>
            </div>
            {event.public_url && (
              <div>
                <dt>URL pubblico</dt>
                <dd className="ecp-drawer__url">{event.public_url}</dd>
              </div>
            )}
          </dl>
        </div>

        <footer className="ecp-drawer__actions">
          {event.public_url && (
            <a href={event.public_url} target="_blank" rel="noopener noreferrer"
               className="ecp-btn ecp-btn--primary"
               data-testid="ec-preview-open-public">
              <Globe size={11} strokeWidth={1.8} />
              Apri sul sito pubblico
              <ExternalLink size={9} strokeWidth={1.8} />
            </a>
          )}
          <Link to={event.edit_href || '#'} className="ecp-btn ecp-btn--secondary"
                data-testid="ec-preview-edit"
                onClick={onClose}>
            <Edit3 size={11} strokeWidth={1.8} />
            {event.type === 'article' ? 'Modifica Market Edition'
              : event.type === 'project' ? 'Modifica progetto'
              : 'Modifica pagina'}
          </Link>
          <button type="button" className="ecp-btn ecp-btn--ghost"
                  data-testid="ec-preview-reschedule"
                  onClick={() => {
                    // Reschedule hint — drag-and-drop is the canonical UX.
                    onClose();
                  }}>
            <CalendarClock size={11} strokeWidth={1.8} />
            Riprogramma (drag&drop)
          </button>
          {event.status !== 'published' && onPublishNow && (
            <button type="button" className="ecp-btn ecp-btn--cta"
                    data-testid="ec-preview-publish"
                    onClick={() => onPublishNow(event)}>
              Pubblica ora
            </button>
          )}
          {event.type === 'article' && (
            <Link to={`/blueprint/editorial?article=${event.id.replace('article-', '')}&duplicate=1`}
                  className="ecp-btn ecp-btn--ghost"
                  onClick={onClose}
                  data-testid="ec-preview-duplicate">
              <Copy size={11} strokeWidth={1.8} />
              Duplica per altro mercato
            </Link>
          )}
        </footer>

        <p className="ecp-drawer__hint">
          Anteprima della superficie pubblica. Tutte le azioni qui sopra
          rispettano la separazione UI admin · contenuto editoriale.
        </p>
      </aside>
    </>
  );
};

export default PublicPreviewDrawer;
