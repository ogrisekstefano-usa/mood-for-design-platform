"""Seed atelier.admin.* + settings.atelier_dashboard.* i18n keys."""
import json
from pathlib import Path

LOCALES_DIR = Path('/app/frontend/src/i18n/strings')

ADMIN = {
    'it-IT': {
        'admin': {
            'back': 'Torna alle impostazioni',
            'eyebrow': 'Atelier · Identità dello studio',
            'title': 'Dashboard Atelier',
            'lede': 'Cura la copy del hero, l\'immagine cinematografica e la libreria di citazioni ispirazionali che compongono la dashboard Studio Pulse™. Le sovrascritture per lingua si applicano in cascata automatica.',
            'tab': {'copy': 'Hero e sezioni', 'media': 'Libreria media', 'quotes': 'Citazioni ispirazionali'},
            'locale': 'Lingua target', 'use_i18n': 'vuoto → usa i18n',
            'media_library': 'Libreria media', 'add_media': 'Aggiungi nuovo media',
            'quote_library': 'Libreria citazioni', 'add_quote': 'Aggiungi nuova citazione',
            'add': 'Aggiungi', 'save_copy': 'Salva sovrascrittura copy',
            'copy_saved': 'Copy atelier salvata', 'media_added': 'Media aggiunto',
            'media_archived': 'Media archiviato', 'quote_added': 'Citazione aggiunta',
            'quote_archived': 'Citazione archiviata',
            'url_required': 'URL immagine obbligatorio', 'quote_required': 'Testo citazione obbligatorio',
            'confirm_archive': 'Archiviare questo asset media?',
            'confirm_archive_quote': 'Archiviare questa citazione?',
        }
    },
    'en-US': {
        'admin': {
            'back': 'Back to settings', 'eyebrow': 'Atelier · Studio Identity',
            'title': 'Dashboard Atelier',
            'lede': 'Curate the hero copy, cinematic imagery and inspiration quote library that compose the Studio Pulse™ dashboard. Per-locale overrides cascade automatically.',
            'tab': {'copy': 'Hero & Sections', 'media': 'Media Library', 'quotes': 'Inspiration Quotes'},
            'locale': 'Target locale', 'use_i18n': 'leave empty → use i18n',
            'media_library': 'Media Library', 'add_media': 'Add new media',
            'quote_library': 'Inspiration Quote Library', 'add_quote': 'Add new quote',
            'add': 'Add', 'save_copy': 'Save copy override',
            'copy_saved': 'Atelier copy saved', 'media_added': 'Media added',
            'media_archived': 'Media archived', 'quote_added': 'Quote added',
            'quote_archived': 'Quote archived',
            'url_required': 'Image URL required', 'quote_required': 'Quote text required',
            'confirm_archive': 'Archive this media asset?', 'confirm_archive_quote': 'Archive this quote?',
        }
    },
    'en-GB': {
        'admin': {
            'back': 'Back to settings', 'eyebrow': 'Atelier · Studio Identity',
            'title': 'Dashboard Atelier',
            'lede': 'Curate the hero copy, cinematic imagery and inspiration quote library that compose the Studio Pulse™ dashboard. Per-locale overrides cascade automatically.',
            'tab': {'copy': 'Hero & Sections', 'media': 'Media Library', 'quotes': 'Inspiration Quotes'},
            'locale': 'Target locale', 'use_i18n': 'leave empty → use i18n',
            'media_library': 'Media Library', 'add_media': 'Add new media',
            'quote_library': 'Inspiration Quote Library', 'add_quote': 'Add new quote',
            'add': 'Add', 'save_copy': 'Save copy override',
            'copy_saved': 'Atelier copy saved', 'media_added': 'Media added',
            'media_archived': 'Media archived', 'quote_added': 'Quote added',
            'quote_archived': 'Quote archived',
            'url_required': 'Image URL required', 'quote_required': 'Quote text required',
            'confirm_archive': 'Archive this media asset?', 'confirm_archive_quote': 'Archive this quote?',
        }
    },
    'fr-FR': {
        'admin': {
            'back': 'Retour aux paramètres', 'eyebrow': 'Atelier · Identité du Studio',
            'title': 'Dashboard Atelier',
            'lede': "Curatez la copy du hero, l'imagerie cinématographique et la bibliothèque de citations qui composent le tableau de bord Studio Pulse™. Les surcharges par langue s'appliquent en cascade.",
            'tab': {'copy': 'Hero & Sections', 'media': 'Bibliothèque Média', 'quotes': "Citations d'inspiration"},
            'locale': 'Langue cible', 'use_i18n': 'vide → utiliser i18n',
            'media_library': 'Bibliothèque Média', 'add_media': 'Ajouter un média',
            'quote_library': 'Bibliothèque de citations', 'add_quote': 'Ajouter une citation',
            'add': 'Ajouter', 'save_copy': 'Enregistrer la copy',
            'copy_saved': 'Copy atelier enregistrée', 'media_added': 'Média ajouté',
            'media_archived': 'Média archivé', 'quote_added': 'Citation ajoutée',
            'quote_archived': 'Citation archivée',
            'url_required': "URL d'image requise", 'quote_required': 'Texte de citation requis',
            'confirm_archive': 'Archiver cet asset ?', 'confirm_archive_quote': 'Archiver cette citation ?',
        }
    },
    'de-DE': {
        'admin': {
            'back': 'Zurück zu den Einstellungen', 'eyebrow': 'Atelier · Studio-Identität',
            'title': 'Dashboard Atelier',
            'lede': 'Kuratieren Sie Hero-Copy, kinematische Bildsprache und die Zitatbibliothek, die das Studio Pulse™ Dashboard prägen. Sprachspezifische Überschreibungen werden automatisch kaskadiert.',
            'tab': {'copy': 'Hero & Sektionen', 'media': 'Medien-Bibliothek', 'quotes': 'Inspirationszitate'},
            'locale': 'Ziel-Sprache', 'use_i18n': 'leer → i18n verwenden',
            'media_library': 'Medien-Bibliothek', 'add_media': 'Neues Medium hinzufügen',
            'quote_library': 'Zitatbibliothek', 'add_quote': 'Neues Zitat hinzufügen',
            'add': 'Hinzufügen', 'save_copy': 'Copy-Überschreibung speichern',
            'copy_saved': 'Atelier-Copy gespeichert', 'media_added': 'Medium hinzugefügt',
            'media_archived': 'Medium archiviert', 'quote_added': 'Zitat hinzugefügt',
            'quote_archived': 'Zitat archiviert',
            'url_required': 'Bild-URL erforderlich', 'quote_required': 'Zitat-Text erforderlich',
            'confirm_archive': 'Dieses Medien-Asset archivieren?', 'confirm_archive_quote': 'Dieses Zitat archivieren?',
        }
    },
    'es-ES': {
        'admin': {
            'back': 'Volver a ajustes', 'eyebrow': 'Atelier · Identidad del Estudio',
            'title': 'Dashboard Atelier',
            'lede': 'Cura la copy del hero, la imagen cinematográfica y la biblioteca de citas inspiracionales que componen el dashboard Studio Pulse™. Las sobrescrituras por idioma se aplican en cascada automática.',
            'tab': {'copy': 'Hero y secciones', 'media': 'Biblioteca de medios', 'quotes': 'Citas inspiracionales'},
            'locale': 'Idioma objetivo', 'use_i18n': 'vacío → usar i18n',
            'media_library': 'Biblioteca de medios', 'add_media': 'Añadir nuevo medio',
            'quote_library': 'Biblioteca de citas', 'add_quote': 'Añadir nueva cita',
            'add': 'Añadir', 'save_copy': 'Guardar sobrescritura',
            'copy_saved': 'Copy atelier guardada', 'media_added': 'Medio añadido',
            'media_archived': 'Medio archivado', 'quote_added': 'Cita añadida',
            'quote_archived': 'Cita archivada',
            'url_required': 'URL de imagen requerida', 'quote_required': 'Texto de cita requerido',
            'confirm_archive': '¿Archivar este asset?', 'confirm_archive_quote': '¿Archivar esta cita?',
        }
    },
    'ar': {
        'admin': {
            'back': 'العودة إلى الإعدادات', 'eyebrow': 'الورشة · هوية الاستوديو',
            'title': 'لوحة الورشة',
            'lede': 'نظِّم نص البطل والصور السينمائية ومكتبة اقتباسات الإلهام التي تُشكِّل لوحة Studio Pulse™. تُطبَّق التجاوزات حسب اللغة تلقائياً.',
            'tab': {'copy': 'البطل والأقسام', 'media': 'مكتبة الوسائط', 'quotes': 'اقتباسات الإلهام'},
            'locale': 'اللغة الهدف', 'use_i18n': 'فارغ → استخدم i18n',
            'media_library': 'مكتبة الوسائط', 'add_media': 'أضف وسيطاً جديداً',
            'quote_library': 'مكتبة الاقتباسات', 'add_quote': 'أضف اقتباساً جديداً',
            'add': 'أضف', 'save_copy': 'احفظ التجاوز',
            'copy_saved': 'تم حفظ نص الورشة', 'media_added': 'تمت إضافة الوسيط',
            'media_archived': 'تمت أرشفة الوسيط', 'quote_added': 'تمت إضافة الاقتباس',
            'quote_archived': 'تمت أرشفة الاقتباس',
            'url_required': 'رابط الصورة مطلوب', 'quote_required': 'نص الاقتباس مطلوب',
            'confirm_archive': 'هل تريد أرشفة هذا الأصل؟', 'confirm_archive_quote': 'هل تريد أرشفة هذا الاقتباس؟',
        }
    },
}

