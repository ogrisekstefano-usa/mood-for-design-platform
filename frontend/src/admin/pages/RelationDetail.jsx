/**
 * ITER161 — RelationDetail
 * The curatorial dossier of a single Studio Relation.
 * Sections: Provenance · Cartella curatoriale (timeline) · Advisory Value ·
 *           Note · Promemoria · Visit Reports · Open Studio Ecosystem.
 */
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Check } from 'lucide-react';
import { adminApi } from '../adminApi';
import { useEditorialCopy } from '../utils/useEditorialCopy';
import {
  tokens, eyebrow, headline, headlineSmall, sublead,
  sectionLabel, helper,
  TEMPERATURE_DOTS, STATUS_TONE,
} from '../utils/consoleTokens';
import VisitReportForm from '../components/VisitReportForm';
import OpenEcosystemFlow from '../components/OpenEcosystemFlow';

const STATUS_KEYS = [
  'prospect','under_review','contacted',
  'presentation_scheduled','presented',
  'qualified','proposal','activated',
  'not_aligned','archived',
];
const TEMPERATURE_KEYS = ['cold','warm','strong','ready'];

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
};

const fmtDay = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return '—'; }
};

const RelationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, loaded } = useEditorialCopy('admin.studioRelations', 'it');
  const [data, setData]       = useState(null);
  const [notes, setNotes]     = useState('');
  const [next, setNext]       = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [showVisit, setShowVisit]     = useState(false);
  const [showFollowup, setShowFollowup] = useState(false);
  const [showActivate, setShowActivate] = useState(false);

  const refresh = () =>
    adminApi.getRelation(id).then((r) => {
      setData(r.data);
      setNotes(r.data?.advisory_notes || '');
      setNext(r.data?.next_action || '');
    }).catch(() => navigate('/command-center/advisor-console'));

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [id]);

  const updateField = async (key, value) => {
    await adminApi.patchRelation(id, { [key]: value });
    refresh();
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await adminApi.patchRelation(id, { advisory_notes: notes, next_action: next });
      setTimeout(() => setSavingNotes(false), 700);
    } catch { setSavingNotes(false); }
  };

  if (!loaded || !data) return (
    <div data-testid="relation-detail-loading" style={{
      background: tokens.bg, color: tokens.ink, minHeight: '100vh',
      padding: '3rem 4.5rem 6rem',
    }}>
      <div style={{ maxWidth: 760 }}>
        <div style={{
          width: 240, height: 12, background: tokens.hair,
          borderRadius: 1, marginBottom: '1.4rem', opacity: 0.5,
        }} />
        <div style={{
          width: 460, height: 36, background: tokens.hair,
          borderRadius: 1, marginBottom: '1rem', opacity: 0.6,
        }} />
        <div style={{
          width: 320, height: 14, background: tokens.hair,
          borderRadius: 1, opacity: 0.4,
        }} />
      </div>
    </div>
  );

  return (
    <div data-testid="relation-detail" style={{
      background: tokens.bg, color: tokens.ink, minHeight: '100vh',
      padding: '3rem 4.5rem 6rem',
    }}>
      {/* Back */}
      <Link to="/command-center/advisor-console" data-testid="relation-back" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        color: tokens.inkDim, fontFamily: 'Inter, sans-serif',
        fontSize: '0.72rem', letterSpacing: '0.22em',
        textTransform: 'uppercase', textDecoration: 'none', marginBottom: '3rem',
      }}>
        <ArrowLeft size={13} /> {t('detail.back')}
      </Link>

      {/* Header */}
      <header style={{ marginBottom: '4rem', maxWidth: 920 }}>
        <p style={{ ...eyebrow, marginBottom: '1rem' }}>{t('relations.eyebrow')}</p>
        <h1 style={{ ...headline, fontSize: '3rem', marginBottom: '0.8rem' }}>
          {data.studio_name}
        </h1>
        <p style={{ ...sublead, fontSize: '0.95rem' }}>
          {data.archetype || '—'}
          {data.city ? <> · {data.city}{data.country ? `, ${data.country}` : ''}</> : null}
          {data.contact_email ? <> · {data.contact_email}</> : null}
        </p>
      </header>

      {/* Status / temperature controls */}
      <section style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem',
        padding: '2rem 0', borderTop: `1px solid ${tokens.hair}`, borderBottom: `1px solid ${tokens.hair}`,
        marginBottom: '5rem',
      }}>
        <Picker
          label={t('detail.status.label')}
          value={data.status}
          options={STATUS_KEYS}
          renderLabel={(k) => t(`status.${k}`)}
          dotColor={(k) => STATUS_TONE[k] || tokens.inkDim}
          onChange={(v) => updateField('status', v)}
          testid="status-picker"
        />
        <Picker
          label={t('detail.temperature.label')}
          value={data.temperature}
          options={TEMPERATURE_KEYS}
          renderLabel={(k) => t(`temperature.${k}`)}
          dotColor={(k) => TEMPERATURE_DOTS[k]}
          onChange={(v) => updateField('temperature', v)}
          testid="temperature-picker"
        />
      </section>

      {/* Two-column body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '5rem' }}>

        {/* LEFT — Notes + Timeline + Visits */}
        <div>
          {/* Advisor notes */}
          <Section eyebrow={t('detail.section.notes')} title={null}>
            <textarea
              data-testid="advisory-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('detail.notes.placeholder')}
              rows={6}
              style={{
                width: '100%', background: 'transparent',
                border: `1px solid ${tokens.hair}`, color: tokens.ink,
                padding: '1.2rem 1.4rem', borderRadius: 2,
                fontFamily: 'Playfair Display, serif', fontStyle: 'italic',
                fontSize: '1rem', lineHeight: 1.65, resize: 'vertical',
                outline: 'none',
              }}
            />
            <p style={{ ...sectionLabel, marginTop: '1.6rem', marginBottom: '0.5rem' }}>
              {t('detail.next_action.label')}
            </p>
            <input
              data-testid="next-action"
              type="text"
              value={next} onChange={(e) => setNext(e.target.value)}
              placeholder={t('detail.next_action.placeholder')}
              style={{
                width: '100%', background: 'transparent',
                border: 'none', borderBottom: `1px solid ${tokens.hairBold}`,
                color: tokens.ink, padding: '0.6rem 0', outline: 'none',
                fontFamily: 'Playfair Display, serif', fontSize: '1.05rem',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={saveNotes} data-testid="save-notes" style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: savingNotes ? tokens.teal : tokens.inkSoft,
                fontFamily: 'Inter, sans-serif', fontSize: '0.72rem',
                letterSpacing: '0.22em', textTransform: 'uppercase',
              }}>
                {savingNotes ? t('detail.notes.saved') : t('detail.notes.save')}
              </button>
            </div>
          </Section>

          {/* Timeline — curatorial dossier */}
          <Section eyebrow={t('detail.section.timeline')} title={null} style={{ marginTop: '4rem' }}>
            <Timeline events={data.events || []} t={t} />
          </Section>

          {/* Visit Reports */}
          <Section
            eyebrow={t('detail.section.visits')}
            title={null}
            style={{ marginTop: '4rem' }}
            action={
              <button onClick={() => setShowVisit(true)} data-testid="add-visit" style={ghostBtn}>
                <Plus size={13} /> {t('visit.eyebrow')}
              </button>
            }
          >
            {(data.visits || []).length === 0 ? (
              <p style={{ ...sublead, fontSize: '0.88rem' }} data-testid="visits-empty">
                — Nessuna lettura archiviata.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '1rem' }}>
                {data.visits.map((v) => (
                  <li key={v.id} data-testid={`visit-${v.id}`} style={{
                    padding: '1.4rem', border: `1px solid ${tokens.hair}`, borderRadius: 2,
                  }}>
                    <p style={{ ...sectionLabel, marginBottom: '0.5rem' }}>{fmtDay(v.visited_at)}</p>
                    {v.atmosphere_observed && (
                      <p style={{
                        fontFamily: 'Playfair Display, serif', fontStyle: 'italic',
                        fontSize: '1rem', color: tokens.inkSoft, lineHeight: 1.6, marginBottom: '0.8rem',
                      }}>
                        "{v.atmosphere_observed}"
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                      {[
                        ['Workflow', v.workflow_maturity],
                        ['Showroom', v.showroom_quality],
                        ['Materiale', v.material_culture],
                        ['Allineamento', v.design_journey_alignment],
                      ].filter(([, val]) => val !== null && val !== undefined).map(([lbl, val]) => (
                        <p key={lbl} style={{ ...helper, fontSize: '0.74rem' }}>
                          <span style={{ color: tokens.inkSoft }}>{lbl}</span> · {val}/5
                        </p>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* RIGHT — Advisory Value + Followups + Activation */}
        <div>
          <AdvisoryValuePanel data={data} t={t} onPatch={updateField} />

          <Section
            eyebrow={t('detail.section.followups')}
            title={null}
            style={{ marginTop: '4rem' }}
            action={
              <button onClick={() => setShowFollowup(true)} data-testid="add-followup" style={ghostBtn}>
                <Plus size={13} />
              </button>
            }
          >
            <FollowupsList items={data.followups || []} t={t} onComplete={async (fid) => {
              await adminApi.completeFollowup(fid);
              refresh();
            }} />
          </Section>

          {/* Open Studio Ecosystem CTA */}
          {data.status !== 'activated' && (
            <div style={{
              marginTop: '4rem', padding: '2.5rem 2rem',
              background: tokens.bgRaised, border: `1px solid ${tokens.hairBold}`,
              borderRadius: 2,
            }} data-testid="activation-block">
              <p style={{ ...eyebrow, marginBottom: '0.8rem' }}>{t('activation.eyebrow')}</p>
              <h3 style={{ ...headlineSmall, fontSize: '1.4rem', marginBottom: '0.7rem' }}>
                {t('activation.headline')}
              </h3>
              <p style={{ ...helper, marginBottom: '1.6rem' }}>{t('detail.activate.helper')}</p>
              <button onClick={() => setShowActivate(true)} data-testid="activate-cta" style={{
                background: tokens.teal, color: '#08090C', border: 'none',
                padding: '0.85rem 1.6rem', fontFamily: 'Inter, sans-serif',
                fontSize: '0.72rem', letterSpacing: '0.22em', textTransform: 'uppercase',
                cursor: 'pointer', borderRadius: 2, fontWeight: 500,
              }}>
                {t('detail.activate_cta')}
              </button>
            </div>
          )}

          {data.status === 'activated' && data.tenant_id && (
            <div style={{
              marginTop: '4rem', padding: '2rem',
              background: tokens.bgSunk, border: `1px solid ${tokens.hair}`,
              borderRadius: 2,
            }} data-testid="activated-block">
              <p style={{ ...eyebrow, color: tokens.teal, marginBottom: '0.8rem' }}>
                {t('activation.confirmation.title')}
              </p>
              <p style={{ ...sublead, fontSize: '0.88rem' }}>
                {t('activation.confirmation.body')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showVisit && (
        <VisitReportForm
          t={t} relationId={id}
          onClose={() => setShowVisit(false)}
          onSaved={() => { setShowVisit(false); refresh(); }}
        />
      )}
      {showFollowup && (
        <NewFollowupDrawer t={t} relationId={id}
          onClose={() => setShowFollowup(false)}
          onSaved={() => { setShowFollowup(false); refresh(); }}
        />
      )}
      {showActivate && (
        <OpenEcosystemFlow
          t={t} data={data}
          onClose={() => setShowActivate(false)}
          onActivated={() => { setShowActivate(false); refresh(); }}
        />
      )}
    </div>
  );
};

/* ───────────── Picker (status / temperature) ───────────── */
const Picker = ({ label, value, options, renderLabel, dotColor, onChange, testid }) => (
  <div data-testid={testid}>
    <p style={{ ...sectionLabel, marginBottom: '0.8rem' }}>{label}</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
      {options.map((k) => {
        const active = k === value;
        return (
          <button key={k} onClick={() => onChange(k)} data-testid={`${testid}-${k}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: active ? 'rgba(0,201,179,0.07)' : 'transparent',
              border: `1px solid ${active ? tokens.tealDim : tokens.hair}`,
              padding: '0.4rem 0.85rem', borderRadius: 2, cursor: 'pointer',
              color: active ? tokens.ink : tokens.inkSoft,
              fontFamily: 'Inter, sans-serif', fontSize: '0.74rem',
              transition: 'all 180ms ease',
            }}>
            <span style={{
              display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
              background: dotColor(k),
            }} />
            {renderLabel(k)}
          </button>
        );
      })}
    </div>
  </div>
);

/* ───────────── Timeline ───────────── */
const Timeline = ({ events, t }) => {
  if (events.length === 0) {
    return <p style={{ ...sublead, fontSize: '0.88rem' }} data-testid="timeline-empty">— Nessun evento ancora archiviato.</p>;
  }
  return (
    <ol style={{ listStyle: 'none', padding: 0, position: 'relative' }} data-testid="timeline">
      <span style={{
        position: 'absolute', top: 6, bottom: 6, left: 4,
        width: 1, background: tokens.hair,
      }} />
      {events.map((e) => (
        <li key={e.id} style={{ display: 'flex', gap: '1.4rem', padding: '0.8rem 0', position: 'relative' }} data-testid={`timeline-${e.kind}`}>
          <span style={{
            width: 9, height: 9, borderRadius: '50%', background: tokens.teal,
            marginTop: 7, flexShrink: 0, position: 'relative', zIndex: 1,
            border: `2px solid ${tokens.bg}`,
          }} />
          <div style={{ flex: 1 }}>
            <p style={{
              fontFamily: 'Playfair Display, serif', fontSize: '1.02rem',
              color: tokens.ink, marginBottom: 2,
            }}>
              {t(`event.${e.kind}`, e.kind)}
            </p>
            <p style={{ ...helper, fontSize: '0.72rem' }}>{fmtDate(e.occurred_at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
};

/* ───────────── Advisory Value panel ───────────── */
const AdvisoryValuePanel = ({ data, t, onPatch }) => {
  const [emv, setEmv] = useState(data.expected_monthly_value || '');
  const [esv, setEsv] = useState(data.expected_setup_value   || '');
  const onBlur = (key, val) => {
    const n = val === '' ? null : Number(val);
    if (n === data[key]) return;
    onPatch(key, n);
  };
  return (
    <div data-testid="advisory-value-panel">
      <p style={{ ...eyebrow, marginBottom: '0.8rem' }}>{t('detail.section.value')}</p>
      <p style={{ ...helper, marginBottom: '1.6rem' }}>{t('summary.advisory.helper')}</p>

      <Stack label={t('summary.advisory.recurring')}>
        <NumInput value={emv} onChange={setEmv} onBlur={() => onBlur('expected_monthly_value', emv)} testid="value-recurring" />
      </Stack>
      <Stack label={t('summary.advisory.setup')}>
        <NumInput value={esv} onChange={setEsv} onBlur={() => onBlur('expected_setup_value', esv)} testid="value-setup" />
      </Stack>
    </div>
  );
};

const Stack = ({ label, children }) => (
  <div style={{ marginBottom: '1.4rem' }}>
    <p style={{ ...sectionLabel, marginBottom: '0.4rem' }}>{label}</p>
    {children}
  </div>
);

const NumInput = ({ value, onChange, onBlur, testid }) => (
  <input
    type="number" min="0" step="50"
    value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
    data-testid={testid}
    style={{
      width: '100%', background: 'transparent',
      border: 'none', borderBottom: `1px solid ${tokens.hairBold}`,
      color: tokens.ink, padding: '0.4rem 0', outline: 'none',
      fontFamily: 'Playfair Display, serif', fontStyle: 'italic', fontSize: '1.3rem',
    }}
  />
);

/* ───────────── Followups list ───────────── */
const FollowupsList = ({ items, t, onComplete }) => {
  if (items.length === 0) {
    return <p style={{ ...sublead, fontSize: '0.88rem' }} data-testid="followups-empty">{t('followup.empty')}</p>;
  }
  return (
    <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.7rem' }} data-testid="followups-list">
      {items.map((f) => (
        <li key={f.id} data-testid={`followup-${f.id}`} style={{
          display: 'flex', alignItems: 'center', gap: '1rem',
          padding: '0.8rem 0', borderBottom: `1px solid ${tokens.hair}`,
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: tokens.ink }}>
              {t(`followup.type.${f.type}`)}
            </p>
            <p style={{ ...helper, fontSize: '0.72rem' }}>{fmtDay(f.due_at)}</p>
            {f.notes && <p style={{ ...helper, fontStyle: 'italic', marginTop: 4 }}>{f.notes}</p>}
          </div>
          {f.status === 'open' && (
            <button onClick={() => onComplete(f.id)} data-testid={`complete-followup-${f.id}`} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: tokens.teal, padding: 4,
            }}>
              <Check size={16} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
};

/* ───────────── New Followup Drawer ───────────── */
const NewFollowupDrawer = ({ t, relationId, onClose, onSaved }) => {
  const [type, setType] = useState('call');
  const [due, setDue]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adminApi.createFollowup(relationId, {
        type, due_at: new Date(due).toISOString(), notes,
      });
      onSaved();
    } finally { setBusy(false); }
  };
  const types = ['call','email','visit','demo','internal_review','activation','proposal'];

  return (
    <div data-testid="new-followup-drawer" style={{
      position: 'fixed', inset: 0, background: 'rgba(8,9,12,0.86)',
      backdropFilter: 'blur(12px)', zIndex: 100, display: 'flex',
      justifyContent: 'flex-end',
    }} onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{
        background: tokens.bg, width: 500, maxWidth: '95vw',
        borderLeft: `1px solid ${tokens.hairBold}`,
        padding: '3.5rem 3rem', overflowY: 'auto', height: '100vh',
      }}>
        <p style={{ ...eyebrow, marginBottom: '1rem' }}>{t('followup.eyebrow')}</p>
        <h2 style={{ ...headlineSmall, marginBottom: '2.5rem' }}>{t('followup.add_cta')}</h2>

        <Stack label={t('followup.type.label')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {types.map((tp) => (
              <button key={tp} type="button" onClick={() => setType(tp)} data-testid={`fu-type-${tp}`}
                style={{
                  background: type === tp ? 'rgba(0,201,179,0.07)' : 'transparent',
                  border: `1px solid ${type === tp ? tokens.tealDim : tokens.hair}`,
                  padding: '0.45rem 0.85rem', borderRadius: 2, cursor: 'pointer',
                  color: type === tp ? tokens.ink : tokens.inkSoft,
                  fontFamily: 'Inter, sans-serif', fontSize: '0.74rem',
                }}>
                {t(`followup.type.${tp}`)}
              </button>
            ))}
          </div>
        </Stack>

        <Stack label={t('followup.due.label')}>
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} data-testid="fu-due"
            style={{
              width: '100%', background: 'transparent',
              border: 'none', borderBottom: `1px solid ${tokens.hairBold}`,
              color: tokens.ink, padding: '0.5rem 0', outline: 'none',
              fontFamily: 'Inter, sans-serif', fontSize: '0.95rem',
              colorScheme: 'dark',
            }} />
        </Stack>

        <Stack label={t('followup.notes.label')}>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} data-testid="fu-notes"
            style={{
              width: '100%', background: 'transparent',
              border: `1px solid ${tokens.hair}`,
              color: tokens.ink, padding: '0.8rem 1rem', borderRadius: 2, outline: 'none',
              fontFamily: 'Playfair Display, serif', fontStyle: 'italic',
              fontSize: '0.95rem', lineHeight: 1.6, resize: 'vertical',
            }} />
        </Stack>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
          <button type="button" onClick={onClose} data-testid="fu-cancel" style={cancelBtn}>
            {t('activation.cancel_cta')}
          </button>
          <button type="submit" disabled={busy} data-testid="fu-submit" style={primaryBtn(busy)}>
            {busy ? '…' : t('followup.add_cta')}
          </button>
        </div>
      </form>
    </div>
  );
};

/* ───────────── Shared little styles ───────────── */
const ghostBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'transparent', border: `1px solid ${tokens.hair}`,
  color: tokens.inkSoft, fontFamily: 'Inter, sans-serif',
  fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase',
  padding: '0.45rem 0.85rem', borderRadius: 2, cursor: 'pointer',
};

const cancelBtn = {
  background: 'transparent', border: 'none', color: tokens.inkDim,
  fontFamily: 'Inter, sans-serif', fontSize: '0.74rem',
  letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
};

const primaryBtn = (disabled) => ({
  background: tokens.teal, color: '#08090C',
  border: 'none', padding: '0.8rem 1.6rem', borderRadius: 2,
  fontFamily: 'Inter, sans-serif', fontSize: '0.72rem',
  letterSpacing: '0.22em', textTransform: 'uppercase', cursor: 'pointer',
  opacity: disabled ? 0.4 : 1, fontWeight: 500,
});

const Section = ({ eyebrow: eb, title, action, children, style }) => (
  <section style={style}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.2rem' }}>
      <div>
        <p style={{ ...eyebrow, marginBottom: title ? '0.6rem' : 0 }}>{eb}</p>
        {title && <h3 style={{ ...headlineSmall, fontSize: '1.3rem' }}>{title}</h3>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

export default RelationDetail;
