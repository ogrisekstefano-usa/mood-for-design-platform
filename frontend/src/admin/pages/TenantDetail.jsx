/**
 * TenantDetail — M6 Relationship Center.
 *
 * 3-column permanent layout:
 *   Left:   ContactsPanel             (M1 data)
 *   Center: RelationshipFeedPanel     (M2 timeline = events+activities+emails unified)
 *   Right:  NextActionsPanel          (M3 open-followups + recent completed)
 *
 * Operational header strip (no useless KPIs):
 *   Founder · Advisor · Owner · Last Touch · Next Follow-Up · Open · Overdue
 *
 * Person-first: Founder clickable → ContactDrawer; Advisor clickable → /command-center/advisors.
 * Mobile: tab-strip [Contacts][Feed][Actions], single column.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, Building2, MapPin, AlertTriangle, Clock as ClockIcon, CalendarDays,
} from 'lucide-react';

import ContactDrawer from '../components/ContactDrawer';
import ActivityDrawer from '../components/ActivityDrawer';
import ContactsPanel from '../components/m6/ContactsPanel';
import RelationshipFeedPanel from '../components/m6/RelationshipFeedPanel';
import NextActionsPanel from '../components/m6/NextActionsPanel';
import useCatalog from '../../lib/useCatalog';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('mood_auth_token') || ''}`,
});

const fmtRelative = (iso) => {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)       return 'just now';
  if (diff < 3600)     return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400)    return `${Math.floor(diff/3600)}h ago`;
  if (diff < 86400*7)  return `${Math.floor(diff/86400)}d ago`;
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
};
const fmtNextFollowUp = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(); startToday.setHours(0,0,0,0);
  const startTomorrow = new Date(startToday); startTomorrow.setDate(startTomorrow.getDate()+1);
  if (d < now)          return { label: 'Overdue · ' + d.toLocaleDateString('it-IT', { day:'2-digit', month:'short' }), tone: 'bad' };
  if (d < startTomorrow) return { label: 'Today · '   + d.toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' }), tone: 'warn' };
  return { label: d.toLocaleDateString('it-IT', { weekday:'short', day:'2-digit', month:'short' }) + ' · ' + d.toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' }), tone: 'normal' };
};

const OpsCell = ({ label, value, tone, onClick, testid }) => {
  const colorMap = { bad: '#FF453A', warn: '#FF9F0A', ok: '#32D74B' };
  const color = colorMap[tone] || '#EDEDED';
  return (
    <div className="px-4 py-2 border-r border-stone-200 last:border-r-0 min-w-0" data-testid={testid}>
      <div className="text-[9.5px] uppercase tracking-[0.14em] text-stone-400 mb-1">{label}</div>
      <div
        className={`text-[12.5px] truncate ${onClick ? 'cursor-pointer hover:underline' : ''}`}
        style={{ color, fontWeight: 500 }}
        onClick={onClick}
      >
        {value || '—'}
      </div>
    </div>
  );
};

const MOBILE_TABS = [
  { key: 'contacts', label: 'Contacts' },
  { key: 'feed',     label: 'Feed' },
  { key: 'actions',  label: 'Actions' },
];

const TenantDetail = () => {
  const { tid } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [overview, setOverview] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [eligibleOwners, setEligibleOwners] = useState([]);
  const [nextFollowUp, setNextFollowUp] = useState(null);
  const [followUpCounts, setFollowUpCounts] = useState({ open: 0, overdue: 0 });
  const [loadError, setLoadError] = useState(null);
  const [drawerContact, setDrawerContact] = useState(null);
  const [activityDrawerId, setActivityDrawerId] = useState(null);

  const [mobileTab, setMobileTab] = useState('feed');

  const roles = useCatalog('contact-roles');
  const roleMap = useMemo(() =>
    Object.fromEntries(roles.map((r) => [r.code, r])), [roles]);

  const apiBase = `${BACKEND}/api/admin/tenants/${tid}`;

  const loadAll = useCallback(async () => {
    setLoadError(null);
    const [ovR, csR, owsR, fuR] = await Promise.allSettled([
      axios.get(`${apiBase}/overview`, { headers: headers() }),
      axios.get(`${apiBase}/contacts`, { headers: headers() }),
      axios.get(`${BACKEND}/api/admin/users/eligible-owners?limit=100`, { headers: headers() }),
      axios.get(`${apiBase}/activities/open-followups`, { headers: headers(), params: { limit: 100 } }),
    ]);

    if (ovR.status === 'fulfilled') setOverview(ovR.value.data);
    else setLoadError({
      code:   ovR.reason?.response?.status,
      detail: ovR.reason?.response?.data?.detail || ovR.reason?.message || 'Errore sconosciuto',
    });

    setContacts(csR.status === 'fulfilled' ? (csR.value.data || []) : []);
    setEligibleOwners(owsR.status === 'fulfilled' ? (owsR.value.data || []) : []);

    if (fuR.status === 'fulfilled') {
      const items = fuR.value.data.items || [];
      const now = new Date();
      const overdue = items.filter((a) => a.next_step_due_at && new Date(a.next_step_due_at) < now).length;
      const upcoming = items
        .filter((a) => a.next_step_due_at && new Date(a.next_step_due_at) >= now)
        .sort((a, b) => new Date(a.next_step_due_at) - new Date(b.next_step_due_at));
      setNextFollowUp(upcoming[0]?.next_step_due_at || null);
      setFollowUpCounts({ open: items.length, overdue });
    } else {
      setNextFollowUp(null);
      setFollowUpCounts({ open: 0, overdue: 0 });
    }
  }, [apiBase, tid]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // contact deep-link
  useEffect(() => {
    const cid = searchParams.get('contact');
    if (cid && contacts.length) {
      const c = contacts.find((x) => x.id === cid);
      if (c) setDrawerContact(c);
    }
  }, [searchParams, contacts]);

  const onAssignTenantOwner = async (newOwner) => {
    await axios.post(`${apiBase}/assign-owner`,
                     { tenant_relationship_owner_user_id: newOwner || null },
                     { headers: headers() });
    loadAll();
  };

  if (!overview) {
    if (loadError) {
      return (
        <div className="p-8 max-w-[1400px] mx-auto" data-testid="tenant-detail-error">
          <button onClick={() => navigate('/command-center/tenants')}
                  className="text-stone-400 hover:text-white inline-flex items-center gap-1 text-sm mb-6"
                  data-testid="tenant-back-btn">
            <ChevronLeft size={16} /> Tenants
          </button>
          <div className="border border-red-200 bg-red-50 p-6">
            <div className="text-[10px] uppercase tracking-wider text-red-600 mb-2">Errore di caricamento</div>
            <div className="text-lg mb-1">Impossibile caricare il tenant</div>
            <div className="text-sm text-stone-600 mb-4">
              {loadError.code ? `HTTP ${loadError.code} · ` : ''}{loadError.detail}
            </div>
            <button onClick={loadAll}
                    data-testid="tenant-detail-retry"
                    className="text-xs px-3 py-1.5 border border-stone-300 hover:bg-white">
              Riprova
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="p-8" data-testid="tenant-detail-loading">
        <div className="text-stone-400">Caricamento…</div>
      </div>
    );
  }

  const { tenant, relation, primary_contact, kpis } = overview;
  const nextFu = fmtNextFollowUp(nextFollowUp);
  const selfUserId = (() => {
    try { return JSON.parse(localStorage.getItem('mood_user') || '{}').id; } catch { return null; }
  })();

  const founderName = primary_contact
    ? `${primary_contact.first_name} ${primary_contact.last_name || ''}`.trim()
    : null;

  return (
    <div data-testid="tenant-detail-page" className="flex flex-col min-h-screen">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-6 pt-4 pb-2 text-[12px] text-stone-400 border-b border-stone-100">
        <button onClick={() => navigate('/command-center/tenants')}
                data-testid="tenant-back-btn"
                className="hover:text-white inline-flex items-center gap-1">
          <ChevronLeft size={13} /> Tenants
        </button>
        <span className="opacity-40">/</span>
        <span className="text-white" data-testid="tenant-name-crumb">
          {relation?.studio_name || tenant.name}
        </span>
      </div>

      {/* Title + Status pill */}
      <header className="px-6 py-4 border-b border-stone-200">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 data-testid="tenant-name" className="text-[22px] tracking-tight" style={{ fontWeight: 500 }}>
            {relation?.studio_name || tenant.name}
          </h1>
          <span data-testid="tenant-status-pill"
                className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase tracking-wider border border-stone-300 rounded-full"
                style={{ color: '#32D74B' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#32D74B' }} />
            {tenant.status}
          </span>
          {(relation?.city || relation?.country) && (
            <span className="ml-auto text-[11px] uppercase tracking-wider text-stone-400 inline-flex items-center gap-1 tabular-nums">
              <MapPin size={11} /> {[relation.city, relation.country].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>

        {/* Operational strip — no useless KPIs */}
        <div data-testid="tenant-ops-strip"
             className="mt-3 pt-3 border-t border-stone-200 grid grid-cols-2 md:grid-cols-7 gap-0">
          <OpsCell label="Founder"
                   value={founderName}
                   onClick={primary_contact ? () => setDrawerContact(primary_contact) : null}
                   testid="ops-founder" />
          <OpsCell label="Advisor"
                   value={relation?.advisor_display}
                   onClick={relation?.owner_advisor_id ? () => navigate(`/command-center/advisors?focus=${relation.owner_advisor_id}`) : null}
                   testid="ops-advisor" />
          <OpsCell label="Owner"
                   value={tenant.tenant_owner_display}
                   testid="ops-owner" />
          <OpsCell label="Last Touch"
                   value={kpis.last_activity_at ? fmtRelative(kpis.last_activity_at) : '—'}
                   testid="ops-last-touch" />
          <OpsCell label="Next Follow-up"
                   value={nextFu?.label || '—'}
                   tone={nextFu?.tone}
                   testid="ops-next-fu" />
          <OpsCell label="Open"
                   value={String(followUpCounts.open)}
                   testid="ops-open" />
          <OpsCell label="Overdue"
                   value={String(followUpCounts.overdue)}
                   tone={followUpCounts.overdue > 0 ? 'bad' : null}
                   testid="ops-overdue" />
        </div>

        {/* Owner assign — small, discreet */}
        {eligibleOwners.length > 0 && (
          <div className="mt-2 text-[10.5px] text-stone-400 flex items-center gap-2">
            <span className="uppercase tracking-wider">Org. Owner ·</span>
            <select data-testid="tenant-owner-select"
                    className="text-[11px] border border-stone-300 px-2 py-1 bg-stone-50"
                    value={tenant.tenant_relationship_owner_user_id || ''}
                    onChange={(e) => onAssignTenantOwner(e.target.value)}>
              <option value="">— Nessuno —</option>
              {eligibleOwners.map((u) => (
                <option key={u.id} value={u.id}>{u.display}</option>
              ))}
            </select>
          </div>
        )}
      </header>

      {/* Mobile tab-strip */}
      <div className="md:hidden flex border-b border-stone-200 sticky top-0 bg-[#0A0A0B] z-10">
        {MOBILE_TABS.map((t) => (
          <button key={t.key}
                  data-testid={`m6-mobile-tab-${t.key}`}
                  onClick={() => setMobileTab(t.key)}
                  className={`flex-1 py-2.5 text-[11px] uppercase tracking-wider ${
                    mobileTab === t.key
                      ? 'border-b-2 border-[#00C9B3] text-white'
                      : 'text-stone-400'
                  }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 3-Column Dashboard */}
      <section data-testid="m6-dashboard"
               className="flex-1 grid md:grid-cols-[220px_1fr_320px] min-h-0">
        {/* Col 1 — Contacts */}
        <div className={`border-r border-stone-200 min-h-0 ${mobileTab === 'contacts' ? '' : 'hidden md:flex'} flex-col`}>
          <ContactsPanel
            contacts={contacts}
            roleMap={roleMap}
            onOpen={(c) => setDrawerContact(c)}
            onLogActivity={(c) => {
              setActivityDrawerId('new');
              // ActivityDrawer reads contacts from prop; the user picks the contact in the form.
              // Optional improvement: pre-fill via state — keep simple for now.
              void c;
            }}
            onAddContact={() => setDrawerContact({})}
          />
        </div>

        {/* Col 2 — Relationship Feed */}
        <div className={`border-r border-stone-200 min-h-0 ${mobileTab === 'feed' ? '' : 'hidden md:flex'} flex-col`}>
          <RelationshipFeedPanel
            apiBase={apiBase}
            onLogActivity={() => setActivityDrawerId('new')}
          />
        </div>

        {/* Col 3 — Next Actions */}
        <div className={`min-h-0 ${mobileTab === 'actions' ? '' : 'hidden md:flex'} flex-col`}>
          <NextActionsPanel
            apiBase={apiBase}
            onEdit={(a) => setActivityDrawerId(a.id)}
            onActionDone={loadAll}
          />
        </div>
      </section>

      {/* Drawers (preserved from M1/M3) */}
      {drawerContact !== null && (
        <ContactDrawer
          tenantId={tid}
          contact={drawerContact}
          onClose={() => { setDrawerContact(null); setSearchParams({}); }}
          onSaved={loadAll}
          adminMode={true}
        />
      )}
      {activityDrawerId && (
        <ActivityDrawer
          apiBase={apiBase}
          scope="admin"
          activityId={activityDrawerId === 'new' ? null : activityDrawerId}
          contacts={contacts}
          users={eligibleOwners}
          selfUserId={selfUserId}
          onClose={() => setActivityDrawerId(null)}
          onSaved={() => { setActivityDrawerId(null); loadAll(); }}
        />
      )}
    </div>
  );
};

export default TenantDetail;

// Unused import guard (Building2/AlertTriangle/ClockIcon/CalendarDays may be
// referenced in mobile fallback or future enhancements — keep them imported
// to avoid churn when re-introducing icon-rich states).
void Building2; void AlertTriangle; void ClockIcon; void CalendarDays;
