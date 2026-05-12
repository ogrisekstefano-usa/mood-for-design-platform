/**
 * SettingsPage — hub linking to Brand Studio, Domains, Locales, Members.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { Palette, Globe, Languages, Users, ArrowRight, Layers } from 'lucide-react';

const SettingsTile = ({ icon: Icon, title, description, to, testid }) => {
  const navigate = useNavigate();
  return (
    <button data-testid={testid} onClick={() => navigate(to)}
      className="text-left bg-[var(--bp-surface-1)] border border-[var(--bp-border)] rounded-[var(--bp-radius-md)] p-6 hover:border-[var(--bp-border-strong)] transition-colors group">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-[var(--bp-radius-sm)] bg-[var(--bp-primary)]/10 flex items-center justify-center flex-shrink-0">
          <Icon size={18} className="text-[var(--bp-primary)]" strokeWidth={1.5} />
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SettingsTile testid="tile-brand" icon={Palette} to="/settings/brand"
          title={t('settings.brand.title', null, 'Brand Studio')}
          description={t('settings.brand.sub', null, 'Theme engine — palette, typography, shape, motion, brand assets.')}
        />
        <SettingsTile testid="tile-pages" icon={Layers} to="/settings/pages"
          title={t('settings.pages.title', null, 'Pages Builder')}
          description={t('settings.pages.sub', null, 'Compose homepage, showcase, and editorial pages with Blueprint Sections.')}
        />
        <SettingsTile testid="tile-domains" icon={Globe} to="/settings/domains"
          title={t('settings.domains.title', null, 'Domains')}
          description={t('settings.domains.sub', null, 'Connect custom domains and subdomains to your workspace.')}
        />
        <SettingsTile testid="tile-locales" icon={Languages} to="/settings/locales"
          title={t('settings.locale')}
          description={t('settings.locales.sub', null, 'Manage default language and active locales for your studio.')}
        />
        <SettingsTile testid="tile-team" icon={Users} to="/settings/team"
          title={t('settings.team')}
          description={t('settings.team.sub', null, 'Invite collaborators and manage roles & permissions.')}
        />
      </div>
    </div>
  );
};

export default SettingsPage;
