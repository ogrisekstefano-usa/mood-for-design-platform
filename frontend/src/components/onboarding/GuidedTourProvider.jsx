/**
 * GuidedTourProvider — ITER154 First Experience Activation
 * =========================================================
 *
 * Context provider that exposes:
 *   - tour steps (DB-driven, role-filtered server-side)
 *   - persisted state (not_started | in_progress | completed | skipped)
 *   - actions: start(), advance(), back(), skip(), finish(), reopen()
 *
 * Renders <GuidedTourOverlay> when state.status === 'in_progress'.
 *
 * Philosophy: NOT a SaaS tooltip. An invitation to inhabit the studio.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useBlueprint } from '../../contexts/BlueprintContext';
import { fetchTour, persistState, resetTour } from '../../lib/guidedTour';
import GuidedTourOverlay from './GuidedTourOverlay';
import GuidedTourWelcome from './GuidedTourWelcome';

const TourCtx = createContext(null);

// Routes where the tour is intentionally hidden
const SUPPRESS_ROUTES = [
  '/login', '/auth', '/admin', '/client', '/public', '/storefront',
];

function isSuppressed(pathname) {
  return SUPPRESS_ROUTES.some((p) => pathname.startsWith(p));
}

export const GuidedTourProvider = ({ children }) => {
  const { user } = useAuth();
  const isAuthenticated = Boolean(user);
  const { locale } = useBlueprint();
  const [steps, setSteps] = useState([]);
  const [state, setState] = useState({ status: 'not_started', current_step: 0 });
  const [phase, setPhase] = useState('idle');
    // 'idle' | 'welcome' | 'running' | 'done'
  const loadedRef = useRef(false);

  // ── load once after login ─────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || loadedRef.current) return;
    if (typeof window !== 'undefined' && isSuppressed(window.location.pathname)) return;
    loadedRef.current = true;
    (async () => {
      try {
        const data = await fetchTour();
        setSteps(data.steps || []);
        const st = data.state || { status: 'not_started', current_step: 0 };
        setState(st);
        if (st.status === 'not_started') {
          // Defer welcome a beat so the app paints first
          setTimeout(() => setPhase('welcome'), 800);
        } else if (st.status === 'in_progress') {
          setPhase('running');
        }
      } catch (e) {
        // Silent — onboarding is non-blocking
        console.warn('[GuidedTour] load failed', e);
      }
    })();
  }, [isAuthenticated]);

  // ── actions ──────────────────────────────────────────────────
  const start = useCallback(async () => {
    setPhase('running');
    const next = { status: 'in_progress', current_step: 1 };
    setState(next);
    try { await persistState({ status: 'in_progress', currentStep: 1 }); } catch {}
  }, []);

  const advance = useCallback(async () => {
    const total = steps.length || 7;
    const next = Math.min((state.current_step || 0) + 1, total);
    if (next > total) return;
    if (next === total + 1) return;
    if (next > steps.length) {
      // finished
      setPhase('done');
      setState({ status: 'completed', current_step: total });
      try { await persistState({ status: 'completed', currentStep: total }); } catch {}
      return;
    }
    setState({ status: 'in_progress', current_step: next });
    try { await persistState({ status: 'in_progress', currentStep: next }); } catch {}
  }, [state.current_step, steps.length]);

  const back = useCallback(async () => {
    const prev = Math.max(1, (state.current_step || 1) - 1);
    setState({ status: 'in_progress', current_step: prev });
    try { await persistState({ status: 'in_progress', currentStep: prev }); } catch {}
  }, [state.current_step]);

  const finish = useCallback(async () => {
    const total = steps.length || 7;
    setPhase('done');
    setState({ status: 'completed', current_step: total });
    try { await persistState({ status: 'completed', currentStep: total }); } catch {}
  }, [steps.length]);

  const skip = useCallback(async () => {
    setPhase('done');
    setState({ status: 'skipped', current_step: state.current_step || 0 });
    try { await persistState({ status: 'skipped', currentStep: state.current_step || 0 }); } catch {}
  }, [state.current_step]);

  const reopen = useCallback(async () => {
    try { await resetTour(); } catch {}
    const data = await fetchTour();
    setSteps(data.steps || []);
    setState({ status: 'not_started', current_step: 0 });
    setPhase('welcome');
  }, []);

  const value = useMemo(() => ({
    steps,
    state,
    phase,
    locale: locale || 'it',
    start, advance, back, skip, finish, reopen,
  }), [steps, state, phase, locale, start, advance, back, skip, finish, reopen]);

  const showWelcome = phase === 'welcome';
  const showOverlay = phase === 'running' && steps.length > 0;

  return (
    <TourCtx.Provider value={value}>
      {children}
      {showWelcome && (
        <GuidedTourWelcome
          locale={value.locale}
          totalSteps={steps.length || 7}
          onStart={start}
          onSkip={skip}
        />
      )}
      {showOverlay && (
        <GuidedTourOverlay
          locale={value.locale}
          steps={steps}
          currentStep={state.current_step}
          onAdvance={advance}
          onBack={back}
          onSkip={skip}
          onFinish={finish}
        />
      )}
    </TourCtx.Provider>
  );
};

export const useGuidedTour = () => {
  const ctx = useContext(TourCtx);
  if (!ctx) {
    return {
      steps: [], state: { status: 'not_started', current_step: 0 },
      phase: 'idle', locale: 'it',
      start: () => {}, advance: () => {}, back: () => {},
      skip: () => {}, finish: () => {}, reopen: () => {},
    };
  }
  return ctx;
};

export default GuidedTourProvider;
