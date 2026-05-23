/**
 * BeginJourneyPage · Sprint G.2
 * "Inizia il tuo Design Journey™" — rituale di accoglienza in 3 passi.
 *
 * NON è acquisizione commerciale. È un ingresso curatoriale.
 * Atmosfera → Lifestyle → Welcome → /journey/welcome/:token
 */
import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import '../../styles/begin-journey.css';
import { useT } from '../../i18n/useT';
const API = process.env.REACT_APP_BACKEND_URL;

// ITER143A · LANGUAGE GOVERNANCE HARDENING™ — every static option label is
// pulled at render time through `t()` so non-IT locales never see Italian
// leaks. Fallback strings are English (universal baseline).
const useBeginJourneyTaxonomy = () => {
  const { t } = useT();
  return {
    SPACE_KINDS: [
      { v: 'home',         l: t('site.begin_journey.space.home',         null, 'Home') },
      { v: 'showroom',     l: t('site.begin_journey.space.showroom',     null, 'Showroom') },
      { v: 'hospitality',  l: t('site.begin_journey.space.hospitality',  null, 'Hospitality') },
      { v: 'office',       l: t('site.begin_journey.space.office',       null, 'Office') },
      { v: 'other',        l: t('site.begin_journey.space.other',        null, 'A dedicated space') },
    ],
    GUESTS: [
      { v: 'often',     l: t('site.begin_journey.guests.often',     null, 'Yes, often') },
      { v: 'sometimes', l: t('site.begin_journey.guests.sometimes', null, 'Sometimes') },
      { v: 'rarely',    l: t('site.begin_journey.guests.rarely',    null, 'Rarely') },
      { v: 'alone',     l: t('site.begin_journey.guests.alone',     null, 'I live the space in solitude') },
    ],
    MATERIALS: [
      t('site.begin_journey.materials.wood',     null, 'Wood'),
      t('site.begin_journey.materials.stone',    null, 'Stone'),
      t('site.begin_journey.materials.textiles', null, 'Natural textiles'),
      t('site.begin_journey.materials.metals',   null, 'Warm metals'),
      t('site.begin_journey.materials.glass',    null, 'Glass'),
      t('site.begin_journey.materials.velvet',   null, 'Velvet'),
      t('site.begin_journey.materials.marble',   null, 'Marble'),
      t('site.begin_journey.materials.linen',    null, 'Linen'),
    ],
    AMBIANCE: [
      { v: 'warm_enveloping',  l: t('site.begin_journey.ambiance.warm',     null, 'Warm and enveloping') },
      { v: 'sober_minimal',    l: t('site.begin_journey.ambiance.sober',    null, 'Sober and minimal') },
      { v: 'luminous_airy',    l: t('site.begin_journey.ambiance.luminous', null, 'Luminous and airy') },
      { v: 'tactile_sensory',  l: t('site.begin_journey.ambiance.tactile',  null, 'Tactile and sensory') },
      { v: 'cinematic',        l: t('site.begin_journey.ambiance.cinematic',null, 'Cinematic') },
    ],
    STEPS: [
      { idx: 0,
        eyebrow: t('site.begin_journey.step1.eyebrow', null, 'First Step · Atmosphere'),
        marker:  'I',
        short:   t('site.begin_journey.step1.short',   null, 'Atmosphere') },
      { idx: 1,
        eyebrow: t('site.begin_journey.step2.eyebrow', null, 'Second Step · How You Live'),
        marker:  'II',
        short:   t('site.begin_journey.step2.short',   null, 'How you live') },
      { idx: 2,
        eyebrow: t('site.begin_journey.step3.eyebrow', null, 'Last Step · Let’s Get in Touch'),
        marker:  'III',
        short:   t('site.begin_journey.step3.short',   null, 'Let’s get in touch') },
    ],
  };
};

