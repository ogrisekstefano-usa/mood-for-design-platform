"""Phase E-1A — Seed PLATFORM lookups for the Editorial Intelligence OS.

  cd /app/backend && python3 scripts/seed_editorial_lookups.py

7 new platform-level groups (tenant_id IS NULL, scope='platform'):
  • article_status         — variant workflow stages (with chip colors)
  • revision_option        — editorial-grade feedback (NOT "fix grammar")
  • cta_tier               — soft / medium / strong (with chip colors +
                              metadata.resulting_lifecycle_stage +
                              metadata.resulting_intent_label_key)
  • cta_intent             — what the click means (contact_studio, …)
  • editorial_tone         — cultural tension descriptors (per market)
  • editorial_pacing       — narrative pacing labels
  • editorial_lead_intent  — sub-classifier on CTA-sourced accounts
                              (inspiration_interest / qualified_editorial_lead /
                               discovery_request)

Idempotent — re-running upserts by (NULL, group_key, value_key).
"""
import sys, uuid
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv(ROOT / '.env')
from database import db


def _iso(): return datetime.now(timezone.utc).isoformat()


# Cultural-grade copywriting deck. Each value tuple is (value_key, label_jsonb, metadata|None).
EDITORIAL_LOOKUPS = {
    'article_status': [
        ('draft',                       {'it-IT': 'Bozza',                        'en-US': 'Draft',                       'en-GB': 'Draft',                       'es-ES': 'Borrador',                    'fr-FR': 'Brouillon',                    'de-DE': 'Entwurf'},                          {'color': {'bg': '#e6e2dc', 'ink': '#7a7060'}}),
        ('direction_defined',           {'it-IT': 'Direzione definita',           'en-US': 'Direction defined',           'en-GB': 'Direction defined',           'es-ES': 'Dirección definida',          'fr-FR': 'Direction définie',            'de-DE': 'Richtung definiert'},               {'color': {'bg': '#f5ecdb', 'ink': '#6b5c3c'}}),
        ('ai_composing',                {'it-IT': 'In composizione AI',           'en-US': 'AI composing',                'en-GB': 'AI composing',                'es-ES': 'IA componiendo',              'fr-FR': "Composition par l'IA",         'de-DE': 'KI in Komposition'},                {'color': {'bg': '#e6deef', 'ink': '#5b4a73'}}),
        ('ready_for_editorial_review',  {'it-IT': 'Pronto per revisione',         'en-US': 'Ready for editorial review',  'en-GB': 'Ready for editorial review',  'es-ES': 'Listo para revisión editorial','fr-FR': 'Prêt pour revue éditoriale',   'de-DE': 'Bereit für redaktionelle Prüfung'}, {'color': {'bg': '#dfe7ea', 'ink': '#3a5a6b'}}),
        ('revision_requested',          {'it-IT': 'Revisione richiesta',          'en-US': 'Revision requested',          'en-GB': 'Revision requested',          'es-ES': 'Revisión solicitada',         'fr-FR': 'Révision demandée',            'de-DE': 'Überarbeitung angefordert'},        {'color': {'bg': '#f0e4ce', 'ink': '#7a6332'}}),
        ('approved',                    {'it-IT': 'Approvato',                    'en-US': 'Approved',                    'en-GB': 'Approved',                    'es-ES': 'Aprobado',                    'fr-FR': 'Approuvé',                     'de-DE': 'Genehmigt'},                        {'color': {'bg': '#dee9e0', 'ink': '#3f6147'}}),
        ('scheduled',                   {'it-IT': 'Pianificato',                  'en-US': 'Scheduled',                   'en-GB': 'Scheduled',                   'es-ES': 'Programado',                  'fr-FR': 'Planifié',                     'de-DE': 'Geplant'},                          {'color': {'bg': '#d3e0e6', 'ink': '#2c4f63'}}),
        ('published',                   {'it-IT': 'Pubblicato',                   'en-US': 'Published',                   'en-GB': 'Published',                   'es-ES': 'Publicado',                   'fr-FR': 'Publié',                       'de-DE': 'Veröffentlicht'},                   {'color': {'bg': '#cfe1d7', 'ink': '#2e5b48'}}),
        ('archived',                    {'it-IT': 'Archiviato',                   'en-US': 'Archived',                    'en-GB': 'Archived',                    'es-ES': 'Archivado',                   'fr-FR': 'Archivé',                      'de-DE': 'Archiviert'},                       {'color': {'bg': '#e6e2dc', 'ink': '#7a7060'}}),
    ],
    'revision_option': [
        # Editorial-grade options — NO "rewrite/fix grammar/shorten".
        ('increase_hospitality_resonance',{'it-IT': 'Aumenta la risonanza ospitale',      'en-US': 'Increase hospitality resonance',     'en-GB': 'Increase hospitality resonance',     'es-ES': 'Aumentar la resonancia hospitalaria',  'fr-FR': "Renforcer la résonance d'hospitalité",  'de-DE': 'Gastlichkeit verstärken'}, None),
        ('reduce_luxury_intensity',       {'it-IT': 'Riduci l\'intensità luxury',         'en-US': 'Reduce luxury intensity',            'en-GB': 'Reduce luxury intensity',            'es-ES': 'Reducir intensidad luxury',            'fr-FR': "Atténuer l'intensité luxe",             'de-DE': 'Luxus-Intensität verringern'}, None),
        ('strengthen_material_storytelling',{'it-IT': 'Rafforza il racconto dei materiali', 'en-US': 'Strengthen material storytelling',   'en-GB': 'Strengthen material storytelling',   'es-ES': 'Fortalecer la narrativa de materiales', 'fr-FR': 'Renforcer le récit matière',           'de-DE': 'Material-Erzählung verstärken'}, None),
        ('more_architectural_authority',  {'it-IT': 'Più autorevolezza architettonica',   'en-US': 'More architectural authority',       'en-GB': 'More architectural authority',       'es-ES': 'Más autoridad arquitectónica',         'fr-FR': "Plus d'autorité architecturale",        'de-DE': 'Mehr architektonische Autorität'}, None),
        ('more_emotional_pacing',         {'it-IT': 'Cadenza più emotiva',                'en-US': 'More emotional pacing',              'en-GB': 'More emotional pacing',              'es-ES': 'Ritmo más emocional',                  'fr-FR': 'Rythme plus émotionnel',                'de-DE': 'Emotionalere Erzählweise'}, None),
        ('improve_wellness_atmosphere',   {'it-IT': 'Migliora l\'atmosfera wellness',     'en-US': 'Improve wellness atmosphere',        'en-GB': 'Improve wellness atmosphere',        'es-ES': 'Mejorar la atmósfera de bienestar',    'fr-FR': "Améliorer l'atmosphère bien-être",      'de-DE': 'Wellness-Atmosphäre verbessern'}, None),
        ('reduce_editorial_density',      {'it-IT': 'Riduci la densità editoriale',       'en-US': 'Reduce editorial density',           'en-GB': 'Reduce editorial density',           'es-ES': 'Reducir densidad editorial',           'fr-FR': 'Alléger la densité éditoriale',         'de-DE': 'Redaktionelle Dichte reduzieren'}, None),
        ('stronger_cta_transition',       {'it-IT': 'Transizione CTA più decisa',         'en-US': 'Stronger CTA transition',            'en-GB': 'Stronger CTA transition',            'es-ES': 'Transición CTA más fuerte',            'fr-FR': 'Transition CTA plus marquée',           'de-DE': 'Stärkerer CTA-Übergang'}, None),
        ('more_collectible_design_tone',  {'it-IT': 'Tono più collectible design',        'en-US': 'More collectible design tone',       'en-GB': 'More collectible design tone',       'es-ES': 'Tono más collectible design',          'fr-FR': 'Ton plus design de collection',         'de-DE': 'Mehr Collectible-Design-Ton'}, None),
        ('more_international_buyer_appeal',{'it-IT': 'Più appeal per buyer internazionali','en-US': 'More international buyer appeal',   'en-GB': 'More international buyer appeal',   'es-ES': 'Mayor atractivo para compradores internacionales','fr-FR':"Plus d'attrait pour acheteurs internationaux",'de-DE':'Mehr internationale Käuferansprache'}, None),
    ],
    'cta_tier': [
        ('soft',   {'it-IT': 'Soft',   'en-US': 'Soft',   'en-GB': 'Soft',   'es-ES': 'Suave',  'fr-FR': 'Subtil', 'de-DE': 'Subtil'},
                   {'color': {'bg': '#f5ecdb', 'ink': '#6b5c3c'}, 'resulting_lifecycle_stage': 'new_inquiry', 'resulting_intent_label_key': 'inspiration_interest'}),
        ('medium', {'it-IT': 'Medium', 'en-US': 'Medium', 'en-GB': 'Medium', 'es-ES': 'Medio',  'fr-FR': 'Modéré', 'de-DE': 'Mittel'},
                   {'color': {'bg': '#f0e4ce', 'ink': '#7a6332'}, 'resulting_lifecycle_stage': 'lead',        'resulting_intent_label_key': 'qualified_editorial_lead'}),
        ('strong', {'it-IT': 'Strong', 'en-US': 'Strong', 'en-GB': 'Strong', 'es-ES': 'Fuerte', 'fr-FR': 'Marqué', 'de-DE': 'Stark'},
                   {'color': {'bg': '#cfe1d7', 'ink': '#2e5b48'}, 'resulting_lifecycle_stage': 'discovery',   'resulting_intent_label_key': 'discovery_request'}),
    ],
    'cta_intent': [
        # Soft
        ('contact_studio',          {'it-IT': 'Contatta lo studio',          'en-US': 'Contact the Studio',          'en-GB': 'Contact the Studio',          'es-ES': 'Contactar el estudio',         'fr-FR': "Contacter l'atelier",          'de-DE': 'Studio kontaktieren'},      {'tier': 'soft'}),
        ('ask_about_materials',     {'it-IT': 'Chiedi informazioni sui materiali','en-US': 'Ask About Materials',    'en-GB': 'Ask About Materials',         'es-ES': 'Preguntar por los materiales', 'fr-FR': 'Demander sur les matériaux',   'de-DE': 'Materialien anfragen'},     {'tier': 'soft'}),
        ('book_showroom_visit',     {'it-IT': 'Prenota una visita showroom',  'en-US': 'Book a Showroom Visit',      'en-GB': 'Book a Showroom Visit',       'es-ES': 'Reservar visita al showroom',  'fr-FR': 'Réserver une visite showroom', 'de-DE': 'Showroom-Termin buchen'},   {'tier': 'soft'}),
        ('request_more_information',{'it-IT': 'Richiedi più informazioni',    'en-US': 'Request More Information',   'en-GB': 'Request More Information',    'es-ES': 'Solicitar más información',    'fr-FR': "Demander plus d'informations", 'de-DE': 'Weitere Informationen anfordern'}, {'tier': 'soft'}),
        ('speak_with_our_team',     {'it-IT': 'Parla con il nostro team',     'en-US': 'Speak With Our Team',         'en-GB': 'Speak With Our Team',         'es-ES': 'Hablar con nuestro equipo',    'fr-FR': "Parler avec notre équipe",     'de-DE': 'Mit unserem Team sprechen'},{'tier': 'soft'}),
        ('discover_collections',    {'it-IT': 'Scopri le collezioni',         'en-US': 'Discover Collections',        'en-GB': 'Discover Collections',        'es-ES': 'Descubrir colecciones',        'fr-FR': 'Découvrir les collections',    'de-DE': 'Kollektionen entdecken'},   {'tier': 'soft'}),
        # Medium
        ('share_your_inspiration',  {'it-IT': 'Condividi la tua ispirazione', 'en-US': 'Share Your Inspiration',      'en-GB': 'Share Your Inspiration',      'es-ES': 'Comparte tu inspiración',      'fr-FR': 'Partagez votre inspiration',   'de-DE': 'Inspiration teilen'},       {'tier': 'medium'}),
        ('send_your_floor_plan',    {'it-IT': 'Invia la tua planimetria',     'en-US': 'Send Your Floor Plan',        'en-GB': 'Send Your Floor Plan',        'es-ES': 'Envíe su plano',               'fr-FR': 'Envoyez votre plan',           'de-DE': 'Grundriss senden'},         {'tier': 'medium'}),
        ('request_design_advice',   {'it-IT': 'Richiedi consulenza design',   'en-US': 'Request Design Advice',       'en-GB': 'Request Design Advice',       'es-ES': 'Solicitar consultoría diseño', 'fr-FR': 'Demander un conseil design',   'de-DE': 'Design-Beratung anfragen'}, {'tier': 'medium'}),
        # Strong
        ('start_your_project',      {'it-IT': 'Avvia il tuo progetto',        'en-US': 'Start Your Project',          'en-GB': 'Start Your Project',          'es-ES': 'Iniciar su proyecto',          'fr-FR': 'Démarrer votre projet',        'de-DE': 'Projekt starten'},          {'tier': 'strong'}),
        ('book_discovery_session',  {'it-IT': 'Prenota una discovery session','en-US': 'Book a Discovery Session',    'en-GB': 'Book a Discovery Session',    'es-ES': 'Reservar discovery session',   'fr-FR': 'Réserver une discovery session','de-DE': 'Discovery-Session buchen'}, {'tier': 'strong'}),
    ],
    'editorial_tone': [
        ('progettuale_italian',   {'it-IT': 'Cultura progettuale italiana',   'en-US': 'Italian design culture',      'en-GB': 'Italian design culture',         'es-ES': 'Cultura proyectual italiana',     'fr-FR': 'Culture du projet italien',         'de-DE': 'Italienische Entwurfskultur'}, None),
        ('aspirational_lifestyle',{'it-IT': 'Aspirational lifestyle',         'en-US': 'Aspirational lifestyle',      'en-GB': 'Aspirational lifestyle',         'es-ES': 'Estilo de vida aspiracional',     'fr-FR': 'Style de vie aspirationnel',        'de-DE': 'Aspirationaler Lifestyle'}, None),
        ('prestige_restraint',    {'it-IT': 'Prestige restraint',             'en-US': 'Prestige restraint',          'en-GB': 'Prestige restraint',             'es-ES': 'Prestigio contenido',             'fr-FR': 'Prestige tout en retenue',          'de-DE': 'Zurückhaltender Prestige-Ton'}, None),
        ('execution_discipline',  {'it-IT': 'Disciplina esecutiva',           'en-US': 'Execution discipline',        'en-GB': 'Execution discipline',           'es-ES': 'Disciplina de ejecución',         'fr-FR': "Discipline d'exécution",            'de-DE': 'Ausführungsdisziplin'}, None),
        ('ceremonial_materiality',{'it-IT': 'Matericità cerimoniale',         'en-US': 'Ceremonial materiality',      'en-GB': 'Ceremonial materiality',         'es-ES': 'Materialidad ceremonial',         'fr-FR': 'Matérialité cérémoniale',           'de-DE': 'Zeremonielle Materialität'}, None),
        ('experiential_living',   {'it-IT': 'Vivere esperienziale',           'en-US': 'Experiential living',         'en-GB': 'Experiential living',            'es-ES': 'Vida experiencial',               'fr-FR': 'Vie expérientielle',                'de-DE': 'Erlebnishaftes Wohnen'}, None),
        ('savoir_faire',          {'it-IT': 'Savoir-faire',                   'en-US': 'Savoir-faire',                'en-GB': 'Savoir-faire',                   'es-ES': 'Savoir-faire',                    'fr-FR': 'Savoir-faire',                      'de-DE': 'Savoir-faire'}, None),
        ('plain_spoken_restraint',{'it-IT': 'Pacatezza Nordica',              'en-US': 'Plain-spoken restraint',      'en-GB': 'Plain-spoken restraint',         'es-ES': 'Reserva nórdica',                 'fr-FR': 'Sobriété nordique',                 'de-DE': 'Nordische Zurückhaltung'}, None),
    ],
    'editorial_pacing': [
        ('slow_editorial',  {'it-IT': 'Cadenza lenta · editoriale',  'en-US': 'Slow editorial pacing',  'en-GB': 'Slow editorial pacing',  'es-ES': 'Ritmo editorial pausado', 'fr-FR': 'Cadence éditoriale lente', 'de-DE': 'Langsames redaktionelles Tempo'}, None),
        ('measured',        {'it-IT': 'Misurato',                    'en-US': 'Measured',               'en-GB': 'Measured',               'es-ES': 'Mesurado',                'fr-FR': 'Mesuré',                   'de-DE': 'Bedacht'}, None),
        ('aspirational',    {'it-IT': 'Aspirazionale',               'en-US': 'Aspirational',           'en-GB': 'Aspirational',           'es-ES': 'Aspiracional',            'fr-FR': 'Aspirationnel',            'de-DE': 'Aspirational'}, None),
        ('ceremonial',      {'it-IT': 'Cerimoniale',                 'en-US': 'Ceremonial',             'en-GB': 'Ceremonial',             'es-ES': 'Ceremonial',              'fr-FR': 'Cérémonial',               'de-DE': 'Zeremoniell'}, None),
        ('precise',         {'it-IT': 'Preciso',                     'en-US': 'Precise',                'en-GB': 'Precise',                'es-ES': 'Preciso',                 'fr-FR': 'Précis',                   'de-DE': 'Präzise'}, None),
    ],
    'editorial_lead_intent': [
        ('inspiration_interest',     {'it-IT': 'Interesse ispirazionale',  'en-US': 'Inspiration interest',         'en-GB': 'Inspiration interest',         'es-ES': 'Interés inspiracional',         'fr-FR': "Intérêt d'inspiration",         'de-DE': 'Inspirations-Interesse'}, {'maps_to_lifecycle_stage': 'new_inquiry', 'color': {'bg': '#f5ecdb', 'ink': '#6b5c3c'}}),
        ('qualified_editorial_lead', {'it-IT': 'Lead editoriale qualificato','en-US': 'Qualified editorial lead',    'en-GB': 'Qualified editorial lead',     'es-ES': 'Lead editorial cualificado',    'fr-FR': 'Lead éditorial qualifié',       'de-DE': 'Qualifizierter redaktioneller Lead'}, {'maps_to_lifecycle_stage': 'lead', 'color': {'bg': '#f0e4ce', 'ink': '#7a6332'}}),
        ('discovery_request',        {'it-IT': 'Richiesta di discovery',   'en-US': 'Discovery request',            'en-GB': 'Discovery request',            'es-ES': 'Solicitud de discovery',        'fr-FR': 'Demande de discovery',          'de-DE': 'Discovery-Anfrage'}, {'maps_to_lifecycle_stage': 'discovery', 'color': {'bg': '#cfe1d7', 'ink': '#2e5b48'}}),
    ],
}


