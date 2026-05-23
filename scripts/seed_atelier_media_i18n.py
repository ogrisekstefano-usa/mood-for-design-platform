"""Seed atelier.media.* i18n keys × 7 locales.

ITER138 · MEDIA ORCHESTRATION REFINEMENT™ — keys for Atelier Media Direction™
composer (drop zone, preview controls, grading presets, gallery, errors).
"""
import json
from pathlib import Path

LOCALES_DIR = Path('/app/frontend/src/i18n/strings')

MEDIA = {
    'it-IT': {
        'media': {
            'eyebrow': 'Atelier · Direzione media',
            'title': 'Componi l\'atmosfera.',
            'lede': 'Carica, inquadra e gradua le immagini che respirano attraverso la tua dashboard. Ogni asset vive dentro l\'atelier — nessun link esterno.',
            'drop_title': 'Trascina un\'immagine · o sfoglia',
            'drop_hint': 'JPG · PNG · WebP — fino a 10 MB. Elaboriamo l\'asset cinematograficamente e lo conserviamo dentro l\'atelier.',
            'invalid_file': 'Per favore trascina un file immagine.',
            'too_large': 'L\'immagine supera 10 MB.',
            'file_required': 'Trascina o seleziona prima un\'immagine.',
            'mobile_blocker_zone': 'Safe zone mobile blocker — il fotogramma mostrato sui telefoni',
            'focal_hint': 'Clicca sulla tela per impostare il punto focale — l\'ancora cinematografica di questo asset.',
            'reset': 'Cambia immagine',
            'presets_label': 'Registro di grading',
            'manual_label': 'Regolazione manuale',
            'grain': 'Grana', 'vignette': 'Vignetta',
            'warmth': 'Calore', 'cyan': 'Atmosfera ciano', 'overlay': 'Intensità overlay',
            'metadata_label': 'Metadati asset',
            'alt_text': 'Testo alternativo',
            'alt_placeholder': 'Interno architettonico luxury · calore atmosferico',
            'kind': 'Ruolo', 'locale_label': 'Lingua',
            'kind_hero': 'Hero', 'kind_project': 'Card progetto', 'kind_inspir': 'Ispirazione',
            'publish': 'Pubblica nell\'atelier',
            'publishing': 'Composizione nell\'atelier…',
            'uploaded': 'Asset composto nell\'atelier.',
            'updated': 'Composizione aggiornata.',
            'archived': 'Asset archiviato.',
            'confirm_archive': 'Archiviare questo asset?',
            'gallery_label': 'Banco media atelier',
            'gallery_empty': 'Nessun asset composto. Trascina la prima immagine qui sopra.',
        }
    },
    'en-US': {
        'media': {
            'eyebrow': 'Atelier · Media Direction',
            'title': 'Compose the atmosphere.',
            'lede': 'Upload, frame and grade the images that breathe through your dashboard. Every asset lives inside the atelier — no external links.',
            'drop_title': 'Drop an image · or browse',
            'drop_hint': 'JPG · PNG · WebP — up to 10 MB. We process the asset cinematically and store it inside the atelier.',
            'invalid_file': 'Please drop an image file.',
            'too_large': 'Image exceeds 10 MB.',
            'file_required': 'Drop or select an image first.',
            'mobile_blocker_zone': 'Mobile blocker safe zone — the still frame shown on phones',
            'focal_hint': 'Click the canvas to set the focal point — the cinematic anchor of this asset.',
            'reset': 'Pick another image',
            'presets_label': 'Grading register',
            'manual_label': 'Manual fine-tuning',
            'grain': 'Grain', 'vignette': 'Vignette',
            'warmth': 'Warmth', 'cyan': 'Cyan atmosphere', 'overlay': 'Overlay intensity',
            'metadata_label': 'Asset metadata',
            'alt_text': 'Alt text',
            'alt_placeholder': 'Architectural luxury interior · atmospheric warmth',
            'kind': 'Role', 'locale_label': 'Locale',
            'kind_hero': 'Hero', 'kind_project': 'Project card', 'kind_inspir': 'Inspiration',
            'publish': 'Publish into the atelier',
            'publishing': 'Composing into atelier…',
            'uploaded': 'Asset composed into the atelier.',
            'updated': 'Composition updated.',
            'archived': 'Asset archived.',
            'confirm_archive': 'Archive this asset?',
            'gallery_label': 'Atelier media bank',
            'gallery_empty': 'No assets composed yet. Drop your first image above.',
        }
    },
    'en-GB': {
        'media': {
            'eyebrow': 'Atelier · Media Direction',
            'title': 'Compose the atmosphere.',
            'lede': 'Upload, frame and grade the imagery that breathes through your dashboard. Every asset lives inside the atelier — no external links.',
            'drop_title': 'Drop an image · or browse',
            'drop_hint': 'JPG · PNG · WebP — up to 10 MB. We process the asset cinematically and store it within the atelier.',
            'invalid_file': 'Please drop an image file.',
            'too_large': 'Image exceeds 10 MB.',
            'file_required': 'Drop or select an image first.',
            'mobile_blocker_zone': 'Mobile blocker safe zone — the still frame shown on phones',
            'focal_hint': 'Tap the canvas to set the focal point — the cinematic anchor of this asset.',
            'reset': 'Pick another image',
            'presets_label': 'Grading register',
            'manual_label': 'Manual fine-tuning',
            'grain': 'Grain', 'vignette': 'Vignette',
            'warmth': 'Warmth', 'cyan': 'Cyan atmosphere', 'overlay': 'Overlay intensity',
            'metadata_label': 'Asset metadata',
            'alt_text': 'Alt text',
            'alt_placeholder': 'Architectural luxury interior · atmospheric warmth',
            'kind': 'Role', 'locale_label': 'Locale',
            'kind_hero': 'Hero', 'kind_project': 'Project card', 'kind_inspir': 'Inspiration',
            'publish': 'Publish into the atelier',
            'publishing': 'Composing into atelier…',
            'uploaded': 'Asset composed into the atelier.',
            'updated': 'Composition updated.',
            'archived': 'Asset archived.',
            'confirm_archive': 'Archive this asset?',
            'gallery_label': 'Atelier media bank',
            'gallery_empty': 'No assets composed yet. Drop your first image above.',
        }
    },
    'fr-FR': {
        'media': {
            'eyebrow': 'Atelier · Direction des médias',
            'title': 'Composez l\'atmosphère.',
            'lede': 'Téléversez, cadrez et étalonnez les images qui respirent à travers votre tableau de bord. Chaque actif vit dans l\'atelier — aucun lien externe.',
            'drop_title': 'Déposez une image · ou parcourez',
            'drop_hint': 'JPG · PNG · WebP — jusqu\'à 10 Mo. Nous traitons l\'actif de manière cinématographique et le conservons dans l\'atelier.',
            'invalid_file': 'Veuillez déposer un fichier image.',
            'too_large': 'L\'image dépasse 10 Mo.',
            'file_required': 'Déposez ou sélectionnez d\'abord une image.',
            'mobile_blocker_zone': 'Zone de sécurité du bloqueur mobile — l\'image fixe affichée sur les téléphones',
            'focal_hint': 'Cliquez sur la toile pour définir le point focal — l\'ancre cinématographique de cet actif.',
            'reset': 'Choisir une autre image',
            'presets_label': 'Registre d\'étalonnage',
            'manual_label': 'Ajustement manuel',
            'grain': 'Grain', 'vignette': 'Vignettage',
            'warmth': 'Chaleur', 'cyan': 'Atmosphère cyan', 'overlay': 'Intensité du voile',
            'metadata_label': 'Métadonnées de l\'actif',
            'alt_text': 'Texte alternatif',
            'alt_placeholder': 'Intérieur architectural de luxe · chaleur atmosphérique',
            'kind': 'Rôle', 'locale_label': 'Langue',
            'kind_hero': 'Héros', 'kind_project': 'Carte projet', 'kind_inspir': 'Inspiration',
            'publish': 'Publier dans l\'atelier',
            'publishing': 'Composition dans l\'atelier…',
            'uploaded': 'Actif composé dans l\'atelier.',
            'updated': 'Composition mise à jour.',
            'archived': 'Actif archivé.',
            'confirm_archive': 'Archiver cet actif ?',
            'gallery_label': 'Banque média de l\'atelier',
            'gallery_empty': 'Aucun actif composé. Déposez votre première image ci-dessus.',
        }
    },
    'de-DE': {
        'media': {
            'eyebrow': 'Atelier · Mediendirektion',
            'title': 'Atmosphäre komponieren.',
            'lede': 'Laden Sie Bilder hoch, rahmen Sie sie ein und stufen Sie sie ab — sie durchatmen Ihr Dashboard. Jedes Asset lebt im Atelier — keine externen Links.',
            'drop_title': 'Bild hierher ziehen · oder durchsuchen',
            'drop_hint': 'JPG · PNG · WebP — bis zu 10 MB. Wir verarbeiten das Asset kinematografisch und speichern es im Atelier.',
            'invalid_file': 'Bitte legen Sie eine Bilddatei ab.',
            'too_large': 'Bild überschreitet 10 MB.',
            'file_required': 'Zuerst ein Bild ablegen oder auswählen.',
            'mobile_blocker_zone': 'Mobile-Blocker-Sicherheitszone — das Standbild auf Telefonen',
            'focal_hint': 'Klicken Sie auf die Leinwand, um den Fokuspunkt zu setzen — der kinematografische Anker dieses Assets.',
            'reset': 'Anderes Bild wählen',
            'presets_label': 'Grading-Register',
            'manual_label': 'Manuelle Feinabstimmung',
            'grain': 'Korn', 'vignette': 'Vignettierung',
            'warmth': 'Wärme', 'cyan': 'Cyan-Atmosphäre', 'overlay': 'Overlay-Intensität',
            'metadata_label': 'Asset-Metadaten',
            'alt_text': 'Alternativtext',
            'alt_placeholder': 'Architektonisches Luxus-Interieur · atmosphärische Wärme',
            'kind': 'Rolle', 'locale_label': 'Sprache',
            'kind_hero': 'Hero', 'kind_project': 'Projektkarte', 'kind_inspir': 'Inspiration',
            'publish': 'Im Atelier veröffentlichen',
            'publishing': 'Komposition im Atelier…',
            'uploaded': 'Asset im Atelier komponiert.',
            'updated': 'Komposition aktualisiert.',
            'archived': 'Asset archiviert.',
            'confirm_archive': 'Dieses Asset archivieren?',
            'gallery_label': 'Atelier-Medienbank',
            'gallery_empty': 'Noch keine Assets komponiert. Legen Sie Ihr erstes Bild oben ab.',
        }
    },
    'es-ES': {
        'media': {
            'eyebrow': 'Atelier · Dirección de medios',
            'title': 'Compón la atmósfera.',
            'lede': 'Sube, encuadra y gradúa las imágenes que respiran a través de tu panel. Cada activo vive dentro del atelier — sin enlaces externos.',
            'drop_title': 'Suelta una imagen · o explora',
            'drop_hint': 'JPG · PNG · WebP — hasta 10 MB. Procesamos el activo cinematográficamente y lo guardamos dentro del atelier.',
            'invalid_file': 'Por favor suelta un archivo de imagen.',
            'too_large': 'La imagen excede 10 MB.',
            'file_required': 'Suelta o selecciona primero una imagen.',
            'mobile_blocker_zone': 'Zona segura del bloqueador móvil — el fotograma mostrado en teléfonos',
            'focal_hint': 'Haz clic en el lienzo para establecer el punto focal — el ancla cinematográfica de este activo.',
            'reset': 'Elegir otra imagen',
            'presets_label': 'Registro de gradación',
            'manual_label': 'Ajuste manual',
            'grain': 'Grano', 'vignette': 'Viñeta',
            'warmth': 'Calidez', 'cyan': 'Atmósfera cian', 'overlay': 'Intensidad de superposición',
            'metadata_label': 'Metadatos del activo',
            'alt_text': 'Texto alternativo',
            'alt_placeholder': 'Interior arquitectónico de lujo · calidez atmosférica',
            'kind': 'Rol', 'locale_label': 'Idioma',
            'kind_hero': 'Hero', 'kind_project': 'Tarjeta proyecto', 'kind_inspir': 'Inspiración',
            'publish': 'Publicar en el atelier',
            'publishing': 'Componiendo en el atelier…',
            'uploaded': 'Activo compuesto en el atelier.',
            'updated': 'Composición actualizada.',
            'archived': 'Activo archivado.',
            'confirm_archive': '¿Archivar este activo?',
            'gallery_label': 'Banco de medios del atelier',
            'gallery_empty': 'Aún no hay activos compuestos. Suelta tu primera imagen arriba.',
        }
    },
    'ar': {
        'media': {
            'eyebrow': 'الورشة · إدارة الوسائط',
            'title': 'اصنع الأجواء.',
            'lede': 'حمِّل، أطِّر ودرِّج الصور التي تتنفس عبر لوحتك. كل أصل يعيش داخل الورشة — لا روابط خارجية.',
            'drop_title': 'أفلِت صورة · أو تصفّح',
            'drop_hint': 'JPG · PNG · WebP — حتى 10 ميغابايت. نعالج الأصل سينمائياً ونحفظه داخل الورشة.',
            'invalid_file': 'من فضلك أفلت ملف صورة.',
            'too_large': 'الصورة تتجاوز 10 ميغابايت.',
            'file_required': 'أفلت أو اختر صورة أولاً.',
            'mobile_blocker_zone': 'منطقة آمنة لحاجب الجوال — الإطار الثابت المعروض على الهواتف',
            'focal_hint': 'انقر على اللوحة لتحديد نقطة التركيز — المرساة السينمائية لهذا الأصل.',
            'reset': 'اختر صورة أخرى',
            'presets_label': 'سجل التدرّج',
            'manual_label': 'ضبط يدوي',
            'grain': 'الحبيبة', 'vignette': 'الفينييت',
            'warmth': 'الدفء', 'cyan': 'أجواء السيان', 'overlay': 'كثافة الطبقة',
            'metadata_label': 'بيانات الأصل',
            'alt_text': 'النص البديل',
            'alt_placeholder': 'داخلية معمارية فاخرة · دفء أجواء',
            'kind': 'الدور', 'locale_label': 'اللغة',
            'kind_hero': 'البطل', 'kind_project': 'بطاقة المشروع', 'kind_inspir': 'الإلهام',
            'publish': 'انشر في الورشة',
            'publishing': 'تأليف في الورشة…',
            'uploaded': 'أصل مؤلَّف في الورشة.',
            'updated': 'تم تحديث التأليف.',
            'archived': 'تم أرشفة الأصل.',
            'confirm_archive': 'أرشفة هذا الأصل؟',
            'gallery_label': 'بنك وسائط الورشة',
            'gallery_empty': 'لا توجد أصول مؤلَّفة بعد. أفلت صورتك الأولى أعلاه.',
        }
    },
}

FILES = ['it-IT.json', 'en-US.json', 'en-GB.json', 'fr-FR.json',
         'de-DE.json', 'es-ES.json', 'ar.json']


def deep_merge(a, b):
    out = dict(a)
    for k, v in b.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


for f in FILES:
    loc = f.replace('.json', '')
    p = LOCALES_DIR / f
    cur = json.loads(p.read_text(encoding='utf-8'))
    atelier = cur.get('atelier', {})
    atelier = deep_merge(atelier, MEDIA[loc])
    cur['atelier'] = atelier
    p.write_text(json.dumps(cur, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'  {loc} → atelier.media seeded ({len(MEDIA[loc]["media"])} keys)')

print('\n✅ atelier.media keys seeded across 7 locales.')
