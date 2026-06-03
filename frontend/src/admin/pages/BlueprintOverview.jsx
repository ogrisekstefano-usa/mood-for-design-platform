/**
 * BlueprintOverview — Founder workspace overview (M1 · D4 mirror).
 * Scope-locked to the founder's own tenant via JWT slug claim.
 * Founder CAN: CRUD contacts, log quick activities.
 * Founder CANNOT: change relationship_owner, see other tenants.
 */
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  Building2, UserPlus, Star, Trash2, MapPin, Clock, Bell, Activity as ActivityIcon,
  Phone, Mail, MessageCircle, Linkedin, StickyNote,
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

const headers = () => {
  const tok = localStorage.getItem('mood_auth_token') || '';
  let slug = 'studio';
  try { slug = JSON.parse(localStorage.getItem('mood_tenant') || 'null')?.slug || 'studio'; }
  catch {}
  return {
    Authorization: `Bearer ${tok}`,
    'X-Tenant-Slug': slug,
  };
};

const TabBtn = ({ active, onClick, testid, label, badge }) => (
  <button
    onClick={onClick} data-testid={testid}
    className={`px-5 py-3 text-sm tracking-wide transition-colors ${
      active ? 'text-stone-900 border-b-2 border-black' : 'text-stone-500 hover:text-stone-900'
    }`}>
    {label}
    {typeof badge === 'number' && (
      <span className="ml-2 text-[10px] tabular-nums text-stone-400">({badge})</span>
    )}
  </button>
);

