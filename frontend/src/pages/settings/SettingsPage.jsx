/**
 * SettingsPage — Tenant Settings hub (Notion / Linear / Shopify-admin feel).
 *
 * New IA (Session G):
 *   • Workspace    — Team & Permissions · Billing & Plan · Domains · Brand Studio
 *   • Website      — Storefront Pages · Forms & Onboarding · Journal Editoriale
 *   • Account      — Profile · Notifications · Security
 *
 * Platform-level controls (Languages, Section Engine, Dev tools, Global Audit, …)
 * have been moved out to `/superadmin/*` and are only visible to super_admin.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, CreditCard, Globe, Palette,
  Store, ClipboardList, Newspaper,
  UserCircle, Bell, KeyRound, ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { useAuth } from '../../contexts/AuthContext';
import CulturalPerspectivePanel from '../../components/settings/CulturalPerspectivePanel';

const SettingsTile = ({ icon: Icon, title, description, to, testid, accent = 'default', soon }) => {
  const navigate = useNavigate();
  const Tag = soon ? 'div' : 'button';
  return (
    <Tag
      data-testid={testid}
      onClick={soon ? undefined : () => navigate(to)}
      className={`text-left bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] p-6 transition-colors group relative
        ${soon ? 'opacity-55 cursor-not-allowed' : 'hover:border-[var(--bp-border-strong)] hover:bg-[var(--bp-surface-1)]/80'}`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-[var(--bp-radius-sm)] flex items-center justify-center flex-shrink-0
          ${accent === 'core' ? 'bg-[var(--bp-primary)]/12 text-[var(--bp-primary)]'
            : accent === 'muted' ? 'bg-[var(--bp-text-muted)]/10 text-[var(--bp-text-muted)]'
            : 'bg-[var(--bp-primary)]/8 text-[var(--bp-primary)]'}`}>
          <Icon size={18} strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-heading text-xl text-[var(--bp-text-primary)] leading-tight">{title}</h3>
            {soon && (
              <span className="px-2 py-0.5 rounded-full bg-[var(--bp-surface-2)] text-[var(--bp-text-muted)] text-[9px] font-body uppercase tracking-[0.18em]">
                Soon
              </span>
            )}
          </div>
          <p className="text-[var(--bp-text-muted)] text-xs font-body leading-relaxed">{description}</p>
        </div>
        {!soon && (
          <ArrowRight size={14} className="text-[var(--bp-text-subtle)] group-hover:text-[var(--bp-text-secondary)] transition-colors mt-1" />
        )}
      </div>
    </Tag>
  );
};

const SectionHeader = ({ kicker, title, body }) => (
  <div className="mb-5">
    <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.22em] font-semibold mb-1">{kicker}</p>
    <h2 className="font-heading text-2xl text-[var(--bp-text-primary)] leading-tight mb-1">{title}</h2>
    <p className="text-[var(--bp-text-muted)] text-xs font-body max-w-2xl leading-relaxed">{body}</p>
  </div>
);

const SettingsPage = () => {
  const { t } = useBlueprint();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSuper = user?.role === 'super_admin';

  return (
    <div className="p-10 max-w-5xl mx-auto" data-testid="settings-page">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="mb-10 flex items-start justify-between gap-6">
        <div>
          <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.22em] font-semibold mb-1">
            {t('settings.kicker', null, 'Studio · Workspace')}
          </p>
          <h1 className="font-heading text-4xl font-light text-[var(--bp-text-primary)]">
            {t('settings.title')}
          </h1>
          <p className="text-[var(--bp-text-muted)] text-sm font-body mt-2 max-w-xl">
            {t('settings.sub', null, 'Manage your studio — team, brand, website and account in one place.')}
          </p>
        </div>
        {isSuper && (
          <button onClick={() => navigate('/superadmin')}
                  data-testid="goto-superadmin"
                  className="flex items-center gap-2 px-4 py-2 rounded-[var(--bp-radius-sm)] border border-[var(--bp-border)] text-[var(--bp-text-secondary)] hover:text-[var(--bp-primary)] hover:border-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.2em] transition-colors">
            <ShieldCheck size={12} strokeWidth={1.5} />
            SuperAdmin
          </button>
        )}
      </div>

      {/* ── WORKSPACE ─────────────────────────────────────────────────── */}
      <section className="mb-12" data-testid="settings-workspace">
        <SectionHeader
          kicker={t('settings.workspace.kicker', null, 'Workspace')}
          title={t('settings.workspace.title', null, 'Studio governance')}
          body={t('settings.workspace.body', null, 'Who can do what, your plan and limits, the domains you publish on, and your brand identity.')}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SettingsTile testid="tile-team" icon={Users} to="/settings/members" accent="core"
            title={t('settings.team.title', null, 'Team & Permissions')}
            description={t('settings.team.sub', null, 'Invite people, assign roles, suspend or remove members. Every action is audit-logged.')}
          />
          <SettingsTile testid="tile-plan" icon={CreditCard} to="/settings/plan" accent="core"
            title={t('settings.plan.title', null, 'Billing & Plan')}
            description={t('settings.plan.sub', null, 'Active plan, usage meters, seat limits, billing cycle.')}
          />
          <SettingsTile testid="tile-domains" icon={Globe} to="/settings/domains"
            title={t('settings.domains.title', null, 'Domains')}
            description={t('settings.domains.sub', null, 'Connect custom domains and subdomains to your workspace.')}
          />
          <SettingsTile testid="tile-brand" icon={Palette} to="/settings/brand"
            title={t('settings.brand.title', null, 'Brand Studio')}
            description={t('settings.brand.sub', null, 'Logo, palette, typography and style preset for your tenant.')}
          />
          <SettingsTile testid="tile-international-presence" icon={Globe} to="/settings/international-presence" accent="core"
            title={t('settings.internationalPresence.title', null, 'International Presence™')}
            description={t('settings.internationalPresence.sub', null, 'The editorial map of markets where the studio positions itself. Activates locale-native storefronts.')}
          />
        </div>
      </section>

      {/* ── WEBSITE ───────────────────────────────────────────────────── */}
      <section className="mb-12" data-testid="settings-website">
        <SectionHeader
          kicker={t('settings.website.kicker', null, 'Website')}
          title={t('settings.website.title', null, 'Your public storefront')}
          body={t('settings.website.body', null, 'The pages, forms and editorial content your clients and professionals see.')}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SettingsTile testid="tile-storefront" icon={Store} to="/settings/storefront"
            title={t('settings.storefront.title', null, 'Storefront Pages')}
            description={t('settings.storefront.sub', null, 'Homepage, hero, projects, value props — navigation & footer included.')}
          />
          <SettingsTile testid="tile-forms" icon={ClipboardList} to="/settings/forms"
            title={t('settings.forms.title', null, 'Forms & Onboarding')}
            description={t('settings.forms.sub', null, 'Lead forms, client & professional intake wizards, automations.')}
          />
          <SettingsTile testid="tile-journal" icon={Newspaper} to="/settings/journal"
            title={t('settings.journal.title', null, 'Journal')}
            description={t('settings.journal.sub', null, 'Editorial posts, project stories, press features.')}
            soon
          />
        </div>
      </section>

      {/* ── ACCOUNT ───────────────────────────────────────────────────── */}
      <section data-testid="settings-account">
        <SectionHeader
          kicker={t('settings.account.kicker', null, 'Account')}
          title={t('settings.account.title', null, 'Your personal preferences')}
          body={t('settings.account.body', null, 'These settings apply only to your own user — not the rest of the studio.')}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SettingsTile testid="tile-profile" icon={UserCircle} to="/settings/profile"
            title={t('settings.profile.title', null, 'Profile')}
            description={t('settings.profile.sub', null, 'Name, avatar, signature.')}
            soon
          />
          <SettingsTile testid="tile-notifications" icon={Bell} to="/settings/notifications"
            title={t('settings.notifications.title', null, 'Notifications')}
            description={t('settings.notifications.sub', null, 'How and when you want to be notified.')}
            soon
          />
          <SettingsTile testid="tile-security" icon={KeyRound} to="/settings/security"
            title={t('settings.security.title', null, 'Security')}
            description={t('settings.security.sub', null, 'Password, sessions, two-factor.')}
            soon
          />
        </div>
      </section>

      {/* ── CULTURAL PERSPECTIVE (P0.2.B) ─────────────────────────────── */}
      {/* Not a language switcher — a runtime cultural repositioning.
          Lives in Account because it's a personal preference; tenant-level
          default lives separately under Studio governance. */}
      <CulturalPerspectivePanel />
    </div>
  );
};

export default SettingsPage;
