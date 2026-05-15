/**
 * SettingsPage — hub linking to Brand Studio, Domains, Locales, Members,
 * Tenant Storefront and Corporate Pages.
 *
 * SCOPE AUDIT (Phase H.5 SESSION A):
 *   • Tenant Storefront — public-facing pages of THIS tenant (homepage, projects,
 *     onboarding, professionals). What end-users (private clients & A&D pros) see.
 *   • Corporate Pages    — Blueprint Section Engine demo pages (sample showcase
 *     of Blueprint OS™ capabilities). Internal/legacy. NOT the tenant storefront.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { Palette, Globe, Languages, Users, ArrowRight, Layers, Compass, ClipboardList, Store, Wrench } from 'lucide-react';

const SettingsTile = ({ icon: Icon, title, description, to, testid, accent }) => {
  const navigate = useNavigate();
  return (
    <button data-testid={testid} onClick={() => navigate(to)}
      className="text-left bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] p-6 hover:border-[var(--bp-border-strong)] transition-colors group">
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-[var(--bp-radius-sm)] flex items-center justify-center flex-shrink-0 ${accent === 'tenant' ? 'bg-[#C9A36E]/15' : accent === 'corporate' ? 'bg-[var(--bp-text-muted)]/10' : 'bg-[var(--bp-primary)]/10'}`}>
          <Icon size={18} className={accent === 'tenant' ? 'text-[#C9A36E]' : accent === 'corporate' ? 'text-[var(--bp-text-muted)]' : 'text-[var(--bp-primary)]'} strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-xl text-[var(--bp-text-primary)] leading-tight mb-1">{title}</h3>
          <p className="text-[var(--bp-text-muted)] text-xs font-body">{description}</p>
        </div>
        <ArrowRight size={14} className="text-[var(--bp-text-subtle)] group-hover:text-[var(--bp-text-secondary)] transition-colors mt-1" />
      </div>
    </button>
  );
};

const SectionHeader = ({ kicker, title, body }) => (
  <div className="mb-5">
    <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.2em] font-semibold mb-1">{kicker}</p>
    <h2 className="font-heading text-2xl text-[var(--bp-text-primary)] leading-tight mb-1">{title}</h2>
    <p className="text-[var(--bp-text-muted)] text-xs font-body max-w-2xl">{body}</p>
  </div>
);

const SettingsPage = () => {
  const { t } = useBlueprint();
  return (
    <div className="p-10 max-w-5xl mx-auto" data-testid="settings-page">
      <div className="mb-10">
        <p className="text-[var(--bp-primary)] text-[10px] font-body uppercase tracking-[0.2em] font-semibold mb-1">
          {t('nav.section.system')}
        </p>
        <h1 className="font-heading text-4xl font-light text-[var(--bp-text-primary)]">
          {t('settings.title')}
        </h1>
      </div>

      {/* Section 1 — TENANT STOREFRONT (the demo store / showroom homepage) */}
      <section className="mb-10" data-testid="settings-tenant-section">
        <SectionHeader
          kicker={t('settings.section.tenant', null, 'Tenant Storefront')}
          title={t('settings.section.tenant.title', null, 'Your public storefront')}
          body={t('settings.section.tenant.body', null, 'Pages your clients & professionals see — homepage, projects, onboarding flows, professionals gateway.')}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SettingsTile testid="tile-storefront" icon={Store} to="/settings/storefront" accent="tenant"
            title={t('settings.storefront.title', null, 'Storefront Pages')}
            description={t('settings.storefront.sub', null, 'Homepage, hero, projects, value props, footer — currently from frontend config; backend CMS in Session B.')}
          />
          <SettingsTile testid="tile-navigation" icon={Compass} to="/settings/navigation" accent="tenant"
            title={t('settings.navigation.title', null, 'Navigation & Footer')}
            description={t('settings.navigation.sub', null, 'Top bar links, footer columns, showroom address.')}
          />
          <SettingsTile testid="tile-forms" icon={ClipboardList} to="/settings/forms" accent="tenant"
            title={t('settings.forms.title', null, 'Forms & Onboarding')}
            description={t('settings.forms.sub', null, 'Private wizard, professional intake, lead forms.')}
          />
          <SettingsTile testid="tile-brand" icon={Palette} to="/settings/brand" accent="tenant"
            title={t('settings.brand.title', null, 'Brand Studio')}
            description={t('settings.brand.sub', null, 'Theme — palette, typography, shape, motion, brand assets.')}
          />
        </div>
      </section>

      {/* Section 2 — CORPORATE / INTERNAL */}
      <section className="mb-10" data-testid="settings-corporate-section">
        <SectionHeader
          kicker={t('settings.section.corporate', null, 'Corporate Platform')}
          title={t('settings.section.corporate.title', null, 'Blueprint OS™ internal pages')}
          body={t('settings.section.corporate.body', null, 'Sample/demo pages built with Blueprint Section Engine. Useful as a Blueprint OS showcase, NOT as your storefront.')}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SettingsTile testid="tile-pages" icon={Layers} to="/settings/pages" accent="corporate"
            title={t('settings.pages.title', null, 'Section Engine Pages')}
            description={t('settings.pages.sub', null, 'Block-based corporate/demo pages — Blueprint OS™ showcase. Default content: "Timeless elegance, engineered."')}
          />
        </div>
      </section>

      {/* Section 3 — PLATFORM SYSTEM */}
      <section data-testid="settings-system-section">
        <SectionHeader
          kicker={t('settings.section.system', null, 'Platform System')}
          title={t('settings.section.system.title', null, 'Cross-cutting configuration')}
          body={t('settings.section.system.body', null, 'Global controls shared by tenant storefront and Blueprint workspace.')}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SettingsTile testid="tile-domains" icon={Globe} to="/settings/domains"
            title={t('settings.domains.title', null, 'Domains')}
            description={t('settings.domains.sub', null, 'Connect custom domains and subdomains to your workspace.')}
          />
          <SettingsTile testid="tile-locales" icon={Languages} to="/settings/languages"
            title={t('settings.languages.title', null, 'Languages')}
            description={t('settings.languages.sub', null, 'Global Language Registry — public site, Blueprint, fallback, RTL, AI translation.')}
          />
          <SettingsTile testid="tile-team" icon={Users} to="/settings/team"
            title={t('settings.team')}
            description={t('settings.team.sub', null, 'Invite collaborators and manage roles & permissions.')}
          />
          <SettingsTile testid="tile-tools" icon={Wrench} to="/settings/storefront#dev"
            title={t('settings.tools.title', null, 'Dev tools')}
            description={t('settings.tools.sub', null, 'i18n coverage, missing keys detector, content audit.')}
          />
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;
