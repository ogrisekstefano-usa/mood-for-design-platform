import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, ArrowRight, Check, Plus, X, User, Palette, LayoutGrid, Images, FileText, Bookmark } from 'lucide-react';
import { SiteProvider, useSite } from '../../site/SiteContext';
import { onboardingContent } from '../../site/content/onboarding';
import {
  categoryFor,
  visibleSteps,
  indexOfStepId,
  isStepRequiredMet,
  progressPercent,
  resolveStep2Content,
  resolveStep6Content,
  buildBriefingShape,
} from '../../site/content/onboardingGraph';
import { navigationContent } from '../../site/content/navigation';
import { tenantConfig } from '../../site/content/tenant';
import BlueprintGenesisOverlay from '../../site/components/BlueprintGenesisOverlay';
import '../../site/site.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const STORAGE_KEY = 'mfd_start_project_state';
const SESSION_KEY = 'mfd_session';

const initialState = {
  step: 1,
  project_type: null,
  spaces: [],
  moods: [],
  inspirations: { active: 'upload', uploads: [], pinterest: [], links: [] },
  materials: [],
  colors: [],
  lifestyle: { feel: '', inspires: '', atmosphere: '' },
  budget: { timeline: '', amount: '', startDate: '', notes: '' },
  locale: null,
  created_at: null,
};

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...initialState, ...JSON.parse(raw) };
  } catch (_) {}
  return initialState;
};

const saveState = (s) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_) {} };

// ──────────────────────────────────────────────────────────────────────
// Wizard chrome
// ──────────────────────────────────────────────────────────────────────
const ProgressIndicator = ({ percent, totalDots, currentDot }) => (
  <div className="mfd-wiz__progress" data-testid="wiz-progress" aria-label={`${percent}%`}>
    {Array.from({ length: totalDots }).map((_, i) => (
      <span
        key={i}
        className={`mfd-wiz__progress-dot ${i + 1 === currentDot ? 'is-active' : i + 1 < currentDot ? 'is-done' : ''}`}
      />
    ))}
  </div>
);

const Chrome = ({ step, exitConfirmText, onExit, counterText, percent, totalDots, currentDot }) => (
  <div className="mfd-wiz__chrome" data-testid="wiz-chrome">
    <Link to="/" className="mfd-wiz__brand" data-testid="wiz-brand">
      <img src={navigationContent.brand.logoSrc} alt="MOOD for DESIGN" />
    </Link>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
      <span className="mfd-wiz__step-counter" data-testid="wiz-step-counter">{counterText}</span>
      {currentDot <= totalDots && <ProgressIndicator percent={percent} totalDots={totalDots} currentDot={currentDot} />}
    </div>
    <button
      type="button"
      className="mfd-wiz__exit"
      data-testid="wiz-exit"
      onClick={() => {
        if (window.confirm(exitConfirmText)) onExit();
      }}
    >
      <X size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
      Exit
    </button>
  </div>
);

// ──────────────────────────────────────────────────────────────────────
// Steps
// ──────────────────────────────────────────────────────────────────────
const StepHeading = ({ eyebrow, title, body }) => (
  <header className="mfd-wiz__heading">
    <span className="mfd-eyebrow mfd-eyebrow--accent">{eyebrow}</span>
    <h1 className="mfd-wiz__title">{title}</h1>
    {body && <p className="mfd-wiz__sub">{body}</p>}
  </header>
);

const Step1ProjectType = ({ value, onChange, pick }) => {
  const c = onboardingContent.step1;
  return (
    <>
      <StepHeading
        eyebrow={pick(c.eyebrow, 'onboarding.step1.eyebrow')}
        title={pick(c.title, 'onboarding.step1.title')}
        body={pick(c.body, 'onboarding.step1.body')}
      />
      <div className="mfd-wiz-cards" data-testid="wiz-step1-cards">
        {c.options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className="mfd-wiz-card"
            aria-pressed={value === opt.id}
            onClick={() => onChange(opt.id)}
            data-testid={`wiz-step1-${opt.id}`}
          >
            <img src={opt.image} alt="" loading="lazy" decoding="async" />
            <div className="mfd-wiz-card__veil" />
            <span className="mfd-wiz-card__label">{pick(opt.label, `onboarding.step1.options.${opt.id}`)}</span>
            <span className="mfd-wiz-card__check"><Check size={14} strokeWidth={2.5} /></span>
          </button>
        ))}
      </div>
    </>
  );
};

