"""Seed atelier.dashboard.* i18n keys across all 7 locales.

ITER138 · Phase 2 (DB-driven dashboard). Inserts the dashboard copy
namespace into the existing locale registries so AtelierDashboardPage
resolves every string via t() with no English-only leftovers.

Idempotent: re-running merges new keys without overwriting curated values.
"""
from __future__ import annotations
import json
from pathlib import Path

LOCALES_DIR = Path('/app/frontend/src/i18n/strings')

# Per-locale dashboard registry. Italian is source-of-truth; non-IT entries
# are editorially reinterpreted, not literally translated.
ATELIER = {
    'it-IT': {
        'dashboard': {
            'hero': {
                'greeting': { 'morning': 'Buongiorno', 'afternoon': 'Buon pomeriggio', 'evening': 'Buonasera' },
                'eyebrow': 'Studio Pulse™ · Ritmo Progettuale',
                'summary_template': '{active} Journey in respiro · {voices} voci ricevute oggi',
                'signature': 'Diamo forma a spazi belli.',
            },
            'kpi': {
                'active_journeys':    'Journey attivi',
                'dossier_in_progress':'Dossier in corso',
                'awaiting_feedback':  'In attesa di voce',
                'deliveries_week':    'Consegne della settimana',
            },
            'card': {
                'status': {
                    'in_progress': 'IN CORSO', 'in_review': 'IN RIVISTA', 'new': 'NUOVO',
                    'listening':   'IN ASCOLTO', 'approved': 'APPROVATO',
                    'delivered':   'CONSEGNATO', 'paused': 'IN PAUSA', 'active': 'ATTIVO',
                },
                'untitled':   'Journey senza titolo',
                'updated':    'Aggiornato {when}',
                'no_updates': 'In attesa del primo capitolo',
            },
            'col': {
                'recent_activity':     'Movimenti recenti',
                'upcoming_milestones': 'Prossimi capitoli',
                'daily_inspiration':   'Ispirazione del giorno',
                'activity_empty':      "Nessun movimento. Lo studio respira in silenzio.",
                'milestones_empty':    "In attesa del prossimo capitolo.",
                'inspiration_empty':   "Nessuna citazione curata ancora.",
            },
            'projects': {
                'title':     'Journey in respiro',
                'see_all':   'Vedi tutti',
                'empty':     "Il tuo atelier è in silenzio. Il prossimo journey aspetta di iniziare.",
                'empty_cta': 'Inizia un nuovo journey',
            },
            'time': {
                'just_now':  'adesso',
                'hours_ago': '{n}h fa',
                'yesterday': 'ieri',
                'days_ago':  '{n} giorni fa',
            },
        }
    },
    'en-US': {
        'dashboard': {
            'hero': {
                'greeting': { 'morning': 'Good morning', 'afternoon': 'Good afternoon', 'evening': 'Good evening' },
                'eyebrow': 'Studio Pulse™ · Project Rhythm',
                'summary_template': '{active} Journeys unfolding · {voices} voices received today',
                'signature': "Let's shape beautiful spaces.",
            },
            'kpi': {
                'active_journeys':    'Active Journeys',
                'dossier_in_progress':'Dossier in progress',
                'awaiting_feedback':  'Awaiting feedback',
                'deliveries_week':    'Deliveries this week',
            },
            'card': {
                'status': {
                    'in_progress': 'IN PROGRESS', 'in_review': 'IN REVIEW', 'new': 'NEW',
                    'listening':   'LISTENING',   'approved': 'APPROVED',
                    'delivered':   'DELIVERED',   'paused': 'PAUSED', 'active': 'ACTIVE',
                },
                'untitled':   'Untitled journey',
                'updated':    'Updated {when}',
                'no_updates': 'Awaiting first chapter',
            },
            'col': {
                'recent_activity':     'Recent activity',
                'upcoming_milestones': 'Upcoming milestones',
                'daily_inspiration':   'Daily inspiration',
                'activity_empty':      'No movement yet. The studio breathes in silence.',
                'milestones_empty':    'Awaiting the next chapter.',
                'inspiration_empty':   'No quote curated yet.',
            },
            'projects': {
                'title':     'Journeys unfolding',
                'see_all':   'See all',
                'empty':     'Your atelier is in silence. The next journey is waiting to begin.',
                'empty_cta': 'Begin a new journey',
            },
            'time': {
                'just_now':  'just now', 'hours_ago': '{n}h ago',
                'yesterday': 'yesterday', 'days_ago': '{n} days ago',
            },
        }
    },
    'en-GB': {
        'dashboard': {
            'hero': {
                'greeting': { 'morning': 'Good morning', 'afternoon': 'Good afternoon', 'evening': 'Good evening' },
                'eyebrow': 'Studio Pulse™ · Project Rhythm',
                'summary_template': '{active} journeys in motion · {voices} voices received today',
                'signature': 'Let us shape considered spaces.',
            },
            'kpi': {
                'active_journeys':    'Active Journeys',
                'dossier_in_progress':'Dossier in progress',
                'awaiting_feedback':  'Awaiting response',
                'deliveries_week':    'Deliveries this week',
            },
            'card': {
                'status': {
                    'in_progress': 'IN PROGRESS', 'in_review': 'UNDER REVIEW', 'new': 'NEW',
                    'listening':   'LISTENING',   'approved': 'APPROVED',
                    'delivered':   'DELIVERED',   'paused': 'PAUSED', 'active': 'ACTIVE',
                },
                'untitled':   'Untitled journey',
                'updated':    'Updated {when}',
                'no_updates': 'Awaiting first chapter',
            },
            'col': {
                'recent_activity':     'Recent activity',
                'upcoming_milestones': 'Upcoming milestones',
                'daily_inspiration':   'Daily inspiration',
                'activity_empty':      'No recent movement. The studio is in considered silence.',
                'milestones_empty':    'Awaiting the next chapter.',
                'inspiration_empty':   'No quote curated yet.',
            },
            'projects': {
                'title':     'Journeys in motion',
                'see_all':   'See all',
                'empty':     'Your atelier rests in quiet. The next journey awaits its first chapter.',
                'empty_cta': 'Begin a new journey',
            },
            'time': {
                'just_now':  'just now', 'hours_ago': '{n}h ago',
                'yesterday': 'yesterday', 'days_ago': '{n} days ago',
            },
        }
    },
    'fr-FR': {
        'dashboard': {
            'hero': {
                'greeting': { 'morning': 'Bonjour', 'afternoon': 'Bon après-midi', 'evening': 'Bonsoir' },
                'eyebrow': 'Studio Pulse™ · Rythme du Projet',
                'summary_template': '{active} parcours en souffle · {voices} voix reçues aujourd\'hui',
                'signature': 'Donnons forme à des espaces qui touchent.',
            },
            'kpi': {
                'active_journeys':    'Parcours actifs',
                'dossier_in_progress':'Dossiers en cours',
                'awaiting_feedback':  'En attente de voix',
                'deliveries_week':    'Livraisons de la semaine',
            },
            'card': {
                'status': {
                    'in_progress': 'EN COURS', 'in_review': 'EN REVUE', 'new': 'NOUVEAU',
                    'listening':   'À L\'ÉCOUTE', 'approved': 'APPROUVÉ',
                    'delivered':   'LIVRÉ', 'paused': 'EN PAUSE', 'active': 'ACTIF',
                },
                'untitled':   'Parcours sans titre',
                'updated':    'Actualisé {when}',
                'no_updates': 'En attente du premier chapitre',
            },
            'col': {
                'recent_activity':     'Mouvements récents',
                'upcoming_milestones': 'Prochains chapitres',
                'daily_inspiration':   'Inspiration du jour',
                'activity_empty':      'Aucun mouvement. L\'atelier respire en silence.',
                'milestones_empty':    'En attente du prochain chapitre.',
                'inspiration_empty':   'Aucune citation à l\'horizon.',
            },
            'projects': {
                'title':     'Parcours en souffle',
                'see_all':   'Voir tout',
                'empty':     'Votre atelier est en silence. Le prochain parcours attend de commencer.',
                'empty_cta': 'Commencer un parcours',
            },
            'time': {
                'just_now':  'à l\'instant', 'hours_ago': 'il y a {n}h',
                'yesterday': 'hier', 'days_ago': 'il y a {n} jours',
            },
        }
    },
    'de-DE': {
        'dashboard': {
            'hero': {
                'greeting': { 'morning': 'Guten Morgen', 'afternoon': 'Guten Tag', 'evening': 'Guten Abend' },
                'eyebrow': 'Studio Pulse™ · Projekt-Rhythmus',
                'summary_template': '{active} Journeys im Atemzug · {voices} Stimmen heute eingegangen',
                'signature': 'Wir formen Räume mit Bedeutung.',
            },
            'kpi': {
                'active_journeys':    'Aktive Journeys',
                'dossier_in_progress':'Dossier in Arbeit',
                'awaiting_feedback':  'Antwort ausstehend',
                'deliveries_week':    'Lieferungen diese Woche',
            },
            'card': {
                'status': {
                    'in_progress': 'IN ARBEIT', 'in_review': 'IM REVIEW', 'new': 'NEU',
                    'listening':   'IM ZUHÖREN', 'approved': 'FREIGEGEBEN',
                    'delivered':   'GELIEFERT', 'paused': 'PAUSIERT', 'active': 'AKTIV',
                },
                'untitled':   'Journey ohne Titel',
                'updated':    'Aktualisiert {when}',
                'no_updates': 'Wartet auf erstes Kapitel',
            },
            'col': {
                'recent_activity':     'Aktuelle Bewegung',
                'upcoming_milestones': 'Nächste Kapitel',
                'daily_inspiration':   'Tägliche Inspiration',
                'activity_empty':      'Noch keine Bewegung. Das Atelier atmet in Stille.',
                'milestones_empty':    'Wartet auf das nächste Kapitel.',
                'inspiration_empty':   'Noch kein Zitat kuratiert.',
            },
            'projects': {
                'title':     'Journeys im Atemzug',
                'see_all':   'Alle ansehen',
                'empty':     'Ihr Atelier ruht in Stille. Die nächste Journey wartet auf ihren Beginn.',
                'empty_cta': 'Neue Journey beginnen',
            },
            'time': {
                'just_now':  'gerade eben', 'hours_ago': 'vor {n}h',
                'yesterday': 'gestern', 'days_ago': 'vor {n} Tagen',
            },
        }
    },
    'es-ES': {
        'dashboard': {
            'hero': {
                'greeting': { 'morning': 'Buenos días', 'afternoon': 'Buenas tardes', 'evening': 'Buenas noches' },
                'eyebrow': 'Studio Pulse™ · Ritmo del Proyecto',
                'summary_template': '{active} Journeys en respiración · {voices} voces recibidas hoy',
                'signature': 'Demos forma a espacios bellos.',
            },
            'kpi': {
                'active_journeys':    'Journeys activos',
                'dossier_in_progress':'Dossier en curso',
                'awaiting_feedback':  'A la espera de voz',
                'deliveries_week':    'Entregas de la semana',
            },
            'card': {
                'status': {
                    'in_progress': 'EN CURSO', 'in_review': 'EN REVISIÓN', 'new': 'NUEVO',
                    'listening':   'EN ESCUCHA', 'approved': 'APROBADO',
                    'delivered':   'ENTREGADO', 'paused': 'EN PAUSA', 'active': 'ACTIVO',
                },
                'untitled':   'Journey sin título',
                'updated':    'Actualizado {when}',
                'no_updates': 'A la espera del primer capítulo',
            },
            'col': {
                'recent_activity':     'Movimientos recientes',
                'upcoming_milestones': 'Próximos capítulos',
                'daily_inspiration':   'Inspiración del día',
                'activity_empty':      'Sin movimientos. El estudio respira en silencio.',
                'milestones_empty':    'A la espera del próximo capítulo.',
                'inspiration_empty':   'Aún no hay cita curada.',
            },
            'projects': {
                'title':     'Journeys en respiración',
                'see_all':   'Ver todos',
                'empty':     'Tu atelier reposa en silencio. El próximo journey espera comenzar.',
                'empty_cta': 'Iniciar un nuevo journey',
            },
            'time': {
                'just_now':  'ahora', 'hours_ago': 'hace {n}h',
                'yesterday': 'ayer', 'days_ago': 'hace {n} días',
            },
        }
    },
    'ar': {
        'dashboard': {
            'hero': {
                'greeting': { 'morning': 'صباح الخير', 'afternoon': 'مساء الخير', 'evening': 'مساء الخير' },
                'eyebrow': 'Studio Pulse™ · إيقاع المشروع',
                'summary_template': '{active} رحلات في تنفّس · {voices} أصوات وصلت اليوم',
                'signature': 'لِنشكّل فضاءات جميلة معاً.',
            },
            'kpi': {
                'active_journeys':    'الرحلات النشطة',
                'dossier_in_progress':'ملفّات قيد العمل',
                'awaiting_feedback':  'في انتظار الصوت',
                'deliveries_week':    'تسليمات هذا الأسبوع',
            },
            'card': {
                'status': {
                    'in_progress': 'قيد التنفيذ', 'in_review': 'قيد المراجعة', 'new': 'جديد',
                    'listening':   'إصغاء', 'approved': 'مُعتمد',
                    'delivered':   'مُسلَّم', 'paused': 'متوقف', 'active': 'نشط',
                },
                'untitled':   'رحلة بلا عنوان',
                'updated':    'حُدّث {when}',
                'no_updates': 'في انتظار الفصل الأول',
            },
            'col': {
                'recent_activity':     'الحراك الأخير',
                'upcoming_milestones': 'الفصول القادمة',
                'daily_inspiration':   'إلهام اليوم',
                'activity_empty':      'لا حراك بعد. الورشة تتنفّس في صمت.',
                'milestones_empty':    'في انتظار الفصل التالي.',
                'inspiration_empty':   'لم تُختر اقتباس بعد.',
            },
            'projects': {
                'title':     'الرحلات في تنفّس',
                'see_all':   'عرض الكل',
                'empty':     'ورشتك تستريح في صمت. الرحلة التالية تنتظر بدايتها.',
                'empty_cta': 'ابدأ رحلة جديدة',
            },
            'time': {
                'just_now':  'الآن', 'hours_ago': 'قبل {n} ساعة',
                'yesterday': 'الأمس', 'days_ago': 'قبل {n} أيام',
            },
        }
    },
}

