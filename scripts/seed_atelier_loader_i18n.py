"""Seed atelier.loader.* phrase keys × 7 locales."""
import json
from pathlib import Path

LOCALES_DIR = Path('/app/frontend/src/i18n/strings')

LOADER = {
    'it-IT': {
        'phrase_preparing_atelier':    'Preparando il tuo atelier…',
        'phrase_curating_atmosphere':  'Curando l\'atmosfera…',
        'phrase_opening_chapter':      'Aprendo il prossimo capitolo…',
        'phrase_synchronizing_rhythm': 'Sincronizzando il ritmo del progetto…',
        'phrase_listening_voices':     'In ascolto delle voci dello studio…',
        'phrase_arranging_silence':    'Disponendo il silenzio…',
    },
    'en-US': {
        'phrase_preparing_atelier':    'Preparing your atelier…',
        'phrase_curating_atmosphere':  'Curating the atmosphere…',
        'phrase_opening_chapter':      'Opening the next chapter…',
        'phrase_synchronizing_rhythm': 'Synchronising the design rhythm…',
        'phrase_listening_voices':     'Listening for voices in the studio…',
        'phrase_arranging_silence':    'Arranging the silence…',
    },
    'en-GB': {
        'phrase_preparing_atelier':    'Preparing your atelier…',
        'phrase_curating_atmosphere':  'Curating the atmosphere…',
        'phrase_opening_chapter':      'Opening the next chapter…',
        'phrase_synchronizing_rhythm': 'Synchronising the design rhythm…',
        'phrase_listening_voices':     'Listening for voices in the studio…',
        'phrase_arranging_silence':    'Arranging the silence…',
    },
    'fr-FR': {
        'phrase_preparing_atelier':    'Préparation de votre atelier…',
        'phrase_curating_atmosphere':  "Curation de l'atmosphère…",
        'phrase_opening_chapter':      'Ouverture du prochain chapitre…',
        'phrase_synchronizing_rhythm': 'Synchronisation du rythme du projet…',
        'phrase_listening_voices':     'À l\'écoute des voix du studio…',
        'phrase_arranging_silence':    'Disposition du silence…',
    },
    'de-DE': {
        'phrase_preparing_atelier':    'Ihr Atelier wird vorbereitet…',
        'phrase_curating_atmosphere':  'Atmosphäre wird kuratiert…',
        'phrase_opening_chapter':      'Das nächste Kapitel öffnet sich…',
        'phrase_synchronizing_rhythm': 'Design-Rhythmus wird synchronisiert…',
        'phrase_listening_voices':     'Wir hören den Stimmen des Studios zu…',
        'phrase_arranging_silence':    'Die Stille wird arrangiert…',
    },
    'es-ES': {
        'phrase_preparing_atelier':    'Preparando tu atelier…',
        'phrase_curating_atmosphere':  'Curando la atmósfera…',
        'phrase_opening_chapter':      'Abriendo el próximo capítulo…',
        'phrase_synchronizing_rhythm': 'Sincronizando el ritmo del diseño…',
        'phrase_listening_voices':     'Escuchando las voces del estudio…',
        'phrase_arranging_silence':    'Disponiendo el silencio…',
    },
    'ar': {
        'phrase_preparing_atelier':    'نُحضِّر ورشتك…',
        'phrase_curating_atmosphere':  'نُنظِّم الأجواء…',
        'phrase_opening_chapter':      'نفتح الفصل التالي…',
        'phrase_synchronizing_rhythm': 'نُزامن إيقاع التصميم…',
        'phrase_listening_voices':     'نُصغي إلى أصوات الورشة…',
        'phrase_arranging_silence':    'نُرتِّب الصمت…',
    },
}

FILES = ['it-IT.json','en-US.json','en-GB.json','fr-FR.json','de-DE.json','es-ES.json','ar.json']

def deep_merge(a, b):
    out = dict(a)
    for k, v in b.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out

for f in FILES:
    loc = f.replace('.json','')
    p = LOCALES_DIR / f
    cur = json.loads(p.read_text(encoding='utf-8'))
    atelier = cur.get('atelier', {})
    atelier['loader'] = deep_merge(atelier.get('loader', {}), LOADER[loc])
    cur['atelier'] = atelier
    p.write_text(json.dumps(cur, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'  {loc} → atelier.loader (6 phrases) seeded')

print('\n✅ atelier.loader.* seeded × 7 locales.')
