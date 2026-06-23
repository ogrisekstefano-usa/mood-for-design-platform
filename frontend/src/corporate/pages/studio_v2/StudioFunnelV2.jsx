/**
 * StudioFunnelV2 — single-mount routing wrapper for the 5-step funnel.
 * Wraps the funnel in <LoadingProvider> so every async operation
 * (submit, fetch, geocode) can show the branded MOOD overlay.
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
import { LoadingProvider, useLoading } from './components/LoadingContext';
import { useLocale } from '../../../contexts/LocaleContext';

const TOTAL_STEPS = 5;

const FunnelInner = ({ locale }) => {
  const [step, setStep] = useState(0);
  const [submitResult, setSubmitResult] = useState(null);
  const navigate = useNavigate();
  const { withLoading } = useLoading();

  const { manifest, ready: manifestReady, t } = useStudioV2Manifest(locale);
  const { draftToken, form, update, reset, ready: draftReady } = useV2Draft();

  // Smooth step transition: brief branded overlay during state batching
  // so the visitor never sees a blank or frozen interim state.
  const advanceStep = async (delta) => {
    const loadingMsg = t('loading.message') || '·';
    await withLoading(loadingMsg, async () => {
      await new Promise((r) => setTimeout(r, 280));
      setStep((s) => Math.min(Math.max(s + delta, 0), TOTAL_STEPS - 1));
    });
  };
  const next = () => advanceStep(+1);
  const back = () => advanceStep(-1);

  useEffect(() => {
    if (submitResult?.ok && step !== 4) setStep(4);
  }, [submitResult, step]);

  if (!manifestReady || !draftReady) {
    // Inline branded loading state until manifest+draft are ready.
    // Once mounted we never see this again; advanceStep covers the rest.
    return (
      <StudioV2Layout stepIndex={step} totalSteps={TOTAL_STEPS}>
        <div data-testid="initial-loading" style={{
          minHeight: 360, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.4)', letterSpacing: '0.18em',
          textTransform: 'uppercase', fontSize: '0.8rem',
        }}>·</div>
      </StudioV2Layout>
    );
  }

  if (!manifest) {
    return (
      <StudioV2Layout stepIndex={step} totalSteps={TOTAL_STEPS}>
        <p style={{ color: '#FFB4A2' }} data-testid="manifest-error">
          {t('manifest.error', 'Servizio temporaneamente non disponibile.')}
        </p>
      </StudioV2Layout>
    );
  }

  const ctx = { manifest, t, form, update, draftToken, locale,
                next, back, setStep, submitResult, setSubmitResult,
                reset, navigate, withLoading };

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

const StudioFunnelV2 = () => {
  const { locale } = useLocale();
  const safeLocale = locale || 'it-IT';
  return (
    <LoadingProvider defaultMessage="·">
      <FunnelInner locale={safeLocale} />
    </LoadingProvider>
  );
};

export default StudioFunnelV2;
