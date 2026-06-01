/**
 * StudioFunnelV2 — single-mount routing wrapper for the 5-step funnel.
 * Mounts at /studio and switches between Step1..Step5 using internal
 * state. URL-driven sub-routes are intentionally absent: the funnel
 * is a single editorial flow with browser back/forward driven by the
 * UI buttons.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StudioV2Layout from './StudioV2Layout';
import Step1Archetype from './Step1Archetype';
import Step2Location from './Step2Location';
import Step3Contact from './Step3Contact';
import Step4Help from './Step4Help';
import Step5Received from './Step5Received';
import { useStudioV2Manifest } from './hooks/useStudioV2Manifest';
import { useV2Draft } from './hooks/useV2Draft';

const TOTAL_STEPS = 5;

const StudioFunnelV2 = () => {
  const [step, setStep] = useState(0);   // 0..4
  const [submitResult, setSubmitResult] = useState(null);
  const navigate = useNavigate();

  const locale = (typeof navigator !== 'undefined' && navigator.language?.startsWith('en'))
    ? 'en-US' : 'it-IT';

  const { manifest, ready: manifestReady, t } = useStudioV2Manifest(locale);
  const { draftToken, form, update, reset, ready: draftReady } = useV2Draft();

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  // Reset funnel if landing on /studio after a successful submit
  useEffect(() => {
    if (submitResult?.ok && step !== 4) {
      setStep(4);
    }
  }, [submitResult, step]);

  if (!manifestReady || !draftReady) {
    return (
      <StudioV2Layout stepIndex={step} totalSteps={TOTAL_STEPS}>
        <div style={{ padding: 80, opacity: 0.55, textAlign: 'center' }}
             data-testid="loading">…</div>
      </StudioV2Layout>
    );
  }

  if (!manifest) {
    return (
      <StudioV2Layout stepIndex={step} totalSteps={TOTAL_STEPS}>
        <p style={{ color: '#FFB4A2' }} data-testid="manifest-error">
          Servizio temporaneamente non disponibile.
        </p>
      </StudioV2Layout>
    );
  }

  const ctx = { manifest, t, form, update, draftToken, locale,
                next, back, setStep, submitResult, setSubmitResult,
                reset, navigate };

  return (
    <StudioV2Layout stepIndex={step} totalSteps={TOTAL_STEPS}>
      {step === 0 && <Step1Archetype {...ctx} />}
      {step === 1 && <Step2Location  {...ctx} />}
      {step === 2 && <Step3Contact   {...ctx} />}
      {step === 3 && <Step4Help      {...ctx} />}
      {step === 4 && <Step5Received  {...ctx} />}
    </StudioV2Layout>
  );
};

export default StudioFunnelV2;
