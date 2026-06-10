/**
 * LeadDetailPage · ITER186.A · P0.2 + P0.3
 *
 * Single canonical detail route for a Lead: /relations/leads/:leadId
 *
 * Purpose (audit fix):
 *   - Risolve "Lead resumption UX rotto" — post Fast Capture l'utente
 *     atterra qui e vede *immediatamente* dove riprendere la Discovery.
 *   - Risolve "/relations/leads/{id} route mancante" — nessun drawer,
 *     nessun deep link prima d'ora.
 *
 * Layout (operativo, non poetico):
 *   - Breadcrumb: Leads / {Nome Lead}
 *   - Hero: nome, email/telefono, source, data creazione
 *   - DiscoveryProgressWidget (live, deterministico)
 *   - DiscoveryInterviewPanel embedded (autosave + qualify)
 *
 * Routing:
 *   - useNewRelationship.handleCreated → navigate(`/relations/leads/${leadId}`)
 *     così la Discovery è già pronta quando l'utente atterra qui.
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Loader2, Mail, Phone, Calendar, Tag, Sparkles } from 'lucide-react';
import api from '../../lib/api';
import { useT } from '../../i18n/useT';
import DiscoveryInterviewPanel from '../../components/relations/DiscoveryInterviewPanel';
import QualificationModal from '../lead-conversion/QualificationModal';

const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch (_) {
    return '—';
  }
};

const LeadDetailPage = () => {
  const { t } = useT();
  const { leadId } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // STORE-005 · Lead → Prospect → Design Journey™ conversion flow
  const [showQualify, setShowQualify] = useState(false);
  const [starting, setStarting] = useState(false);

  const startJourney = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const r = await api.post(`/api/leads/${leadId}/start-journey`);
      if (r.data?.journey_id) {
        navigate(`/studio/journey/${r.data.journey_id}`);
        return;
      }
    } catch (e) {
      console.warn('[lead] start-journey failed', e);
    } finally {
      setStarting(false);
    }
  };

  const onQualificationComplete = async (res) => {
    setShowQualify(false);
    // Refresh lead to reflect qualification
    try {
      const { data } = await api.get(`/api/leads/${leadId}`);
      setLead(data);
    } catch (_) {}
    // If auto-qualified, jump directly into Design Journey creation
    if (res?.qualified) startJourney();
  };

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/api/leads/${leadId}`);
        if (!cancel) setLead(data);
      } catch (e) {
        if (!cancel) setError(e?.response?.data?.detail?.message || null);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [leadId]);

  const name = lead
    ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.email || t('clientRelations.leadDetail.fallback')
    : '';

  return (
    <div
      data-testid="lead-detail-page"
      style={{
        maxWidth: 960, margin: '0 auto', padding: '24px 28px 64px',
        color: '#0c0e12',
      }}
    >
      {/* Breadcrumb */}
      <nav
        data-testid="lead-detail-breadcrumb"
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5a5d63', marginBottom: 14 }}
      >
        <button
          type="button"
          onClick={() => navigate('/relations/leads')}
          data-testid="lead-detail-back"
          style={{
            background: 'transparent', border: 0, color: '#5a5d63', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0,
          }}
        >
          <ChevronLeft size={14} /> {t('nav.client_relations_leads')}
        </button>
        <span style={{ color: '#c0c2c7' }}>/</span>
        <span data-testid="lead-detail-name-crumb" style={{ color: '#0c0e12' }}>{name || '…'}</span>
      </nav>

      {loading && (
        <div data-testid="lead-detail-loading" style={{ color: '#7a7d83', padding: 32, textAlign: 'center' }}>
          <Loader2 className="animate-spin" size={20} /> {t('clientRelations.leadDetail.loading')}
        </div>
      )}

      {!loading && error && (
        <div
          data-testid="lead-detail-error"
          style={{
            padding: 20, background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 10, color: '#991b1b',
          }}
        >
          <strong>{t('clientRelations.leadDetail.unavailableTitle')}</strong>
          <div style={{ fontSize: 13, marginTop: 4 }}>{error || t('clientRelations.leadDetail.notFoundError')}</div>
          <Link to="/relations/leads" style={{ color: '#0c0e12', textDecoration: 'underline', fontSize: 13 }}>
            {t('common.backToList')}
          </Link>
        </div>
      )}

      {!loading && !error && lead && (
        <>
          {/* Hero */}
          <header
            data-testid="lead-detail-hero"
            style={{
              padding: 24, background: '#ffffff', border: '1px solid #e6e6e8',
              borderRadius: 12, marginBottom: 16,
            }}
          >
            <p style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7a7d83', margin: 0 }}>
              {t('clientRelations.leadDetail.eyebrow')}
            </p>
            <h1
              data-testid="lead-detail-name"
              style={{ margin: '6px 0 12px', fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em' }}
            >
              {name}
            </h1>
            <ul
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, listStyle: 'none', margin: 0, padding: 0 }}
            >
              {lead.email && (
                <li data-testid="lead-detail-email" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#3a3d44' }}>
                  <Mail size={14} strokeWidth={1.6} /> {lead.email}
                </li>
              )}
              {lead.phone && (
                <li data-testid="lead-detail-phone" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#3a3d44' }}>
                  <Phone size={14} strokeWidth={1.6} /> {lead.phone}
                </li>
              )}
              {(lead.source_channel || lead.origin_source) && (
                <li data-testid="lead-detail-source" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#3a3d44' }}>
                  <Tag size={14} strokeWidth={1.6} /> {(lead.source_channel || lead.origin_source || '').replace(/_/g, ' ')}
                </li>
              )}
              <li data-testid="lead-detail-created" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#3a3d44' }}>
                <Calendar size={14} strokeWidth={1.6} /> {t('clientRelations.leadDetail.registeredOn')} {formatDate(lead.created_at)}
              </li>
            </ul>
          </header>

          {/* STORE-005 · Primary CTA: Create Design Journey */}
          <div
            data-testid="lead-cta-create-journey-wrap"
            style={{
              background: 'linear-gradient(135deg, rgba(232,178,98,0.10), rgba(111,228,210,0.06))',
              border: '1px solid rgba(232,178,98,0.32)',
              borderRadius: 12,
              padding: '18px 20px',
              marginBottom: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <p style={{ fontSize: 10.5, letterSpacing: '0.26em', textTransform: 'uppercase', color: '#a26d23', margin: 0, fontWeight: 600 }}>
                Pronto a trasformarlo in progetto?
              </p>
              <p style={{ fontSize: 13, color: '#3a3d44', margin: '6px 0 0', maxWidth: 480, lineHeight: 1.4 }}>
                Rispondi a 4 domande in {'\u003C'}90 secondi e MOOD crea automaticamente la Design Journey con tutti i dati prefillati.
              </p>
            </div>
            {lead.first_journey_id ? (
              <Link
                to={`/studio/journey/${lead.first_journey_id}`}
                data-testid="lead-cta-open-journey"
                style={{
                  padding: '12px 22px', borderRadius: 8,
                  background: '#E8B262', color: '#07080B',
                  fontSize: 12.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
                }}
              >
                <Sparkles size={14} strokeWidth={2} /> {t('clientRelations.leadDetail.cta.openJourney')}
              </Link>
            ) : (
              <button
                type="button"
                data-testid="lead-cta-create-journey"
                onClick={() => setShowQualify(true)}
                disabled={starting}
                style={{
                  padding: '12px 22px', borderRadius: 8, border: 'none',
                  background: '#E8B262', color: '#07080B',
                  fontSize: 12.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
                }}
              >
                <Sparkles size={14} strokeWidth={2} /> {starting ? t('common.creating') : t('clientRelations.leadDetail.cta.createJourney')}
              </button>
            )}
          </div>

          {/* Discovery panel (embedded) — risolve "non sai dove riprendere" */}
          <DiscoveryInterviewPanel
            leadId={leadId}
            onAccountCreated={(accountId) => {
              // Post-qualify: porta l'utente al Prospect/Account appena creato
              if (accountId) navigate(`/relations/accounts?focus=${accountId}`);
            }}
          />
        </>
      )}

      {showQualify && (
        <QualificationModal
          leadId={leadId}
          leadName={name}
          onClose={() => setShowQualify(false)}
          onComplete={onQualificationComplete}
        />
      )}
    </div>
  );
};

export default LeadDetailPage;