def upsert_platform(c, group_key, value_key, label, sort_order, meta=None):
    """Upsert a PLATFORM lookup row (tenant_id IS NULL)."""
    existing = (c.table('relationship_lookups').select('id,metadata')
                .is_('tenant_id', 'null').eq('scope', 'platform')
                .eq('group_key', group_key).eq('value_key', value_key)
                .limit(1).execute().data or [])
    payload = {
        'tenant_id': None, 'scope': 'platform',
        'group_key': group_key, 'value_key': value_key,
        'label': label, 'sort_order': sort_order, 'active': True,
        'metadata': meta or {}, 'updated_at': datetime.now(timezone.utc).isoformat(),
    }
    if existing:
        if existing[0].get('metadata') and not meta:
            payload['metadata'] = existing[0]['metadata']
        c.table('relationship_lookups').update(payload).eq('id', existing[0]['id']).execute()
    else:
        payload['id'] = str(uuid.uuid4())
        payload['created_at'] = datetime.now(timezone.utc).isoformat()
        c.table('relationship_lookups').insert(payload).execute()


def main():
    c = db()
    total = 0
    for group_key, items in EDITORIAL_LOOKUPS.items():
        for i, entry in enumerate(items):
            value_key, label, meta = entry
            upsert_platform(c, group_key, value_key, label, i, meta)
            total += 1
        print(f'  ✓ platform group={group_key}: {len(items)} values')
    print(f'✓ seeded {total} editorial platform values across {len(EDITORIAL_LOOKUPS)} groups')


if __name__ == '__main__':
    main()