const BeginJourneyPage = () => {
  const {
    t
  } = useT();
  const { SPACE_KINDS, GUESTS, MATERIALS, AMBIANCE, STEPS } = useBeginJourneyTaxonomy();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [spaceKinds, setSpaceKinds] = useState([]);
  const [howToFeel, setHowToFeel] = useState('');
  const [refs, setRefs] = useState('');

  // Step 2
  const [guests, setGuests] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [ambiance, setAmbiance] = useState(null);

  // Step 3
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const toggle = (arr, v, setter) => setter(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  const step1Has = spaceKinds.length || howToFeel.trim() || refs.trim();
  const step2Has = guests || materials.length || ambiance;
  const step3Valid = firstName.trim().length >= 1 && /.+@.+\..+/.test(email);
  const submit = async () => {
    if (!step3Valid) {
      toast(t('site.begin_journey.toast.required', null,
        'Please leave at least your name and an email so we can write to you.'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        atmosphere: {
          space_kinds: spaceKinds,
          how_to_feel: howToFeel.trim(),
          references: refs.trim()
        },
        lifestyle: {
          guests,
          materials: materials.map(m => m.toLowerCase()),
          ambiance
        },
        welcome: {
          first_name: firstName.trim(),
          email: email.trim(),
          phone: phone.trim() || null
        }
      };
      const r = await axios.post(`${API}/api/public/journeys/initiate`, payload);
      const url = r.data?.welcome_url;
      if (url) {
        navigate(url);
        return;
      }
      toast(t('site.begin_journey.toast.started', null,
        'Your Design Journey™ has begun.'));
    } catch (e) {
      console.error(e);
      toast(t('site.begin_journey.toast.failed', null,
        'We couldn’t start your Journey. Please try again in a moment.'));
      setSubmitting(false);
    }
  };
  const meta = useMemo(() => STEPS[step], [step]);
  return <div className="bj-shell" data-testid="begin-journey-page">
      {submitting && <div className="bj-overlay" data-testid="bj-overlay">
          <div className="bj-overlay__text">
            {t("site.begin_journey.stiamo_aprendo_il_tuo_design_journey")}
          </div>
        </div>}

      <div className="bj-container">
        {/* LEFT RAIL */}
        <aside className="bj-rail">
          <div className="bj-rail__brand">
            MOOD
            <small>Design Journey™</small>
          </div>
          {STEPS.map(s => <div key={s.idx} className={'bj-rail__step ' + (s.idx === step ? 'bj-rail__step--active' : '') + (s.idx < step ? 'bj-rail__step--done' : '')} data-testid={`bj-rail-step-${s.idx}`}>
              <span className="bj-rail__step-marker">{s.marker}</span>
              <span>{s.short}</span>
            </div>)}
        </aside>

        {/* STAGE */}
        <main className="bj-stage" key={step}>
          <div className="bj-eyebrow" data-testid="bj-eyebrow">{meta.eyebrow}</div>

          {step === 0 && <>
              <h1 className="bj-title" data-testid="bj-step1-title">
                {t("site.begin_journey.quale_atmosfera_stai_cercando")}
              </h1>
              <p className="bj-subtitle">
                {t("site.begin_journey.inizia_a_raccontarci_lo_spazio_che_immagini_senza")}
              </p>

              <div className="bj-field">
                <label className="bj-field__label">Quale spazio immagini?</label>
                <div className="bj-chips" data-testid="bj-space-kinds">
                  {SPACE_KINDS.map(s => <button key={s.v} type="button" className={'bj-chip ' + (spaceKinds.includes(s.v) ? 'bj-chip--active' : '')} onClick={() => toggle(spaceKinds, s.v, setSpaceKinds)} data-testid={`bj-space-${s.v}`}>
                      {s.l}
                    </button>)}
                </div>
              </div>

              <div className="bj-field">
                <label className="bj-field__label">{t('site.begin_journey.come_vuoi_sentirti_in_questo_spazio')}</label>
                <textarea className="bj-textarea" placeholder={t("site.begin_journey.una_sensazione_un_momento_del_giorno_un_ricordo")} value={howToFeel} onChange={e => setHowToFeel(e.target.value)} data-testid="bj-how-to-feel" />
              </div>

              <div className="bj-field">
                <label className="bj-field__label">Hai riferimenti che ami?</label>
                <textarea className="bj-textarea" placeholder="Una città, un film, un materiale, un ricordo, un'immagine…" value={refs} onChange={e => setRefs(e.target.value)} data-testid="bj-references" />
                <span className="bj-field__hint">{t('site.begin_journey.niente_di_formale_tutto_quello_che_ti_viene_in_men')}</span>
              </div>

              <div className="bj-actions">
                <button className="bj-btn bj-btn--primary" disabled={!step1Has} onClick={() => setStep(1)} data-testid="bj-step1-next">
                  {t("site.begin_journey.continua_il_racconto")}
                </button>
                {!step1Has && <span className="bj-microcopy">Lasciaci almeno un'impressione per continuare.</span>}
              </div>
            </>}

          {step === 1 && <>
              <h1 className="bj-title" data-testid="bj-step2-title">
                {t("site.begin_journey.come_vivi_gli_spazi")}
              </h1>
              <p className="bj-subtitle">
                {t("site.begin_journey.aiutaci_a_comprendere_il_tuo_modo_di_abitare_non_i")}
              </p>

              <div className="bj-field">
                <label className="bj-field__label">Ricevi ospiti spesso?</label>
                <div className="bj-chips" data-testid="bj-guests">
                  {GUESTS.map(g => <button key={g.v} type="button" className={'bj-chip ' + (guests === g.v ? 'bj-chip--active' : '')} onClick={() => setGuests(g.v === guests ? null : g.v)} data-testid={`bj-guests-${g.v}`}>
                      {g.l}
                    </button>)}
                </div>
              </div>

              <div className="bj-field">
                <label className="bj-field__label">{t('site.begin_journey.quali_materiali_ti_fanno_stare_bene')}</label>
                <div className="bj-chips" data-testid="bj-materials">
                  {MATERIALS.map(m => <button key={m} type="button" className={'bj-chip ' + (materials.includes(m) ? 'bj-chip--active' : '')} onClick={() => toggle(materials, m, setMaterials)} data-testid={`bj-material-${m.toLowerCase()}`}>
                      {m}
                    </button>)}
                </div>
              </div>

              <div className="bj-field">
                <label className="bj-field__label">Preferisci ambienti…</label>
                <div className="bj-chips" data-testid="bj-ambiance">
                  {AMBIANCE.map(a => <button key={a.v} type="button" className={'bj-chip ' + (ambiance === a.v ? 'bj-chip--active' : '')} onClick={() => setAmbiance(a.v === ambiance ? null : a.v)} data-testid={`bj-ambiance-${a.v}`}>
                      {a.l}
                    </button>)}
                </div>
              </div>

              <div className="bj-actions">
                <button className="bj-btn bj-btn--ghost" onClick={() => setStep(0)} data-testid="bj-step2-back">
                  ← Indietro
                </button>
                <button className="bj-btn bj-btn--primary" disabled={!step2Has} onClick={() => setStep(2)} data-testid="bj-step2-next">
                  {t("site.begin_journey.avvicinati_al_tuo_journey")}
                </button>
              </div>
            </>}

          {step === 2 && <>
              <h1 className="bj-title" data-testid="bj-step3-title">
                Da dove cominciamo?
              </h1>
              <p className="bj-subtitle">
                {t("site.begin_journey.tre_dettagli_soltanto_il_resto_nascera_dalla_conve")}
              </p>

              <div className="bj-field">
                <label className="bj-field__label">Come ti chiamiamo?</label>
                <input className="bj-input" value={firstName} onChange={e => setFirstName(e.target.value)} data-testid="bj-first-name" />
              </div>

              <div className="bj-field">
                <label className="bj-field__label">Una mail per scriverti</label>
                <input className="bj-input" type="email" value={email} onChange={e => setEmail(e.target.value)} data-testid="bj-email" />
              </div>

              <div className="bj-field">
                <label className="bj-field__label">Un numero se preferisci sentirti</label>
                <input className="bj-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} data-testid="bj-phone" />
                <span className="bj-field__hint">{t('site.begin_journey.facoltativo_alcune_cose_si_capiscono_meglio_a_voce')}</span>
              </div>

              <div className="bj-actions">
                <button className="bj-btn bj-btn--ghost" onClick={() => setStep(1)} data-testid="bj-step3-back">
                  ← Indietro
                </button>
                <button className="bj-btn bj-btn--primary" disabled={!step3Valid || submitting} onClick={submit} data-testid="bj-submit">
                  {t("site.begin_journey.inizia_il_tuo_design_journey")}
                </button>
              </div>

              <p className="bj-microcopy">
                {t("site.begin_journey.nessun_preventivo_nessuna_pressione_solo_una_conve")}
              </p>
            </>}
        </main>
      </div>
    </div>;
};
export default BeginJourneyPage;