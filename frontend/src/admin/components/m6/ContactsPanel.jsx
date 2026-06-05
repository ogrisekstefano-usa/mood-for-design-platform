/**
 * ContactsPanel — M6 Relationship Center · Column 1.
 *
 * Riusa M1: dati da /api/admin/tenants/{tid}/contacts (passati come prop).
 * Quick Actions sempre visibili (no hover-only):
 *   Call / Mail / WA / LI / +Act
 *
 * Person-first: click sul nome → apre ContactDrawer esistente.
 */
import React from 'react';
import { Phone, Mail, MessageCircle, Linkedin, Plus, Star } from 'lucide-react';

const initials = (c) =>
  `${(c.first_name || '?')[0]}${(c.last_name || '')[0] || ''}`.toUpperCase();

const phoneDigits = (c) =>
  (c.phone_number ? `${c.phone_prefix || ''}${c.phone_number}`.replace(/[^\d+]/g, '') : null);

const QuickActions = ({ contact, onLogActivity }) => {
  const tel = phoneDigits(contact);
  const wa  = tel ? `https://wa.me/${tel.replace('+', '')}` : null;
  const li  = contact.linkedin_url || null;
  const cls = 'flex-1 py-1.5 text-[10px] uppercase tracking-wider border border-stone-300 bg-stone-50 hover:bg-stone-100 text-center transition-colors';
  const disabled = 'flex-1 py-1.5 text-[10px] uppercase tracking-wider border border-stone-200 text-stone-300 cursor-not-allowed bg-transparent text-center';

  return (
    <div className="flex gap-1 mt-2">
      {tel
        ? <a href={`tel:${tel}`} className={cls} data-testid={`contact-call-${contact.id}`} title={`Chiama ${tel}`}><Phone size={11} className="inline" /></a>
        : <span className={disabled} data-testid={`contact-call-${contact.id}`} aria-disabled="true" title="Telefono non disponibile"><Phone size={11} className="inline" /></span>}
      {contact.email
        ? <a href={`mailto:${contact.email}`} className={cls} data-testid={`contact-mail-${contact.id}`} title={`Email ${contact.email}`}><Mail size={11} className="inline" /></a>
        : <span className={disabled} data-testid={`contact-mail-${contact.id}`} aria-disabled="true" title="Email non disponibile"><Mail size={11} className="inline" /></span>}
      {wa
        ? <a href={wa} target="_blank" rel="noreferrer" className={cls} data-testid={`contact-wa-${contact.id}`} title="WhatsApp"><MessageCircle size={11} className="inline" /></a>
        : <span className={disabled} data-testid={`contact-wa-${contact.id}`} aria-disabled="true" title="WhatsApp non disponibile"><MessageCircle size={11} className="inline" /></span>}
      {li
        ? <a href={li} target="_blank" rel="noreferrer" className={cls} data-testid={`contact-li-${contact.id}`} title="LinkedIn"><Linkedin size={11} className="inline" /></a>
        : <span className={disabled} data-testid={`contact-li-${contact.id}`} aria-disabled="true" title="LinkedIn non disponibile"><Linkedin size={11} className="inline" /></span>}
      <button onClick={() => onLogActivity(contact)} className={cls + ' bg-black text-white border-black'} data-testid={`contact-logact-${contact.id}`} title="Logga attività">
        <Plus size={11} className="inline" />
      </button>
    </div>
  );
};

