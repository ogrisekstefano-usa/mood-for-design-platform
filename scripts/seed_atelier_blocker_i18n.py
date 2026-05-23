"""Seed atelier.blocker.* i18n (mobile cinematic blocker copy) × 7 locales."""
import json
from pathlib import Path

LOCALES_DIR = Path('/app/frontend/src/i18n/strings')

BLOCKER = {
    'it-IT': {
        'eyebrow': 'Blueprint Atelier™',
        'title':   'Disegnato per la postazione di studio.',
        'lede':    'Il tuo atelier respira su una tela ampia. Il sistema operativo cinematografico riposa sull\'architettura desktop — torna alla postazione di studio per continuare.',
        'cta':     'Invia alla mia postazione',
        'whisper': 'Tela consigliata · da 1280 px in su.',
    },
    'en-US': {
        'eyebrow': 'Blueprint Atelier™',
        'title':   'Designed for the studio workstation.',
        'lede':    'Your atelier breathes on a wide canvas. The cinematic operating system rests on desktop architecture — return to your studio to continue.',
        'cta':     'Send to my workstation',
        'whisper': 'Recommended canvas · 1280 px and wider.',
    },
    'en-GB': {
        'eyebrow': 'Blueprint Atelier™',
        'title':   'Made for the studio workstation.',
        'lede':    'Your atelier breathes on a wide canvas. The cinematic operating system lives on desktop architecture — return to your studio to continue.',
        'cta':     'Send to my workstation',
        'whisper': 'Recommended canvas · 1280 px and wider.',
    },
    'fr-FR': {
        'eyebrow': 'Blueprint Atelier™',
        'title':   "Conçu pour le poste de travail du studio.",
        'lede':    "Votre atelier respire sur une vaste toile. Le système d'exploitation cinématographique repose sur une architecture de bureau — retournez à votre studio pour continuer.",
        'cta':     'Envoyer à mon poste',
        'whisper': 'Toile recommandée · 1280 px ou plus.',
    },
    'de-DE': {
        'eyebrow': 'Blueprint Atelier™',
        'title':   'Für den Studio-Arbeitsplatz entworfen.',
        'lede':    'Ihr Atelier atmet auf einer breiten Leinwand. Das kinematische Betriebssystem ruht auf Desktop-Architektur — kehren Sie ins Studio zurück, um fortzufahren.',
        'cta':     'An Arbeitsplatz senden',
        'whisper': 'Empfohlene Leinwand · 1280 px und breiter.',
    },
    'es-ES': {
        'eyebrow': 'Blueprint Atelier™',
        'title':   'Diseñado para la estación de trabajo del estudio.',
        'lede':    'Tu atelier respira en un lienzo amplio. El sistema operativo cinematográfico reposa sobre arquitectura de escritorio — regresa al estudio para continuar.',
        'cta':     'Enviar a mi estación',
        'whisper': 'Lienzo recomendado · 1280 px en adelante.',
    },
    'ar': {
        'eyebrow': 'Blueprint Atelier™',
        'title':   'صُمِّم لمحطّة عمل الاستوديو.',
        'lede':    'ورشتك تتنفّس على قماشة واسعة. نظام التشغيل السينمائي يستقرّ على هندسة سطح المكتب — عُد إلى استوديوك للمتابعة.',
        'cta':     'أرسل إلى محطّة عملي',
        'whisper': 'القماشة الموصى بها · 1280 px وأكثر.',
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
    atelier['blocker'] = deep_merge(atelier.get('blocker', {}), BLOCKER[loc])
    cur['atelier'] = atelier
    p.write_text(json.dumps(cur, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'  {loc} → atelier.blocker seeded')

print('\n✅ atelier.blocker.* seeded × 7 locales.')
