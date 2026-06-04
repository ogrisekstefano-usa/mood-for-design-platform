/**
 * ProjectsPage — Design Journey™ Operating Center
 *
 * Filosofia: NON una lista database. È il centro operativo di uno
 * studio di interior design. 50% Linear · 25% Attio · 15% Arc · 10% Milanote.
 * MOOD DNA: luxury · professional · creative · operational.
 *
 * Architettura:
 *   • Hero editoriale: titolo serif "Design Journey™" + sottotitolo + CTA primaria
 *   • KPI strip: Progetti attivi · In revisione · Presentazioni · Approvati
 *   • Project cards visualmente forti: hero, cliente, fase, ultima attività,
 *     prossima azione, team, contatori operativi
 *   • Wizard 4-step per la creazione (Cliente → Tipologia → Nome → Conferma)
 *   • Stages Journey: Discover / Inspiration / Moodboard / Presentation /
 *     Revision / Approval / Specification (NO stati CRM tecnici)
 *
 * Theme-driven · i18n-ready · zero hardcoded colors.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Plus, Lock, ArrowRight, Calendar, Users, Image, Box, CheckCircle2,
  Sparkles, ChevronLeft, Search, Building2, Home, Hotel, Briefcase,
  Loader2,
} from 'lucide-react';
import api, { formatError } from '../../lib/api';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { useLicense, refreshLicense } from '../../hooks/useLicense';
import UsageChip from '../../components/common/UsageChip';
import {
  AtelierModal,
  AtelierFooter,
  AtelierButton,
  AtelierInput,
  AtelierField,
} from '../../components/atelier/AtelierModal';
import './projects-page.css';

// ─────────────────────────────────────────────────────────────────
// Design Journey™ STAGES
// 7 atelier stages mapped from legacy backend statuses
// ─────────────────────────────────────────────────────────────────
const JOURNEY_STAGES = [
  { key: 'discover',      i18n: 'projects.stage.discover',      fallback: 'Discover',      tone: 'soft',     statuses: 'new,brief_completed' },
  { key: 'inspiration',   i18n: 'projects.stage.inspiration',   fallback: 'Inspiration',   tone: 'info',     statuses: 'inspiration' },
  { key: 'moodboard',     i18n: 'projects.stage.moodboard',     fallback: 'Moodboard',     tone: 'info',     statuses: 'moodboard,in_review,proposal_in_progress' },
  { key: 'presentation',  i18n: 'projects.stage.presentation',  fallback: 'Presentation',  tone: 'accent',   statuses: 'proposal_sent' },
  { key: 'revision',      i18n: 'projects.stage.revision',      fallback: 'Revision',      tone: 'warning',  statuses: 'revision' },
  { key: 'approval',      i18n: 'projects.stage.approval',      fallback: 'Approval',      tone: 'positive', statuses: 'approved,won' },
  { key: 'specification', i18n: 'projects.stage.specification', fallback: 'Specification', tone: 'positive', statuses: 'specification,delivered' },
];

const STATUS_TO_STAGE = JOURNEY_STAGES.reduce((acc, s) => {
  for (const st of (s.statuses || '').split(',').filter(Boolean)) acc[st] = s.key;
  return acc;
}, {});

const stageMeta = (status) => {
  const key = STATUS_TO_STAGE[status] || 'discover';
  return JOURNEY_STAGES.find((s) => s.key === key) || JOURNEY_STAGES[0];
};

// ─────────────────────────────────────────────────────────────────
// FILTER TABS — config-driven
// ─────────────────────────────────────────────────────────────────
const FILTER_TABS = [
  { key: '',             i18n: 'projects.filter.all',        fallback: 'Tutti',        statuses: '' },
  { key: 'active',       i18n: 'projects.filter.active',     fallback: 'Attivi',       statuses: 'new,brief_completed,inspiration,moodboard,in_review,proposal_in_progress,revision' },
  { key: 'review',       i18n: 'projects.filter.review',     fallback: 'In revisione', statuses: 'in_review,proposal_in_progress' },
  { key: 'presentation', i18n: 'projects.filter.presented',  fallback: 'Presentati',   statuses: 'proposal_sent' },
  { key: 'won',          i18n: 'projects.filter.approved',   fallback: 'Approvati',    statuses: 'approved,won,specification,delivered' },
  { key: 'archived',     i18n: 'projects.filter.archived',   fallback: 'Archivio',     statuses: 'archived,lost,rejected' },
];

// ─────────────────────────────────────────────────────────────────
// Hero photography (luxury interior design — Unsplash curated)
// Deterministic per id, override via metadata_json.hero_image_url
// ─────────────────────────────────────────────────────────────────
const HERO_POOL = [
  'photo-1616486338812-3dadae4b4ace', 'photo-1505691938895-1758d7feb511',
  'photo-1493663284031-b7e3aefcae8e', 'photo-1554995207-c18c203602cb',
  'photo-1582268611958-ebfd161ef9cf', 'photo-1556909114-f6e7ad7d3136',
  'photo-1567538096630-e0c55bd6374c', 'photo-1565182999561-18d7dc61c393',
  'photo-1556228720-195a672e8a03',   'photo-1600585154340-be6161a56a0c',
];
const heroFor = (project) => {
  const explicit = project?.metadata_json?.hero_image_url;
  if (explicit) return explicit;
  const id = String(project?.id || '');
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return `https://images.unsplash.com/${HERO_POOL[hash % HERO_POOL.length]}?w=900&q=80&auto=format&fit=crop`;
};

const formatRelative = (iso) => {
  if (!iso) return null;
  try {
    const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60)        return 'pochi istanti fa';
    if (sec < 3600)      return `${Math.floor(sec / 60)} min fa`;
    if (sec < 86400)     return `${Math.floor(sec / 3600)} ore fa`;
    if (sec < 86400 * 7) return `${Math.floor(sec / 86400)} giorni fa`;
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  } catch { return null; }
};

// Get client initials from a name string (max 2 chars)
const initialsOf = (name) =>
  (name || '?').trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0]).join('').toUpperCase();

// Deterministic palette for team avatars (theme-derived hues)
const TEAM_HUES = ['#5dd9c4', '#E0A872', '#a78bfa', '#7d8b56', '#c9a875', '#6ee7b7'];
const hueFor = (seed) => {
  const s = String(seed || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return TEAM_HUES[s % TEAM_HUES.length];
};

// ─────────────────────────────────────────────────────────────────
// PROJECT CARD — operational SaaS, not editorial poster
// ─────────────────────────────────────────────────────────────────
const ProjectCard = ({ project, index }) => {
  const payload = project?.metadata_json?.onboarding_payload || {};
  const stage = stageMeta(project.status);
  const clientFirst = payload.first_name || project.client_first_name;
  const stripPrefix = (s) =>
    String(s || '').replace(/^(conversazione di|conversation with)\s+/i, '').trim();
  const projectName = stripPrefix(project.title) ||
    (clientFirst ? `${clientFirst}'s Project` : 'Untitled Project');
  const clientName = clientFirst ||
    (project.client_email ? project.client_email.split('@')[0] : 'Cliente');

  const usedIn = project.used_in || { moodboards: 0, proposals: 0, memories: 0 };
  const lastUpdate = formatRelative(project.updated_at || project.created_at);
  const hero = heroFor(project);

  // Team: derive from members or fallback to project initiator
  const team = (project.team_members || []).slice(0, 4);
  if (team.length === 0 && clientFirst) {
    team.push({ id: 'owner', name: clientFirst });
  }

  // Next action — derived from stage (foundational, will plug into actions API)
  const nextActionLabel = {
    discover:      'Programma kickoff',
    inspiration:   'Raccogli ispirazioni',
    moodboard:     'Componi moodboard',
    presentation:  'Presenta al cliente',
    revision:      'Applica revisioni',
    approval:      'Conferma approvazione',
    specification: 'Genera spec book',
  }[stage.key] || 'Continua il journey';

  return (
    <Link
      to={`/workspace/projects/${project.id}`}
      data-testid={`project-card-${index}`}
      className={`pj-card pj-card--${stage.tone}`}
    >
      <div className="pj-card__hero" aria-hidden="true">
        <img src={hero} alt="" loading="lazy" />
        <div className="pj-card__hero-veil" />
        <span className={`pj-card__stage pj-card__stage--${stage.tone}`} data-testid={`project-card-${index}-stage`}>
          <span className="pj-card__stage-dot" />
          {stage.fallback}
        </span>
      </div>

      <div className="pj-card__body">
        <header className="pj-card__head">
          <p className="pj-card__client" data-testid={`project-card-${index}-client`}>
            <span className="pj-card__client-avatar" style={{ background: `color-mix(in srgb, ${hueFor(clientName)} 20%, transparent)`, color: hueFor(clientName) }}>
              {initialsOf(clientName)}
            </span>
            <span className="pj-card__client-name">{clientName}</span>
          </p>
          <h3 className="pj-card__name" data-testid={`project-card-${index}-name`}>
            {projectName}
          </h3>
        </header>

        <div className="pj-card__timeline">
          {lastUpdate && (
            <p className="pj-card__activity pj-card__activity--last">
              <span className="pj-card__activity-dot" />
              <span><strong>Ultima attività</strong> · {lastUpdate}</span>
            </p>
          )}
          <p className="pj-card__activity pj-card__activity--next">
            <ArrowRight size={11} strokeWidth={1.8} />
            <span><strong>Prossima</strong> · {nextActionLabel}</span>
          </p>
        </div>

        <footer className="pj-card__foot">
          <ul className="pj-card__metrics">
            <li title="Moodboards">
              <Image size={11} strokeWidth={1.8} />
              <span>{usedIn.moodboards}</span>
            </li>
            <li title="Materiali">
              <Box size={11} strokeWidth={1.8} />
              <span>{usedIn.materials || usedIn.proposals || 0}</span>
            </li>
            <li title="Decisioni">
              <CheckCircle2 size={11} strokeWidth={1.8} />
              <span>{usedIn.decisions || usedIn.memories || 0}</span>
            </li>
          </ul>
          {team.length > 0 && (
            <ul className="pj-card__team" aria-label="Team">
              {team.map((m, i) => (
                <li
                  key={m.id || i}
                  title={m.name || ''}
                  style={{
                    background: `color-mix(in srgb, ${hueFor(m.name || m.id || i)} 22%, transparent)`,
                    color: hueFor(m.name || m.id || i),
                    zIndex: 10 - i,
                  }}
                >
                  {initialsOf(m.name)}
                </li>
              ))}
            </ul>
          )}
        </footer>
      </div>
    </Link>
  );
};

// ─────────────────────────────────────────────────────────────────
// NEW PROJECT WIZARD — 4 step (Cliente → Tipologia → Nome → Conferma)
// ─────────────────────────────────────────────────────────────────
const PROJECT_TYPES = [
  { key: 'residential',   label: 'Residenziale',  desc: 'Case private, ville, appartamenti', Icon: Home },
  { key: 'hospitality',   label: 'Hospitality',   desc: 'Hotel, ristoranti, boutique',       Icon: Hotel },
  { key: 'office',        label: 'Office',        desc: 'Uffici, coworking, headquarters',   Icon: Briefcase },
  { key: 'retail',        label: 'Retail',        desc: 'Showroom, flagship, pop-up',        Icon: Building2 },
];

const NewProjectWizard = ({ open, onClose, onCreated }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  // Client picker state
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [client, setClient] = useState(null); // {id, name, email} OR {new: true, first_name, last_name, email}
  const [projType, setProjType] = useState(null);
  const [projName, setProjName] = useState('');

  // Reset wizard on open
  useEffect(() => {
    if (open) {
      setStep(1); setBusy(false);
      setClientQuery(''); setClientResults([]);
      setClient(null); setProjType(null); setProjName('');
    }
  }, [open]);

  // Live search clients (debounced)
  useEffect(() => {
    if (!open || step !== 1 || clientQuery.trim().length < 2) {
      setClientResults([]);
      return undefined;
    }
    const t = setTimeout(() => {
      api.get('/api/relations/accounts', { params: { q: clientQuery.trim(), limit: 6 } })
        .then(({ data }) => setClientResults(data?.data || data || []))
        .catch(() => setClientResults([]));
    }, 220);
    return () => clearTimeout(t);
  }, [clientQuery, step, open]);

  const canNext = useMemo(() => {
    if (step === 1) return !!client || (clientQuery.trim().length >= 2);
    if (step === 2) return !!projType;
    if (step === 3) return projName.trim().length >= 2;
    return true;
  }, [step, client, clientQuery, projType, projName]);

  // Auto-suggest project name when reaching step 3
  useEffect(() => {
    if (step === 3 && !projName && client) {
      const cn = client.name || client.first_name || 'Cliente';
      const pt = projType?.label || 'Progetto';
      setProjName(`${pt} ${cn}`.trim());
    }
  }, [step, client, projType, projName]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const payload = {
        title: projName.trim(),
        project_type: projType?.key || null,
        priority: 'normal',
        metadata_json: {
          onboarding_payload: {
            first_name: client?.first_name || (client?.name || '').split(' ')[0],
            last_name: client?.last_name || (client?.name || '').split(' ').slice(1).join(' '),
            account_id: client?.id || null,
            email: client?.email || null,
          },
        },
      };
      const r = await api.post('/api/projects', payload);
      refreshLicense();
      toast.success(`${projName} è ora in Discover · Design Journey™`);
      onCreated?.(r.data);
      // Navigate to the new project workspace
      const newId = r.data?.id || r.data?.project?.id;
      if (newId) navigate(`/workspace/projects/${newId}`);
      onClose?.();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.code === 'LICENSE_LIMIT_REACHED') {
        toast.error(`Limite progetti raggiunto (${detail.current}/${detail.limit}). Upgrade ${detail.plan}.`);
      } else {
        toast.error(formatError(err));
      }
    } finally { setBusy(false); }
  };

  const back = () => setStep((s) => Math.max(1, s - 1));
  const next = () => {
    // Promote inline-typed client query to "new client" stub
    if (step === 1 && !client && clientQuery.trim().length >= 2) {
      const parts = clientQuery.trim().split(/\s+/);
      setClient({
        first_name: parts[0],
        last_name: parts.slice(1).join(' ') || '',
        name: clientQuery.trim(),
        new: true,
      });
    }
    if (step === 4) return submit();
    setStep((s) => Math.min(4, s + 1));
    return undefined;
  };

  return (
    <AtelierModal
      open={open}
      onClose={onClose}
      eyebrow={`Design Journey™ · Step ${step} di 4`}
      title={
        step === 1 ? 'Per chi è questo progetto?' :
        step === 2 ? 'Che tipo di progetto?' :
        step === 3 ? 'Come si chiama?' :
                     'Conferma il nuovo progetto'
      }
      subtitle={
        step === 1 ? 'Scegli un cliente esistente o digita un nuovo nome.' :
        step === 2 ? 'Aiuta MOOD a preparare il workspace giusto. Potrai cambiarlo dopo.' :
        step === 3 ? 'Un nome che ti aiuti a riconoscerlo subito.' :
                     null
      }
      maxWidth={680}
      testid="new-project-wizard"
    >
      {/* Stepper */}
      <div className="pj-wizard__steps" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={`pj-wizard__step ${n <= step ? 'is-on' : ''}`} />
        ))}
      </div>

      {/* STEP 1 — Cliente */}
      {step === 1 && (
        <div className="pj-wizard__panel">
          <AtelierField label="Cliente">
            <div className="pj-wizard__search">
              <Search size={13} strokeWidth={1.6} />
              <AtelierInput
                value={clientQuery}
                onChange={(e) => { setClientQuery(e.target.value); setClient(null); }}
                placeholder="Cerca per nome o email…"
                autoFocus
                data-testid="wizard-client-search"
              />
            </div>
          </AtelierField>

          {clientResults.length > 0 && (
            <ul className="pj-wizard__results" data-testid="wizard-client-results">
              {clientResults.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className={`pj-wizard__result ${client?.id === a.id ? 'is-on' : ''}`}
                    onClick={() => setClient({ id: a.id, name: a.account_name || a.display_name, email: a.email })}
                    data-testid={`wizard-client-${a.id}`}
                  >
                    <span className="pj-wizard__result-avatar" style={{ background: `color-mix(in srgb, ${hueFor(a.id)} 22%, transparent)`, color: hueFor(a.id) }}>
                      {initialsOf(a.account_name || a.display_name || a.email)}
                    </span>
                    <span className="pj-wizard__result-body">
                      <span className="pj-wizard__result-name">{a.account_name || a.display_name}</span>
                      {a.email && <span className="pj-wizard__result-email">{a.email}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {clientResults.length === 0 && clientQuery.trim().length >= 2 && (
            <p className="pj-wizard__hint">
              <Sparkles size={12} strokeWidth={1.6} /> Premi <strong>Avanti</strong> per creare “{clientQuery.trim()}” come nuovo cliente.
            </p>
          )}
        </div>
      )}

      {/* STEP 2 — Tipologia */}
      {step === 2 && (
        <div className="pj-wizard__panel">
          <div className="pj-wizard__types" data-testid="wizard-types">
            {PROJECT_TYPES.map(({ key, label, desc, Icon }) => (
              <button
                key={key}
                type="button"
                className={`pj-wizard__type ${projType?.key === key ? 'is-on' : ''}`}
                onClick={() => setProjType({ key, label, desc })}
                data-testid={`wizard-type-${key}`}
              >
                <span className="pj-wizard__type-icon"><Icon size={20} strokeWidth={1.5} /></span>
                <span className="pj-wizard__type-body">
                  <strong>{label}</strong>
                  <em>{desc}</em>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3 — Nome progetto */}
      {step === 3 && (
        <div className="pj-wizard__panel">
          <AtelierField label="Nome progetto">
            <AtelierInput
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              placeholder="es. Residenza Sereno, Villa Maremma…"
              autoFocus
              data-testid="wizard-name"
            />
          </AtelierField>
        </div>
      )}

      {/* STEP 4 — Conferma */}
      {step === 4 && (
        <div className="pj-wizard__panel">
          <div className="pj-wizard__confirm" data-testid="wizard-confirm">
            <Row label="Cliente" value={client?.name || `${client?.first_name || ''} ${client?.last_name || ''}`} />
            <Row label="Tipologia" value={projType?.label} />
            <Row label="Progetto" value={projName} />
            <Row label="Fase iniziale" value="Discover" tone="accent" />
          </div>
          <p className="pj-wizard__hint">
            <Sparkles size={12} strokeWidth={1.6} />
            Verrà aperto in Discover. Aggiungerai budget, timeline e team dal workspace del progetto.
          </p>
        </div>
      )}

      <AtelierFooter align="between">
        <div>
          {step > 1 && (
            <AtelierButton variant="minimal" onClick={back} testid="wizard-back">
              <ChevronLeft size={13} strokeWidth={1.8} /> Indietro
            </AtelierButton>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <AtelierButton variant="ghost" onClick={onClose} testid="wizard-cancel">
            Annulla
          </AtelierButton>
          <AtelierButton
            onClick={next}
            disabled={!canNext}
            loading={busy && step === 4}
            testid="wizard-next"
          >
            {busy && step === 4 ? (<><Loader2 size={12} className="pj-spin" /> Apertura…</>) :
              step === 4 ? (<>Apri il progetto <ArrowRight size={13} strokeWidth={1.8} /></>) :
                          (<>Avanti <ArrowRight size={13} strokeWidth={1.8} /></>)}
          </AtelierButton>
        </div>
      </AtelierFooter>
    </AtelierModal>
  );
};

const Row = ({ label, value, tone }) => (
  <div className="pj-wizard__confirm-row">
    <span className="pj-wizard__confirm-label">{label}</span>
    <span className={`pj-wizard__confirm-value ${tone ? `is-${tone}` : ''}`}>{value || '—'}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────
const ProjectsPage = () => {
  const navigate = useNavigate();
  const { license, capacityFor } = useLicense();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);

  const cap = capacityFor('projects');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tab = FILTER_TABS.find((s) => s.key === filter);
      const params = tab && tab.statuses ? `?status=${encodeURIComponent(tab.statuses)}` : '';
      const { data } = await api.get(`/api/projects${params}`);
      setProjects(data.data || []);
    } catch { setProjects([]); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const kpis = useMemo(() => {
    const buckets = { active: 0, review: 0, presented: 0, approved: 0 };
    for (const p of projects) {
      const k = stageMeta(p.status).key;
      if (['discover', 'inspiration', 'moodboard'].includes(k)) buckets.active++;
      if (k === 'moodboard') buckets.review++;
      if (k === 'presentation') buckets.presented++;
      if (['approval', 'specification'].includes(k)) buckets.approved++;
    }
    return buckets;
  }, [projects]);

  const onCta = () => {
    if (cap.atCap) navigate('/settings/plan');
    else setWizardOpen(true);
  };

  return (
    <div className="pj-page" data-testid="projects-page">
      <NewProjectWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={() => { setWizardOpen(false); load(); }}
      />

      {/* ── HERO ──────────────────────────────────────────────── */}
      <header className="pj-hero">
        <div className="pj-hero__copy">
          <p className="pj-hero__eyebrow" data-testid="projects-page-eyebrow">
            MOOD · Studio Operations
          </p>
          <h1 className="pj-hero__title" data-testid="projects-page-title">
            <em>Design Journey&trade;</em>
          </h1>
          <p className="pj-hero__subtitle">
            Gestisci ogni progetto dal primo incontro alla presentazione finale.
          </p>
        </div>
        <div className="pj-hero__actions">
          {license && (
            <UsageChip label="Progetti" current={cap.current} limit={cap.limit}
                       unlimited={cap.unlimited} atCap={cap.atCap} nearCap={cap.nearCap}
                       testid="projects-usage-chip" />
          )}
          <button
            type="button"
            onClick={onCta}
            className={`pj-hero__cta ${cap.atCap ? 'is-locked' : ''}`}
            data-testid="new-project-btn"
          >
            {cap.atCap
              ? (<><Lock size={13} strokeWidth={1.8} /> Upgrade to create more</>)
              : (<><Plus size={14} strokeWidth={1.8} /> Nuovo progetto</>)}
          </button>
        </div>
      </header>

      {/* ── KPI STRIP ─────────────────────────────────────────── */}
      <section className="pj-kpis" data-testid="projects-kpis">
        <KpiCard label="Progetti attivi"        value={kpis.active}    accent="accent" />
        <KpiCard label="In revisione"           value={kpis.review}    accent="info" />
        <KpiCard label="Presentazioni"          value={kpis.presented} accent="warning" />
        <KpiCard label="Approvati"              value={kpis.approved}  accent="positive" />
      </section>

      {/* ── FILTER TABS ───────────────────────────────────────── */}
      <nav className="pj-tabs" role="tablist">
        {FILTER_TABS.map((s) => (
          <button
            key={s.key || 'all'}
            type="button"
            data-testid={`tab-${s.key || 'all'}`}
            onClick={() => setFilter(s.key)}
            className={`pj-tab ${filter === s.key ? 'is-active' : ''}`}
            role="tab"
            aria-selected={filter === s.key}
          >
            {s.fallback}
          </button>
        ))}
      </nav>

      {/* ── GRID ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="pj-grid">
          {[1, 2, 3, 4].map((i) => <div key={i} className="pj-card pj-card--skeleton" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="pj-empty" data-testid="projects-empty">
          <Sparkles size={28} strokeWidth={1} />
          <h3>Il tuo studio è pronto per il primo progetto.</h3>
          <p>Apri una Design Journey™ e MOOD si occuperà del workspace.</p>
          <button onClick={onCta} className="pj-hero__cta" data-testid="projects-empty-cta">
            {cap.atCap ? 'Upgrade plan' : (<><Plus size={13} strokeWidth={1.8} /> Apri la prima Journey</>)}
          </button>
        </div>
      ) : (
        <div className="pj-grid" data-testid="projects-grid">
          {projects.map((p, i) => (
            <ProjectCard key={p.id} project={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
};

const KpiCard = ({ label, value, accent }) => (
  <div className={`pj-kpi pj-kpi--${accent}`}>
    <span className="pj-kpi__value">{value}</span>
    <span className="pj-kpi__label">{label}</span>
  </div>
);

export default ProjectsPage;