const ContactCard = ({ contact, roleMap, onOpen, onLogActivity, isPrimary }) => {
  const roleLabel = roleMap?.[contact.role_code]?.label_it || contact.role_code;
  return (
    <div data-testid={`contact-card-${contact.id}`}
         className={`p-2.5 rounded transition-colors border ${
           isPrimary
             ? 'border-[#00C9B3]/30 bg-[#00C9B3]/[0.04]'
             : 'border-transparent hover:bg-stone-50 hover:border-stone-200'
         }`}>
      <button
        onClick={() => onOpen(contact)}
        data-testid={`contact-open-${contact.id}`}
        className="flex items-start gap-2 w-full text-left"
      >
        <div className="flex-shrink-0 w-6 h-6 rounded border border-stone-300 bg-stone-100 inline-flex items-center justify-center text-[10px] font-semibold text-stone-600">
          {initials(contact)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium truncate flex items-center gap-1">
            <span className="hover:underline">{contact.first_name} {contact.last_name}</span>
            {isPrimary && <Star size={10} className="text-[#00C9B3] fill-[#00C9B3]" />}
          </div>
          <div className="text-[10.5px] text-stone-500 truncate mt-0.5">{roleLabel}</div>
        </div>
      </button>
      <div className="mt-2 text-[11px] text-stone-600 space-y-0.5">
        {contact.email && <div className="truncate"><span className="text-stone-400 text-[10px] uppercase tracking-wider mr-1">Email</span>{contact.email}</div>}
        {contact.phone_number && <div className="tabular-nums"><span className="text-stone-400 text-[10px] uppercase tracking-wider mr-1">Tel</span>{contact.phone_prefix} {contact.phone_number}</div>}
        {contact.owner_display && <div><span className="text-stone-400 text-[10px] uppercase tracking-wider mr-1">Owner</span>{contact.owner_display}</div>}
      </div>
      <QuickActions contact={contact} onLogActivity={onLogActivity} />
    </div>
  );
};

const ROLE_GROUP_ORDER = [
  { code: 'founder',   label: 'Founders'   },
  { code: 'architect', label: 'Architects' },
  { code: 'designer',  label: 'Designers'  },
  { code: 'admin',     label: 'Admin'      },
];

const groupByRole = (contacts) => {
  const groups = new Map();
  for (const c of contacts) {
    const role = c.role_code || 'other';
    if (!groups.has(role)) groups.set(role, []);
    groups.get(role).push(c);
  }
  const ordered = [];
  for (const { code, label } of ROLE_GROUP_ORDER) {
    if (groups.has(code)) { ordered.push([label, groups.get(code)]); groups.delete(code); }
  }
  for (const [code, list] of groups.entries()) {
    ordered.push([code.charAt(0).toUpperCase() + code.slice(1), list]);
  }
  return ordered;
};

export default function ContactsPanel({ contacts = [], roleMap = {}, onOpen, onLogActivity, onAddContact }) {
  const grouped = groupByRole(contacts);
  const primaryId = (contacts.find((c) => c.is_primary) || {}).id;

  return (
    <div data-testid="m6-contacts-panel" className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-3 border-b border-stone-200 sticky top-0 bg-[#0A0A0B] z-[5]">
        <h3 className="text-[10.5px] uppercase tracking-[0.14em] text-stone-400 font-medium">
          Contacts <span className="tabular-nums text-stone-500 ml-1">· {contacts.length}</span>
        </h3>
        <button onClick={onAddContact}
                data-testid="m6-add-contact"
                className="text-[10.5px] uppercase tracking-wider px-2 py-1 border border-stone-300 hover:bg-stone-100">
          + Add
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-6">
        {contacts.length === 0 && (
          <div data-testid="m6-contacts-empty" className="px-3 py-12 text-center text-[12px] text-stone-400">
            Nessun contatto.<br />
            <button onClick={onAddContact} className="text-[#00C9B3] underline mt-2 hover:opacity-80">
              + Aggiungi il primo contatto
            </button>
          </div>
        )}
        {grouped.map(([label, list]) => (
          <div key={label}>
            <div className="text-[9.5px] uppercase tracking-[0.14em] text-stone-400 mt-3 mb-1 px-1">{label}</div>
            <div className="space-y-1">
              {list.map((c) => (
                <ContactCard
                  key={c.id}
                  contact={c}
                  roleMap={roleMap}
                  onOpen={onOpen}
                  onLogActivity={onLogActivity}
                  isPrimary={c.id === primaryId}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