LOCALE_FILES = {
    'it-IT': 'it-IT.json',
    'en-US': 'en-US.json',
    'en-GB': 'en-GB.json',
    'fr-FR': 'fr-FR.json',
    'de-DE': 'de-DE.json',
    'es-ES': 'es-ES.json',
    'ar':    'ar.json',
}


def deep_merge(base: dict, layer: dict) -> dict:
    """Merge layer into base. layer values overwrite scalar leaves; nested
    dicts are merged recursively. Does NOT mutate `base`."""
    out = dict(base)
    for k, v in layer.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def count_keys(d, prefix=''):
    n = 0
    for k, v in d.items():
        if isinstance(v, dict):
            n += count_keys(v, prefix + k + '.')
        else:
            n += 1
    return n


def main():
    for loc, fname in LOCALE_FILES.items():
        path = LOCALES_DIR / fname
        existing = json.loads(path.read_text(encoding='utf-8'))
        new_layer = {'atelier': ATELIER[loc]}
        merged = deep_merge(existing, new_layer)
        path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        added = count_keys(ATELIER[loc])
        print(f'  {loc:6s} → {fname:15s} merged · +{added} atelier.dashboard keys')

    print('\n✅ atelier.dashboard.* seeded across 7 locales.')


if __name__ == '__main__':
    main()
