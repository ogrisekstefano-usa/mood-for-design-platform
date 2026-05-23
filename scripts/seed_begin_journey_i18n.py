"""ITER143A · seed `site.begin_journey.*` taxonomy × 7 locales.

Eradicates the hardcoded-IT leak in BeginJourneyPage option lists
(SPACE_KINDS, GUESTS, MATERIALS, AMBIANCE, STEPS) + toast messages.
"""
import json
from pathlib import Path

LOC = Path('/app/frontend/src/i18n/strings')

BJ = {
    'it-IT': {
        'space': {'home': 'Casa', 'showroom': 'Showroom', 'hospitality': 'Ospitalità',
                  'office': 'Ufficio', 'other': 'Uno spazio dedicato'},
        'guests': {'often': 'Sì, spesso', 'sometimes': 'Qualche volta',
                   'rarely': 'Raramente', 'alone': 'Vivo lo spazio in solitudine'},
        'materials': {'wood': 'Legno', 'stone': 'Pietra', 'textiles': 'Tessuti naturali',
                      'metals': 'Metalli caldi', 'glass': 'Vetro', 'velvet': 'Velluto',
                      'marble': 'Marmo', 'linen': 'Lino'},
        'ambiance': {'warm': 'Caldi e avvolgenti', 'sober': 'Sobri e minimali',
                     'luminous': 'Luminosi e arieggiati', 'tactile': 'Materici e sensoriali',
                     'cinematic': 'Cinematici'},
        'step1': {'eyebrow': 'Passo Primo · Atmosfera',           'short': 'Atmosfera'},
        'step2': {'eyebrow': 'Passo Secondo · Come Vivi',         'short': 'Come vivi'},
        'step3': {'eyebrow': 'Passo Ultimo · Entriamo in Contatto','short': 'Entriamo in contatto'},
        'toast': {
            'required': 'Lasciaci almeno il nome e una mail per scriverti.',
            'started':  'Il tuo Design Journey™ è iniziato.',
            'failed':   'Non sono riuscito a iniziare il tuo Journey. Riprova fra un istante.',
        },
    },
    'en-US': {
        'space': {'home': 'Home', 'showroom': 'Showroom', 'hospitality': 'Hospitality',
                  'office': 'Office', 'other': 'A dedicated space'},
        'guests': {'often': 'Yes, often', 'sometimes': 'Sometimes',
                   'rarely': 'Rarely', 'alone': 'I live the space in solitude'},
        'materials': {'wood': 'Wood', 'stone': 'Stone', 'textiles': 'Natural textiles',
                      'metals': 'Warm metals', 'glass': 'Glass', 'velvet': 'Velvet',
                      'marble': 'Marble', 'linen': 'Linen'},
        'ambiance': {'warm': 'Warm and enveloping', 'sober': 'Sober and minimal',
                     'luminous': 'Luminous and airy', 'tactile': 'Tactile and sensory',
                     'cinematic': 'Cinematic'},
        'step1': {'eyebrow': 'First Step · Atmosphere',          'short': 'Atmosphere'},
        'step2': {'eyebrow': 'Second Step · How You Live',       'short': 'How you live'},
        'step3': {'eyebrow': 'Last Step · Let’s Get in Touch',   'short': 'Let’s get in touch'},
        'toast': {
            'required': 'Please leave at least your name and an email so we can write to you.',
            'started':  'Your Design Journey™ has begun.',
            'failed':   'We couldn’t start your Journey. Please try again in a moment.',
        },
    },
    'en-GB': {
        'space': {'home': 'Home', 'showroom': 'Showroom', 'hospitality': 'Hospitality',
                  'office': 'Office', 'other': 'A dedicated space'},
        'guests': {'often': 'Yes, often', 'sometimes': 'Sometimes',
                   'rarely': 'Rarely', 'alone': 'I inhabit the space in solitude'},
        'materials': {'wood': 'Wood', 'stone': 'Stone', 'textiles': 'Natural textiles',
                      'metals': 'Warm metals', 'glass': 'Glass', 'velvet': 'Velvet',
                      'marble': 'Marble', 'linen': 'Linen'},
        'ambiance': {'warm': 'Warm and enveloping', 'sober': 'Sober and minimal',
                     'luminous': 'Luminous and airy', 'tactile': 'Tactile and sensory',
                     'cinematic': 'Cinematic'},
        'step1': {'eyebrow': 'First Step · Atmosphere',          'short': 'Atmosphere'},
        'step2': {'eyebrow': 'Second Step · How You Live',       'short': 'How you live'},
        'step3': {'eyebrow': 'Last Step · Let’s Get in Touch',   'short': 'Let’s get in touch'},
        'toast': {
            'required': 'Please leave at least your name and an email so we can write to you.',
            'started':  'Your Design Journey™ has begun.',
            'failed':   'We couldn’t start your Journey. Please try again in a moment.',
        },
    },
    'fr-FR': {
        'space': {'home': 'Maison', 'showroom': 'Showroom', 'hospitality': 'Hôtellerie',
                  'office': 'Bureau', 'other': 'Un espace dédié'},
        'guests': {'often': 'Oui, souvent', 'sometimes': 'Parfois',
                   'rarely': 'Rarement', 'alone': 'J’habite l’espace en solitude'},
        'materials': {'wood': 'Bois', 'stone': 'Pierre', 'textiles': 'Tissus naturels',
                      'metals': 'Métaux chauds', 'glass': 'Verre', 'velvet': 'Velours',
                      'marble': 'Marbre', 'linen': 'Lin'},
        'ambiance': {'warm': 'Chaleureux et enveloppants', 'sober': 'Sobres et minimaux',
                     'luminous': 'Lumineux et aériens', 'tactile': 'Tactiles et sensoriels',
                     'cinematic': 'Cinématographiques'},
        'step1': {'eyebrow': 'Premier Pas · Atmosphère',         'short': 'Atmosphère'},
        'step2': {'eyebrow': 'Deuxième Pas · Comment vous vivez','short': 'Comment vous vivez'},
        'step3': {'eyebrow': 'Dernier Pas · Entrons en Contact', 'short': 'Entrons en contact'},
        'toast': {
            'required': 'Laissez-nous au moins votre nom et un email pour vous écrire.',
            'started':  'Votre Design Journey™ a commencé.',
            'failed':   'Nous n’avons pas pu démarrer votre Journey. Réessayez dans un instant.',
        },
    },
    'de-DE': {
        'space': {'home': 'Zuhause', 'showroom': 'Showroom', 'hospitality': 'Gastfreundschaft',
                  'office': 'Büro', 'other': 'Ein eigener Raum'},
        'guests': {'often': 'Ja, häufig', 'sometimes': 'Manchmal',
                   'rarely': 'Selten', 'alone': 'Ich bewohne den Raum in Stille'},
        'materials': {'wood': 'Holz', 'stone': 'Stein', 'textiles': 'Naturtextilien',
                      'metals': 'Warme Metalle', 'glass': 'Glas', 'velvet': 'Samt',
                      'marble': 'Marmor', 'linen': 'Leinen'},
        'ambiance': {'warm': 'Warm und umhüllend', 'sober': 'Nüchtern und minimal',
                     'luminous': 'Hell und luftig', 'tactile': 'Taktil und sinnlich',
                     'cinematic': 'Kinematografisch'},
        'step1': {'eyebrow': 'Erster Schritt · Atmosphäre',        'short': 'Atmosphäre'},
        'step2': {'eyebrow': 'Zweiter Schritt · Wie Sie leben',    'short': 'Wie Sie leben'},
        'step3': {'eyebrow': 'Letzter Schritt · Lassen Sie uns sprechen', 'short': 'Lassen Sie uns sprechen'},
        'toast': {
            'required': 'Bitte hinterlassen Sie uns Ihren Namen und eine E-Mail, damit wir Ihnen schreiben können.',
            'started':  'Ihre Design Journey™ hat begonnen.',
            'failed':   'Wir konnten Ihre Journey nicht starten. Bitte versuchen Sie es gleich noch einmal.',
        },
    },
    'es-ES': {
        'space': {'home': 'Casa', 'showroom': 'Showroom', 'hospitality': 'Hospitalidad',
                  'office': 'Oficina', 'other': 'Un espacio dedicado'},
        'guests': {'often': 'Sí, a menudo', 'sometimes': 'A veces',
                   'rarely': 'Rara vez', 'alone': 'Habito el espacio en soledad'},
        'materials': {'wood': 'Madera', 'stone': 'Piedra', 'textiles': 'Tejidos naturales',
                      'metals': 'Metales cálidos', 'glass': 'Cristal', 'velvet': 'Terciopelo',
                      'marble': 'Mármol', 'linen': 'Lino'},
        'ambiance': {'warm': 'Cálidos y envolventes', 'sober': 'Sobrios y minimalistas',
                     'luminous': 'Luminosos y aireados', 'tactile': 'Táctiles y sensoriales',
                     'cinematic': 'Cinematográficos'},
        'step1': {'eyebrow': 'Primer Paso · Atmósfera',           'short': 'Atmósfera'},
        'step2': {'eyebrow': 'Segundo Paso · Cómo vives',         'short': 'Cómo vives'},
        'step3': {'eyebrow': 'Último Paso · Pongámonos en contacto','short': 'Pongámonos en contacto'},
        'toast': {
            'required': 'Déjanos al menos tu nombre y un correo para escribirte.',
            'started':  'Tu Design Journey™ ha comenzado.',
            'failed':   'No hemos podido iniciar tu Journey. Inténtalo de nuevo en un momento.',
        },
    },
    'ar': {
        'space': {'home': 'المنزل', 'showroom': 'صالة العرض', 'hospitality': 'الضيافة',
                  'office': 'المكتب', 'other': 'فضاء مخصص'},
        'guests': {'often': 'نعم، كثيرًا', 'sometimes': 'أحيانًا',
                   'rarely': 'نادرًا', 'alone': 'أعيش الفضاء في عزلة'},
        'materials': {'wood': 'خشب', 'stone': 'حجر', 'textiles': 'أقمشة طبيعية',
                      'metals': 'معادن دافئة', 'glass': 'زجاج', 'velvet': 'مخمل',
                      'marble': 'رخام', 'linen': 'كتان'},
        'ambiance': {'warm': 'دافئة ومحتضنة', 'sober': 'هادئة ومينيمالية',
                     'luminous': 'مضيئة وفسيحة', 'tactile': 'ملموسة وحسية',
                     'cinematic': 'سينمائية'},
        'step1': {'eyebrow': 'الخطوة الأولى · الأجواء',          'short': 'الأجواء'},
        'step2': {'eyebrow': 'الخطوة الثانية · كيف تعيش',         'short': 'كيف تعيش'},
        'step3': {'eyebrow': 'الخطوة الأخيرة · لنبقَ على تواصل',  'short': 'لنبقَ على تواصل'},
        'toast': {
            'required': 'اترك لنا على الأقل اسمك وبريدك الإلكتروني لنكتب إليك.',
            'started':  'بدأت رحلة التصميم™ الخاصة بك.',
            'failed':   'لم نتمكن من بدء رحلتك. حاول مرة أخرى بعد لحظة.',
        },
    },
}


def deep_set(d, path, value):
    parts = path.split('.')
    cur = d
    for p in parts[:-1]:
        cur = cur.setdefault(p, {})
    cur[parts[-1]] = value


for loc, payload in BJ.items():
    p = LOC / f'{loc}.json'
    if not p.exists():
        print(f'  ! locale file missing: {p}')
        continue
    cur = json.loads(p.read_text(encoding='utf-8'))
    site = cur.setdefault('site', {}).setdefault('begin_journey', {})
    # space.* / guests.* / materials.* / ambiance.* / stepN.* / toast.*
    for group, items in payload.items():
        site_group = site.setdefault(group, {})
        for k, v in items.items():
            site_group[k] = v
    p.write_text(json.dumps(cur, ensure_ascii=False, indent=2) + '\n',
                 encoding='utf-8')
    n = sum(len(v) for v in payload.values())
    print(f'  {loc} → +{n} keys')

print('\n✅ site.begin_journey.* taxonomy seeded × 7 locales.')
