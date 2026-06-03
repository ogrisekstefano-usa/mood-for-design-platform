/**
 * TenantDetail — Command Center M1.
 * 5 tabs: Overview / Contacts / Activities (preview) / Timeline (placeholder M2) /
 *         Notifications (placeholder M4).
 */
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, Building2, UserPlus, Star, Trash2, MapPin,
  Phone, Mail, MessageCircle, Linkedin, StickyNote, Clock, Bell, Activity as ActivityIcon,
} from 'lucide-react';
import ContactDrawer from '../components/ContactDrawer';
import ActivityDrawer from '../components/ActivityDrawer';
import ActivityFeed from '../components/ActivityFeed';
import TimelineFeed from '../components/TimelineFeed';
import useCatalog from '../../lib/useCatalog';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const ACTIVITY_ICON = {
  call: Phone, email: Mail, whatsapp: MessageCircle, linkedin: Linkedin,
  internal_note: StickyNote,
};

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('mood_auth_token') || ''}`,
});

const TabBtn = ({ active, onClick, testid, label, badge }) => (
  <button
    onClick={onClick}
    data-testid={testid}
    className={`px-5 py-3 text-sm tracking-wide transition-colors relative ${
      active ? 'text-stone-900 border-b-2 border-black' : 'text-stone-500 hover:text-stone-900'
    }`}>
    {label}
    {typeof badge === 'number' && (
      <span className="ml-2 text-[10px] tabular-nums text-stone-400">({badge})</span>
    )}
  </button>
);

const TenantDetail = () => {
  const { tid } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'overview';

  const [overview, setOverview] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [eligibleOwners, setEligibleOwners] = useState([]);
  const [drawerContact, setDrawerContact] = useState(null);
  const [activityDrawerId, setActivityDrawerId] = useState(null);   // 'new' | uuid
  const roles = useCatalog('contact-roles');
  const roleMap = Object.fromEntries(roles.map((r) => [r.code, r]));

  const loadAll = useCallback(async () => {
    try {
      const [ov, cs, acts, ows] = await Promise.all([
        axios.get(`${BACKEND}/api/admin/tenants/${tid}/overview`, { headers: headers() }),
        axios.get(`${BACKEND}/api/admin/tenants/${tid}/contacts`, { headers: headers() }),
        axios.get(`${BACKEND}/api/admin/tenants/${tid}/activities?limit=10`, { headers: headers() }),
        axios.get(`${BACKEND}/api/admin/users/eligible-owners?limit=100`, { headers: headers() }),
      ]);
      setOverview(ov.data);
      setContacts(cs.data || []);
      setActivities(acts.data || []);
      setEligibleOwners(ows.data || []);
    } catch (e) {
      console.error('overview load error', e);
    }
  }, [tid]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Open contact deep-link
  useEffect(() => {
    const cid = searchParams.get('contact');
    if (cid && contacts.length) {
      const c = contacts.find((x) => x.id === cid);
      if (c) setDrawerContact(c);
    }
  }, [searchParams, contacts]);

  const onSetPrimary = async (cid) => {
    await axios.post(`${BACKEND}/api/admin/tenants/${tid}/contacts/${cid}/set-primary`,
                     {}, { headers: headers() });
    loadAll();
  };
  const onArchive = async (cid) => {
    if (!window.confirm('Archiviare questo contatto?')) return;
    await axios.delete(`${BACKEND}/api/admin/tenants/${tid}/contacts/${cid}`,
                       { headers: headers() });
    loadAll();
  };
  const onAssignTenantOwner = async (newOwner) => {
    await axios.post(`${BACKEND}/api/admin/tenants/${tid}/assign-owner`,
                     { tenant_relationship_owner_user_id: newOwner || null },
                     { headers: headers() });
    loadAll();
  };

  if (!overview) {
    return (
      <div className="p-8 max-w-[1400px] mx-auto" data-testid="tenant-detail-loading">
        <div className="text-stone-400">Caricamento…</div>
      </div>
    );
  }

  const { tenant, relation, primary_contact, kpis, recent_activities } = overview;

  return (
    <div data-testid="tenant-detail-page" className="max-w-[1400px] mx-auto">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-8 pt-6 pb-4">
        <button onClick={() => navigate('/command-center/tenants')}
                data-testid="tenant-back-btn"
                className="text-stone-400 hover:text-stone-900 inline-flex items-center gap-1 text-sm">
          <ChevronLeft size={16} /> Tenants
        </button>
      </div>

      {/* Header */}
      <header className="px-8 pb-6 border-b border-stone-200">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-stone-400">
              <Building2 size={12} /> Tenant · {tenant.status}
            </div>
            <h1 data-testid="tenant-name" className="text-4xl font-light tracking-tight mt-1">
              {relation?.studio_name || tenant.name}
            </h1>
            {relation && (relation.city || relation.country) && (
              <div className="text-sm text-stone-500 mt-2 inline-flex items-center gap-1">
                <MapPin size={12} /> {[relation.city, relation.country].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
          <div className="text-right text-xs text-stone-500 space-y-1">
            <div><span className="text-stone-400">Founder · </span>
              <strong className="text-stone-900">
                {primary_contact ? `${primary_contact.first_name} ${primary_contact.last_name || ''}` : '—'}
              </strong>
            </div>
            <div><span className="text-stone-400">Advisor · </span>
              <strong className="text-stone-900">{relation?.advisor_display || '—'}</strong>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <span className="text-stone-400">Org. Owner · </span>
              <select data-testid="tenant-owner-select"
                      className="text-xs border border-stone-200 px-2 py-1 bg-white"
                      value={tenant.tenant_relationship_owner_user_id || ''}
                      onChange={(e) => onAssignTenantOwner(e.target.value)}>
                <option value="">— Nessuno —</option>
                {eligibleOwners.map((u) => (
                  <option key={u.id} value={u.id}>{u.display}</option>
                ))}
              </select>
            </div>
            <div className="text-stone-400">
              Created · {new Date(tenant.created_at).toLocaleDateString('it-IT')}
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="px-6 border-b border-stone-200">
        <TabBtn label="Overview"      active={tab==='overview'}      testid="tab-overview"
                onClick={() => setSearchParams({ tab: 'overview' })} />
        <TabBtn label="Contatti"      active={tab==='contacts'}      testid="tab-contacts"
                onClick={() => setSearchParams({ tab: 'contacts' })} badge={kpis.contacts_total} />
        <TabBtn label="Attività"      active={tab==='activities'}    testid="tab-activities"
                onClick={() => setSearchParams({ tab: 'activities' })} badge={kpis.activities_30d} />
        <TabBtn label="Timeline"      active={tab==='timeline'}      testid="tab-timeline"
                onClick={() => setSearchParams({ tab: 'timeline' })} />
        <TabBtn label="Notifiche"     active={tab==='notifications'} testid="tab-notifications"
                onClick={() => setSearchParams({ tab: 'notifications' })} />
      </nav>

      <main className="px-8 py-8">
        {tab === 'overview' && (
          <div data-testid="overview-pane" className="grid grid-cols-3 gap-6">
            <div className="border border-stone-200 p-5">
              <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-1">Contatti</div>
              <div className="text-3xl font-light">{kpis.contacts_total}</div>
            </div>
            <div className="border border-stone-200 p-5">
              <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-1">Attività 30g</div>
              <div className="text-3xl font-light">{kpis.activities_30d}</div>
            </div>
            <div className="border border-stone-200 p-5">
              <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-1">Ultima attività</div>
              <div className="text-sm font-light text-stone-800">
                {kpis.last_activity_at
                  ? new Date(kpis.last_activity_at).toLocaleString('it-IT')
                  : '—'}
              </div>
            </div>
            <div className="col-span-2 border border-stone-200 p-5">
              <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-3">Primary contact</div>
              {primary_contact ? (
                <div>
                  <div className="text-lg">{primary_contact.first_name} {primary_contact.last_name}</div>
                  <div className="text-sm text-stone-500">
                    {roleMap[primary_contact.role_code]?.label_it || primary_contact.role_code}
                    {primary_contact.email && <> · {primary_contact.email}</>}
                  </div>
                </div>
              ) : <div className="text-stone-400 text-sm">Nessun primary contact impostato.</div>}
            </div>
            <div className="border border-stone-200 p-5">
              <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-3">Ultime attività</div>
              {recent_activities?.length ? recent_activities.slice(0, 3).map((a) => (
                <div key={a.id} className="text-xs text-stone-700 mb-2 truncate">
                  {a.type_label_it || a.activity_type_code} · {a.subject || '—'}
                </div>
              )) : <div className="text-stone-400 text-sm">Nessuna attività.</div>}
            </div>
          </div>
        )}

        {tab === 'contacts' && (
          <div data-testid="contacts-pane">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg">Contatti ({contacts.length})</h2>
              <button data-testid="new-contact-btn"
                      onClick={() => setDrawerContact({})}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-black text-white">
                <UserPlus size={14} /> Nuovo contatto
              </button>
            </div>
            <div className="border border-stone-200 bg-white">
              <table data-testid="contacts-table" className="w-full text-sm">
                <thead className="border-b border-stone-200 text-[11px] uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="text-left px-4 py-3">Nome</th>
                    <th className="text-left px-4 py-3">Ruolo</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Telefono</th>
                    <th className="text-left px-4 py-3">Owner</th>
                    <th className="text-left px-4 py-3">Source</th>
                    <th className="text-right px-4 py-3">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-10 text-stone-400">
                      Ancora nessun contatto. Clicca <strong>Nuovo contatto</strong> per iniziare.
                    </td></tr>
                  )}
                  {contacts.map((c) => (
                    <tr key={c.id} data-testid={`contact-row-${c.id}`}
                        className="border-b border-stone-100 hover:bg-stone-50">
                      <td className="px-4 py-3">
                        <button onClick={() => setDrawerContact(c)}
                                data-testid={`contact-name-${c.id}`}
                                className="font-medium hover:underline">
                          {c.first_name} {c.last_name}
                        </button>
                        {c.is_primary && (
                          <Star size={12} className="inline ml-2 text-amber-500 fill-amber-400" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-700">
                        {roleMap[c.role_code]?.label_it || c.role_code}
                      </td>
                      <td className="px-4 py-3 text-stone-700">{c.email || '—'}</td>
                      <td className="px-4 py-3 text-stone-700">
                        {c.phone_prefix && c.phone_number ? `${c.phone_prefix} ${c.phone_number}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-stone-700">{c.owner_display || '—'}</td>
                      <td className="px-4 py-3 text-stone-500 text-xs">{c.source_code || '—'}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {!c.is_primary && (
                          <button data-testid={`set-primary-${c.id}`}
                                  onClick={() => onSetPrimary(c.id)}
                                  className="text-xs text-stone-500 hover:text-amber-600">
                            <Star size={14} className="inline" /> Primary
                          </button>
                        )}
                        <button data-testid={`archive-${c.id}`}
                                onClick={() => onArchive(c.id)}
                                className="text-xs text-stone-400 hover:text-red-600">
                          <Trash2 size={14} className="inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'activities' && (
          <div data-testid="activities-pane">
            <ActivityFeed
              apiBase={`${BACKEND}/api/admin/tenants/${tid}`}
              scope="admin"
              onCreate={() => setActivityDrawerId('new')}
              onEdit={(a) => setActivityDrawerId(a.id)}
            />
          </div>
        )}

        {tab === 'timeline' && (
          <TimelineFeed
            apiBase={`${BACKEND}/api/admin/tenants/${tid}`}
            scope="admin"
          />
        )}

        {tab === 'notifications' && (
          <div data-testid="notifications-placeholder"
               className="border border-dashed border-stone-300 px-10 py-20 text-center">
            <Bell size={32} className="text-stone-300 mx-auto mb-3" />
            <h3 className="text-lg mb-2">Notification Center</h3>
            <p className="text-sm text-stone-500 max-w-md mx-auto">
              Disponibile in M4. Notifiche interne con badge 🔔 in topbar e
              trigger automatici per lead in attesa, primo login, attività in scadenza.
            </p>
          </div>
        )}
      </main>

      {drawerContact !== null && (
        <ContactDrawer
          tenantId={tid}
          contact={drawerContact}
          onClose={() => { setDrawerContact(null); setSearchParams({ tab }); }}
          onSaved={loadAll}
          adminMode={true}
        />
      )}

      {activityDrawerId && (
        <ActivityDrawer
          apiBase={`${BACKEND}/api/admin/tenants/${tid}`}
          scope="admin"
          activityId={activityDrawerId === 'new' ? null : activityDrawerId}
          contacts={contacts}
          users={eligibleOwners}
          selfUserId={JSON.parse(localStorage.getItem('mood_user') || '{}').id}
          onClose={() => setActivityDrawerId(null)}
          onSaved={() => { setActivityDrawerId(null); loadAll(); }}
        />
      )}
    </div>
  );
};

export default TenantDetail;
