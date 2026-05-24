/**
 * MembersPage — Member Management for the current tenant.
 *
 * Linear/Notion-style table with:
 *   • inline filter by status (All / Active / Invited / Suspended)
 *   • cinematic Invite drawer
 *   • role / status badges
 *   • per-row actions: resend invite · suspend · reactivate · change role · remove
 *
 * Permission-driven: the page itself is gated server-side by P_TENANT_MEMBERS_READ.
 * The action list is derived from the user's role + the API's /members/roles
 * response — NO hardcoded role list in this file (extensible for showroom
 * managers, sales reps, A&D partners, fabricators when added to permissions.py).
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ArrowLeft, UserPlus, MoreHorizontal, Mail, Pause, Play, Trash2, Send, ShieldCheck, X, Check, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { useAuth } from '../../contexts/AuthContext';
import { refreshLicense } from '../../hooks/useLicense';
import api from '../../lib/api';

const STATUS_STYLES = {
  active:    { label: 'Active',    cls: 'text-[var(--bp-primary)] bg-[var(--bp-primary)]/10 border-[var(--bp-primary)]/25' },
  invited:   { label: 'Invited',   cls: 'text-amber-300 bg-amber-300/10 border-amber-300/25' },
  suspended: { label: 'Suspended', cls: 'text-rose-300 bg-rose-300/10 border-rose-300/25' },
};

const ROLE_LABEL = {
  super_admin:     'Super admin',
  tenant_admin:    'Tenant admin',
  designer:        'Designer',
  client:          'Client',
  editor:          'Editor',
  project_manager: 'Project manager',
  analyst:         'Analyst',
  ad_partner:      'A&D partner',
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return '—'; }
};

const initials = (m) => {
  const f = (m.first_name || '').trim();
  const l = (m.last_name || '').trim();
  if (f || l) return `${f[0] || ''}${l[0] || ''}`.toUpperCase() || '?';
  return (m.email || '?').slice(0, 2).toUpperCase();
};

// ── Avatar ─────────────────────────────────────────────────────────────────
const Avatar = ({ m }) => (
  m.avatar_url
    ? <img src={m.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover ring-1 ring-[var(--bp-border)]" />
    : <div className="w-9 h-9 rounded-full bg-[var(--bp-surface-2)] border border-[var(--bp-border)] flex items-center justify-center text-[11px] font-body text-[var(--bp-text-secondary)] tracking-wide">
        {initials(m)}
      </div>
);

const StatusBadge = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.active;
  return (
    <span data-testid={`member-status-${status}`}
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-body uppercase tracking-[0.16em] ${s.cls}`}>
      <span className="w-1 h-1 rounded-full bg-current" />
      {s.label}
    </span>
  );
};

// ── Action menu ────────────────────────────────────────────────────────────
const ActionMenu = ({ m, currentProfileId, onResend, onSuspend, onReactivate, onChangeRole, onRemove, roles }) => {
  const [open, setOpen] = useState(false);
  const [roleMenu, setRoleMenu] = useState(false);
  const isSelf = m.id === currentProfileId;
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen((v) => !v)}
              data-testid={`member-actions-${m.id}`}
              className="p-1.5 rounded-[var(--bp-radius-xs)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] hover:bg-[var(--bp-surface-2)]/60 transition-colors">
        <MoreHorizontal size={16} strokeWidth={1.5} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => { setOpen(false); setRoleMenu(false); }} />
          <div className="absolute right-0 top-full mt-1 w-56 z-40 bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)] shadow-2xl py-1.5" data-testid={`member-menu-${m.id}`}>
            {m.status === 'invited' && (
              <MenuItem icon={Mail} label="Resend invite" testid={`menu-resend-${m.id}`}
                        onClick={() => { setOpen(false); onResend(m); }} />
            )}
            {!isSelf && m.status !== 'suspended' && (
              <MenuItem icon={Pause} label="Suspend" testid={`menu-suspend-${m.id}`}
                        onClick={() => { setOpen(false); onSuspend(m); }} />
            )}
            {!isSelf && m.status === 'suspended' && (
              <MenuItem icon={Play} label="Reactivate" testid={`menu-reactivate-${m.id}`}
                        onClick={() => { setOpen(false); onReactivate(m); }} />
            )}
            {!isSelf && (
              <div className="relative">
                <button onClick={() => setRoleMenu((v) => !v)}
                        data-testid={`menu-change-role-${m.id}`}
                        className="w-full px-3 py-2 flex items-center gap-2 text-left text-[12px] font-body text-[var(--bp-text-primary)] hover:bg-[var(--bp-surface-2)]/60 transition-colors">
                  <ShieldCheck size={13} strokeWidth={1.5} className="text-[var(--bp-text-muted)]" />
                  Change role…
                </button>
                {roleMenu && (
                  <div className="absolute right-full top-0 mr-1 w-48 bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-sm)] shadow-2xl py-1.5">
                    {roles.map((r) => (
                      <button key={r.key}
                              onClick={() => { setOpen(false); setRoleMenu(false); onChangeRole(m, r.key); }}
                              data-testid={`menu-role-${r.key}-${m.id}`}
                              className={`w-full px-3 py-2 flex items-center justify-between text-left text-[12px] font-body transition-colors
                                ${m.role === r.key ? 'text-[var(--bp-primary)]' : 'text-[var(--bp-text-primary)] hover:bg-[var(--bp-surface-2)]/60'}`}>
                        {ROLE_LABEL[r.key] || r.key}
                        {m.role === r.key && <Check size={12} strokeWidth={2} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!isSelf && (
              <>
                <div className="my-1 border-t border-[var(--bp-border)]" />
                <MenuItem icon={Trash2} label="Remove from tenant" danger testid={`menu-remove-${m.id}`}
                          onClick={() => { setOpen(false); onRemove(m); }} />
              </>
            )}
            {isSelf && (
              <p className="px-3 py-2 text-[10px] font-body text-[var(--bp-text-muted)] italic">Self-management blocked</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const MenuItem = ({ icon: Icon, label, onClick, testid, danger }) => (
  <button onClick={onClick} data-testid={testid}
          className={`w-full px-3 py-2 flex items-center gap-2 text-left text-[12px] font-body transition-colors
            ${danger
              ? 'text-rose-300 hover:bg-rose-300/10'
              : 'text-[var(--bp-text-primary)] hover:bg-[var(--bp-surface-2)]/60'}`}>
    <Icon size={13} strokeWidth={1.5} className={danger ? '' : 'text-[var(--bp-text-muted)]'} />
    {label}
  </button>
);

// ── Invite drawer ──────────────────────────────────────────────────────────
const InviteDrawer = ({ open, onClose, roles, onSubmit }) => {
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('designer');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setFirst(''); setLast(''); setEmail(''); setRole('designer'); setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;
  const submit = async (e) => {
    e?.preventDefault();
    if (!first.trim() || !last.trim() || !email.trim()) {
      toast.error('First name, last name, and email are required');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ first_name: first.trim(), last_name: last.trim(), email: email.trim(), role });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex" data-testid="invite-drawer">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[460px] bg-[var(--bp-surface-1)] border-l border-[var(--bp-border)] flex flex-col">
        <header className="flex items-start justify-between p-6 border-b border-[var(--bp-border)]">
          <div>
            <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.22em] font-semibold mb-1">Member Studio</p>
            <h2 className="font-heading text-2xl text-[var(--bp-text-primary)] mt-0.5">Invite a member</h2>
            <p className="text-[var(--bp-text-muted)] text-[12px] font-body mt-1 max-w-sm">
              A magic-link email will be sent so they can set their own password.
            </p>
          </div>
          <button onClick={onClose} data-testid="invite-close"
                  className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]">
            <X size={18} strokeWidth={1.5} />
          </button>
        </header>

        <form onSubmit={submit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <Field label="First name" value={first} onChange={setFirst} testid="invite-first" autoFocus />
          <Field label="Last name"  value={last}  onChange={setLast}  testid="invite-last" />
          <Field label="Email"      value={email} onChange={setEmail} type="email" testid="invite-email" />

          <div>
            <label className="block text-[10px] font-body uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mb-2">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {roles.map((r) => (
                <button type="button" key={r.key}
                        onClick={() => setRole(r.key)}
                        data-testid={`invite-role-${r.key}`}
                        className={`text-left px-3 py-2.5 rounded-[var(--bp-radius-xs)] border transition-colors
                          ${role === r.key
                            ? 'border-[var(--bp-primary)] bg-[var(--bp-primary)]/8 text-[var(--bp-text-primary)]'
                            : 'border-[var(--bp-border)] text-[var(--bp-text-secondary)] hover:border-[var(--bp-border-strong)]'}`}>
                  <p className="font-body text-[12px]">{ROLE_LABEL[r.key] || r.key}</p>
                  <p className="text-[10px] text-[var(--bp-text-muted)] mt-1 line-clamp-1">{r.permissions.length} permission{r.permissions.length === 1 ? '' : 's'}</p>
                </button>
              ))}
            </div>
          </div>
        </form>

        <footer className="flex items-center justify-end gap-2 p-6 border-t border-[var(--bp-border)]">
          <button onClick={onClose} className="px-4 py-2 text-[11px] font-body uppercase tracking-[0.2em] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors"
                  data-testid="invite-cancel">
            Cancel
          </button>
          <button onClick={submit} disabled={submitting}
                  data-testid="invite-submit"
                  className="flex items-center gap-2 px-4 py-2 rounded-[var(--bp-radius-xs)] bg-[var(--bp-primary)] text-black text-[11px] font-body uppercase tracking-[0.2em] hover:brightness-110 disabled:opacity-50 transition-all">
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} strokeWidth={1.8} />}
            Send invite
          </button>
        </footer>
      </div>
    </div>
  );
};

// ── Edit drawer (right-side, mirrors InviteDrawer) ─────────────────────────
const EditMemberDrawer = ({ open, member, roles, canManage, isSelf,
                            onClose, onSave, onSuspend, onReactivate,
                            onResend, onRemove }) => {
  const [first, setFirst] = useState('');
  const [last,  setLast]  = useState('');
  const [role,  setRole]  = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && member) {
      setFirst(member.first_name || '');
      setLast(member.last_name || '');
      setRole(member.role || '');
    }
  }, [open, member]);

  if (!open || !member) return null;

  const dirty = first !== (member.first_name || '') ||
                last  !== (member.last_name  || '') ||
                role  !== (member.role || '');

  const submit = async () => {
    const patchBody = {};
    if (first !== (member.first_name || '')) patchBody.first_name = first.trim();
    if (last  !== (member.last_name  || '')) patchBody.last_name  = last.trim();
    if (role  !== (member.role || ''))       patchBody.role       = role;
    if (!Object.keys(patchBody).length) { onClose(); return; }
    setSubmitting(true);
    try { await onSave(patchBody); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex" data-testid="edit-member-drawer">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[460px] bg-[var(--bp-surface-1)] border-l border-[var(--bp-border)] flex flex-col">
        <header className="flex items-start justify-between p-6 border-b border-[var(--bp-border)]">
          <div className="flex items-start gap-4 min-w-0">
            <Avatar m={member} />
            <div className="min-w-0">
              <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.22em] font-semibold mb-1">
                Member · {STATUS_STYLES[member.status]?.label || member.status}
              </p>
              <h2 className="font-heading text-2xl text-[var(--bp-text-primary)] truncate">
                {(member.first_name || '') + ' ' + (member.last_name || '') || member.email}
              </h2>
              <p className="text-[var(--bp-text-muted)] text-[11px] font-mono truncate">{member.email}</p>
            </div>
          </div>
          <button onClick={onClose} data-testid="edit-member-close"
                  className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]">
            <X size={18} strokeWidth={1.5} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Self-editing notice */}
          {isSelf && (
            <div className="px-3 py-2.5 rounded-[var(--bp-radius-xs)] border border-[var(--bp-border)] bg-[var(--bp-surface-2)]/40 text-[11px] text-[var(--bp-text-secondary)] font-body leading-relaxed"
                 data-testid="edit-member-self-hint">
              Stai modificando il tuo profilo. Per cambiare la foto, ruolo o
              biografia visibili ai clienti usa <strong>“Presentazione al
              cliente”</strong> in Impostazioni → Account.
            </div>
          )}

          <Field label="Nome"    value={first} onChange={setFirst} testid="edit-member-first" autoFocus />
          <Field label="Cognome" value={last}  onChange={setLast}  testid="edit-member-last" />

          {/* Role */}
          <div>
            <label className="block text-[10px] font-body uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mb-2">Ruolo</label>
            <div className="grid grid-cols-2 gap-2">
              {(roles || []).map((r) => (
                <button type="button" key={r.key}
                        onClick={() => setRole(r.key)}
                        data-testid={`edit-member-role-${r.key}`}
                        disabled={!canManage || isSelf}
                        className={`text-left px-3 py-2.5 rounded-[var(--bp-radius-xs)] border transition-colors
                          ${role === r.key
                            ? 'border-[var(--bp-primary)] bg-[var(--bp-primary)]/8 text-[var(--bp-text-primary)]'
                            : 'border-[var(--bp-border)] text-[var(--bp-text-secondary)] hover:border-[var(--bp-border-strong)]'}
                          disabled:opacity-40 disabled:cursor-not-allowed`}>
                  <p className="font-body text-[12px]">{ROLE_LABEL[r.key] || r.key}</p>
                  <p className="text-[10px] text-[var(--bp-text-muted)] mt-1 line-clamp-1">
                    {r.permissions.length} permission{r.permissions.length === 1 ? '' : 's'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[var(--bp-border)]">
            <Meta label="Last login"  value={fmtDate(member.last_login_at)} />
            <Meta label="Invitato il"  value={fmtDate(member.invited_at)} />
            <Meta label="Accettato il" value={fmtDate(member.accepted_at)} />
            <Meta label="Creato il"    value={fmtDate(member.created_at)} />
          </div>

          {/* Operational actions — only for tenant_admin acting on others */}
          {canManage && !isSelf && (
            <div className="pt-4 border-t border-[var(--bp-border)] space-y-2">
              {member.status === 'invited' && (
                <DrawerAction icon={Mail} label="Reinvia invito"
                              testid="edit-member-resend" onClick={onResend} />
              )}
              {member.status === 'active' && (
                <DrawerAction icon={Pause} label="Sospendi membro"
                              testid="edit-member-suspend" onClick={onSuspend} />
              )}
              {member.status === 'suspended' && (
                <DrawerAction icon={Play} label="Riattiva membro"
                              testid="edit-member-reactivate" onClick={onReactivate} />
              )}
              <DrawerAction icon={Trash2} danger label="Rimuovi dallo studio"
                            testid="edit-member-remove" onClick={onRemove} />
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 p-6 border-t border-[var(--bp-border)]">
          <button onClick={onClose} data-testid="edit-member-cancel"
                  className="px-4 py-2 text-[11px] font-body uppercase tracking-[0.2em] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]">
            Annulla
          </button>
          <button onClick={submit} disabled={!dirty || submitting}
                  data-testid="edit-member-save"
                  className="flex items-center gap-2 px-4 py-2 rounded-[var(--bp-radius-xs)] bg-[var(--bp-primary)] text-black text-[11px] font-body uppercase tracking-[0.2em] hover:brightness-110 disabled:opacity-40 transition-all">
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={1.8} />}
            Salva modifiche
          </button>
        </footer>
      </div>
    </div>
  );
};

const Meta = ({ label, value }) => (
  <div>
    <p className="text-[9px] font-body uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mb-1">{label}</p>
    <p className="text-[12px] text-[var(--bp-text-primary)] font-body">{value || '—'}</p>
  </div>
);

const DrawerAction = ({ icon: Icon, label, danger, onClick, testid }) => (
  <button onClick={onClick} data-testid={testid}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--bp-radius-xs)] border transition-colors text-[12px] font-body
                      ${danger
                        ? 'border-rose-500/25 text-rose-300 hover:bg-rose-500/10'
                        : 'border-[var(--bp-border)] text-[var(--bp-text-secondary)] hover:border-[var(--bp-border-strong)] hover:text-[var(--bp-text-primary)]'}`}>
    <Icon size={14} strokeWidth={1.5} />
    {label}
  </button>
);

const Field = ({ label, value, onChange, type = 'text', testid, autoFocus }) => (
  <div>
    <label className="block text-[10px] font-body uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mb-2">{label}</label>
    <input value={value} onChange={(e) => onChange(e.target.value)}
           type={type} autoFocus={autoFocus} data-testid={testid}
           className="w-full px-3 py-2.5 bg-[var(--bp-surface-2)] border border-[var(--bp-border)] rounded-[var(--bp-radius-xs)] text-[var(--bp-text-primary)] text-[13px] font-body outline-none focus:border-[var(--bp-primary)] transition-colors" />
  </div>
);

// ── Confirm dialog (minimal, cinematic) ────────────────────────────────────
const Confirm = ({ open, title, message, danger, confirmLabel = 'Confirm', onConfirm, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center" data-testid="confirm-dialog">
      <div className="w-[420px] bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] p-6">
        <div className="flex items-start gap-3 mb-2">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${danger ? 'bg-rose-500/15 text-rose-300' : 'bg-[var(--bp-primary)]/10 text-[var(--bp-primary)]'}`}>
            <AlertCircle size={16} strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="font-heading text-lg text-[var(--bp-text-primary)] mb-1">{title}</h3>
            <p className="text-[var(--bp-text-secondary)] text-[12px] font-body">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} data-testid="confirm-cancel"
                  className="px-4 py-2 text-[11px] font-body uppercase tracking-[0.2em] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]">
            Cancel
          </button>
          <button onClick={onConfirm} data-testid="confirm-ok"
                  className={`px-4 py-2 rounded-[var(--bp-radius-xs)] text-[11px] font-body uppercase tracking-[0.2em] transition-colors
                    ${danger
                      ? 'bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 border border-rose-500/30'
                      : 'bg-[var(--bp-primary)] text-black hover:brightness-110'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────
const MembersPage = () => {
  const navigate = useNavigate();
  const { t } = useBlueprint();
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [editing, setEditing] = useState(null); // member being edited via right-side drawer
  const [confirm, setConfirm] = useState(null);
  const [license, setLicense] = useState(null);

  const myProfileId = user?.id;
  const myRole = user?.role;
  const canManage = myRole === 'super_admin' || myRole === 'tenant_admin';

  // Live seat budget — used to disable Invite CTA + show usage chip
  const seatLimit = license?.limits?.max_users;          // null = unlimited
  const seatUsage = license?.usage?.users || 0;
  const atSeatCap = seatLimit != null && seatUsage >= seatLimit;

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [m, r, l] = await Promise.all([
        api.get('/api/members'),
        api.get('/api/members/roles'),
        api.get('/api/license').catch(() => ({ data: null })),
      ]);
      setMembers(m.data || []);
      setRoles((r.data?.roles || []).filter((x) => x.key !== 'super_admin'));
      setLicense(l.data);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403) {
        toast.error('You do not have permission to manage members');
        navigate('/settings');
      } else {
        toast.error('Failed to load members');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Mutators ─────────────────────────────────────────────────────────────
  const invite = async (payload) => {
    try {
      await api.post('/api/members/invite', payload);
      toast.success('Invite sent — magic link delivered to ' + payload.email);
      refreshLicense();
      await loadAll();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      // License-aware error formatting
      if (detail && typeof detail === 'object' && detail.code === 'LICENSE_LIMIT_REACHED') {
        toast.error(`Seat limit reached (${detail.current}/${detail.limit}). Upgrade your ${detail.plan || ''} plan to invite more.`);
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Invite failed');
      }
      throw e;
    }
  };

  const resend = async (m) => {
    try {
      await api.post(`/api/members/${m.id}/resend-invite`);
      toast.success('Invite resent to ' + m.email);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not resend invite');
    }
  };

  const patch = async (m, body, successMsg) => {
    try {
      await api.patch(`/api/members/${m.id}`, body);
      toast.success(successMsg);
      await loadAll();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Operation failed');
    }
  };

  const remove = async (m) => {
    try {
      await api.delete(`/api/members/${m.id}`);
      toast.success(`${m.email} removed from tenant`);
      await loadAll();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not remove member');
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = members;
    if (statusFilter !== 'all') list = list.filter((m) => m.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((m) =>
        (m.email || '').toLowerCase().includes(q) ||
        (m.first_name || '').toLowerCase().includes(q) ||
        (m.last_name || '').toLowerCase().includes(q));
    }
    return list;
  }, [members, statusFilter, search]);

  const counts = useMemo(() => ({
    all:       members.length,
    active:    members.filter((m) => m.status === 'active').length,
    invited:   members.filter((m) => m.status === 'invited').length,
    suspended: members.filter((m) => m.status === 'suspended').length,
  }), [members]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-10 max-w-6xl mx-auto" data-testid="members-page">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <button onClick={() => navigate('/settings')}
                  data-testid="members-back"
                  className="flex items-center gap-1.5 text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] text-[10px] font-body uppercase tracking-[0.22em] mb-4">
            <ArrowLeft size={11} strokeWidth={1.5} /> {t('common.back', null, 'Back')}
          </button>
          <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.22em] font-semibold mb-1">Tenant · Members</p>
          <h1 className="font-heading text-4xl font-light text-[var(--bp-text-primary)] leading-none">People</h1>
          <p className="text-[var(--bp-text-muted)] text-[13px] font-body mt-2 max-w-xl">
            Invite collaborators and assign roles. Every action is audit-logged.
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-3">
            {license && (
              <span data-testid="seats-chip"
                    className={`px-3 py-1.5 rounded-full text-[10px] font-body uppercase tracking-[0.2em] border
                      ${atSeatCap
                        ? 'border-rose-500/30 text-rose-300 bg-rose-500/8'
                        : 'border-[var(--bp-border)] text-[var(--bp-text-muted)]'}`}>
                Seats {seatUsage}/{seatLimit == null ? '∞' : seatLimit}
              </span>
            )}
            <button onClick={() => atSeatCap ? navigate('/settings/plan') : setDrawer(true)}
                    data-testid="members-invite-cta"
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-[var(--bp-radius-sm)] text-[11px] font-body uppercase tracking-[0.22em] transition-all
                      ${atSeatCap
                        ? 'bg-[var(--bp-surface-2)] border border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] hover:border-[var(--bp-border-strong)]'
                        : 'bg-[var(--bp-primary)] text-black hover:brightness-110'}`}>
              <UserPlus size={13} strokeWidth={1.8} />
              {atSeatCap ? 'Upgrade to invite' : 'Invite member'}
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-1">
          {['all', 'active', 'invited', 'suspended'].map((s) => (
            <button key={s}
                    onClick={() => setStatusFilter(s)}
                    data-testid={`members-filter-${s}`}
                    className={`px-3 py-1.5 rounded-[var(--bp-radius-xs)] text-[10px] font-body uppercase tracking-[0.18em] transition-colors
                      ${statusFilter === s
                        ? 'bg-[var(--bp-surface-2)] text-[var(--bp-text-primary)]'
                        : 'text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]'}`}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              <span className="ml-1.5 text-[var(--bp-text-subtle)] font-mono tabular-nums">{counts[s]}</span>
            </button>
          ))}
        </div>
        <input value={search}
               onChange={(e) => setSearch(e.target.value)}
               placeholder="Search by name or email"
               data-testid="members-search"
               className="w-64 px-3 py-2 bg-transparent border border-[var(--bp-border)] rounded-[var(--bp-radius-xs)] text-[var(--bp-text-primary)] text-[12px] font-body outline-none focus:border-[var(--bp-primary)] transition-colors placeholder:text-[var(--bp-text-subtle)]" />
      </div>

      {/* Table */}
      <div className="border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] overflow-hidden">
        <div className="grid grid-cols-[1fr_140px_120px_120px_60px] gap-4 px-5 py-3 border-b border-[var(--bp-border)] bg-[var(--bp-surface-1)]/40 text-[10px] font-body uppercase tracking-[0.18em] text-[var(--bp-text-muted)]">
          <p>Person</p>
          <p>Role</p>
          <p>Status</p>
          <p>Last login</p>
          <p className="text-right">—</p>
        </div>

        {loading && (
          <div className="p-12 flex items-center justify-center text-[var(--bp-text-muted)]">
            <Loader2 size={16} className="animate-spin mr-2" /> Loading…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="p-12 text-center text-[var(--bp-text-muted)] text-[12px] font-body italic" data-testid="members-empty">
            No members match the current filters.
          </div>
        )}

        {!loading && filtered.map((m) => (
          <div key={m.id}
               data-testid={`member-row-${m.id}`}
               onClick={(e) => {
                 // Don't trigger when an inner button (ActionMenu) was clicked.
                 if (e.target.closest('button')) return;
                 setEditing(m);
               }}
               className="grid grid-cols-[1fr_140px_120px_120px_60px] gap-4 px-5 py-3.5 items-center border-b border-[var(--bp-border)] last:border-b-0 hover:bg-[var(--bp-surface-1)]/60 transition-colors cursor-pointer">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar m={m} />
              <div className="min-w-0">
                <p className="text-[var(--bp-text-primary)] text-[13px] font-body truncate">
                  {(m.first_name || '') + ' ' + (m.last_name || '') || '—'}
                  {m.id === myProfileId && <span className="ml-2 text-[10px] text-[var(--bp-text-muted)] uppercase tracking-[0.18em]">You</span>}
                </p>
                <p className="text-[var(--bp-text-muted)] text-[11px] font-mono truncate">{m.email}</p>
              </div>
            </div>
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-body uppercase tracking-[0.18em] bg-[var(--bp-surface-2)] text-[var(--bp-text-secondary)] border border-[var(--bp-border)]"
                    data-testid={`member-role-${m.id}`}>
                {ROLE_LABEL[m.role] || m.role}
              </span>
            </div>
            <div><StatusBadge status={m.status} /></div>
            <p className="text-[var(--bp-text-muted)] text-[11px] font-body">{fmtDate(m.last_login_at)}</p>
            <div className="flex justify-end">
              {canManage && (
                <ActionMenu m={m}
                            currentProfileId={myProfileId}
                            roles={roles}
                            onResend={resend}
                            onSuspend={(x) => setConfirm({ kind: 'suspend', m: x })}
                            onReactivate={(x) => patch(x, { status: 'active' }, `${x.email} reactivated`)}
                            onChangeRole={(x, role) => patch(x, { role }, `Role updated to ${ROLE_LABEL[role] || role}`)}
                            onRemove={(x) => setConfirm({ kind: 'remove', m: x })} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Drawers */}
      <InviteDrawer open={drawer} onClose={() => setDrawer(false)} roles={roles} onSubmit={invite} />

      <EditMemberDrawer
        open={!!editing}
        member={editing}
        roles={roles}
        canManage={canManage}
        isSelf={editing?.id === myProfileId}
        onClose={() => setEditing(null)}
        onSave={async (body) => {
          if (!editing) return;
          await patch(editing, body, `${editing.email} aggiornato`);
          setEditing(null);
        }}
        onSuspend={() => { setConfirm({ kind: 'suspend', m: editing }); setEditing(null); }}
        onReactivate={() => { patch(editing, { status: 'active' }, `${editing.email} riattivato`); setEditing(null); }}
        onResend={() => { resend(editing); setEditing(null); }}
        onRemove={() => { setConfirm({ kind: 'remove', m: editing }); setEditing(null); }}
      />

      <Confirm open={!!confirm && confirm.kind === 'suspend'}
               title="Suspend member?"
               message={`${confirm?.m?.email} will lose access until reactivated.`}
               confirmLabel="Suspend"
               onClose={() => setConfirm(null)}
               onConfirm={async () => { const m = confirm.m; setConfirm(null); await patch(m, { status: 'suspended' }, `${m.email} suspended`); }} />

      <Confirm open={!!confirm && confirm.kind === 'remove'}
               danger
               title="Remove from tenant?"
               message={`${confirm?.m?.email} will be removed from this tenant. Their authentication account is preserved.`}
               confirmLabel="Remove"
               onClose={() => setConfirm(null)}
               onConfirm={async () => { const m = confirm.m; setConfirm(null); await remove(m); }} />
    </div>
  );
};

export default MembersPage;