const Step2Spaces = ({ value, onToggle, pick, contentOverride }) => {
  const c = contentOverride || onboardingContent.step2;
  return (
    <>
      <StepHeading eyebrow={pick(c.eyebrow, 'onboarding.step2.eyebrow')} title={pick(c.title, 'onboarding.step2.title')} body={pick(c.body, 'onboarding.step2.body')} />
      <div className="mfd-wiz-split">
        <div className="mfd-wiz-split__media">
          <img src={c.image} alt="" loading="lazy" />
        </div>
        <div className="mfd-wiz-checks" data-testid="wiz-step2-checks">
          {c.options.map((opt) => {
            const on = value.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                className="mfd-wiz-check"
                data-on={on}
                onClick={() => onToggle(opt.id)}
                data-testid={`wiz-step2-${opt.id}`}
              >
                <span className="mfd-wiz-check__box">{on && <Check size={12} strokeWidth={2.5} />}</span>
                <span>{pick(opt.label, `onboarding.step2.options.${opt.id}`)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

const Step3Mood = ({ value, onToggle, pick }) => {
  const c = onboardingContent.step3;
  return (
    <>
      <StepHeading eyebrow={pick(c.eyebrow, 'onboarding.step3.eyebrow')} title={pick(c.title, 'onboarding.step3.title')} body={pick(c.body, 'onboarding.step3.body')} />
      <div className="mfd-wiz-cards" data-testid="wiz-step3-cards">
        {c.options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className="mfd-wiz-card"
            aria-pressed={value.includes(opt.id)}
            onClick={() => onToggle(opt.id)}
            data-testid={`wiz-step3-${opt.id}`}
          >
            <img src={opt.image} alt="" loading="lazy" decoding="async" />
            <div className="mfd-wiz-card__veil" />
            <span className="mfd-wiz-card__label">{pick(opt.label, `onboarding.step3.options.${opt.id}`)}</span>
            <span className="mfd-wiz-card__check"><Check size={14} strokeWidth={2.5} /></span>
          </button>
        ))}
      </div>
    </>
  );
};

const Step4Inspirations = ({ value, onChange, pick }) => {
  const c = onboardingContent.step4;
  const tab = value.active;
  const setTab = (t) => onChange({ ...value, active: t });
  const [linkInput, setLinkInput] = useState('');

  const handleUpload = (e) => {
    const files = Array.from(e.target.files || []);
    const urls = files.map((f) => URL.createObjectURL(f));
    onChange({ ...value, uploads: [...value.uploads, ...urls] });
  };
  const removeFromCollection = (key, idx) => {
    onChange({ ...value, [key]: value[key].filter((_, i) => i !== idx) });
  };
  const addLink = (key) => {
    if (!linkInput.trim()) return;
    onChange({ ...value, [key]: [...value[key], linkInput.trim()] });
    setLinkInput('');
  };

  const items = tab === 'upload' ? value.uploads : tab === 'pinterest' ? value.pinterest : tab === 'link' ? value.links : [...value.uploads, ...value.pinterest, ...value.links];
  const collectionKey = tab === 'pinterest' ? 'pinterest' : tab === 'link' ? 'links' : 'uploads';

  return (
    <>
      <StepHeading eyebrow={pick(c.eyebrow, 'onboarding.step4.eyebrow')} title={pick(c.title, 'onboarding.step4.title')} body={pick(c.body, 'onboarding.step4.body')} />

      <div className="mfd-wiz-tabs" data-testid="wiz-step4-tabs" role="tablist">
        {c.tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            className="mfd-wiz-tabs__btn"
            role="tab"
            aria-selected={tab === tb.id}
            onClick={() => setTab(tb.id)}
            data-testid={`wiz-step4-tab-${tb.id}`}
          >{pick(tb.label, `onboarding.step4.tabs.${tb.id}`)}</button>
        ))}
      </div>

      {(tab === 'pinterest' || tab === 'link') && (
        <div className="mfd-wiz-link-row">
          <input
            type="url"
            className="mfd-wiz-input"
            placeholder={pick(c.placeholder[tab], `onboarding.step4.placeholder.${tab}`)}
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addLink(collectionKey); }}
            data-testid={`wiz-step4-input-${tab}`}
          />
          <button type="button" className="mfd-wiz__cta" onClick={() => addLink(collectionKey)} data-testid={`wiz-step4-add-${tab}`}>
            {pick(c.addMore, 'onboarding.step4.addMore')}
          </button>
        </div>
      )}

      <div className="mfd-wiz-board" data-testid="wiz-step4-board">
        {items.length === 0 && tab !== 'upload' && (
          <div className="mfd-wiz-board__cell mfd-wiz-board__add" data-testid="wiz-step4-empty">
            {pick(c.emptyBoard, 'onboarding.step4.emptyBoard')}
          </div>
        )}

        {items.map((src, i) => (
          <div key={i} className="mfd-wiz-board__cell">
            {(src.startsWith('blob:') || src.startsWith('http')) && /(\.(jpe?g|png|webp|gif|avif)|images|unsplash|cdn|imgur|cloudinary|shopify)/i.test(src) ? (
              <img src={src} alt="" />
            ) : (
              <div style={{ position: 'absolute', inset: 0, padding: '0.85rem', display: 'grid', placeItems: 'center', textAlign: 'center', fontFamily: 'var(--site-sans)', fontSize: 11, letterSpacing: '0.04em', color: 'var(--site-ink-2)', wordBreak: 'break-all' }}>
                {src.length > 80 ? src.slice(0, 80) + '\u2026' : src}
              </div>
            )}
            <button type="button" className="mfd-wiz-board__remove" onClick={() => removeFromCollection(collectionKey, i)} aria-label="Remove">
              <X size={12} />
            </button>
          </div>
        ))}

        {tab === 'upload' && (
          <label className="mfd-wiz-board__cell mfd-wiz-board__add" data-testid="wiz-step4-add-upload">
            <input type="file" accept="image/*" multiple onChange={handleUpload} />
            <Plus size={20} strokeWidth={1.4} />
            <span style={{ marginTop: 6 }}>{pick(c.addMore, 'onboarding.step4.addMore')}</span>
          </label>
        )}
      </div>
    </>
  );
};

