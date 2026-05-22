/**
 * CulturalEditionsListPage — Workspace listing of cultural editions.
 *
 * Pagina indice: visualizza tutte le edizioni culturali create.
 * Da qui si può aprire la review page di ciascuna o avviare una nuova.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as Icons from 'lucide-react';
import api from '../../lib/api';
import CulturalEditionWizard from '../../components/cultural/CulturalEditionWizard';
import './cultural-editions.css';
import { useT } from '../../i18n/useT';

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
};

const STATUS_LABEL_KEY = {
  draft:     'taxonomy.cultural_edition.draft',
  in_review: 'taxonomy.cultural_edition.in_review',
  approved:  'taxonomy.cultural_edition.approved',
  archived:  'taxonomy.cultural_edition.archived',
};

const CulturalEditionsListPage = () => {
  const { t } = useT();
  const [drafts, setDrafts] = useState(null);
  const [error, setError] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (params.get('new') === '1') {
      setWizardOpen(true);
      params.delete('new');
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = () => {
    api.get('/api/cultural-editions/drafts')
      .then((r) => setDrafts(r.data?.drafts || []))
      .catch((e) => setError(e?.response?.data?.detail || 'Errore nel caricamento'));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="ce-page" data-testid="cultural-editions-page">
      <header className="ce-page-head">
        <div>
          <p className="ce-eyebrow">Cultural Edition™</p>
          <h1 className="ce-title">{t('cultural.cultural_editions_list.le_tue_versioni_mercato')}</h1>
          <p className="ce-lede">
            {t('cultural.cultural_editions_list.lede',
               null,
               'Every edition is an editorial act: a piece of your content adapted to a specific market culture — tone, references, atmosphere.')}
          </p>
        </div>
        <button type="button" className="ce-btn ce-btn--primary"
                onClick={() => setWizardOpen(true)}
                data-testid="ce-list-new-btn">
          <Icons.Plus size={13} /> {t('cultural.cultural_editions_list.new_edition', null, 'New edition')}
        </button>
      </header>

      {error && (
        <div className="ce-empty" data-testid="ce-list-error">
          <Icons.AlertCircle size={22} strokeWidth={1.2} />
          <p>{error}</p>
        </div>
      )}

      {!error && drafts === null && (
        <div className="ce-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="ce-row ce-row--skel">
              <div className="ce-skel ce-skel--w50" />
              <div className="ce-skel ce-skel--w30" />
            </div>
          ))}
        </div>
      )}

      {!error && drafts && drafts.length === 0 && (
        <div className="ce-empty" data-testid="ce-list-empty">
          <Icons.Globe size={26} strokeWidth={1.2} />
          <p className="ce-empty__title">{t('cultural.cultural_editions_list.nessuna_edizione_ancora')}</p>
          <p className="ce-empty__hint">
            Crea la prima versione mercato di un tuo progetto o di una moodboard:
            è il modo in cui MOOD ti aiuta a parlare correttamente a Miami, NYC, Dubai, Milano o Parigi.
          </p>
          <button type="button" className="ce-btn ce-btn--primary"
                  onClick={() => setWizardOpen(true)}
                  data-testid="ce-list-empty-cta">
            <Icons.Globe size={13} /> Crea Cultural Edition™
          </button>
        </div>
      )}

      {!error && drafts && drafts.length > 0 && (
        <div className="ce-list" data-testid="ce-list">
          {drafts.map((d) => (
            <Link key={d.id} to={`/workspace/cultural-editions/${d.id}`}
                  className="ce-row" data-testid={`ce-row-${d.id}`}>
              <span className="ce-row__icon">
                <Icons.Globe size={14} strokeWidth={1.5} />
              </span>
              <span className="ce-row__body">
                <span className="ce-row__title">
                  {d.source_title || 'Senza titolo'} → <em>{d.target_market_label}</em>
                </span>
                <span className="ce-row__sub">
                  {d.market_version?.headline || 'Bozza editoriale in preparazione'}
                </span>
              </span>
              <span className="ce-row__meta">
                <span className={`ce-status ce-status--${d.status}`}>{t(STATUS_LABEL_KEY[d.status] || `taxonomy.cultural_edition.${d.status}`, null, d.status) || d.status}</span>
                <span className="ce-row__date">{fmtDate(d.created_at)}</span>
              </span>
              <Icons.ArrowUpRight size={13} className="ce-row__arrow" />
            </Link>
          ))}
        </div>
      )}

      <CulturalEditionWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={(draft) => {
          setWizardOpen(false);
          if (draft?.id) navigate(`/workspace/cultural-editions/${draft.id}`);
        }}
      />
    </div>
  );
};

export default CulturalEditionsListPage;
