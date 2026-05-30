/**
 * AtelierWelcomePanel · ITER162 (root)
 *
 * Layout three-column cinematic:
 *   SX   · AtelierSidebar (narrativa)
 *   MID  · Hero + Quote + QuickSummary (4 cards) + Timeline
 *   DX   · ReferenceCard + ActionPanel + NextStep
 * Floating bottom-right · AtelierPasswordPrompt
 *
 * Solo grafica + architettura preset. Dati: welcomeSummary già
 * mappati da `buildAtelierViewModel`. Niente backend qui.
 */
import React, { useState } from 'react';
import AtelierSidebar         from './AtelierSidebar';
import AtelierHero            from './AtelierHero';
import AtelierQuickSummary    from './AtelierQuickSummary';
import AtelierReferenceCard   from './AtelierReferenceCard';
import AtelierActionPanel     from './AtelierActionPanel';
import AtelierTimeline        from './AtelierTimeline';
import AtelierNextStep        from './AtelierNextStep';
import AtelierPasswordPrompt  from './AtelierPasswordPrompt';
import AtelierNotifications   from './AtelierNotifications';
import AtelierUserMenu        from './AtelierUserMenu';
import RecallRequestModal     from '../../../components/client/RecallRequestModal';
import './atelier.css';

const AtelierWelcomePanel = ({ viewModel, components }) => {
  const [recallOpen, setRecallOpen] = useState(false);
  const c = components || {};
  const vm = viewModel;

  return (
    <div className="atelier-shell" data-testid="atelier-welcome-panel">
      {/* SX · Sidebar */}
      {c.sidebar !== false && (
        <AtelierSidebar
          client={vm.client}
          referente={vm.referente}
        />
      )}

      {/* Main */}
      <main className="atelier-main" data-testid="atelier-main">
        {/* Top bar · notifiche + avatar menu */}
        <header className="atelier-topbar" data-testid="atelier-topbar">
          <span className="atelier-topbar__studio" data-testid="atelier-topbar-studio">
            <em>Studio</em> {vm.studio?.name}
          </span>
          <AtelierNotifications studioName={vm.studio?.name} />
          <AtelierUserMenu client={vm.client} />
        </header>

        {/* MID column · hero + summary integrati in un unico blocco */}
        <section className="atelier-mid">
          <div className="atelier-mid__inner" data-testid="atelier-mid-inner">
            {c.hero !== false && (
              <AtelierHero hero={vm.hero} quote={c.quote !== false ? vm.quote : null} />
            )}
            {c.quickSummary !== false && (
              <AtelierQuickSummary
                indications={vm.indications}
                journeyId={vm.journeyId}
                locale={vm.locale}
                market={vm.market}
              />
            )}
          </div>
        </section>

        {/* DX column */}
        <aside className="atelier-side" data-testid="atelier-side-column">
          {c.referenceCard !== false && (
            <AtelierReferenceCard referente={vm.referente} />
          )}
          {c.actionPanel !== false && (
            <AtelierActionPanel
              journeyId={vm.journeyId}
              onRecallClick={() => setRecallOpen(true)}
            />
          )}
        </aside>

        {/* Bottom strip · Timeline + Next step */}
        <section className="atelier-bottom" data-testid="atelier-bottom-strip">
          {c.timeline !== false && (
            <AtelierTimeline steps={vm.timeline} />
          )}
          {c.nextStep !== false && (
            <AtelierNextStep nextStep={vm.nextStep} />
          )}
        </section>
      </main>

      {/* Floating · password prompt */}
      {c.passwordPrompt !== false && <AtelierPasswordPrompt />}

      {/* Recall modal · same component used by ClientWelcomePanel */}
      {recallOpen && (
        <RecallRequestModal
          onClose={() => setRecallOpen(false)}
          journeyId={vm.journeyId}
        />
      )}
    </div>
  );
};

export default AtelierWelcomePanel;
