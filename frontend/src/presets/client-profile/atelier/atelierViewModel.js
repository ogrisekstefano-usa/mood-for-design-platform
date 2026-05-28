/**
 * Atelier dummy/derived data layer · ITER162
 *
 * Trasforma la response di /api/client/welcome-summary in tutto ciò
 * che il preset Atelier vuole mostrare. Dove l'API non ha ancora il
 * dato, restituiamo dummy editoriale coerente.
 *
 * NON chiamare API qui — è una funzione pura.
 */

const ATM_LIBRARY = {
  warm_enveloping:    { title: 'Calda e accogliente',
                        body:  'Racconti di uno spazio che trasmette intimità\ne benessere.' },
  light_airy:         { title: 'Luminosa e ariosa',
                        body:  'Cerchi una casa che lasci entrare\nluce e respiro.' },
  bold_contrasted:    { title: 'Decisa e materica',
                        body:  'Linee nette, contrasti gentili,\npersonalità riconoscibile.' },
  quiet_minimal:      { title: 'Quieta e essenziale',
                        body:  'Pochi gesti, molta presenza.\nIl vuoto come materia.' },
};

const LIFE_LIBRARY = {
  slow_living:        { title: 'Rallentare e vivere',
                        body:  'Cerchi un ambiente che inviti\na prendersi il tempo, ogni giorno.' },
  social_host:        { title: 'Aprire le porte',
                        body:  'Casa pensata anche per gli amici,\nper le sere condivise.' },
  family_centred:     { title: 'Spazio di famiglia',
                        body:  'Quotidianità protetta,\nangoli che crescono con voi.' },
  work_from_home:     { title: 'Tempo concentrato',
                        body:  'Una stanza che sa farsi studio\nsenza perdere casa.' },
};

const PRIO_LIBRARY = {
  light_continuity:   { title: 'Luce e connessione',
                        body:  'Desideri spazi luminosi\nche creano armonia e continuità.' },
  privacy:            { title: 'Intimità',
                        body:  'Spazi che proteggono,\nsoglie discrete fra le stanze.' },
  flow:               { title: 'Fluidità',
                        body:  'Passaggi morbidi,\nuno spazio che accompagna il gesto.' },
  art_first:          { title: 'L\'opera al centro',
                        body:  'La casa come cornice\nper ciò che ami.' },
};

// Static editorial imagery — fallback usato quando il tenant non ha
// caricato placeholder custom dal Command Center CMS.
// Il backend ritorna anche questi DEFAULT da /api/admin/client-profile-config
// in modo che la sorgente di verità sia condivisa.
const ATELIER_IMAGES = {
  hero:     'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=85&w=2400&auto=format&fit=crop',
  atmosphere: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?q=85&w=800&auto=format&fit=crop',
  lifestyle:  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?q=85&w=800&auto=format&fit=crop',
  materials:  'https://images.unsplash.com/photo-1604014237800-1c9102c219da?q=85&w=800&auto=format&fit=crop',
  priority:   'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?q=85&w=800&auto=format&fit=crop',
  nextStep:   'https://images.unsplash.com/photo-1565538810643-b5bdb714032a?q=85&w=800&auto=format&fit=crop',
};

const _imageFor = (slot, placeholders) => {
  const fromCfg = placeholders?.[slot]?.url;
  if (fromCfg) return fromCfg;
  return ATELIER_IMAGES[slot];
};

const _pickFromLibrary = (lib, key, fallbackKey) =>
  lib[(key || '').toLowerCase()] || lib[fallbackKey] || Object.values(lib)[0];

/**
 * Build the "Le tue prime indicazioni" 4-card deck.
 * Mapping atmosphere/lifestyle → 4 editorial cards.
 */
