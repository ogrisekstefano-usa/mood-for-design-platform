import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Plus, X, FileText } from 'lucide-react';
import { SiteProvider, useSite } from '../../site/SiteContext';
import { professionalsContent } from '../../site/content/professionals';
import { navigationContent } from '../../site/content/navigation';
import { publicLanguages } from '../../site/content/languages';
import '../../site/site.css';

const STORAGE_KEY = 'mfd_professional_intake_state';
const TOTAL = 5;
const initialState = {
  step: 1,
  intent: [],
  project: { projectName: '', location: '', type: '', timeline: '', budget: '' },
  references: { active: 'upload', uploads: [], links: [] },
  pro: { company: '', role: '', email: '', website: '', instagram: '', phone: '', country: '', language: '' },
  locale: null, created_at: null,
};
const loadState = () => { try { const r = localStorage.getItem(STORAGE_KEY); if (r) return { ...initialState, ...JSON.parse(r) }; } catch (_) {} return initialState; };
const saveState = (s) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_) {} };

const Heading = ({ eyebrow, title, body }) => (
  <header className="mfd-wiz__heading">
    <span className="mfd-eyebrow mfd-eyebrow--accent">{eyebrow}</span>
    <h1 className="mfd-wiz__title">{title}</h1>
    {body && <p className="mfd-wiz__sub">{body}</p>}
  </header>
);

