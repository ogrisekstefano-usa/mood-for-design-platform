/**
 * BeginJourneyPage · Sprint G.2 + ITER143A+ Dynamic Editorial Runtime™
 * "Inizia il tuo Design Journey™" — rituale di accoglienza in 3 passi.
 *
 * ZERO HARDCODED CONTENT POLICY:
 * Tutti i testi visibili sono caricati dal Dynamic Editorial Runtime™
 * (page_key='begin-journey') prima del primo paint. Se una traduzione
 * manca, il sistema rende uno skeleton; MAI un foreign-language leak.
 */
import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import '../../styles/begin-journey.css';
import '../site/home-iter150.css';
import MoodSiteHeader from '../../site/components/MoodSiteHeader';
import {
  EditorialBundleProvider,
  useEditorialBundle,
} from '../../site/editorial/EditorialBundleProvider';

const API = process.env.REACT_APP_BACKEND_URL;
const NS = 'site.begin_journey';
const k = (suffix) => `${NS}.${suffix}`;

const BeginJourneyForm = () => {
  const { get, ready } = useEditorialBundle();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [spaceKinds, setSpaceKinds] = useState([]);
  const [howToFeel, setHowToFeel] = useState('');
  const [refs, setRefs] = useState('');
  const [guests, setGuests] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [ambiance, setAmbiance] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Editorial taxonomy built from the dynamic bundle.
  const taxonomy = useMemo(() => ({
    SPACE_KINDS: [
      { v: 'home',         l: get(k('chip.space.home')) },
      { v: 'showroom',     l: get(k('chip.space.showroom')) },
      { v: 'hospitality',  l: get(k('chip.space.hospitality')) },
      { v: 'office',       l: get(k('chip.space.office')) },
      { v: 'other',        l: get(k('chip.space.other')) },
    ],
    GUESTS: [
      { v: 'often',     l: get(k('chip.guests.often')) },
      { v: 'sometimes', l: get(k('chip.guests.sometimes')) },
      { v: 'rarely',    l: get(k('chip.guests.rarely')) },
      { v: 'alone',     l: get(k('chip.guests.alone')) },
    ],
    MATERIALS: [
      { v: 'wood',     l: get(k('chip.material.wood')) },
      { v: 'stone',    l: get(k('chip.material.stone')) },
      { v: 'textiles', l: get(k('chip.material.textiles')) },
      { v: 'metals',   l: get(k('chip.material.metals')) },
      { v: 'glass',    l: get(k('chip.material.glass')) },
      { v: 'velvet',   l: get(k('chip.material.velvet')) },
      { v: 'marble',   l: get(k('chip.material.marble')) },
      { v: 'linen',    l: get(k('chip.material.linen')) },
    ],
    AMBIANCE: [
      { v: 'warm_enveloping',  l: get(k('chip.ambiance.warm_enveloping')) },
      { v: 'sober_minimal',    l: get(k('chip.ambiance.sober_minimal')) },
      { v: 'luminous_airy',    l: get(k('chip.ambiance.luminous_airy')) },
      { v: 'tactile_sensory',  l: get(k('chip.ambiance.tactile_sensory')) },
      { v: 'cinematic',        l: get(k('chip.ambiance.cinematic')) },
    ],
    STEPS: [
      { idx: 0, eyebrow: get(k('step1.eyebrow')), marker: 'I',
        short: get(k('step1.short')) },
      { idx: 1, eyebrow: get(k('step2.eyebrow')), marker: 'II',
        short: get(k('step2.short')) },
      { idx: 2, eyebrow: get(k('step3.eyebrow')), marker: 'III',
        short: get(k('step3.short')) },
    ],
  }), [get]);

  const { SPACE_KINDS, GUESTS, MATERIALS, AMBIANCE, STEPS } = taxonomy;
  const toggle = (arr, v, setter) =>
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const step1Has = spaceKinds.length || howToFeel.trim() || refs.trim();
  const step2Has = guests || materials.length || ambiance;
  const step3Valid = firstName.trim().length >= 1 && /.+@.+\..+/.test(email);

  const submit = async () => {
    if (!step3Valid) {
      toast(get(k('toast.required')));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        atmosphere: {
          space_kinds: spaceKinds,
          how_to_feel: howToFeel.trim(),
          references: refs.trim(),
        },
        lifestyle: {
          guests,
          materials,
          ambiance,
        },
        welcome: {
          first_name: firstName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
        },
      };
      const r = await axios.post(`${API}/api/public/journeys/initiate`, payload);
      const magicLink = r.data?.magic_link_url;
      const welcomeUrl = r.data?.welcome_url;
      // ITER161 · P0.2 · Magic-link first.
      // Il cliente entra SUBITO nel Client Profile. Niente più pagina
      // magic link manuale come schermo principale. L'email backup
      // viene comunque inviata dal backend.
      if (magicLink) {
        // window.location preserva il fragment con i token Supabase quando
        // il link viene seguito; restiamo sullo stesso origin nel preview env.
        window.location.assign(magicLink);
        return;
      }
      // Caso degradato (Supabase admin API indisponibile): fallback al
      // welcome token così non perdiamo il cliente.
      if (welcomeUrl) { navigate(welcomeUrl); return; }
      toast(get(k('toast.started')));
    } catch (e) {
      console.error(e);
      toast(get(k('toast.failed')));
      setSubmitting(false);
    }
  };
  const meta = useMemo(() => STEPS[step], [STEPS, step]);

  // Pre-paint gate: hold first render until the bundle is ready, so users
  // never see a flash of IT before the right locale arrives.
  if (!ready) {
    return (
      <>
        <MoodSiteHeader locale="it" />
        <div className="bj-shell bj-shell--embedded" data-testid="begin-journey-page" aria-busy="true">
          <div className="bj-overlay" data-editorial-skeleton="true" />
        </div>
      </>
    );
  }

  return (
    <>
      <MoodSiteHeader locale="it" />
      <div className="bj-shell bj-shell--embedded" data-testid="begin-journey-page">
      {submitting && (
        <div className="bj-overlay" data-testid="bj-overlay">
          <div className="bj-overlay__text">{get(k('overlay.opening'))}</div>
        </div>
      )}

      <div className="bj-container">
        {/* LEFT RAIL */}
        <aside className="bj-rail">
          <div className="bj-rail__brand">
            MOOD
            <small>Design Journey™</small>
          </div>
          {STEPS.map((s) => (
            <div
              key={s.idx}
              className={
                'bj-rail__step ' +
                (s.idx === step ? 'bj-rail__step--active' : '') +
                (s.idx < step ? 'bj-rail__step--done' : '')
              }
              data-testid={`bj-rail-step-${s.idx}`}
            >
              <span className="bj-rail__step-marker">{s.marker}</span>
              <span>{s.short}</span>
            </div>
          ))}
        </aside>

        {/* STAGE */}
        <main className="bj-stage" key={step}>
          <div className="bj-eyebrow" data-testid="bj-eyebrow">{meta.eyebrow}</div>

          {step === 0 && (
            <>
              <h1 className="bj-title" data-testid="bj-step1-title">
                {get(k('step1.title'))}
              </h1>
              <p className="bj-subtitle">{get(k('step1.subtitle'))}</p>

              <div className="bj-field">
                <label className="bj-field__label">
                  {get(k('step1.field.space.label'))}
                </label>
                <div className="bj-chips" data-testid="bj-space-kinds">
                  {SPACE_KINDS.map((s) => (
                    <button
                      key={s.v}
                      type="button"
                      className={
                        'bj-chip ' +
                        (spaceKinds.includes(s.v) ? 'bj-chip--active' : '')
                      }
                      onClick={() => toggle(spaceKinds, s.v, setSpaceKinds)}
                      data-testid={`bj-space-${s.v}`}
                    >
                      {s.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bj-field">
                <label className="bj-field__label">
                  {get(k('step1.field.how_to_feel.label'))}
                </label>
                <textarea
                  className="bj-textarea"
                  placeholder={get(k('step1.field.how_to_feel.placeholder'))}
                  value={howToFeel}
                  onChange={(e) => setHowToFeel(e.target.value)}
                  data-testid="bj-how-to-feel"
                />
              </div>

              <div className="bj-field">
                <label className="bj-field__label">
                  {get(k('step1.field.references.label'))}
                </label>
                <textarea
                  className="bj-textarea"
                  placeholder={get(k('step1.field.references.placeholder'))}
                  value={refs}
                  onChange={(e) => setRefs(e.target.value)}
                  data-testid="bj-references"
                />
                <span className="bj-field__hint">
                  {get(k('step1.field.references.hint'))}
                </span>
              </div>

              <div className="bj-actions">
                <button
                  className="bj-btn bj-btn--primary"
                  disabled={!step1Has}
                  onClick={() => setStep(1)}
                  data-testid="bj-step1-next"
                >
                  {get(k('step1.cta.next'))}
                </button>
                {!step1Has && (
                  <span className="bj-microcopy">{get(k('step1.cta.required'))}</span>
                )}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="bj-title" data-testid="bj-step2-title">
                {get(k('step2.title'))}
              </h1>
              <p className="bj-subtitle">{get(k('step2.subtitle'))}</p>

              <div className="bj-field">
                <label className="bj-field__label">
                  {get(k('step2.field.guests.label'))}
                </label>
                <div className="bj-chips" data-testid="bj-guests">
                  {GUESTS.map((g) => (
                    <button
                      key={g.v}
                      type="button"
                      className={'bj-chip ' + (guests === g.v ? 'bj-chip--active' : '')}
                      onClick={() => setGuests(g.v === guests ? null : g.v)}
                      data-testid={`bj-guests-${g.v}`}
                    >
                      {g.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bj-field">
                <label className="bj-field__label">
                  {get(k('step2.field.materials.label'))}
                </label>
                <div className="bj-chips" data-testid="bj-materials">
                  {MATERIALS.map((m) => (
                    <button
                      key={m.v}
                      type="button"
                      className={
                        'bj-chip ' +
                        (materials.includes(m.v) ? 'bj-chip--active' : '')
                      }
                      onClick={() => toggle(materials, m.v, setMaterials)}
                      data-testid={`bj-material-${m.v}`}
                    >
                      {m.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bj-field">
                <label className="bj-field__label">
                  {get(k('step2.field.ambiance.label'))}
                </label>
                <div className="bj-chips" data-testid="bj-ambiance">
                  {AMBIANCE.map((a) => (
                    <button
                      key={a.v}
                      type="button"
                      className={
                        'bj-chip ' + (ambiance === a.v ? 'bj-chip--active' : '')
                      }
                      onClick={() => setAmbiance(a.v === ambiance ? null : a.v)}
                      data-testid={`bj-ambiance-${a.v}`}
                    >
                      {a.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bj-actions">
                <button
                  className="bj-btn bj-btn--ghost"
                  onClick={() => setStep(0)}
                  data-testid="bj-step2-back"
                >
                  {get(k('step2.cta.back'))}
                </button>
                <button
                  className="bj-btn bj-btn--primary"
                  disabled={!step2Has}
                  onClick={() => setStep(2)}
                  data-testid="bj-step2-next"
                >
                  {get(k('step2.cta.next'))}
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="bj-title" data-testid="bj-step3-title">
                {get(k('step3.title'))}
              </h1>
              <p className="bj-subtitle">{get(k('step3.subtitle'))}</p>

              <div className="bj-field">
                <label className="bj-field__label">
                  {get(k('step3.field.first_name.label'))}
                </label>
                <input
                  className="bj-input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  data-testid="bj-first-name"
                />
              </div>

              <div className="bj-field">
                <label className="bj-field__label">
                  {get(k('step3.field.email.label'))}
                </label>
                <input
                  className="bj-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="bj-email"
                />
              </div>

              <div className="bj-field">
                <label className="bj-field__label">
                  {get(k('step3.field.phone.label'))}
                </label>
                <input
                  className="bj-input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  data-testid="bj-phone"
                />
                <span className="bj-field__hint">
                  {get(k('step3.field.phone.hint'))}
                </span>
              </div>

              <div className="bj-actions">
                <button
                  className="bj-btn bj-btn--ghost"
                  onClick={() => setStep(1)}
                  data-testid="bj-step3-back"
                >
                  {get(k('step3.cta.back'))}
                </button>
                <button
                  className="bj-btn bj-btn--primary"
                  disabled={!step3Valid || submitting}
                  onClick={submit}
                  data-testid="bj-submit"
                >
                  {get(k('step3.cta.submit'))}
                </button>
              </div>

              <p className="bj-microcopy">{get(k('step3.microcopy'))}</p>
            </>
          )}
        </main>
      </div>
      </div>
    </>
  );
};

const BeginJourneyPage = () => (
  <EditorialBundleProvider pageKeys={['begin-journey']}>
    <BeginJourneyForm />
  </EditorialBundleProvider>
);

export default BeginJourneyPage;