const _buildIndications = (atmosphere = {}, lifestyle = {}, placeholders = {}) => {
  const atm  = _pickFromLibrary(ATM_LIBRARY,  atmosphere.ambiance,  'warm_enveloping');
  const life = _pickFromLibrary(LIFE_LIBRARY, lifestyle.pace,       'slow_living');
  const prio = _pickFromLibrary(PRIO_LIBRARY, lifestyle.priority,   'light_continuity');

  return [
    { id: 'atmosphere', label: 'Atmosfera',    icon: 'sparkles',
      title: atm.title,  body: atm.body,  image: _imageFor('atmosphere', placeholders) },
    { id: 'lifestyle',  label: 'Stile di vita', icon: 'home',
      title: life.title, body: life.body, image: _imageFor('lifestyle', placeholders) },
    { id: 'materials',  label: 'Preferenze',   icon: 'leaf',
      title: 'Materiali naturali',
      body: 'Ami le texture autentiche\ne i toni neutri e materici.',
      image: _imageFor('materials', placeholders) },
    { id: 'priority',   label: 'Priorità',     icon: 'shield',
      title: prio.title, body: prio.body, image: _imageFor('priority', placeholders) },
  ];
};

/** Extract a quote from the user's initial brief, if any. */
const _buildQuote = (summary, atmosphere = {}) => {
  if (atmosphere?.how_to_feel) {
    return {
      text:   atmosphere.how_to_feel,
      author: 'Marco · prime indicazioni del tuo Journey™',
    };
  }
  if (summary && summary.length > 20) {
    return {
      text:   summary.length > 140 ? summary.slice(0, 140).rsplit?.(' ', 1) || summary.slice(0, 140) + '…' : summary,
      author: 'Le tue prime parole nel Journey™',
    };
  }
  return {
    text:   'Voglio sentire la casa quando entro.',
    author: 'Le tue prime parole nel Journey™',
  };
};

/** Static 4-step opening timeline. Real status comes later from journey state. */
const _buildTimeline = (firstStepDone = true) => ([
  { id: 'brief_received', label: 'Prime indicazioni\ncompletate', icon: 'check',
    status: firstStepDone ? 'done' : 'pending' },
  { id: 'studio_listen',  label: 'In attesa di\nriscontro dallo studio', icon: 'ear',
    status: firstStepDone ? 'active' : 'pending' },
  { id: 'first_direction', label: 'Progetto in\npreparazione', icon: 'pencil',
    status: 'pending' },
  { id: 'first_meeting',  label: 'Primo incontro\ne direzione',   icon: 'users',
    status: 'pending' },
]);

/** Master mapper. Accetta opzionalmente `placeholders` (oggetto
 * `{hero, atmosphere, lifestyle, materials, priority, nextStep}` con
 * struttura `{url, asset_id?, alt?}`) per consentire al Command Center
 * di sovrascrivere le immagini editoriali per tenant. */
export function buildAtelierViewModel(welcomeSummary, opts = {}) {
  const s = welcomeSummary || {};
  const placeholders = opts.placeholders || {};
  const first = (s.client?.first_name) || 'a casa';
  const studio = s.studio_name || 'Lo Studio';
  const referente = s.referente || null;

  return {
    client: {
      firstName: first,
      lastName:  s.client?.last_name || '',
      email:     s.client?.email || null,
    },
    studio:    { name: studio },
    referente,
    hero: {
      eyebrow: 'Il tuo spazio progettuale',
      title:   `Benvenuto, ${first}.`,
      lede:    `Questo è il tuo spazio progettuale.\nLo studio è al lavoro per trasformare le tue idee\nin un progetto su misura per te.`,
      image:   _imageFor('hero', placeholders),
    },
    quote:        _buildQuote(s.summary, s.atmosphere),
    indications:  _buildIndications(s.atmosphere, s.lifestyle, placeholders),
    timeline:     _buildTimeline(true),
    nextStep: {
      title: 'Prossimo passo',
      body:  'Lo studio sta analizzando le tue indicazioni per proporti una prima direzione progettuale.',
      hint:  'Ti aggiorneremo a breve.',
      image: _imageFor('nextStep', placeholders),
    },
    journeyId: s.journey_id || null,
  };
}

export const ATELIER_IMAGE_LIB = ATELIER_IMAGES;