const Step1Intent = ({ value, onToggle, pick }) => {
  const c = professionalsContent.intake.step1;
  return (
    <>
      <Heading eyebrow={pick(c.eyebrow, 'professionals.intake.step1.eyebrow')} title={pick(c.title, 'professionals.intake.step1.title')} body={pick(c.body, 'professionals.intake.step1.body')} />
      <div className="mfd-wiz-checks" data-testid="pro-step1" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', display: 'grid', gap: '0.65rem' }}>
        {c.options.map((opt) => {
          const on = value.includes(opt.id);
          return (
            <button key={opt.id} type="button" className="mfd-wiz-check" data-on={on} onClick={() => onToggle(opt.id)} data-testid={`pro-step1-${opt.id}`}>
              <span className="mfd-wiz-check__box">{on && <Check size={12} strokeWidth={2.5} />}</span>
              <span>{pick(opt.label, `professionals.intake.step1.options.${opt.id}`)}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};

const TextField = ({ id, label, placeholder, value, onChange, type = 'text', testid }) => (
  <div className="mfd-wiz-field">
    <label htmlFor={id}>{label}</label>
    <input id={id} type={type} className="mfd-wiz-input" placeholder={placeholder} value={value || ''} onChange={(e) => onChange(e.target.value)} data-testid={testid} />
  </div>
);

const Step2Project = ({ value, onChange, pick }) => {
  const c = professionalsContent.intake.step2;
  const f = c.fields;
  return (
    <>
      <Heading eyebrow={pick(c.eyebrow, 'professionals.intake.step2.eyebrow')} title={pick(c.title, 'professionals.intake.step2.title')} body={pick(c.body, 'professionals.intake.step2.body')} />
      <div className="mfd-wiz-fields" data-testid="pro-step2" style={{ maxWidth: 720 }}>
        <TextField id="proj-name"     testid="pro-step2-projectName" label={pick(f.projectName.label, 'professionals.intake.step2.fields.projectName.label')} placeholder={pick(f.projectName.placeholder)} value={value.projectName} onChange={(v) => onChange({ ...value, projectName: v })} />
        <TextField id="proj-location" testid="pro-step2-location"    label={pick(f.location.label,    'professionals.intake.step2.fields.location.label')}    placeholder={pick(f.location.placeholder)}    value={value.location}    onChange={(v) => onChange({ ...value, location: v })} />
        <div className="mfd-wiz-field">
          <label htmlFor="proj-type">{pick(f.type.label, 'professionals.intake.step2.fields.type.label')}</label>
          <select id="proj-type" className="mfd-wiz-select" value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value })} data-testid="pro-step2-type">
            <option value="">{pick(f.type.placeholder)}</option>
            {f.type.options.map((o) => <option key={o.id} value={o.id}>{pick(o.label)}</option>)}
          </select>
        </div>
        <div className="mfd-wiz-field">
          <label htmlFor="proj-timeline">{pick(f.timeline.label, 'professionals.intake.step2.fields.timeline.label')}</label>
          <select id="proj-timeline" className="mfd-wiz-select" value={value.timeline} onChange={(e) => onChange({ ...value, timeline: e.target.value })} data-testid="pro-step2-timeline">
            <option value="">{pick(f.timeline.placeholder)}</option>
            {f.timeline.options.map((o) => <option key={o.id} value={o.id}>{pick(o.label)}</option>)}
          </select>
        </div>
        <div className="mfd-wiz-field">
          <label htmlFor="proj-budget">{pick(f.budget.label, 'professionals.intake.step2.fields.budget.label')}</label>
          <select id="proj-budget" className="mfd-wiz-select" value={value.budget} onChange={(e) => onChange({ ...value, budget: e.target.value })} data-testid="pro-step2-budget">
            <option value="">{pick(f.budget.placeholder)}</option>
            {f.budget.options.map((o) => <option key={o.id} value={o.id}>{pick(o.label)}</option>)}
          </select>
        </div>
      </div>
    </>
  );
};

const Step3References = ({ value, onChange, pick }) => {
  const c = professionalsContent.intake.step3;
  const tab = value.active;
  const setTab = (t) => onChange({ ...value, active: t });
  const [linkInput, setLinkInput] = useState('');
  const handleUpload = (e) => {
    const files = Array.from(e.target.files || []);
    onChange({ ...value, uploads: [...value.uploads, ...files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }))] });
  };
  const removeUpload = (i) => onChange({ ...value, uploads: value.uploads.filter((_, idx) => idx !== i) });
  const removeLink = (i) => onChange({ ...value, links: value.links.filter((_, idx) => idx !== i) });
  const addLink = () => { if (!linkInput.trim()) return; onChange({ ...value, links: [...value.links, linkInput.trim()] }); setLinkInput(''); };
  const items = tab === 'upload' ? value.uploads : value.links;

  return (
    <>
      <Heading eyebrow={pick(c.eyebrow, 'professionals.intake.step3.eyebrow')} title={pick(c.title, 'professionals.intake.step3.title')} body={pick(c.body, 'professionals.intake.step3.body')} />
      <div className="mfd-wiz-tabs" role="tablist" data-testid="pro-step3-tabs">
        {c.tabs.map((tb) => (
          <button key={tb.id} type="button" className="mfd-wiz-tabs__btn" aria-selected={tab === tb.id} onClick={() => setTab(tb.id)} data-testid={`pro-step3-tab-${tb.id}`}>
            {pick(tb.label)}
          </button>
        ))}
      </div>
      {tab === 'link' && (
        <div className="mfd-wiz-link-row">
          <input type="url" className="mfd-wiz-input" placeholder={pick(c.placeholder, 'professionals.intake.step3.placeholder')} value={linkInput} onChange={(e) => setLinkInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLink()} data-testid="pro-step3-link-input" />
          <button type="button" className="mfd-wiz__cta" onClick={addLink} data-testid="pro-step3-link-add">{pick(c.addMore)}</button>
        </div>
      )}
      <div className="mfd-wiz-board" data-testid="pro-step3-board">
        {items.length === 0 && tab !== 'upload' && (
          <div className="mfd-wiz-board__cell mfd-wiz-board__add">{pick(c.empty)}</div>
        )}
        {tab === 'upload' && value.uploads.map((u, i) => (
          <div key={i} className="mfd-wiz-board__cell">
            {/\.(jpe?g|png|webp|gif|avif)$/i.test(u.name) ? (
              <img src={u.url} alt={u.name} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, padding: '0.85rem', display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--site-ink-2)', fontFamily: 'var(--site-sans)', fontSize: 11 }}>
                <FileText size={24} strokeWidth={1.4} />
                <span style={{ marginTop: 8, wordBreak: 'break-all' }}>{u.name}</span>
              </div>
            )}
            <button type="button" className="mfd-wiz-board__remove" onClick={() => removeUpload(i)} aria-label="Remove"><X size={12} /></button>
          </div>
        ))}
        {tab === 'link' && value.links.map((l, i) => (
          <div key={i} className="mfd-wiz-board__cell">
            <div style={{ position: 'absolute', inset: 0, padding: '0.85rem', display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--site-ink-2)', fontFamily: 'var(--site-sans)', fontSize: 11, wordBreak: 'break-all' }}>{l}</div>
            <button type="button" className="mfd-wiz-board__remove" onClick={() => removeLink(i)} aria-label="Remove"><X size={12} /></button>
          </div>
        ))}
        {tab === 'upload' && (
          <label className="mfd-wiz-board__cell mfd-wiz-board__add" data-testid="pro-step3-upload-add">
            <input type="file" accept="image/*,application/pdf" multiple onChange={handleUpload} />
            <Plus size={20} strokeWidth={1.4} />
            <span style={{ marginTop: 6 }}>{pick(c.addMore)}</span>
          </label>
        )}
      </div>
    </>
  );
};