const Step5Materials = ({ materials, colors, onToggleMaterial, onToggleColor, pick }) => {
  const c = onboardingContent.step5;
  return (
    <>
      <StepHeading eyebrow={pick(c.eyebrow, 'onboarding.step5.eyebrow')} title={pick(c.title, 'onboarding.step5.title')} body={pick(c.body, 'onboarding.step5.body')} />
      <div className="mfd-wiz-chips-section">
        <h3>{pick(c.materialsTitle, 'onboarding.step5.materialsTitle')}</h3>
        <div className="mfd-wiz-chips" data-testid="wiz-step5-materials">
          {c.materials.map((m) => (
            <button key={m.id} type="button" className="mfd-wiz-chip" aria-pressed={materials.includes(m.id)} onClick={() => onToggleMaterial(m.id)} data-testid={`wiz-step5-material-${m.id}`}>
              <span className="mfd-wiz-chip__swatch" style={{ background: m.swatch }} />
              <span className="mfd-wiz-chip__label">{pick(m.label, `onboarding.step5.materials.${m.id}`)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mfd-wiz-chips-section" style={{ marginTop: '1rem' }}>
        <h3>{pick(c.colorsTitle, 'onboarding.step5.colorsTitle')}</h3>
        <div className="mfd-wiz-chips" data-testid="wiz-step5-colors">
          {c.colors.map((co) => (
            <button key={co.id} type="button" className="mfd-wiz-chip" aria-pressed={colors.includes(co.id)} onClick={() => onToggleColor(co.id)} data-testid={`wiz-step5-color-${co.id}`}>
              <span className="mfd-wiz-chip__swatch" style={{ background: co.swatch }} />
              <span className="mfd-wiz-chip__label">{pick(co.label, `onboarding.step5.colors.${co.id}`)}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

const Step6Lifestyle = ({ value, onChange, pick, contentOverride }) => {
  const c = contentOverride || onboardingContent.step6;
  return (
    <>
      <StepHeading eyebrow={pick(c.eyebrow, 'onboarding.step6.eyebrow')} title={pick(c.title, 'onboarding.step6.title')} body={pick(c.body, 'onboarding.step6.body')} />
      <div className="mfd-wiz-split" style={{ alignItems: 'start' }}>
        <div className="mfd-wiz-split__media" style={{ minHeight: 480, position: 'relative' }}>
          <img src={c.image} alt="" loading="lazy" />
        </div>
        <div className="mfd-wiz-fields" data-testid="wiz-step6-fields">
          {c.fields.map((f) => (
            <div key={f.id} className="mfd-wiz-field">
              <label htmlFor={`field-${f.id}`}>{pick(f.label, `onboarding.step6.fields.${f.id}.label`)}</label>
              <textarea
                id={`field-${f.id}`}
                className="mfd-wiz-textarea"
                placeholder={pick(f.placeholder, `onboarding.step6.fields.${f.id}.placeholder`)}
                value={value[f.id] || ''}
                onChange={(e) => onChange({ ...value, [f.id]: e.target.value })}
                rows={3}
                data-testid={`wiz-step6-${f.id}`}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

const Step7Budget = ({ value, onChange, pick }) => {
  const c = onboardingContent.step7;
  const groups = [
    { key: 'timeline',  cfg: c.timeline,  testId: 'wiz-step7-timeline' },
    { key: 'amount',    cfg: c.budget,    testId: 'wiz-step7-budget' },
    { key: 'startDate', cfg: c.startDate, testId: 'wiz-step7-startDate' },
  ];
  return (
    <>
      <StepHeading eyebrow={pick(c.eyebrow, 'onboarding.step7.eyebrow')} title={pick(c.title, 'onboarding.step7.title')} body={pick(c.body, 'onboarding.step7.body')} />
      <div className="mfd-wiz-split" style={{ alignItems: 'start' }}>
        <div className="mfd-wiz-fields" data-testid="wiz-step7-fields">
          {groups.map((g) => (
            <div key={g.key} className="mfd-wiz-field">
              <label htmlFor={`field-${g.key}`}>{pick(g.cfg.label, `onboarding.step7.${g.key}.label`)}</label>
              <select
                id={`field-${g.key}`}
                className="mfd-wiz-select"
                value={value[g.key] || ''}
                onChange={(e) => onChange({ ...value, [g.key]: e.target.value })}
                data-testid={g.testId}
              >
                <option value="">{pick(g.cfg.placeholder, `onboarding.step7.${g.key}.placeholder`)}</option>
                {g.cfg.options.map((opt) => (
                  <option key={opt.id} value={opt.id}>{pick(opt.label, `onboarding.step7.${g.key}.options.${opt.id}`)}</option>
                ))}
              </select>
            </div>
          ))}
          <div className="mfd-wiz-field">
            <label htmlFor="field-notes">{pick(c.notes.label, 'onboarding.step7.notes.label')}</label>
            <textarea
              id="field-notes"
              className="mfd-wiz-textarea"
              placeholder={pick(c.notes.placeholder, 'onboarding.step7.notes.placeholder')}
              value={value.notes || ''}
              onChange={(e) => onChange({ ...value, notes: e.target.value })}
              rows={3}
              data-testid="wiz-step7-notes"
            />
          </div>
        </div>
        <div className="mfd-wiz-split__media" style={{ minHeight: 520 }}>
          <img src={c.image} alt="" loading="lazy" />
        </div>
      </div>
    </>
  );
};

const ICONS = { user: User, palette: Palette, layout: LayoutGrid, images: Images, 'file-text': FileText };

const FinalReady = ({ pick, payload, onCreate, onBriefingReady }) => {
  const c = onboardingContent.final;
  const [briefing, setBriefing] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await axios.post(`${BACKEND_URL}/api/onboarding/briefing-summary`,
          { payload, locale: payload.locale }, { timeout: 12000 });
        if (alive && r.data?.briefing) {
          setBriefing(r.data.briefing);
          onBriefingReady?.(r.data.briefing);
        }
      } catch (_) {
        // Silent — the wizard ships without the AI summary; backend has fallback.
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div data-testid="wiz-final">
      <StepHeading eyebrow={pick(c.eyebrow, 'onboarding.final.eyebrow')} title={pick(c.title, 'onboarding.final.title')} body={pick(c.body, 'onboarding.final.body')} />
      <div className="mfd-wiz-summary" data-testid="wiz-final-summary">
        {c.items.map((it) => {
          const Icon = ICONS[it.icon] || User;
          return (
            <div key={it.id} className="mfd-wiz-summary__row" data-testid={`wiz-final-item-${it.id}`}>
              <span className="mfd-wiz-summary__icon"><Icon size={16} strokeWidth={1.4} /></span>
              <div>
                <p className="mfd-wiz-summary__title">{pick(it.title, `onboarding.final.items.${it.id}.title`)}</p>
                <p className="mfd-wiz-summary__body">{pick(it.body, `onboarding.final.items.${it.id}.body`)}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', marginTop: '1.5rem' }}>
        <button type="button" className="mfd-wiz__cta" onClick={onCreate} data-testid="wiz-final-create">
          {pick(c.primary.label, 'onboarding.final.primary.label')} <ArrowRight size={14} style={{ marginLeft: 8, verticalAlign: -2 }} />
        </button>
        <Link to={c.secondary.href} className="mfd-btn" data-testid="wiz-final-access">
          {pick(c.secondary.label, 'onboarding.final.secondary.label')} <ArrowRight size={14} />
        </Link>
      </div>
      <p style={{ marginTop: '1rem', fontSize: 12, color: 'var(--site-ink-3)', letterSpacing: '0.04em' }}>{pick(c.note, 'onboarding.final.note')}</p>
      {/* Hidden payload preview for testability — DB-ready shape */}
      <pre data-testid="wiz-final-payload" style={{ display: 'none' }}>{JSON.stringify(payload, null, 2)}</pre>
      {briefing && (
        <pre data-testid="wiz-final-briefing" style={{ display: 'none' }}>{JSON.stringify(briefing, null, 2)}</pre>
      )}
    </div>
  );
};

// ─── Account Creation step — last gate before cinematic Genesis ───────────
const AccountCreationStep = ({ pick, defaultEmail = '', onSubmit, submitting, error }) => {
  const c = onboardingContent.account;
  const [form, setForm] = useState({ first_name: '', last_name: '', email: defaultEmail, password: '' });
  const [localError, setLocalError] = useState('');

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const submit = (e) => {
    e?.preventDefault?.();
    setLocalError('');
    if (!form.first_name.trim()) return setLocalError(pick(c.fields.firstName));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setLocalError(pick(c.errorEmail));
    if (form.password.length < 8) return setLocalError(pick(c.errorPasswordShort));
    onSubmit(form);
  };

  return (
    <form data-testid="wiz-account" onSubmit={submit}>
      <StepHeading
        eyebrow={pick(c.eyebrow, 'onboarding.account.eyebrow')}
        title={pick(c.title, 'onboarding.account.title')}
        body={pick(c.body, 'onboarding.account.body')}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginTop: '1.5rem', maxWidth: '32rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <span style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--site-ink-2)' }}>{pick(c.fields.firstName)}</span>
          <input value={form.first_name} onChange={set('first_name')} autoFocus
                 className="mfd-wiz-input" data-testid="wiz-account-firstname" required
                 style={{ padding: '0.7rem 0', borderBottom: '1px solid var(--site-line)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--site-line)', fontSize: '1rem', color: 'var(--site-ink-1)', outline: 'none' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <span style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--site-ink-2)' }}>{pick(c.fields.lastName)}</span>
          <input value={form.last_name} onChange={set('last_name')}
                 className="mfd-wiz-input" data-testid="wiz-account-lastname"
                 style={{ padding: '0.7rem 0', borderBottom: '1px solid var(--site-line)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--site-line)', fontSize: '1rem', color: 'var(--site-ink-1)', outline: 'none' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', gridColumn: 'span 2' }}>
          <span style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--site-ink-2)' }}>{pick(c.fields.email)}</span>
          <input type="email" value={form.email} onChange={set('email')}
                 className="mfd-wiz-input" data-testid="wiz-account-email" required
                 style={{ padding: '0.7rem 0', borderBottom: '1px solid var(--site-line)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--site-line)', fontSize: '1rem', color: 'var(--site-ink-1)', outline: 'none' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', gridColumn: 'span 2' }}>
          <span style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--site-ink-2)' }}>{pick(c.fields.password)}</span>
          <input type="password" value={form.password} onChange={set('password')}
                 className="mfd-wiz-input" data-testid="wiz-account-password" required minLength={8}
                 style={{ padding: '0.7rem 0', borderBottom: '1px solid var(--site-line)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--site-line)', fontSize: '1rem', color: 'var(--site-ink-1)', outline: 'none' }} />
        </label>
      </div>
      {(localError || error) && (
        <p data-testid="wiz-account-error" style={{ marginTop: '1rem', color: '#A33', fontSize: 13 }}>{localError || error}</p>
      )}
      <p style={{ marginTop: '1rem', fontSize: 11, color: 'var(--site-ink-3)', letterSpacing: '0.04em', maxWidth: '32rem' }}>{pick(c.consent)}</p>
      <button type="submit" disabled={submitting} className="mfd-wiz__cta"
              style={{ marginTop: '1.5rem' }}
              data-testid="wiz-account-submit">
        {submitting
          ? '…'
          : (<>{pick(c.submit)} <ArrowRight size={14} style={{ marginLeft: 8, verticalAlign: -2 }} /></>)}
      </button>
    </form>
  );
};

// ──────────────────────────────────────────────────────────────────────
// Main wizard
// ──────────────────────────────────────────────────────────────────────
const StartProjectWizardInner = () => {
  const { pick, locale } = useSite();
  const navigate = useNavigate();
  const [state, setState] = useState(loadState);

  // Cinematic transition state
  const [phase, setPhase] = useState('wizard'); // 'wizard' | 'account' | 'genesis'
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [genesis, setGenesis] = useState(null);
  const [genesisComplete, setGenesisComplete] = useState(false);
  const [aiBriefing, setAiBriefing] = useState(null);

  useEffect(() => { document.title = pick(onboardingContent.meta.title, 'onboarding.meta.title'); }, [pick]);
  useEffect(() => { saveState(state); }, [state]);

  // Adaptive flow: list of step nodes visible given current answers.
  const flow = useMemo(() => visibleSteps(state), [state]);
  const totalDots = flow.length;
  const currentDot = Math.min(state.step, totalDots);
  const currentNodeIdx = indexOfStepId(state, state.step);

  const update = useCallback((patch) => setState((s) => ({ ...s, ...patch })), []);
  const toggleArr = useCallback((key, id) => setState((s) => ({ ...s, [key]: s[key].includes(id) ? s[key].filter((x) => x !== id) : [...s[key], id] })), []);

  // When the user changes project_type, drop any previously selected spaces
  // that don't belong to the new category — guarantees an Office user never
  // ships a "Bedroom" answer to the studio.
  const setProjectType = useCallback((newType) => {
    setState((s) => {
      if (s.project_type === newType) return s;
      const newCat = categoryFor(newType);
      const oldCat = categoryFor(s.project_type);
      if (newCat === oldCat && s.project_type != null) {
        return { ...s, project_type: newType };
      }
      // Category changed — reset category-dependent answers (preserve everything else)
      return { ...s, project_type: newType, spaces: [] };
    });
  }, []);

  // Adaptive step-2 + step-6 content based on current category
  const step2Content = useMemo(() => resolveStep2Content(state, locale), [state, locale]);
  const step6Content = useMemo(() => resolveStep6Content(state, locale), [state, locale]);

  const counterText = useMemo(() => {
    const tpl = pick(onboardingContent.meta.eyebrow, 'onboarding.meta.eyebrow');
    return tpl.replace('{n}', String(currentDot)).replace('{total}', String(totalDots));
  }, [currentDot, totalDots, pick]);

  const canContinue = useMemo(
    () => isStepRequiredMet(state, state.step),
    [state],
  );

  const handleNext = () => {
    const nextNode = flow[currentNodeIdx + 1];
    if (nextNode) {
      update({ step: nextNode.id });
    } else {
      // submit → mark final state
      update({ step: 9999, created_at: new Date().toISOString(), locale });
    }
  };
  const handleBack = () => {
    const prevNode = flow[currentNodeIdx - 1];
    if (prevNode) update({ step: prevNode.id });
  };
  const handleExit = () => navigate('/');

  // Build final payload (DB-ready shape)
  const payload = useMemo(() => ({
    project_type: state.project_type,
    project_category: categoryFor(state.project_type),
    spaces: state.spaces,
    moods: state.moods,
    inspirations: {
      uploads: state.inspirations.uploads,
      pinterest: state.inspirations.pinterest,
      links: state.inspirations.links,
    },
    materials: state.materials,
    colors: state.colors,
    lifestyle_answers: state.lifestyle,
    budget: state.budget.amount,
    timeline: state.budget.timeline,
    start_date: state.budget.startDate,
    notes: state.budget.notes,
    locale: state.locale || locale,
    tenant: null,
    created_at: state.created_at,
    briefing_shape: buildBriefingShape(state, state.locale || locale),
  }), [state, locale]);

  const handleCreate = () => {
    // Move from FinalReady summary → AccountCreationStep (still inside the wizard chrome)
    setPhase('account');
  };

  const submitOnboarding = async (form) => {
    setSubmitError('');
    setSubmitting(true);
    try {
      const r = await axios.post(`${BACKEND_URL}/api/onboarding/private/submit`, {
        first_name: form.first_name,
        last_name:  form.last_name || null,
        email:      form.email,
        password:   form.password,
        locale:     state.locale || locale,
        payload:    { ...payload, ai_briefing: aiBriefing || null },
      });
      const { session, user, genesis: g } = r.data || {};
      if (session?.access_token) {
        // Persist session so the redirected page is authenticated
        const sessionStore = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          token_type: 'bearer',
        };
        try { localStorage.setItem(SESSION_KEY, JSON.stringify(sessionStore)); } catch (_) {}
      }
      setGenesis(g);
      setPhase('genesis');
      // Clear local wizard state on success
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      // After the cinematic narrative cycles through its messages, mark complete
      const narrativeCount = (g?.narrative?.length || 4);
      // Each message stays ~1.6s; let it cycle through then show the final pulse
      setTimeout(() => setGenesisComplete(true), Math.max(1600 * (narrativeCount - 1), 2400));
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 409) {
        setSubmitError(pick(onboardingContent.account.errorEmailExists));
      } else {
        setSubmitError(detail || pick(onboardingContent.account.errorGeneric));
      }
      setSubmitting(false);
    }
  };

  const enterWorkspace = () => {
    const projectId = genesis?.project_id;
    if (projectId) {
      // Authenticated workspace route — NOT the public /projects/:slug
      window.location.assign(`/workspace/projects/${projectId}`);
    } else {
      window.location.assign('/workspace/projects');
    }
  };

  // ── Cinematic Genesis phase ───────────────────────────────────────────────
  if (phase === 'genesis') {
    return (
      <BlueprintGenesisOverlay
        narrative={genesis?.narrative || ['Building your Blueprint…', 'Your Blueprint is ready.']}
        complete={genesisComplete}
        finalLabel={genesis?.narrative?.[(genesis?.narrative?.length || 1) - 1]}
        onContinue={enterWorkspace}
      />
    );
  }

  return (
    <div className="mfd-site mfd-wiz" data-testid="start-project-wizard">
      <Chrome
        step={state.step}
        counterText={state.step <= 7 ? counterText : pick(onboardingContent.final.eyebrow, 'onboarding.final.eyebrow')}
        exitConfirmText={pick(onboardingContent.meta.exitConfirm, 'onboarding.meta.exitConfirm')}
        onExit={handleExit}
        percent={progressPercent(state, state.step)}
        totalDots={totalDots}
        currentDot={currentDot}
      />

      <main className="mfd-wiz__body">
        <section className="mfd-wiz__step" key={state.step}>
          {state.step === 1 && (
            <Step1ProjectType value={state.project_type} onChange={setProjectType} pick={pick} />
          )}
          {state.step === 2 && (
            <Step2Spaces value={state.spaces} onToggle={(id) => toggleArr('spaces', id)} pick={pick} contentOverride={step2Content} />
          )}
          {state.step === 3 && (
            <Step3Mood value={state.moods} onToggle={(id) => toggleArr('moods', id)} pick={pick} />
          )}
          {state.step === 4 && (
            <Step4Inspirations value={state.inspirations} onChange={(v) => update({ inspirations: v })} pick={pick} />
          )}
          {state.step === 5 && (
            <Step5Materials
              materials={state.materials}
              colors={state.colors}
              onToggleMaterial={(id) => toggleArr('materials', id)}
              onToggleColor={(id) => toggleArr('colors', id)}
              pick={pick}
            />
          )}
          {state.step === 6 && (
            <Step6Lifestyle value={state.lifestyle} onChange={(v) => update({ lifestyle: v })} pick={pick} contentOverride={step6Content} />
          )}
          {state.step === 7 && (
            <Step7Budget value={state.budget} onChange={(v) => update({ budget: v })} pick={pick} />
          )}
          {state.step > 7 && phase === 'wizard' && (
            <FinalReady pick={pick} payload={payload} onCreate={handleCreate} onBriefingReady={setAiBriefing} />
          )}
          {phase === 'account' && (
            <AccountCreationStep
              pick={pick}
              defaultEmail=""
              onSubmit={submitOnboarding}
              submitting={submitting}
              error={submitError}
            />
          )}

          {state.step <= 7 && (
            <footer className="mfd-wiz__footer">
              {currentNodeIdx > 0 ? (
                <button type="button" className="mfd-wiz__back" onClick={handleBack} data-testid="wiz-back">
                  <ArrowLeft size={14} strokeWidth={1.6} /> {pick(onboardingContent.meta.backStep, 'onboarding.meta.backStep')}
                </button>
              ) : <span />}

              <span className="mfd-wiz__saved" data-testid="wiz-saved-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.55 }}>
                <Bookmark size={11} strokeWidth={1.5} />
                {pick(
                  {
                    it: 'Il tuo percorso è salvato',
                    en: 'Your journey is saved',
                    fr: 'Votre parcours est sauvegardé',
                    de: 'Ihr Weg ist gespeichert',
                    es: 'Tu camino está guardado',
                  },
                  'onboarding.meta.savedHint',
                )}
              </span>

              <button
                type="button"
                className="mfd-wiz__cta"
                disabled={!canContinue}
                onClick={handleNext}
                data-testid="wiz-continue"
              >
                {currentNodeIdx < flow.length - 1
                  ? pick(onboardingContent.meta.continue, 'onboarding.meta.continue')
                  : pick(onboardingContent.meta.submit, 'onboarding.meta.submit')}
              </button>
            </footer>
          )}
        </section>
      </main>
    </div>
  );
};

const StartProjectWizard = () => (
  <SiteProvider>
    <StartProjectWizardInner />
  </SiteProvider>
);

export default StartProjectWizard;