const BlueprintOverview = () => {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview]   = useState(null);
  const [contacts, setContacts]   = useState([]);
  const [activities, setActivities] = useState([]);
  const [drawerContact, setDrawerContact] = useState(null);
  const [activityDrawerId, setActivityDrawerId] = useState(null);
  const roles = useCatalog('contact-roles');
  const roleMap = Object.fromEntries(roles.map((r) => [r.code, r]));

  const apiBase = `${BACKEND}/api/blueprint`;

  const loadAll = useCallback(async () => {
    try {
      const [ov, cs, acts] = await Promise.all([
        axios.get(`${apiBase}/overview`,            { headers: headers() }),
        axios.get(`${apiBase}/contacts`,            { headers: headers() }),
        axios.get(`${apiBase}/activities?limit=10`, { headers: headers() }),
      ]);
      setOverview(ov.data);
      setContacts(cs.data || []);
      setActivities(acts.data || []);
    } catch (e) {
      console.error('founder overview load', e);
    }
  }, [apiBase]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onSetPrimary = async (cid) => {
    await axios.post(`${apiBase}/contacts/${cid}/set-primary`, {}, { headers: headers() });
    loadAll();
  };
  const onArchive = async (cid) => {
    if (!window.confirm('Archiviare questo contatto?')) return;
    await axios.delete(`${apiBase}/contacts/${cid}`, { headers: headers() });
    loadAll();
  };

  if (!overview) {
    return <div className="p-8 text-stone-400" data-testid="blueprint-overview-loading">Caricamento…</div>;
  }
  const { tenant, relation, primary_contact, kpis, recent_activities } = overview;

  return (
    <div data-testid="blueprint-overview-page" className="max-w-[1400px] mx-auto">
      <header className="px-8 pt-8 pb-6 border-b border-stone-200">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-stone-400">
          <Building2 size={12} /> Studio
        </div>
        <h1 className="text-4xl font-light mt-1">{relation?.studio_name || tenant.name}</h1>
        {relation && (relation.city || relation.country) && (
          <div className="text-sm text-stone-500 mt-2 inline-flex items-center gap-1">
            <MapPin size={12} /> {[relation.city, relation.country].filter(Boolean).join(', ')}
          </div>
        )}
        <div className="text-xs text-stone-500 mt-3">
          {relation?.advisor_display && <>Advisor curatoriale: <strong>{relation.advisor_display}</strong> · </>}
          {tenant.tenant_owner_display && <>Org. Owner: <strong>{tenant.tenant_owner_display}</strong></>}
        </div>
      </header>

      <nav className="px-6 border-b border-stone-200">
        <TabBtn active={tab==='overview'}      label="Overview" testid="b-tab-overview"
                onClick={() => setTab('overview')} />
        <TabBtn active={tab==='contacts'}      label="Contatti" testid="b-tab-contacts"
                onClick={() => setTab('contacts')} badge={kpis.contacts_total} />
        <TabBtn active={tab==='activities'}    label="Attività" testid="b-tab-activities"
                onClick={() => setTab('activities')} badge={kpis.activities_30d} />
        <TabBtn active={tab==='timeline'}      label="Timeline"     testid="b-tab-timeline"
                onClick={() => setTab('timeline')} />
        <TabBtn active={tab==='notifications'} label="Notifiche"    testid="b-tab-notifications"
                onClick={() => setTab('notifications')} />
      </nav>

      <main className="px-8 py-8">
        {tab === 'overview' && (
          <div data-testid="b-overview-pane" className="grid grid-cols-3 gap-6">
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
              <div className="text-sm">{kpis.last_activity_at ? new Date(kpis.last_activity_at).toLocaleString('it-IT') : '—'}</div>
            </div>
            <div className="col-span-2 border border-stone-200 p-5">
              <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-3">Primary contact</div>
              {primary_contact ? (
                <div>
                  <div className="text-lg">{primary_contact.first_name} {primary_contact.last_name}</div>
                  <div className="text-sm text-stone-500">{roleMap[primary_contact.role_code]?.label_it || primary_contact.role_code} · {primary_contact.email || '—'}</div>
                </div>
              ) : <div className="text-stone-400 text-sm">Nessun primary contact impostato.</div>}
            </div>
            <div className="border border-stone-200 p-5">
              <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-3">Ultime attività</div>
              {recent_activities?.length ? recent_activities.slice(0,3).map((a) => (
                <div key={a.id} className="text-xs text-stone-700 mb-2 truncate">
                  {a.type_label_it || a.activity_type_code} · {a.subject || '—'}
                </div>
              )) : <div className="text-stone-400 text-sm">Nessuna attività.</div>}
            </div>
          </div>
        )}

        {tab === 'contacts' && (
          <div data-testid="b-contacts-pane">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg">Contatti del tuo studio ({contacts.length})</h2>
              <button data-testid="b-new-contact-btn"
                      onClick={() => setDrawerContact({})}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-black text-white">
                <UserPlus size={14} /> Nuovo contatto
              </button>
            </div>
            <div className="border border-stone-200 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-stone-200 text-[11px] uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="text-left px-4 py-3">Nome</th>
                    <th className="text-left px-4 py-3">Ruolo</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Telefono</th>
                    <th className="text-right px-4 py-3">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-10 text-stone-400">
                      Inizia aggiungendo il primo contatto del tuo team.
                    </td></tr>
                  )}
                  {contacts.map((c) => (
                    <tr key={c.id} data-testid={`b-contact-row-${c.id}`}
                        className="border-b border-stone-100 hover:bg-stone-50">
                      <td className="px-4 py-3">
                        <button onClick={() => setDrawerContact(c)} className="font-medium hover:underline">
                          {c.first_name} {c.last_name}
                        </button>
                        {c.is_primary && <Star size={12} className="inline ml-2 text-amber-500 fill-amber-400" />}
                      </td>
                      <td className="px-4 py-3 text-stone-700">{roleMap[c.role_code]?.label_it || c.role_code}</td>
                      <td className="px-4 py-3 text-stone-700">{c.email || '—'}</td>
                      <td className="px-4 py-3 text-stone-700">
                        {c.phone_prefix && c.phone_number ? `${c.phone_prefix} ${c.phone_number}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {!c.is_primary && (
                          <button onClick={() => onSetPrimary(c.id)}
                                  className="text-xs text-stone-500 hover:text-amber-600">
                            <Star size={14} className="inline" /> Primary
                          </button>
                        )}
                        <button onClick={() => onArchive(c.id)}
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
          <div data-testid="b-activities-pane">
            <ActivityFeed
              apiBase={`${BACKEND}/api/blueprint`}
              scope="founder"
              onCreate={() => setActivityDrawerId('new')}
              onEdit={(a) => setActivityDrawerId(a.id)}
            />
          </div>
        )}

        {tab === 'timeline' && (
          <TimelineFeed
            apiBase={`${BACKEND}/api/blueprint`}
            scope="founder"
          />
        )}
        {tab === 'notifications' && (
          <div data-testid="b-notifications-placeholder"
               className="border border-dashed border-stone-300 px-10 py-20 text-center">
            <Bell size={32} className="text-stone-300 mx-auto mb-3" />
            <h3 className="text-lg mb-2">Notification Center</h3>
            <p className="text-sm text-stone-500 max-w-md mx-auto">Disponibile in M4.</p>
          </div>
        )}
      </main>

      {drawerContact !== null && (
        <ContactDrawer
          tenantId={tenant.id}
          contact={drawerContact}
          onClose={() => setDrawerContact(null)}
          onSaved={loadAll}
          adminMode={false}
          apiBase={apiBase}
        />
      )}

      {activityDrawerId && (
        <ActivityDrawer
          apiBase={`${BACKEND}/api/blueprint`}
          scope="founder"
          activityId={activityDrawerId === 'new' ? null : activityDrawerId}
          contacts={contacts}
          selfUserId={JSON.parse(localStorage.getItem('mood_user') || '{}').id}
          onClose={() => setActivityDrawerId(null)}
          onSaved={() => { setActivityDrawerId(null); loadAll(); }}
        />
      )}
    </div>
  );
};

export default BlueprintOverview;
