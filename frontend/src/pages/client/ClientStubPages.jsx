/**
 * ClientStubPage — premium "coming soon" filler for the secondary
 * sidebar entries (project / moodboards / timeline / approvals /
 * files / messages). Keeps the tone calm and reassuring instead of
 * a generic "404" or "not implemented".
 *
 * ITER130 · fully localized through the i18n registry — no hardcoded
 * Italian literals, the EN-US client never reads a translated phrase.
 */
import React from 'react';
import { Sparkles } from 'lucide-react';
import { useT } from '../../i18n/useT';

const Stub = ({ eyebrowKey, titleKey, bodyKey, testId }) => {
  const { t } = useT();
  return (
    <div data-testid={testId} className="max-w-[920px] mt-2">
      <div className="cp-card p-12 lg:p-14">
        <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--cp-gold)] mb-6">
          {t(eyebrowKey)}
        </p>
        <h2 className="font-heading text-[36px] lg:text-[40px] leading-[1.1] tracking-[-0.012em] text-[var(--cp-text-primary)] max-w-[18ch]">
          {t(titleKey)}
        </h2>
        <div className="mt-6 h-px w-12 bg-[var(--cp-gold)] opacity-50" />
        <p className="mt-7 text-[14px] leading-[1.7] text-[var(--cp-text-secondary)] max-w-[52ch] font-body">
          {t(bodyKey)}
        </p>
        <div className="mt-10 flex items-center gap-3 text-[var(--cp-text-muted)]">
          <span
            aria-hidden
            className="w-9 h-9 rounded-full flex items-center justify-center
                       bg-[var(--cp-gold-bg)] border border-[var(--cp-border)]
                       text-[var(--cp-gold-soft)]"
          >
            <Sparkles size={15} strokeWidth={1.5} />
          </span>
          <p className="text-[12px] uppercase tracking-[0.2em]">
            {t('stubs.client.in_arrivo')}
          </p>
        </div>
      </div>
    </div>
  );
};

export const ClientProjectPage = () => (
  <Stub
    testId="client-project-page"
    eyebrowKey="stubs.client.project.eyebrow"
    titleKey="stubs.client.project.title"
    bodyKey="stubs.client.project.body"
  />
);

export const ClientMoodboardsPage = () => (
  <Stub
    testId="client-moodboards-page"
    eyebrowKey="stubs.client.moodboards.eyebrow"
    titleKey="stubs.client.moodboards.title"
    bodyKey="stubs.client.moodboards.body"
  />
);

export const ClientTimelinePage = () => (
  <Stub
    testId="client-timeline-page"
    eyebrowKey="stubs.client.timeline.eyebrow"
    titleKey="stubs.client.timeline.title"
    bodyKey="stubs.client.timeline.body"
  />
);

export const ClientApprovalsPage = () => (
  <Stub
    testId="client-approvals-page"
    eyebrowKey="stubs.client.approvals.eyebrow"
    titleKey="stubs.client.approvals.title"
    bodyKey="stubs.client.approvals.body"
  />
);

export const ClientFilesPage = () => (
  <Stub
    testId="client-files-page"
    eyebrowKey="stubs.client.files.eyebrow"
    titleKey="stubs.client.files.title"
    bodyKey="stubs.client.files.body"
  />
);

export const ClientMessagesPage = () => (
  <Stub
    testId="client-messages-page"
    eyebrowKey="stubs.client.messages.eyebrow"
    titleKey="stubs.client.messages.title"
    bodyKey="stubs.client.messages.body"
  />
);
