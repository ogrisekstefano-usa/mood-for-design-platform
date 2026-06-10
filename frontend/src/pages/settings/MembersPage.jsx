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
 *
 * i18n: useT() from i18n/useT.jsx (same pickString engine as the rest of FASE 2).
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ArrowLeft, UserPlus, MoreHorizontal, Mail, Pause, Play, Trash2, Send, ShieldCheck, X, Check, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useT } from '../../i18n/useT';
import { useAuth } from '../../contexts/AuthContext';
import { refreshLicense } from '../../hooks/useLicense';
import api from '../../lib/api';

const STATUS_STYLES = {
  active:    { cls: 'text-[var(--bp-primary)] bg-[var(--bp-primary)]/10 border-[var(--bp-primary)]/25' },
  invited:   { cls: 'text-amber-300 bg-amber-300/10 border-amber-300/25' },
  suspended: { cls: 'text-rose-300 bg-rose-300/10 border-rose-300/25' },
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

const fmtDate = (iso, { withTime = false } = {}) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const datePart = d.toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    if (!withTime) return datePart;
    const timePart = d.toLocaleTimeString(undefined, {
      hour: '2-digit', minute: '2-digit',
    });
    return `${datePart} · ${timePart}`;
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
  const { t } = useT();
  const s = STATUS_STYLES[status] || STATUS_STYLES.active;
  return (
    <span data-testid={`member-status-${status}`}
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-body uppercase tracking-[0.16em] ${s.cls}`}>
      <span className="w-1 h-1 rounded-full bg-current" />
      {t('members.status_' + status)}
    </span>
  );
};

// ── Action menu ────────────────────────────────────────────────────────────
const ActionMenu = ({ m, currentProfileId, onResend, onSuspend, onReactivate, onChangeRole, onRemove, roles }) => {
  const { t } = useT();
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
              <MenuItem icon={Mail} label={t('members.menu_resend')} testid={`menu-resend-${m.id}`}
                        onClick={() => { setOpen(false); onResend(m); }} />
            )}
            {!isSelf && m.status !== 'suspended' && (
              <MenuItem icon={Pause} label={t('members.menu_suspend')} testid={`menu-suspend-${m.id}`}
                        onClick={() => { setOpen(false); onSuspend(m); }} />
            )}
            {!isSelf && m.status === 'suspended' && (
              <MenuItem icon={Play} label={t('members.menu_reactivate')} testid={`menu-reactivate-${m.id}`}
                        onClick={() => { setOpen(false); onReactivate(m); }} />
            )}
            {!isSelf && (
              <div className="relative">
                <button onClick={() => setRoleMenu((v) => !v)}
                        data-testid={`menu-change-role-${m.id}`}
                        className="w-full px-3 py-2 flex items-center gap-2 text-left text-[12px] font-body text-[var(--bp-text-primary)] hover:bg-[var(--bp-surface-2)]/60 transition-colors">
                  <ShieldCheck size={13} strokeWidth={1.5} className="text-[var(--bp-text-muted)]" />
                  {t('members.menu_change_role')}
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
                <MenuItem icon={Trash2} label={t('members.menu_remove')} danger testid={`menu-remove-${m.id}`}
                          onClick={() => { setOpen(false); onRemove(m); }} />
              </>
            )}
            {isSelf && (
              <p className="px-3 py-2 text-[10px] font-body text-[var(--bp-text-muted)] italic">{t('members.menu_self_blocked')}</p>
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
  const { t } = useT();
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
      toast.error(t('members.toast_required_fields'));
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
            <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.22em] font-semibold mb-1">{t('members.invite_eyebrow')}</p>
            <h2 className="font-heading text-2xl text-[var(--bp-text-primary)] mt-0.5">{t('members.invite_title')}</h2>
            <p className="text-[var(--bp-text-muted)] text-[12px] font-body mt-1 max-w-sm">
              {t('members.invite_subtitle')}
            </p>
          </div>
          <button onClick={onClose} data-testid="invite-close"
                  className="text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]">
            <X size={18} strokeWidth={1.5} />
          </button>
        </header>

        <form onSubmit={submit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <Field label={t('members.invite_first')} value={first} onChange={setFirst} testid="invite-first" autoFocus />
          <Field label={t('members.invite_last')}  value={last}  onChange={setLast}  testid="invite-last" />
          <Field label={t('members.invite_email')} value={email} onChange={setEmail} type="email" testid="invite-email" />

          <div>
            <label className="block text-[10px] font-body uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mb-2">{t('members.invite_role')}</label>
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
                  <p className="text-[10px] text-[var(--bp-text-muted)] mt-1 line-clamp-1">
                    {r.permissions.length === 1
                      ? t('members.permission_single', { n: r.permissions.length })
                      : t('members.permission_plural', { n: r.permissions.length })}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </form>

        <footer className="flex items-center justify-end gap-2 p-6 border-t border-[var(--bp-border)]">
          <button onClick={onClose} className="px-4 py-2 text-[11px] font-body uppercase tracking-[0.2em] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] transition-colors"
                  data-testid="invite-cancel">
            {t('members.btn_cancel')}
          </button>
          <button onClick={submit} disabled={submitting}
                  data-testid="invite-submit"
                  className="flex items-center gap-2 px-4 py-2 rounded-[var(--bp-radius-xs)] bg-[var(--bp-primary)] text-black text-[11px] font-body uppercase tracking-[0.2em] hover:brightness-110 disabled:opacity-50 transition-all">
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} strokeWidth={1.8} />}
            {t('members.btn_send_invite')}
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
  const { t } = useT();
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
                {t('members.status_member_eyebrow', { status: t('members.status_' + member.status) })}
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
              {t('members.edit_self_hint')}
            </div>
          )}

          <Field label={t('members.edit_label_first')} value={first} onChange={setFirst} testid="edit-member-first" autoFocus />
          <Field label={t('members.edit_label_last')}  value={last}  onChange={setLast}  testid="edit-member-last" />

          {/* Role */}
          <div>
            <label className="block text-[10px] font-body uppercase tracking-[0.22em] text-[var(--bp-text-muted)] mb-2">{t('members.edit_label_role')}</label>
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
                    {r.permissions.length === 1
                      ? t('members.permission_single', { n: r.permissions.length })
                      : t('members.permission_plural', { n: r.permissions.length })}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[var(--bp-border)]">
            <Meta label={t('members.meta_last_login')}  value={fmtDate(member.last_login_at, { withTime: true })} />
            <Meta label={t('members.meta_invited_at')}  value={fmtDate(member.invited_at)} />
            <Meta label={t('members.meta_accepted_at')} value={fmtDate(member.accepted_at)} />
            <Meta label={t('members.meta_created_at')}  value={fmtDate(member.created_at)} />
          </div>

          {/* Operational actions — only for tenant_admin acting on others */}
          {canManage && !isSelf && (
            <div className="pt-4 border-t border-[var(--bp-border)] space-y-2">
              {member.status === 'invited' && (
                <DrawerAction icon={Mail} label={t('members.action_resend')}
                              testid="edit-member-resend" onClick={onResend} />
              )}
              {member.status === 'active' && (
                <DrawerAction icon={Pause} label={t('members.action_suspend')}
                              testid="edit-member-suspend" onClick={onSuspend} />
              )}
              {member.status === 'suspended' && (
                <DrawerAction icon={Play} label={t('members.action_reactivate')}
                              testid="edit-member-reactivate" onClick={onReactivate} />
              )}
              <DrawerAction icon={Trash2} danger label={t('members.action_remove')}
                            testid="edit-member-remove" onClick={onRemove} />
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 p-6 border-t border-[var(--bp-border)]">
          <button onClick={onClose} data-testid="edit-member-cancel"
                  className="px-4 py-2 text-[11px] font-body uppercase tracking-[0.2em] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)]">
            {t('members.btn_cancel')}
          </button>
          <button onClick={submit} disabled={!dirty || submitting}
                  data-testid="edit-member-save"
                  className="flex items-center gap-2 px-4 py-2 rounded-[var(--bp-radius-xs)] bg-[var(--bp-primary)] text-black text-[11px] font-body uppercase tracking-[0.2em] hover:brightness-110 disabled:opacity-40 transition-all">
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={1.8} />}
            {t('members.btn_save')}
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
const Confirm = ({ open, title, message, danger, confirmLabel, onConfirm, onClose }) => {
  const { t } = useT();
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
            {t('members.confirm_cancel')}
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
  const { t } = useT();
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [license, setLicense] = useState(null);

  const myProfileId = user?.id;
  const myRole = user?.role;
  const canManage = myRole === 'super_admin' || myRole === 'tenant_admin';

  const seatLimit = license?.limits?.max_users;
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
        toast.error(t('members.toast_permission_denied'));
        navigate('/settings');
      } else {
        toast.error(t('members.toast_load_error'));
      }
    } finally {
      setLoading(false);
    }
  }, [navigate, t]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Mutators ─────────────────────────────────────────────────────────────
  const invite = async (payload) => {
    try {
      await api.post('/api/members/invite', payload);
      toast.success(t('members.toast_invite_sent', { email: payload.email }));
      refreshLicense();
      await loadAll();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.code === 'LICENSE_LIMIT_REACHED') {
        toast.error(t('members.toast_seat_limit', { current: detail.current, limit: detail.limit, plan: detail.plan || '' }));
      } else {
        toast.error(typeof detail === 'string' ? detail : t('members.toast_invite_failed'));
      }
      throw e;
    }
  };

  const resend = async (m) => {
    try {
      await api.post(`/api/members/${m.id}/resend-invite`);
      toast.success(t('members.toast_resent', { email: m.email }));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('members.toast_resend_failed'));
    }
  };

  const patch = async (m, body, successMsg) => {
    try {
      await api.patch(`/api/members/${m.id}`, body);
      toast.success(successMsg);
      await loadAll();
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('members.toast_op_failed'));
    }
  };

  const remove = async (m) => {
    try {
      await api.delete(`/api/members/${m.id}`);
      toast.success(t('members.toast_removed', { email: m.email }));
      await loadAll();
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('members.toast_remove_failed'));
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
    <div className="p-10 w-full" data-testid="members-page">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <button onClick={() => navigate('/settings')}
                  data-testid="members-back"
                  className="flex items-center gap-1.5 text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] text-[10px] font-body uppercase tracking-[0.22em] mb-4">
            <ArrowLeft size={11} strokeWidth={1.5} /> {t('common.back')}
          </button>
          <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.22em] font-semibold mb-1">{t('members.eyebrow')}</p>
          <h1 className="font-heading text-4xl font-light text-[var(--bp-text-primary)] leading-none">{t('members.title')}</h1>
          <p className="text-[var(--bp-text-muted)] text-[13px] font-body mt-2 max-w-xl">
            {t('members.subtitle')}
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
                {t('members.seats_chip', { used: seatUsage, limit: seatLimit == null ? '∞' : seatLimit })}
              </span>
            )}
            <button onClick={() => atSeatCap ? navigate('/settings/plan') : setDrawer(true)}
                    data-testid="members-invite-cta"
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-[var(--bp-radius-sm)] text-[11px] font-body uppercase tracking-[0.22em] transition-all
                      ${atSeatCap
                        ? 'bg-[var(--bp-surface-2)] border border-[var(--bp-border)] text-[var(--bp-text-muted)] hover:text-[var(--bp-text-primary)] hover:border-[var(--bp-border-strong)]'
                        : 'bg-[var(--bp-primary)] text-black hover:brightness-110'}`}>
              <UserPlus size={13} strokeWidth={1.8} />
              {atSeatCap ? t('members.btn_upgrade') : t('members.btn_invite')}
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
              {t('members.filter_' + s)}
              <span className="ml-1.5 text-[var(--bp-text-subtle)] font-mono tabular-nums">{counts[s]}</span>
            </button>
          ))}
        </div>
        <input value={search}
               onChange={(e) => setSearch(e.target.value)}
               placeholder={t('members.search_placeholder')}
               data-testid="members-search"
               className="w-64 px-3 py-2 bg-transparent border border-[var(--bp-border)] rounded-[var(--bp-radius-xs)] text-[var(--bp-text-primary)] text-[12px] font-body outline-none focus:border-[var(--bp-primary)] transition-colors placeholder:text-[var(--bp-text-subtle)]" />
      </div>

      {/* Table */}
      <div className="border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] overflow-hidden">
        <div className="grid grid-cols-[1fr_140px_120px_120px_60px] gap-4 px-5 py-3 border-b border-[var(--bp-border)] bg-[var(--bp-surface-1)]/40 text-[10px] font-body uppercase tracking-[0.18em] text-[var(--bp-text-muted)]">
          <p>{t('members.th_person')}</p>
          <p>{t('members.th_role')}</p>
          <p>{t('members.th_status')}</p>
          <p>{t('members.th_last_login')}</p>
          <p className="text-right">—</p>
        </div>

        {loading && (
          <div className="p-12 flex items-center justify-center text-[var(--bp-text-muted)]">
            <Loader2 size={16} className="animate-spin mr-2" /> {t('members.loading')}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="p-12 text-center text-[var(--bp-text-muted)] text-[12px] font-body italic" data-testid="members-empty">
            {t('members.empty')}
          </div>
        )}

        {!loading && filtered.map((m) => (
          <div key={m.id}
               data-testid={`member-row-${m.id}`}
               onClick={(e) => {
                 if (e.target.closest('button')) return;
                 setEditing(m);
               }}
               className="grid grid-cols-[1fr_140px_120px_120px_60px] gap-4 px-5 py-3.5 items-center border-b border-[var(--bp-border)] last:border-b-0 hover:bg-[var(--bp-surface-1)]/60 transition-colors cursor-pointer">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar m={m} />
              <div className="min-w-0">
                <p className="text-[var(--bp-text-primary)] text-[13px] font-body truncate">
                  {(m.first_name || '') + ' ' + (m.last_name || '') || '—'}
                  {m.id === myProfileId && <span className="ml-2 text-[10px] text-[var(--bp-text-muted)] uppercase tracking-[0.18em]">{t('members.you_label')}</span>}
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
            <p className="text-[var(--bp-text-muted)] text-[11px] font-body">{fmtDate(m.last_login_at, { withTime: true })}</p>
            <div className="flex justify-end">
              {canManage && (
                <ActionMenu m={m}
                            currentProfileId={myProfileId}
                            roles={roles}
                            onResend={resend}
                            onSuspend={(x) => setConfirm({ kind: 'suspend', m: x })}
                            onReactivate={(x) => patch(x, { status: 'active' }, t('members.toast_reactivated', { email: x.email }))}
                            onChangeRole={(x, role) => patch(x, { role }, t('members.toast_role_updated', { role: ROLE_LABEL[role] || role }))}
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
          await patch(editing, body, t('members.toast_updated', { email: editing.email }));
          setEditing(null);
        }}
        onSuspend={() => { setConfirm({ kind: 'suspend', m: editing }); setEditing(null); }}
        onReactivate={() => { patch(editing, { status: 'active' }, t('members.toast_reactivated', { email: editing.email })); setEditing(null); }}
        onResend={() => { resend(editing); setEditing(null); }}
        onRemove={() => { setConfirm({ kind: 'remove', m: editing }); setEditing(null); }}
      />

      <Confirm open={!!confirm && confirm.kind === 'suspend'}
               title={t('members.confirm_suspend_title')}
               message={t('members.confirm_suspend_msg', { email: confirm?.m?.email })}
               confirmLabel={t('members.confirm_suspend_btn')}
               onClose={() => setConfirm(null)}
               onConfirm={async () => { const m = confirm.m; setConfirm(null); await patch(m, { status: 'suspended' }, t('members.toast_suspended', { email: m.email })); }} />

      <Confirm open={!!confirm && confirm.kind === 'remove'}
               danger
               title={t('members.confirm_remove_title')}
               message={t('members.confirm_remove_msg', { email: confirm?.m?.email })}
               confirmLabel={t('members.confirm_remove_btn')}
               onClose={() => setConfirm(null)}
               onConfirm={async () => { const m = confirm.m; setConfirm(null); await remove(m); }} />
    </div>
  );
};

export default MembersPage;