SETTINGS_TILE = {
    'it-IT': {'title': 'Dashboard Atelier',
              'sub': 'Cura immagini hero, copy cinematografica e citazioni ispirazionali per Studio Pulse™. Sovrascritture per lingua.'},
    'en-US': {'title': 'Dashboard Atelier',
              'sub': 'Curate hero imagery, cinematic copy and daily inspiration quotes for Studio Pulse™. Per-locale overrides.'},
    'en-GB': {'title': 'Dashboard Atelier',
              'sub': 'Curate hero imagery, cinematic copy and daily inspiration quotes for Studio Pulse™. Per-locale overrides.'},
    'fr-FR': {'title': 'Dashboard Atelier',
              'sub': "Curatez l'imagerie hero, la copy cinématographique et les citations d'inspiration pour Studio Pulse™. Surcharges par langue."},
    'de-DE': {'title': 'Dashboard Atelier',
              'sub': 'Kuratieren Sie Hero-Bilder, kinematische Copy und tägliche Inspirationszitate für Studio Pulse™. Sprachspezifische Überschreibungen.'},
    'es-ES': {'title': 'Dashboard Atelier',
              'sub': 'Cura imágenes del hero, copy cinematográfica y citas inspiracionales para Studio Pulse™. Sobrescrituras por idioma.'},
    'ar':    {'title': 'لوحة الورشة',
              'sub': 'نظِّم صور البطل والنص السينمائي واقتباسات الإلهام لـ Studio Pulse™. تجاوزات لكل لغة.'},
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
    # Merge atelier.admin
    atelier = cur.get('atelier', {})
    atelier = deep_merge(atelier, ADMIN[loc])
    cur['atelier'] = atelier
    # Merge settings.atelier_dashboard
    settings = cur.get('settings', {})
    settings['atelier_dashboard'] = SETTINGS_TILE[loc]
    cur['settings'] = settings
    p.write_text(json.dumps(cur, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'  {loc} → atelier.admin + settings.atelier_dashboard seeded')

print('\n✅ admin & settings keys seeded.')