const Step4ProDetails = ({ value, onChange, pick }) => {
  const c = professionalsContent.intake.step4;
  const f = c.fields;
  const langs = publicLanguages();
  return (
    <>
      <Heading eyebrow={pick(c.eyebrow)} title={pick(c.title)} body={pick(c.body)} />
      <div className="mfd-wiz-fields" data-testid="pro-step4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', display: 'grid', gap: '1.25rem', maxWidth: 1080 }}>
        <TextField id="pro-company"   testid="pro-step4-company"   label={pick(f.company.label)}   placeholder={pick(f.company.placeholder)}   value={value.company}   onChange={(v) => onChange({ ...value, company: v })} />
        <TextField id="pro-role"      testid="pro-step4-role"      label={pick(f.role.label)}      placeholder={pick(f.role.placeholder)}      value={value.role}      onChange={(v) => onChange({ ...value, role: v })} />
        <TextField id="pro-email"     testid="pro-step4-email"     label={pick(f.email.label)}     placeholder={pick(f.email.placeholder)}     value={value.email}     onChange={(v) => onChange({ ...value, email: v })} type="email" />
        <TextField id="pro-website"   testid="pro-step4-website"   label={pick(f.website.label)}   placeholder={pick(f.website.placeholder)}   value={value.website}   onChange={(v) => onChange({ ...value, website: v })} type="url" />
        <TextField id="pro-instagram" testid="pro-step4-instagram" label={pick(f.instagram.label)} placeholder={pick(f.instagram.placeholder)} value={value.instagram} onChange={(v) => onChange({ ...value, instagram: v })} />
        <TextField id="pro-phone"     testid="pro-step4-phone"     label={pick(f.phone.label)}     placeholder={pick(f.phone.placeholder)}     value={value.phone}     onChange={(v) => onChange({ ...value, phone: v })} type="tel" />
        <TextField id="pro-country"   testid="pro-step4-country"   label={pick(f.country.label)}   placeholder={pick(f.country.placeholder)}   value={value.country}   onChange={(v) => onChange({ ...value, country: v })} />
        <div className="mfd-wiz-field">
          <label htmlFor="pro-language">{pick(f.language.label)}</label>
          <select id="pro-language" className="mfd-wiz-select" value={value.language} onChange={(e) => onChange({ ...value, language: e.target.value })} data-testid="pro-step4-language">
            <option value="">{pick(f.language.placeholder)}</option>
            {langs.map((l) => <option key={l.code} value={l.code}>{l.native_name}</option>)}
          </select>
        </div>
      </div>
    </>
  );
};

const Step5Confirmation = ({ state, payload, pick, onContinue }) => {
  const c = professionalsContent.intake.step5;
  return (
    <div data-testid="pro-step5">
      <Heading eyebrow={pick(c.eyebrow)} title={pick(c.title)} body={pick(c.body)} />
      <div className="mfd-wiz-summary" data-testid="pro-step5-summary">
        <div className="mfd-wiz-summary__row">
          <div>
            <p className="mfd-wiz-summary__title">{pick(c.sectionLabels.intent)}</p>
            <p className="mfd-wiz-summary__body">{state.intent.length > 0 ? state.intent.join(' · ') : '\u2014'}</p>
          </div>
        </div>
        <div className="mfd-wiz-summary__row">
          <div>
            <p className="mfd-wiz-summary__title">{pick(c.sectionLabels.project)}</p>
            <p className="mfd-wiz-summary__body">{[state.project.projectName, state.project.location, state.project.type].filter(Boolean).join(' · ') || '\u2014'}</p>
          </div>
        </div>
        <div className="mfd-wiz-summary__row">
          <div>
            <p className="mfd-wiz-summary__title">{pick(c.sectionLabels.materials)}</p>
            <p className="mfd-wiz-summary__body">{state.references.uploads.length} files · {state.references.links.length} links</p>
          </div>
        </div>
        <div className="mfd-wiz-summary__row">
          <div>
            <p className="mfd-wiz-summary__title">{pick(c.sectionLabels.next)}</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0.4rem 0 0 0', display: 'grid', gap: '0.35rem', color: 'var(--site-ink-3)', fontSize: 13 }}>
              {c.nextSteps.map((s, i) => <li key={i}>· {pick(s)}</li>)}
            </ul>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', marginTop: '1.5rem' }}>
        <button type="button" className="mfd-wiz__cta" onClick={onContinue} data-testid="pro-step5-continue">
          {pick(c.ctaPrimary)} <ArrowRight size={14} style={{ marginLeft: 8, verticalAlign: -2 }} />
        </button>
        <button type="button" className="mfd-btn" onClick={onContinue} data-testid="pro-step5-request" style={{ padding: '1.05rem 2.1rem' }}>
          {pick(c.ctaSecondary)} <ArrowRight size={14} />
        </button>
      </div>
      <pre data-testid="pro-final-payload" style={{ display: 'none' }}>{JSON.stringify(payload, null, 2)}</pre>
    </div>
  );
};

