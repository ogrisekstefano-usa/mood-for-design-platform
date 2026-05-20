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

const API = process.env.REACT_APP_BACKEND_URL;

const SPACE_KINDS = [
  { v: 'home',         l: 'Casa' },
  { v: 'showroom',     l: 'Showroom' },
  { v: 'hospitality',  l: 'Ospitalità' },
  { v: 'office',       l: 'Ufficio' },
  { v: 'other',        l: 'Uno spazio dedicato' },
];

const GUESTS = [
  { v: 'often',     l: 'Sì, spesso' },
  { v: 'sometimes', l: 'Qualche volta' },
  { v: 'rarely',    l: 'Raramente' },
  { v: 'alone',     l: 'Vivo lo spazio in solitudine' },
];

const MATERIALS = [
  'Legno', 'Pietra', 'Tessuti naturali', 'Metalli caldi',
  'Vetro', 'Velluto', 'Marmo', 'Lino',
];

const AMBIANCE = [
  { v: 'warm_enveloping', l: 'Caldi e avvolgenti' },
  { v: 'sober_minimal',   l: 'Sobri e minimali' },
  { v: 'luminous_airy',   l: 'Luminosi e arieggiati' },
  { v: 'tactile_sensory', l: 'Materici e sensoriali' },
  { v: 'cinematic',       l: 'Cinematici' },
];

const STEPS = [
  { idx: 0, eyebrow: 'Passo Primo · Atmosfera',           marker: 'I',   short: 'Atmosfera' },
  { idx: 1, eyebrow: 'Passo Secondo · Come Vivi',         marker: 'II',  short: 'Come vivi' },
  { idx: 2, eyebrow: 'Passo Ultimo · Entriamo in Contatto', marker: 'III', short: 'Entriamo in contatto' },
];

