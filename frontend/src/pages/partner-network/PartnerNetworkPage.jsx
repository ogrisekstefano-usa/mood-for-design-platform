/**
 * PartnerNetworkPage — Blueprint → Partner Network
 * ════════════════════════════════════════════════
 * Vista filtrata di leads.lead_type = 'partner_application'.
 * Appare come modulo autonomo nel Blueprint OS.
 *
 * Fasi implementate:
 *   Fase 5   — Lista partner con filtri stato
 *   Fase 5.1 — UX come modulo autonomo (non "leads filtrati")
 *   Fase 6   — Assegnazione partner approvati a Design Journey
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Network, Search, X, ChevronDown, ChevronUp, Compass,
  ExternalLink, MoreHorizontal, CheckCircle2,
  Clock, UserCheck, Users, Archive, AlertCircle,
} from 'lucide-react';
import api from '../../lib/api';
import './partner-network.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
};

const initials = (p) => {
  const f = (p?.first_name || '').charAt(0);
  const l = (p?.last_name  || '').charAt(0);
  return (f + l).toUpperCase() || '?';
};

const STATUS_CONFIG = {
  applied:  { label: 'Candidato',  color: '#6B7280', bg: '#F3F4F6', icon: Clock },
  review:   { label: 'In Review',  color: '#D97706', bg: '#FEF3C7', icon: Clock },
  approved: { label: 'Approvato',  color: '#059669', bg: '#D1FAE5', icon: CheckCircle2 },
  active:   { label: 'Attivo',     color: '#2563EB', bg: '#DBEAFE', icon: UserCheck },
  archived: { label: 'Archiviato', color: '#9CA3AF', bg: '#F9FAFB', icon: Archive },
};

const STATUS_FLOW = ['applied', 'review', 'approved', 'active', 'archived'];

const CATEGORY_LABELS = {
  architect:         'Architetto',
  interior_designer: 'Interior Designer',
  contractor:        'General Contractor',
  showroom:          'Showroom',
  brand:             'Brand',
  artisan:           'Artigiano',
  developer:         'Developer',
};

// ─── StatusBadge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.applied;
  const Icon = cfg.icon;
  return (
    <span
      className="pn-status-badge"
      style={{ color: cfg.color, background: cfg.bg }}
      data-testid={`partner-status-badge-${status}`}
    >
      <Icon size={11} />
      {cfg.label}
    </span>
  );
};

// ─── StatusMenu ──────────────────────────────────────────────────────────────

const StatusMenu = ({ partner, onStatusChange, loading }) => {
  const [open, setOpen] = useState(false);
  const current = partner.partner_status || partner.progression_state || 'applied';

  const handleChange = async (newStatus) => {
    setOpen(false);
    if (newStatus === current) return;
    await onStatusChange(partner.id, newStatus);
  };

  return (
    <div className="pn-status-menu" onBlur={() => setTimeout(() => setOpen(false), 150)}>
      <button
        className="pn-status-menu__trigger"
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        data-testid={`partner-status-menu-${partner.id}`}
        aria-label="Cambia stato"
      >
        <StatusBadge status={current} />
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <ul className="pn-status-menu__list" role="listbox">
          {STATUS_FLOW.map((s) => (
            <li key={s} role="option" aria-selected={s === current}>
              <button
                className={`pn-status-menu__item ${s === current ? 'pn-status-menu__item--active' : ''}`}
                onClick={() => handleChange(s)}
                data-testid={`partner-status-option-${s}`}
              >
                <StatusBadge status={s} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ─── AssignDJModal ────────────────────────────────────────────────────────────

const AssignDJModal = ({ partner, onClose, onAssigned }) => {
  const [journeys, setJourneys]   = useState([]);
  const [selected, setSelected]   = useState('');
  const [loading, setLoading]     = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    api.get('/api/partner-network/journeys')
      .then(r => setJourneys(r.data?.journeys || []))
      .catch(() => setError('Impossibile caricare i Design Journey.'))
      .finally(() => setLoading(false));
  }, []);

  const handleAssign = async () => {
    if (!selected) return;
    setAssigning(true);
    setError('');
    try {
      await api.post(`/api/partner-network/partners/${partner.id}/assign`, { journey_id: selected });
      onAssigned(partner.id);
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Errore durante l\'assegnazione.';
      setError(msg);
    } finally {
      setAssigning(false);
    }
  };

  const name = `${partner.first_name} ${partner.last_name}`;

  return (
    <div className="pn-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pn-modal" role="dialog" aria-modal="true" data-testid="pn-assign-dj-modal">
        <div className="pn-modal__header">
          <h3 className="pn-modal__title">Assegna a Design Journey</h3>
          <button className="pn-modal__close" onClick={onClose} aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>

        <div className="pn-modal__body">
          <p className="pn-modal__desc">
            Seleziona il Design Journey a cui aggiungere <strong>{name}</strong> come contributor.
          </p>

          {loading ? (
            <div className="pn-modal__loading">Caricamento Design Journey...</div>
          ) : journeys.length === 0 ? (
            <div className="pn-modal__empty">Nessun Design Journey attivo disponibile.</div>
          ) : (
            <ul className="pn-journey-list">
              {journeys.map(j => (
                <li key={j.id}>
                  <label className={`pn-journey-item ${selected === j.id ? 'pn-journey-item--selected' : ''}`}>
                    <input
                      type="radio"
                      name="journey"
                      value={j.id}
                      checked={selected === j.id}
                      onChange={() => setSelected(j.id)}
                      data-testid={`pn-journey-option-${j.id}`}
                    />
                    <Compass size={14} />
                    <span>{j.title || 'Design Journey'}</span>
                    <span className="pn-journey-item__status">{j.status || 'active'}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <div className="pn-modal__error" data-testid="pn-assign-error">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>

        <div className="pn-modal__footer">
          <button className="pn-btn pn-btn--ghost" onClick={onClose}>Annulla</button>
          <button
            className="pn-btn pn-btn--primary"
            onClick={handleAssign}
            disabled={!selected || assigning || loading}
            data-testid="pn-assign-confirm-btn"
          >
            {assigning ? 'Assegnazione...' : 'Assegna come Contributor'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── PartnerRow ───────────────────────────────────────────────────────────────

const PartnerRow = ({ partner, onStatusChange, onAssignDJ, loadingId }) => {
  const [actionsOpen, setActionsOpen] = useState(false);
  const isLoading = loadingId === partner.id;
  const canAssignDJ = ['approved', 'active'].includes(partner.partner_status || 'applied');

  return (
    <tr
      className="pn-table__row"
      data-testid={`partner-row-${partner.id}`}
      data-status={partner.progression_state}
    >
      {/* Identità */}
      <td className="pn-table__cell pn-table__cell--identity">
        <div className="pn-identity">
          <span className="pn-avatar" aria-hidden="true">{initials(partner)}</span>
          <div className="pn-identity__info">
            <span className="pn-identity__name" data-testid={`partner-name-${partner.id}`}>
              {partner.first_name} {partner.last_name}
            </span>
            <span className="pn-identity__email">{partner.email}</span>
          </div>
        </div>
      </td>

      {/* Studio */}
      <td className="pn-table__cell pn-table__cell--company">
        <span className="pn-company">{partner.company_name || '—'}</span>
      </td>

      {/* Categoria */}
      <td className="pn-table__cell pn-table__cell--category">
        <span className="pn-category">
          {CATEGORY_LABELS[partner.professional_category] || partner.professional_category || '—'}
        </span>
      </td>

      {/* Territorio */}
      <td className="pn-table__cell pn-table__cell--territory">
        <span>{partner.territory || '—'}</span>
      </td>

      {/* Data candidatura */}
      <td className="pn-table__cell pn-table__cell--date">
        <span className="pn-date">{formatDate(partner.created_at)}</span>
      </td>

      {/* Stato */}
      <td className="pn-table__cell pn-table__cell--status">
        <StatusMenu
          partner={{...partner, partner_status: partner.partner_status || 'applied'}}
          onStatusChange={onStatusChange}
          loading={isLoading}
        />
      </td>

      {/* Azioni */}
      <td className="pn-table__cell pn-table__cell--actions">
        <div
          className="pn-actions"
          onBlur={() => setTimeout(() => setActionsOpen(false), 150)}
        >
          <button
            className="pn-actions__trigger"
            onClick={() => setActionsOpen(o => !o)}
            aria-label="Altre azioni"
            data-testid={`partner-actions-${partner.id}`}
          >
            <MoreHorizontal size={15} />
          </button>

          {actionsOpen && (
            <ul className="pn-actions__menu" role="menu">
              {partner.portfolio_url && (
                <li role="menuitem">
                  <a
                    href={partner.portfolio_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pn-actions__item"
                    data-testid={`partner-portfolio-link-${partner.id}`}
                  >
                    <ExternalLink size={13} />
                    Portfolio
                  </a>
                </li>
              )}
              {canAssignDJ && (
                <li role="menuitem">
                  <button
                    className="pn-actions__item"
                    onClick={() => { setActionsOpen(false); onAssignDJ(partner); }}
                    data-testid={`partner-assign-dj-${partner.id}`}
                  >
                    <Compass size={13} />
                    Aggiungi a Design Journey
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </td>
    </tr>
  );
};

// ─── PartnerNetworkPage ──────────────────────────────────────────────────────

const FILTERS = [
  { value: '',         label: 'Tutti' },
  { value: 'applied',  label: 'Candidato' },
  { value: 'review',   label: 'In Review' },
  { value: 'approved', label: 'Approvato' },
  { value: 'active',   label: 'Attivo' },
  { value: 'archived', label: 'Archiviato' },
];

export default function PartnerNetworkPage() {
  const [partners, setPartners]       = useState([]);
  const [statusCounts, setCounts]     = useState({});
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [filterStatus, setFilter]     = useState('');
  const [search, setSearch]           = useState('');
  const [loadingId, setLoadingId]     = useState(null);
  const [assignTarget, setAssignTarget] = useState(null); // partner for DJ modal

  const fetchPartners = useCallback(async (status = filterStatus, q = search) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (q.trim()) params.set('q', q.trim());
      const res = await api.get(`/api/partner-network/partners?${params.toString()}`);
      setPartners(res.data?.partners || []);
      setCounts(res.data?.status_counts || {});
    } catch (err) {
      setError('Errore nel caricamento dei partner.');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => { fetchPartners('', ''); }, []); // eslint-disable-line

  const handleFilterChange = (val) => {
    setFilter(val);
    fetchPartners(val, search);
  };

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    if (!val.trim() || val.length >= 2) {
      fetchPartners(filterStatus, val);
    }
  };

  const handleStatusChange = async (partnerId, newStatus) => {
    setLoadingId(partnerId);
    try {
      await api.patch(`/api/partner-network/partners/${partnerId}/status`, { status: newStatus });
      setPartners(prev =>
        prev.map(p => p.id === partnerId ? { ...p, partner_status: newStatus } : p)
      );
      setCounts(prev => {
        const updated = { ...prev };
        const oldStatus = partners.find(p => p.id === partnerId)?.partner_status || 'applied';
        updated[oldStatus] = Math.max(0, (updated[oldStatus] || 1) - 1);
        updated[newStatus] = (updated[newStatus] || 0) + 1;
        return updated;
      });
    } catch (err) {
      setError('Errore nell\'aggiornamento dello stato.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleAssigned = (partnerId) => {
    setPartners(prev =>
      prev.map(p => p.id === partnerId ? { ...p, progression_state: 'active' } : p)
    );
  };

  const totalAll = Object.values(statusCounts).reduce((s, v) => s + v, 0);

  return (
    <div className="pn-page" data-testid="partner-network-page">
      {/* Header */}
      <header className="pn-header">
        <div className="pn-header__identity">
          <Network size={20} className="pn-header__icon" />
          <div>
            <h1 className="pn-header__title" data-testid="pn-page-title">Partner Network</h1>
            <p className="pn-header__sub">
              Professionisti che hanno espresso interesse a collaborare con lo studio.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="pn-stats">
          <div className="pn-stat">
            <span className="pn-stat__value" data-testid="pn-stat-total">{totalAll}</span>
            <span className="pn-stat__label">Totale</span>
          </div>
          <div className="pn-stat">
            <span className="pn-stat__value" data-testid="pn-stat-approved">
              {(statusCounts.approved || 0) + (statusCounts.active || 0)}
            </span>
            <span className="pn-stat__label">Approvati</span>
          </div>
          <div className="pn-stat">
            <span className="pn-stat__value" data-testid="pn-stat-review">
              {statusCounts.review || 0}
            </span>
            <span className="pn-stat__label">In Review</span>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="pn-toolbar">
        {/* Filtri stato */}
        <div className="pn-filters" role="tablist" data-testid="pn-status-filters">
          {FILTERS.map(f => {
            const count = f.value === '' ? totalAll : (statusCounts[f.value] || 0);
            return (
              <button
                key={f.value}
                role="tab"
                aria-selected={filterStatus === f.value}
                className={`pn-filter-tab ${filterStatus === f.value ? 'pn-filter-tab--active' : ''}`}
                onClick={() => handleFilterChange(f.value)}
                data-testid={`pn-filter-${f.value || 'all'}`}
              >
                {f.label}
                <span className="pn-filter-tab__count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Ricerca */}
        <div className="pn-search">
          <Search size={14} className="pn-search__icon" />
          <input
            type="text"
            placeholder="Cerca per nome, email, studio..."
            value={search}
            onChange={handleSearch}
            className="pn-search__input"
            data-testid="pn-search-input"
          />
          {search && (
            <button
              className="pn-search__clear"
              onClick={() => { setSearch(''); fetchPartners(filterStatus, ''); }}
              aria-label="Cancella ricerca"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Contenuto */}
      <div className="pn-content">
        {error && (
          <div className="pn-error" data-testid="pn-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {loading ? (
          <div className="pn-loading" data-testid="pn-loading">
            <div className="pn-loading__spinner" />
            <span>Caricamento...</span>
          </div>
        ) : partners.length === 0 ? (
          <div className="pn-empty" data-testid="pn-empty">
            <Users size={40} strokeWidth={1} />
            <h3 className="pn-empty__title">
              {filterStatus
                ? `Nessun partner in stato "${STATUS_CONFIG[filterStatus]?.label || filterStatus}"`
                : search
                ? 'Nessun risultato per questa ricerca'
                : 'Nessuna candidatura ricevuta'}
            </h3>
            <p className="pn-empty__sub">
              Le candidature inviate da{' '}
              <a href="/partner-application" target="_blank" rel="noopener" className="pn-empty__link">
                /partner-application
              </a>
              {' '}appariranno qui automaticamente.
            </p>
          </div>
        ) : (
          <div className="pn-table-wrapper">
            <table className="pn-table" data-testid="pn-partners-table">
              <thead>
                <tr className="pn-table__head">
                  <th className="pn-table__th">Professionista</th>
                  <th className="pn-table__th">Studio</th>
                  <th className="pn-table__th">Categoria</th>
                  <th className="pn-table__th">Territorio</th>
                  <th className="pn-table__th">Candidatura</th>
                  <th className="pn-table__th">Stato</th>
                  <th className="pn-table__th pn-table__th--actions" />
                </tr>
              </thead>
              <tbody>
                {partners.map(p => (
                  <PartnerRow
                    key={p.id}
                    partner={p}
                    onStatusChange={handleStatusChange}
                    onAssignDJ={(partner) => setAssignTarget(partner)}
                    loadingId={loadingId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DJ Assignment Modal */}
      {assignTarget && (
        <AssignDJModal
          partner={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssigned={handleAssigned}
        />
      )}
    </div>
  );
}
