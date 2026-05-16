/**
 * DashboardPage — Cinematic Enterprise Workflow OS dashboard.
 *
 * Layout (per mockup):
 *   ┌─ Welcome strip ─────────────────────────────────────────┐
 *   │   "Bentornato, Stefano"   ·   date selector                │
 *   ├─ 4 KPI cards  +  Quick Actions  +  Tasks ──────────────┤
 *   │   (KPIs span 4 columns; right rail is 2 column stack)     │
 *   ├─ Featured projects horizontal scroller ────────────────┤
 *   ├─ 4-column operational grid ────────────────────────────┤
 *   │   Recent activity · Media preview · Top materials · Team │
 *   ├─ Project timeline ─────────────────────────────────────┤
 *   └─────────────────────────────────────────────────────────┘
 *
 * All data from /api/dashboard/summary (one round-trip). Real where data
 * exists, elegant empty states where it doesn't. NO fake data.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLocaleRuntime } from '../../contexts/LocaleRuntimeContext';
import StudioOnboardingPanel from '../../components/dashboard/StudioOnboardingPanel';
import AssignedClientsPanel from '../../components/dashboard/AssignedClientsPanel';

// ── tiny utils ────────────────────────────────────────────────────────
const fmtRelative = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'ora';
  if (diff < 3600) return `${Math.round(diff / 60)}m fa`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h fa`;
  if (diff < 604800) return `${Math.round(diff / 86400)}g fa`;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
};

const fmtDate = (iso) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

const initials = (name) => (name || '?').split(' ')
  .map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

// ── Sparkline (SVG, no library) ──────────────────────────────────────
const Sparkline = ({ data, width = 120, height = 32, color = 'var(--bp-primary)' }) => {
  if (!data || !data.length) return null;
  const max = Math.max(1, ...data);
  const step = width / (data.length - 1 || 1);
  const path = data.map((v, i) => {
    const x = i * step;
    const y = height - (v / max) * (height - 4) - 2;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const areaPath = `${path} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-grad-${color.replace(/[^a-z]/gi, '')}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-grad-${color.replace(/[^a-z]/gi, '')})`} />
      <path d={path} stroke={color} strokeWidth="1.4" fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

// ── KPI card ─────────────────────────────────────────────────────────
const KpiCard = ({ kpi, label }) => {
  const Icon = Icons[kpi.icon] || Icons.Square;
  const positive = kpi.trend >= 0;
  return (
    <div
      data-testid={`kpi-${kpi.id}`}
      className="bp-card p-6 flex flex-col"
    >
      <div className="flex items-start justify-between">
        <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--bp-text-muted)] font-body">
          {label}
        </p>
        <div className="w-8 h-8 rounded-[8px] bg-[var(--bp-surface-2)] flex items-center justify-center text-[var(--bp-text-muted)]">
          <Icon size={14} strokeWidth={1.5} />
        </div>
      </div>
      <p className="mt-5 text-[34px] tabular-nums font-heading text-[var(--bp-text-primary)] tracking-tight leading-none">
        {kpi.value}{kpi.format === 'hours' ? <span className="text-[20px] text-[var(--bp-text-muted)]">h</span> : ''}
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        {kpi.trend !== 0 && (
          <span className={`text-[11px] font-mono tabular-nums ${positive ? 'text-[var(--bp-primary)]' : 'text-[var(--bp-danger)]'}`}>
            {positive ? '↑' : '↓'} {Math.abs(kpi.trend)}%
          </span>
        )}
        <span className="text-[10px] text-[var(--bp-text-muted)] font-body">vs 14g</span>
      </div>
      <div className="mt-3 -mb-1">
        <Sparkline data={kpi.sparkline} width={210} height={36} />
      </div>
    </div>
  );
};

// ── Quick actions ────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { id: 'lead', icon: 'Users', label: 'Nuovo Lead', to: '/workspace/leads?new=1' },
  { id: 'project', icon: 'FolderOpen', label: 'Nuovo Progetto', to: '/workspace/projects?new=1' },
  { id: 'proposal', icon: 'FileText', label: 'Nuova Proposta', to: '/workspace/proposals?new=1' },
  { id: 'moodboard', icon: 'Layers', label: 'Nuovo Moodboard', to: '/moodboards?new=1' },
  { id: 'upload', icon: 'Upload', label: 'Carica file', to: '/library?upload=1' },
];

const QuickActions = () => (
  <div data-testid="quick-actions" className="bp-card p-6">
    <h3 className="text-[15px] font-heading text-[var(--bp-text-primary)] mb-5">Azioni rapide</h3>
    <div className="space-y-1">
      {QUICK_ACTIONS.map((a) => {
        const Icon = Icons[a.icon] || Icons.Square;
        return (
          <Link
            key={a.id}
            to={a.to}
            data-testid={`quick-action-${a.id}`}
            className="group flex items-center gap-3 px-2.5 py-2 rounded-[8px]
                       hover:bg-[var(--bp-surface-2)]/60 transition-colors"
          >
            <span className="w-7 h-7 rounded-[6px] bg-[var(--bp-surface-2)] flex items-center justify-center text-[var(--bp-text-muted)] group-hover:text-[var(--bp-primary)] transition-colors">
              <Icon size={13} strokeWidth={1.5} />
            </span>
            <span className="flex-1 text-[13px] text-[var(--bp-text-secondary)] group-hover:text-[var(--bp-text-primary)] transition-colors font-body">
              {a.label}
            </span>
            <Icons.ChevronRight size={12} className="text-[var(--bp-text-subtle)] group-hover:text-[var(--bp-text-muted)]" />
          </Link>
        );
      })}
    </div>
  </div>
);

// ── Tasks panel ──────────────────────────────────────────────────────
const TasksPanel = ({ tasks }) => (
  <div data-testid="tasks-panel" className="bp-card p-6">
    <div className="flex items-center justify-between mb-5">
      <h3 className="text-[15px] font-heading text-[var(--bp-text-primary)]">Attività da completare</h3>
      {tasks.length > 0 && (
        <span className="px-1.5 py-0.5 rounded-[4px] bg-[var(--bp-primary-soft)] text-[var(--bp-primary)] text-[10px] font-mono tabular-nums">
          {tasks.length}
        </span>
      )}
    </div>
    {tasks.length === 0 ? (
      <p className="text-[12px] text-[var(--bp-text-muted)] italic font-body py-8 text-center">
        Tutto sotto controllo. Nessuna attività in sospeso.
      </p>
    ) : (
      <div className="space-y-2.5">
        {tasks.map((t) => {
          const d = t.due_date ? new Date(t.due_date) : null;
          return (
            <div
              key={t.id}
              data-testid={`task-row-${t.id}`}
              className="flex items-start gap-3 px-2 py-1.5 rounded-[6px] hover:bg-[var(--bp-surface-2)]/40 transition-colors"
            >
              <span className="w-4 h-4 mt-0.5 rounded-[3px] border border-[var(--bp-border-strong)] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[var(--bp-text-primary)] truncate font-body">
                  {t.title}
                </p>
                {t.project_title && (
                  <p className="text-[11px] text-[var(--bp-text-muted)] truncate mt-0.5 font-body">
                    {t.project_title}
                  </p>
                )}
              </div>
              {d && (
                <span className="text-[10px] text-[var(--bp-text-muted)] font-body whitespace-nowrap">
                  {fmtDate(t.due_date)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    )}
    <Link
      to="/workspace/tasks"
      className="mt-4 inline-block text-[11px] text-[var(--bp-primary)] hover:underline font-body"
      data-testid="see-all-tasks-btn"
    >
      Vedi tutte le attività
    </Link>
  </div>
);

// ── Featured projects ────────────────────────────────────────────────
const FeaturedProjects = ({ projects }) => (
  <section data-testid="featured-projects" className="bp-card p-8">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-[18px] font-heading text-[var(--bp-text-primary)]">Progetti in evidenza</h3>
      <Link
        to="/workspace/projects"
        data-testid="see-all-projects-btn"
        className="text-[11px] text-[var(--bp-primary)] hover:underline font-body"
      >
        Vedi tutti
      </Link>
    </div>
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
      {projects.map((p) => (
        <Link
          key={p.id}
          to={`/workspace/projects/${p.id}`}
          data-testid={`featured-project-${p.id}`}
          className="group rounded-[10px] overflow-hidden border border-[var(--bp-border)] bg-[var(--bp-bg)]
                     hover:border-[var(--bp-border-strong)] transition-colors"
        >
          <div className="aspect-[16/11] relative bg-[var(--bp-surface-2)] overflow-hidden">
            {p.cover_url ? (
              <img src={p.cover_url} alt={p.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Icons.FolderOpen size={24} className="text-[var(--bp-text-subtle)]" strokeWidth={1.3} />
              </div>
            )}
          </div>
          <div className="p-4">
            <p className="text-[13px] text-[var(--bp-text-primary)] font-medium leading-snug line-clamp-1">
              {p.title}
            </p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mt-1 font-body">
              {p.project_type || 'Project'}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-1 rounded-full bg-[var(--bp-surface-3)] overflow-hidden">
                <div
                  className="h-full bg-[var(--bp-primary)] rounded-full transition-all"
                  style={{ width: `${p.progress}%` }}
                />
              </div>
              <span className="text-[10px] text-[var(--bp-text-secondary)] font-mono tabular-nums whitespace-nowrap">
                {p.progress}%
              </span>
            </div>
          </div>
        </Link>
      ))}
      <Link
        to="/workspace/projects?new=1"
        data-testid="new-project-tile"
        className="group rounded-[10px] border border-dashed border-[var(--bp-border-strong)] bg-transparent
                   flex flex-col items-center justify-center min-h-[200px] gap-3
                   hover:border-[var(--bp-primary)]/40 hover:bg-[var(--bp-primary-soft)] transition-all"
      >
        <span className="w-10 h-10 rounded-full border border-[var(--bp-border-strong)] flex items-center justify-center text-[var(--bp-text-muted)] group-hover:text-[var(--bp-primary)] group-hover:border-[var(--bp-primary)]/40 transition-all">
          <Icons.Plus size={16} strokeWidth={1.5} />
        </span>
        <span className="text-[12px] text-[var(--bp-text-secondary)] font-body group-hover:text-[var(--bp-primary)] transition-colors">
          Nuovo progetto
        </span>
      </Link>
    </div>
  </section>
);

// ── Recent activity feed ─────────────────────────────────────────────
const ACTIVITY_ICON = {
  moodboard: 'Layers', proposal: 'FileText', project: 'FolderOpen',
  lead: 'Users', material: 'Gem', media: 'Image',
};

const RecentActivity = ({ events }) => (
  <div data-testid="recent-activity" className="bp-card p-6">
    <h3 className="text-[15px] font-heading text-[var(--bp-text-primary)] mb-5">Attività recenti</h3>
    {events.length === 0 ? (
      <p className="text-[12px] text-[var(--bp-text-muted)] italic py-6 text-center">Nessuna attività recente</p>
    ) : (
      <div className="space-y-3">
        {events.map((e, i) => {
          const Icon = Icons[ACTIVITY_ICON[e.type]] || Icons.Circle;
          return (
            <div key={i} className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-[var(--bp-surface-2)] flex-shrink-0 flex items-center justify-center text-[var(--bp-text-muted)] mt-0.5">
                <Icon size={12} strokeWidth={1.5} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[var(--bp-text-primary)] truncate font-body">
                  {e.title}
                </p>
                {e.subtitle && (
                  <p className="text-[11px] text-[var(--bp-text-muted)] truncate mt-0.5 font-body">{e.subtitle}</p>
                )}
              </div>
              <span className="text-[10px] text-[var(--bp-text-muted)] font-body whitespace-nowrap flex-shrink-0">
                {fmtRelative(e.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

// ── Media library preview ────────────────────────────────────────────
const MediaPreview = ({ assets }) => (
  <div data-testid="media-preview" className="bp-card p-6">
    <div className="flex items-center justify-between mb-5">
      <h3 className="text-[15px] font-heading text-[var(--bp-text-primary)]">Media Library</h3>
      <Link to="/library" className="text-[11px] text-[var(--bp-primary)] hover:underline font-body" data-testid="media-see-all-btn">
        Vedi tutto
      </Link>
    </div>
    {assets.length === 0 ? (
      <p className="text-[12px] text-[var(--bp-text-muted)] italic py-6 text-center">Archivio vuoto</p>
    ) : (
      <div className="grid grid-cols-3 gap-2">
        {assets.map((a) => (
          <Link
            to="/library"
            key={a.id}
            data-testid={`media-tile-${a.id}`}
            className="aspect-square rounded-[6px] overflow-hidden border border-[var(--bp-border)] bg-[var(--bp-surface-2)] relative group"
          >
            {(a.file_type || '').startsWith('image/') ? (
              <img src={a.display_url} alt={a.alt_text || a.file_name} className="w-full h-full object-cover" loading="lazy" />
            ) : a.file_type === 'application/pdf' ? (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <Icons.FileText size={20} className="text-[var(--bp-text-muted)]" />
                <span className="text-[8px] uppercase tracking-wider text-[var(--bp-text-muted)] font-mono mt-1">PDF</span>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Icons.Layers size={18} className="text-[var(--bp-text-muted)]" />
              </div>
            )}
          </Link>
        ))}
      </div>
    )}
  </div>
);

// ── Top materials ────────────────────────────────────────────────────
const TopMaterials = ({ materials }) => (
  <div data-testid="top-materials" className="bp-card p-6">
    <div className="flex items-center justify-between mb-5">
      <h3 className="text-[15px] font-heading text-[var(--bp-text-primary)]">Materiali più utilizzati</h3>
    </div>
    {materials.length === 0 ? (
      <p className="text-[12px] text-[var(--bp-text-muted)] italic py-6 text-center">Nessun materiale registrato</p>
    ) : (
      <div className="space-y-2.5">
        {materials.map((m) => (
          <Link
            key={m.id}
            to={`/library/materials/${m.slug}`}
            data-testid={`top-material-${m.slug}`}
            className="flex items-center gap-3 px-1.5 py-1.5 rounded-[6px] hover:bg-[var(--bp-surface-2)]/50 transition-colors"
          >
            <span className="w-10 h-10 rounded-[6px] overflow-hidden bg-[var(--bp-surface-2)] flex-shrink-0">
              {m.image_url ? (
                <img src={m.image_url} alt={m.name} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Icons.Gem size={13} className="text-[var(--bp-text-muted)]" strokeWidth={1.3} />
                </div>
              )}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-[var(--bp-text-primary)] truncate font-body">{m.name}</p>
              {m.subtitle && (
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)] mt-0.5 font-body">
                  {m.subtitle}
                </p>
              )}
            </div>
            <span className="text-[10px] text-[var(--bp-text-muted)] font-body whitespace-nowrap">
              {m.project_count} {m.project_count === 1 ? 'progetto' : 'progetti'}
            </span>
          </Link>
        ))}
      </div>
    )}
    <Link to="/library/materials" className="mt-4 inline-block text-[11px] text-[var(--bp-primary)] hover:underline font-body">
      Vai al Material Registry
    </Link>
  </div>
);

// ── Team activity ────────────────────────────────────────────────────
const TeamActivity = ({ members }) => (
  <div data-testid="team-activity" className="bp-card p-6">
    <h3 className="text-[15px] font-heading text-[var(--bp-text-primary)] mb-5">Attività del team</h3>
    {members.length === 0 ? (
      <p className="text-[12px] text-[var(--bp-text-muted)] italic py-6 text-center">Nessun membro attivo</p>
    ) : (
      <div className="space-y-3">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full overflow-hidden bg-[var(--bp-surface-2)] flex-shrink-0 flex items-center justify-center text-[10px] font-mono text-[var(--bp-text-secondary)] border border-[var(--bp-border)]">
              {m.avatar_url
                ? <img src={m.avatar_url} alt={m.name} className="w-full h-full object-cover" />
                : initials(m.name)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-[var(--bp-text-primary)] truncate font-body">{m.name}</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--bp-text-muted)] mt-0.5 font-body">
                {m.role}
              </p>
            </div>
            <span className="text-[10px] text-[var(--bp-text-muted)] font-body whitespace-nowrap">
              {fmtRelative(m.last_seen_at)}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ── Timeline ────────────────────────────────────────────────────────
const Timeline = ({ events }) => {
  const days = useMemo(() => {
    const out = [];
    const start = new Date();
    for (let i = 0; i < 8; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return out;
  }, []);
  const eventsByDate = useMemo(() => {
    const m = {};
    events.forEach((e) => { (m[e.date] = m[e.date] || []).push(e); });
    return m;
  }, [events]);

  return (
    <section data-testid="dashboard-timeline" className="bp-card p-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[18px] font-heading text-[var(--bp-text-primary)]">Timeline progetti</h3>
        <Link to="/workspace/calendar" className="text-[11px] text-[var(--bp-primary)] hover:underline font-body">
          Vedi calendario
        </Link>
      </div>
      <div className="grid grid-cols-8 gap-2">
        {days.map((d, i) => {
          const key = d.toISOString().slice(0, 10);
          const items = eventsByDate[key] || [];
          const isToday = i === 0;
          return (
            <div key={key} className="flex flex-col">
              <div className={`text-center mb-2 ${isToday ? 'text-[var(--bp-primary)]' : 'text-[var(--bp-text-muted)]'}`}>
                <p className="text-[10px] uppercase tracking-[0.18em] font-body">
                  {d.toLocaleDateString('it-IT', { weekday: 'short' })}
                </p>
                <p className="text-[16px] font-medium tabular-nums">
                  {d.getDate()}
                </p>
              </div>
              <div className="flex-1 min-h-[80px] rounded-[6px] border border-[var(--bp-border)]/60 bg-[var(--bp-bg)]/40 p-1.5 space-y-1">
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    className={`text-[10px] px-1.5 py-1 rounded-[3px] truncate font-body
                                ${it.kind === 'proposal'
                                  ? 'bg-[var(--bp-primary-soft)] text-[var(--bp-primary)]'
                                  : 'bg-[var(--bp-surface-3)] text-[var(--bp-text-secondary)]'}`}
                    title={it.title}
                  >
                    {it.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════════════
const KPI_LABELS = {
  active_projects: 'Progetti attivi',
  pending_proposals: 'Proposte in attesa',
  completed_tasks: 'Attività completate',
  hours_logged: 'Ore di lavoro',
};

// ── Operational Hero (P0.5 §1 · P0.2.A locale-runtime aware) ────────
const OperationalHero = ({ firstName, summary }) => {
  const hour = new Date().getHours();
  const greeting = hour < 6 ? 'Buona notte' : hour < 13 ? 'Buongiorno' : hour < 19 ? 'Buon pomeriggio' : 'Buonasera';
  const runtime = useLocaleRuntime();
  return (
    <section data-testid="dashboard-operational-hero"
             data-locale-code={runtime.localeCode}
             className="bp-card relative overflow-hidden px-9 py-9">
      <div
        className="absolute inset-0 opacity-[0.35] pointer-events-none"
        style={{
          background:
            'radial-gradient(60% 80% at 0% 0%, var(--bp-primary-soft, rgba(216,180,122,0.06)) 0%, transparent 70%)',
        }}
      />
      <p className="relative text-[10px] tracking-[0.3em] uppercase text-[var(--bp-primary)] font-body mb-3"
         data-testid="dashboard-hero-eyebrow">
        {runtime.copy('dashboard.hero.eyebrow')}
      </p>
      <h1 className="relative text-[36px] font-heading text-[var(--bp-text-primary)] leading-[1.02] tracking-tight"
          data-testid="dashboard-hero-greeting">
        {greeting}, <span className="italic text-[var(--bp-text-secondary)]">{firstName}.</span>
      </h1>
      <p className="relative mt-2 text-[14.5px] font-body text-[var(--bp-text-secondary)] max-w-2xl leading-relaxed italic"
         data-testid="dashboard-hero-welcome">
        {runtime.copy('dashboard.hero.welcome')}
      </p>
      {summary?.length > 0 ? (
        <ul className="relative mt-5 space-y-2 max-w-2xl" data-testid="hero-summary">
          {summary.map((s, idx) => {
            const Icon = Icons[s.icon] || Icons.ChevronRight;
            return (
              <li key={idx}>
                <Link to={s.to} className="group inline-flex items-center gap-3 py-1
                                           text-[14.5px] text-[var(--bp-text-secondary)]
                                           hover:text-[var(--bp-text-primary)] transition-colors font-body">
                  <Icon size={13} strokeWidth={1.5} className="text-[var(--bp-primary)] opacity-80" />
                  <span>{s.text}</span>
                  <Icons.ArrowUpRight size={11} strokeWidth={1.5}
                    className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="relative mt-5 text-[13.5px] text-[var(--bp-text-muted)] font-body max-w-xl"
           data-testid="dashboard-hero-empty">
          {runtime.copy('dashboard.hero.empty')}
        </p>
      )}
    </section>
  );
};

// ── Recent Design Requests (P0.5 §2) ─────────────────────────────────
const LeadCard = ({ lead }) => {
  const scoreLevel = lead.score >= 70 ? 'high' : lead.score >= 40 ? 'medium' : 'low';
  return (
    <Link
      to={`/workspace/leads/${lead.id}`}
      data-testid={`lead-card-${lead.id}`}
      className="bp-card p-5 hover:border-[var(--bp-border-strong)] transition-all group flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--bp-text-muted)] font-body mb-1">
            {lead.country || 'Senza paese'} · {lead.language?.toUpperCase() || '—'}
          </p>
          <h4 className="text-[15.5px] font-medium text-[var(--bp-text-primary)] truncate font-body">
            {lead.name}
          </h4>
        </div>
        <span className={`shrink-0 px-2 py-0.5 text-[9.5px] tracking-[0.16em] uppercase font-body rounded-[2px] ${
          scoreLevel === 'high' ? 'bg-[var(--bp-primary-soft)] text-[var(--bp-primary)]'
          : scoreLevel === 'medium' ? 'bg-[var(--bp-surface-3)] text-[var(--bp-text-secondary)]'
          : 'bg-[var(--bp-surface-2)] text-[var(--bp-text-muted)]'
        }`}>
          {lead.score || 0}/100
        </span>
      </div>
      <div className="text-[12px] text-[var(--bp-text-secondary)] font-body space-y-0.5">
        {lead.project_type && <p>· {lead.project_type.replace(/_/g, ' ')}</p>}
        {lead.budget_range && <p>· budget {lead.budget_range}</p>}
      </div>
      <div className="mt-auto pt-3 border-t border-[var(--bp-border)] flex items-center justify-between text-[10px] text-[var(--bp-text-muted)] font-body">
        <span className="truncate">
          {lead.assignee?.name ? `Curato da ${lead.assignee.name}` : 'Non assegnato'}
        </span>
        <span className="shrink-0">{fmtRelative(lead.created_at)}</span>
      </div>
    </Link>
  );
};

const RecentDesignRequests = ({ leads }) => (
  <section data-testid="dashboard-recent-leads" className="bp-card p-8">
    <div className="flex items-end justify-between mb-6">
      <div>
        <p className="text-[10px] tracking-[0.28em] uppercase text-[var(--bp-primary)] font-body mb-2">
          Studio · Recent Design Requests
        </p>
        <h3 className="text-[20px] font-heading text-[var(--bp-text-primary)] leading-tight">
          Richieste progetto recenti
        </h3>
      </div>
      <Link to="/workspace/leads" className="text-[11px] text-[var(--bp-text-secondary)] hover:text-[var(--bp-primary)] font-body">
        Vedi tutte →
      </Link>
    </div>
    {leads.length === 0 ? (
      <div className="py-10 text-center">
        <Icons.Sparkles size={20} strokeWidth={1.2} className="text-[var(--bp-text-muted)] mx-auto mb-3 opacity-50" />
        <p className="text-[13px] text-[var(--bp-text-secondary)] font-body max-w-md mx-auto">
          Le richieste qualificate dai contenuti editoriali e dall'onboarding pubblico
          appariranno qui in tempo reale.
        </p>
      </div>
    ) : (
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {leads.slice(0, 4).map((l) => <LeadCard key={l.id} lead={l} />)}
      </div>
    )}
  </section>
);

// ── Projects Requiring Attention (P0.5 §3) ───────────────────────────
const ProjectAttentionCard = ({ project, stale }) => {
  const Icon = Icons.FolderOpen;
  return (
    <Link
      to={`/workspace/projects/${project.id}`}
      data-testid={`project-card-${project.id}`}
      className={`relative bp-card p-5 hover:border-[var(--bp-border-strong)] transition-all group block ${
        stale ? 'ring-1 ring-[var(--bp-primary)]/30' : ''
      }`}
    >
      {stale && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.2em]
                         text-[var(--bp-primary)] font-body">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--bp-primary)] animate-pulse" />
          Da riprendere
        </span>
      )}
      <div className="aspect-[16/10] mb-4 overflow-hidden bg-[var(--bp-surface-2)] rounded-[3px]">
        {project.cover_url ? (
          <img src={project.cover_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon size={22} strokeWidth={1.2} className="text-[var(--bp-text-muted)] opacity-40" />
          </div>
        )}
      </div>
      <h4 className="text-[14.5px] font-medium text-[var(--bp-text-primary)] truncate font-body mb-1">
        {project.title}
      </h4>
      <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--bp-text-muted)] font-body mb-3">
        {project.project_type || project.status || 'progetto'}
      </p>
      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-[2px] bg-[var(--bp-surface-2)] overflow-hidden">
          <div className="h-full bg-[var(--bp-primary)]" style={{ width: `${project.progress || 0}%` }} />
        </div>
        <span className="text-[10px] text-[var(--bp-text-muted)] font-body tabular-nums">
          {project.progress || 0}%
        </span>
      </div>
    </Link>
  );
};

const ProjectsRequiringAttention = ({ projects, staleIds }) => {
  const staleSet = new Set(staleIds || []);
  return (
    <section data-testid="dashboard-projects-attention" className="bp-card p-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-[10px] tracking-[0.28em] uppercase text-[var(--bp-primary)] font-body mb-2">
            Studio · Projects requiring attention
          </p>
          <h3 className="text-[20px] font-heading text-[var(--bp-text-primary)] leading-tight">
            Progetti che chiedono la tua attenzione
          </h3>
        </div>
        <Link to="/workspace/projects" className="text-[11px] text-[var(--bp-text-secondary)] hover:text-[var(--bp-primary)] font-body">
          Vedi tutti →
        </Link>
      </div>
      {projects.length === 0 ? (
        <div className="py-10 text-center">
          <Icons.FolderOpen size={20} strokeWidth={1.2} className="text-[var(--bp-text-muted)] mx-auto mb-3 opacity-50" />
          <p className="text-[13px] text-[var(--bp-text-secondary)] font-body max-w-md mx-auto">
            I progetti in corso e quelli da curare emergeranno qui non appena un lead viene convertito.
          </p>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {projects.slice(0, 4).map((p) =>
            <ProjectAttentionCard key={p.id} project={p} stale={staleSet.has(p.id)} />)}
        </div>
      )}
    </section>
  );
};

// ── Design References Stream (P0.5 §4) ───────────────────────────────
const DesignReferencesStream = ({ refs }) => (
  <section data-testid="dashboard-design-refs" className="bp-card p-8">
    <div className="flex items-end justify-between mb-6">
      <div>
        <p className="text-[10px] tracking-[0.28em] uppercase text-[var(--bp-primary)] font-body mb-2">
          Editorial · Design References
        </p>
        <h3 className="text-[20px] font-heading text-[var(--bp-text-primary)] leading-tight">
          Riferimenti salvati dai visitatori
        </h3>
      </div>
      <Link to="/magazine" className="text-[11px] text-[var(--bp-text-secondary)] hover:text-[var(--bp-primary)] font-body">
        Magazine →
      </Link>
    </div>
    {refs.length === 0 ? (
      <div className="py-10 text-center">
        <Icons.Bookmark size={20} strokeWidth={1.2} className="text-[var(--bp-text-muted)] mx-auto mb-3 opacity-50" />
        <p className="text-[13px] text-[var(--bp-text-secondary)] font-body max-w-md mx-auto">
          Quando i visitatori salveranno un'atmosfera o un materiale dagli articoli editoriali,
          la troverai qui — pronta per essere portata in un progetto.
        </p>
      </div>
    ) : (
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {refs.slice(0, 5).map((r) => (
          <Link
            key={r.id}
            to={r.article_slug ? `/magazine/${r.article_slug}` : '/workspace/leads'}
            data-testid={`design-ref-${r.id}`}
            className="bp-card overflow-hidden hover:border-[var(--bp-border-strong)] transition-all"
          >
            <div className="aspect-[4/3] bg-[var(--bp-surface-2)] overflow-hidden">
              {r.image_url && <img src={r.image_url} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--bp-primary)] font-body mb-1">
                {r.vertical || 'Editorial'}
              </p>
              <h4 className="text-[13px] font-medium text-[var(--bp-text-primary)] line-clamp-2 font-body leading-snug">
                {r.label}
              </h4>
              <p className="text-[10px] text-[var(--bp-text-muted)] mt-2 font-body">
                {r.client_name} · {fmtRelative(r.created_at)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    )}
  </section>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api.get('/api/dashboard/summary')
      .then((r) => { if (alive) setData(r.data); })
      .catch((e) => {
        if (!alive) return;
        const status = e?.response?.status;
        setError({
          status,
          message: status === 403
            ? 'Questa dashboard è riservata ai membri dello studio.'
            : 'Impossibile caricare la dashboard in questo momento.',
        });
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  const firstName = user?.first_name || (user?.email || '').split('@')[0];
  const today = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

  if (loading && !data) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--bp-bg)]">
        <Icons.Loader2 size={20} className="animate-spin text-[var(--bp-text-muted)]" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div data-testid="dashboard-error" className="h-full flex flex-col items-center justify-center bg-[var(--bp-bg)] px-10 py-16 text-center">
        <div className="w-14 h-14 rounded-[12px] border border-[var(--bp-border)] bg-[var(--bp-surface-1)] flex items-center justify-center mb-6">
          <Icons.AlertCircle size={20} strokeWidth={1.3} className="text-[var(--bp-text-muted)]" />
        </div>
        <p className="text-[10px] tracking-[0.28em] uppercase text-[var(--bp-text-muted)] font-body mb-2">
          {error.status === 403 ? 'Accesso limitato' : 'Errore'}
        </p>
        <h1 className="text-[22px] font-medium tracking-tight text-[var(--bp-text-primary)] mb-2 max-w-md leading-tight">
          {error.message}
        </h1>
        {error.status !== 403 && (
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            data-testid="dashboard-retry-btn"
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-[8px] border border-[var(--bp-border)]
                       text-[12px] text-[var(--bp-text-secondary)] hover:text-[var(--bp-text-primary)]
                       hover:border-[var(--bp-border-strong)] font-body transition-colors"
          >
            <Icons.RotateCcw size={12} />
            Riprova
          </button>
        )}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div data-testid="dashboard-page" className="px-10 py-10 max-w-[1600px] mx-auto space-y-8">
      {/* P0.5 §1 — Operational Hero replaces the generic welcome */}
      <OperationalHero firstName={firstName} summary={data.operational_summary || []} />

      {/* Studio onboarding panel (S.1) — auto-hides when complete/dismissed */}
      <StudioOnboardingPanel />

      {/* Assigned clients follow-up (S.2) — auto-hides when no assignments */}
      <AssignedClientsPanel />

      {/* KPIs + right rail — KPIs are real (sourced from real DB counts) */}
      <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 1fr) 280px 280px' }}>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {data.kpis.map((k) => (
            <KpiCard key={k.id} kpi={k} label={KPI_LABELS[k.id] || k.id} />
          ))}
        </div>
        <QuickActions />
        <TasksPanel tasks={data.tasks || []} />
      </div>

      {/* P0.5 §2 — Recent Design Requests */}
      <RecentDesignRequests leads={data.recent_leads || []} />

      {/* P0.5 §3 — Projects Requiring Attention */}
      <ProjectsRequiringAttention
        projects={data.featured_projects || []}
        staleIds={data.stale_project_ids || []}
      />

      {/* P0.5 §4 — Design References Stream */}
      <DesignReferencesStream refs={data.design_references || []} />

      {/* P0.5 §5 — Studio Activity Feed (existing operational stream) */}
      <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <RecentActivity events={data.recent_activity || []} />
        <MediaPreview assets={data.media_preview || []} />
        <TopMaterials materials={data.top_materials || []} />
        <TeamActivity members={data.team_activity || []} />
      </div>

      {/* Timeline */}
      <Timeline events={data.timeline || []} />
    </div>
  );
};

export default DashboardPage;