const BeginJourneyPage = () => {
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

  const toggle = (arr, v, setter) =>
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const step1Has = spaceKinds.length || howToFeel.trim() || refs.trim();
  const step2Has = guests || materials.length || ambiance;
  const step3Valid = firstName.trim().length >= 1 && /.+@.+\..+/.test(email);

  const submit = async () => {
    if (!step3Valid) {
      toast('Lasciaci almeno il nome e una mail per scriverti.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        atmosphere: {
          space_kinds: spaceKinds,
          how_to_feel: howToFeel.trim(),
          references:  refs.trim(),
        },
        lifestyle: {
          guests,
          materials: materials.map((m) => m.toLowerCase()),
          ambiance,
        },
        welcome: {
          first_name: firstName.trim(),
          email:      email.trim(),
          phone:      phone.trim() || null,
        },
      };
      const r = await axios.post(`${API}/api/public/journeys/initiate`, payload);
      const url = r.data?.welcome_url;
      if (url) {
        navigate(url);
        return;
      }
      toast('Il tuo Design Journey è iniziato.');
    } catch (e) {
      console.error(e);
      toast('Non sono riuscito a iniziare il tuo Journey. Riprova fra un istante.');
      setSubmitting(false);
    }
  };

  const meta = useMemo(() => STEPS[step], [step]);

  return (
    <div className="bj-shell" data-testid="begin-journey-page">
      {submitting && (
        <div className="bj-overlay" data-testid="bj-overlay">
          <div className="bj-overlay__text">
            Stiamo aprendo il tuo Design Journey…
          </div>
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
                (s.idx <  step ? 'bj-rail__step--done'   : '')
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
                Quale atmosfera stai cercando?
              </h1>
              <p className="bj-subtitle">
                Inizia a raccontarci lo spazio che immagini — senza fretta.
              </p>

              <div className="bj-field">
                <label className="bj-field__label">Quale spazio immagini?</label>
                <div className="bj-chips" data-testid="bj-space-kinds">
                  {SPACE_KINDS.map((s) => (
                    <button key={s.v} type="button"
                            className={'bj-chip ' + (spaceKinds.includes(s.v) ? 'bj-chip--active' : '')}
                            onClick={() => toggle(spaceKinds, s.v, setSpaceKinds)}
                            data-testid={`bj-space-${s.v}`}>
                      {s.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bj-field">
                <label className="bj-field__label">Come vuoi sentirti in questo spazio?</label>
                <textarea className="bj-textarea"
                          placeholder="Una sensazione, un momento del giorno, un ricordo…"
                          value={howToFeel} onChange={(e) => setHowToFeel(e.target.value)}
                          data-testid="bj-how-to-feel" />
              </div>

              <div className="bj-field">
                <label className="bj-field__label">Hai riferimenti che ami?</label>
                <textarea className="bj-textarea"
                          placeholder="Una città, un film, un materiale, un ricordo, un'immagine…"
                          value={refs} onChange={(e) => setRefs(e.target.value)}
                          data-testid="bj-references" />
                <span className="bj-field__hint">Niente di formale — tutto quello che ti viene in mente.</span>
              </div>

              <div className="bj-actions">
                <button className="bj-btn bj-btn--primary"
                        disabled={!step1Has}
                        onClick={() => setStep(1)}
                        data-testid="bj-step1-next">
                  Continua il racconto →
                </button>
                {!step1Has && (
                  <span className="bj-microcopy">Lasciaci almeno un'impressione per continuare.</span>
                )}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="bj-title" data-testid="bj-step2-title">
                Come vivi gli spazi?
              </h1>
              <p className="bj-subtitle">
                Aiutaci a comprendere il tuo modo di abitare, non il tuo budget.
              </p>

              <div className="bj-field">
                <label className="bj-field__label">Ricevi ospiti spesso?</label>
                <div className="bj-chips" data-testid="bj-guests">
                  {GUESTS.map((g) => (
                    <button key={g.v} type="button"
                            className={'bj-chip ' + (guests === g.v ? 'bj-chip--active' : '')}
                            onClick={() => setGuests(g.v === guests ? null : g.v)}
                            data-testid={`bj-guests-${g.v}`}>
                      {g.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bj-field">
                <label className="bj-field__label">Quali materiali ti fanno stare bene?</label>
                <div className="bj-chips" data-testid="bj-materials">
                  {MATERIALS.map((m) => (
                    <button key={m} type="button"
                            className={'bj-chip ' + (materials.includes(m) ? 'bj-chip--active' : '')}
                            onClick={() => toggle(materials, m, setMaterials)}
                            data-testid={`bj-material-${m.toLowerCase()}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bj-field">
                <label className="bj-field__label">Preferisci ambienti…</label>
                <div className="bj-chips" data-testid="bj-ambiance">
                  {AMBIANCE.map((a) => (
                    <button key={a.v} type="button"
                            className={'bj-chip ' + (ambiance === a.v ? 'bj-chip--active' : '')}
                            onClick={() => setAmbiance(a.v === ambiance ? null : a.v)}
                            data-testid={`bj-ambiance-${a.v}`}>
                      {a.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bj-actions">
                <button className="bj-btn bj-btn--ghost"
                        onClick={() => setStep(0)} data-testid="bj-step2-back">
                  ← Indietro
                </button>
                <button className="bj-btn bj-btn--primary"
                        disabled={!step2Has}
                        onClick={() => setStep(2)} data-testid="bj-step2-next">
                  Avvicinati al tuo Journey →
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="bj-title" data-testid="bj-step3-title">
                Da dove cominciamo?
              </h1>
              <p className="bj-subtitle">
                Tre dettagli soltanto — il resto nascerà dalla conversazione.
              </p>

              <div className="bj-field">
                <label className="bj-field__label">Come ti chiamiamo?</label>
                <input className="bj-input" value={firstName}
                       onChange={(e) => setFirstName(e.target.value)}
                       data-testid="bj-first-name" />
              </div>

              <div className="bj-field">
                <label className="bj-field__label">Una mail per scriverti</label>
                <input className="bj-input" type="email" value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       data-testid="bj-email" />
              </div>

              <div className="bj-field">
                <label className="bj-field__label">Un numero se preferisci sentirti</label>
                <input className="bj-input" type="tel" value={phone}
                       onChange={(e) => setPhone(e.target.value)}
                       data-testid="bj-phone" />
                <span className="bj-field__hint">Facoltativo — alcune cose si capiscono meglio a voce.</span>
              </div>

              <div className="bj-actions">
                <button className="bj-btn bj-btn--ghost"
                        onClick={() => setStep(1)} data-testid="bj-step3-back">
                  ← Indietro
                </button>
                <button className="bj-btn bj-btn--primary"
                        disabled={!step3Valid || submitting}
                        onClick={submit}
                        data-testid="bj-submit">
                  Inizia il tuo Design Journey™
                </button>
              </div>

              <p className="bj-microcopy">
                Nessun preventivo, nessuna pressione. Solo una conversazione.
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default BeginJourneyPage;