const ProgressDots = ({ step, total }) => (
  <div className="mfd-wiz__progress" data-testid="pro-progress">
    {Array.from({ length: total }).map((_, i) => (
      <span key={i} className={`mfd-wiz__progress-dot ${i + 1 === step ? 'is-active' : i + 1 < step ? 'is-done' : ''}`} />
    ))}
  </div>
);

const ProfessionalIntakeInner = () => {
  const { pick, locale } = useSite();
  const navigate = useNavigate();
  const [state, setState] = useState(loadState);
  const m = professionalsContent.intake.meta;

  useEffect(() => { document.title = pick(professionalsContent.meta.title, 'professionals.meta.title'); }, [pick]);
  useEffect(() => { saveState(state); }, [state]);

  const update = useCallback((patch) => setState((s) => ({ ...s, ...patch })), []);
  const toggleArr = useCallback((key, id) => setState((s) => ({ ...s, [key]: s[key].includes(id) ? s[key].filter((x) => x !== id) : [...s[key], id] })), []);

  const counterText = useMemo(() => pick(m.eyebrow).replace('{n}', String(state.step)).replace('{total}', String(TOTAL)), [state.step, pick, m.eyebrow]);

  const canContinue = useMemo(() => {
    switch (state.step) {
      case 1: return state.intent.length > 0;
      case 2: return !!state.project.projectName && !!state.project.location && !!state.project.type;
      case 3: return true;
      case 4: return !!state.pro.company && !!state.pro.email;
      case 5: return true;
      default: return true;
    }
  }, [state]);

  const handleNext = () => {
    if (state.step < TOTAL) update({ step: state.step + 1 });
  };
  const handleBack = () => state.step > 1 && update({ step: state.step - 1 });
  const handleExit = () => navigate('/professionals');
  const payload = useMemo(() => ({
    flow: 'professional',
    intent: state.intent,
    project: state.project,
    references: { uploads: state.references.uploads.map((u) => u.name), links: state.references.links },
    professional: state.pro,
    locale: state.locale || locale,
    tenant: null,
    created_at: state.created_at || new Date().toISOString(),
  }), [state, locale]);
  const handleSubmit = () => {
    try { localStorage.setItem('mfd_pending_pro_payload', JSON.stringify(payload)); } catch (_) {}
    navigate('/auth/login');
  };

  return (
    <div className="mfd-site mfd-wiz" data-testid="pro-intake">
      <div className="mfd-wiz__chrome" data-testid="pro-chrome">
        <Link to="/professionals" className="mfd-wiz__brand">
          <img src={navigationContent.brand.logoSrc} alt="MOOD for DESIGN" />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <span className="mfd-wiz__step-counter" data-testid="pro-counter">{counterText}</span>
          <ProgressDots step={state.step} total={TOTAL} />
        </div>
        <button type="button" className="mfd-wiz__exit" onClick={() => { if (window.confirm(pick(m.exitConfirm))) handleExit(); }} data-testid="pro-exit">
          <X size={12} style={{ marginRight: 4, verticalAlign: -1 }} /> Exit
        </button>
      </div>

      <main className="mfd-wiz__body">
        <section className="mfd-wiz__step" key={state.step}>
          {state.step === 1 && <Step1Intent value={state.intent} onToggle={(id) => toggleArr('intent', id)} pick={pick} />}
          {state.step === 2 && <Step2Project value={state.project} onChange={(v) => update({ project: v })} pick={pick} />}
          {state.step === 3 && <Step3References value={state.references} onChange={(v) => update({ references: v })} pick={pick} />}
          {state.step === 4 && <Step4ProDetails value={state.pro} onChange={(v) => update({ pro: v })} pick={pick} />}
          {state.step === 5 && <Step5Confirmation state={state} payload={payload} pick={pick} onContinue={handleSubmit} />}

          {state.step < 5 && (
            <footer className="mfd-wiz__footer">
              {state.step > 1 ? (
                <button type="button" className="mfd-wiz__back" onClick={handleBack} data-testid="pro-back">
                  <ArrowLeft size={14} strokeWidth={1.6} /> {pick(m.back)}
                </button>
              ) : <span />}
              <button type="button" className="mfd-wiz__cta" disabled={!canContinue} onClick={handleNext} data-testid="pro-continue">
                {state.step < 4 ? pick(m.continue) : pick(m.submit)}
              </button>
            </footer>
          )}
        </section>
      </main>
    </div>
  );
};

const ProfessionalIntakePage = () => (
  <SiteProvider>
    <ProfessionalIntakeInner />
  </SiteProvider>
);

export default ProfessionalIntakePage;
