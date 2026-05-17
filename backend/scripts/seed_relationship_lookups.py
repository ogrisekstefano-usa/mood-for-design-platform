"""Phase R-CRM-2A — Seed Blueprint Command Center lookups (locale-aware).

Idempotent: re-running upserts by (tenant_id, group_key, value_key).

Locale codes follow strict BCP-47 (en-US, en-GB, it-IT, es-ES, fr-FR, de-DE…).
en-US ≠ en-GB (terminology/spelling/luxury communication tone may differ later).

Metadata schema (per value):
  {
    "color":  { "bg": "#…", "ink": "#…" }   # only for stages/health/priority chips
    "icon":   "lucide-icon-name"            # optional
    "permission_key": "crm.catalog.manage"  # optional
  }

  cd /app/backend && python3 scripts/seed_relationship_lookups.py
"""
import sys, uuid
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from datetime import datetime, timezone
from database import db


def _iso(): return datetime.now(timezone.utc).isoformat()


TENANT_SLUG = 'mood-demo-studio-81a09e'

# ── Locale-aware label dictionaries (BCP-47, never language-only) ─────────
# en-US and en-GB intentionally diverge where the luxury terminology asks
# for it (UK studios prefer "Enquiry" / "Opportunity" over "Inquiry"/"Lead").
# es-ES / fr-FR / de-DE seeded with curated initial translations.
LOOKUPS = {
  'lifecycle_stage': [
    ('new_inquiry', {
        'it-IT': 'Nuova richiesta', 'en-US': 'New Inquiry', 'en-GB': 'New Enquiry',
        'es-ES': 'Nueva solicitud',  'fr-FR': 'Nouvelle demande', 'de-DE': 'Neue Anfrage',
    }, {'bg': '#f5ecdb', 'ink': '#6b5c3c'}),
    ('lead', {
        'it-IT': 'Lead', 'en-US': 'Lead', 'en-GB': 'Opportunity',
        'es-ES': 'Lead', 'fr-FR': 'Prospect', 'de-DE': 'Lead',
    }, {'bg': '#f0e4ce', 'ink': '#7a6332'}),
    ('discovery', {
        'it-IT': 'Discovery', 'en-US': 'Discovery / Interview', 'en-GB': 'Discovery / Brief',
        'es-ES': 'Descubrimiento', 'fr-FR': 'Découverte', 'de-DE': 'Discovery',
    }, {'bg': '#e6deef', 'ink': '#5b4a73'}),
    ('prospect', {
        'it-IT': 'Prospect', 'en-US': 'Prospect', 'en-GB': 'Qualified Opportunity',
        'es-ES': 'Prospecto', 'fr-FR': 'Opportunité qualifiée', 'de-DE': 'Qualifiziertes Opportunity',
    }, {'bg': '#dee9e0', 'ink': '#3f6147'}),
    ('active_project', {
        'it-IT': 'Progetto attivo', 'en-US': 'Active Project', 'en-GB': 'Live Project',
        'es-ES': 'Proyecto activo', 'fr-FR': 'Projet actif', 'de-DE': 'Aktives Projekt',
    }, {'bg': '#cfe1d7', 'ink': '#2e5b48'}),
    ('existing_client', {
        'it-IT': 'Cliente esistente', 'en-US': 'Existing Client', 'en-GB': 'Existing Client',
        'es-ES': 'Cliente existente', 'fr-FR': 'Client existant', 'de-DE': 'Bestandskunde',
    }, {'bg': '#dfe7ea', 'ink': '#3a5a6b'}),
    ('repeat_client', {
        'it-IT': 'Cliente ricorrente', 'en-US': 'Repeat Client', 'en-GB': 'Returning Client',
        'es-ES': 'Cliente recurrente', 'fr-FR': 'Client fidèle', 'de-DE': 'Wiederkehrender Kunde',
    }, {'bg': '#d3e0e6', 'ink': '#2c4f63'}),
    ('partner_ad', {
        'it-IT': 'Partner / A&D', 'en-US': 'Partner / A&D', 'en-GB': 'Partner / A&D',
        'es-ES': 'Socio / A&D', 'fr-FR': 'Partenaire / A&D', 'de-DE': 'Partner / A&D',
    }, {'bg': '#ecdada', 'ink': '#7a4344'}),
    ('archived', {
        'it-IT': 'Archiviato', 'en-US': 'Archived', 'en-GB': 'Archived',
        'es-ES': 'Archivado', 'fr-FR': 'Archivé', 'de-DE': 'Archiviert',
    }, {'bg': '#e6e2dc', 'ink': '#7a7060'}),
  ],
  'account_type': [
    ('private_client',         {'it-IT': 'Cliente privato', 'en-US': 'Private client / family', 'en-GB': 'Private client / family', 'es-ES': 'Cliente privado / familia', 'fr-FR': 'Client privé / famille', 'de-DE': 'Privatkunde / Familie'}, None),
    ('architecture_studio',    {'it-IT': 'Studio di architettura', 'en-US': 'Architecture studio', 'en-GB': 'Architecture practice', 'es-ES': 'Estudio de arquitectura', 'fr-FR': "Cabinet d'architecture", 'de-DE': 'Architekturbüro'}, None),
    ('interior_design_studio', {'it-IT': 'Studio interior', 'en-US': 'Interior design studio', 'en-GB': 'Interior design studio', 'es-ES': 'Estudio de interiorismo', 'fr-FR': "Cabinet d'architecture d'intérieur", 'de-DE': 'Innenarchitekturbüro'}, None),
    ('furniture_client',       {'it-IT': 'Cliente arredo', 'en-US': 'Furniture store client', 'en-GB': 'Furniture showroom client', 'es-ES': 'Cliente mobiliario', 'fr-FR': "Client d'ameublement", 'de-DE': 'Möbel-Showroom-Kunde'}, None),
    ('developer',              {'it-IT': 'Sviluppatore', 'en-US': 'Developer', 'en-GB': 'Developer', 'es-ES': 'Promotor', 'fr-FR': 'Promoteur', 'de-DE': 'Bauträger'}, None),
    ('contractor',             {'it-IT': 'General contractor', 'en-US': 'Contractor', 'en-GB': 'Main contractor', 'es-ES': 'Contratista', 'fr-FR': 'Entreprise générale', 'de-DE': 'Generalunternehmer'}, None),
    ('hospitality_group',      {'it-IT': 'Gruppo hospitality', 'en-US': 'Hospitality group', 'en-GB': 'Hospitality group', 'es-ES': 'Grupo hotelero', 'fr-FR': "Groupe hôtelier", 'de-DE': 'Hotelgruppe'}, None),
    ('company',                {'it-IT': 'Azienda', 'en-US': 'Company', 'en-GB': 'Company', 'es-ES': 'Empresa', 'fr-FR': 'Entreprise', 'de-DE': 'Unternehmen'}, None),
    ('partner_ad',             {'it-IT': 'Partner / A&D', 'en-US': 'Partner / A&D', 'en-GB': 'Partner / A&D', 'es-ES': 'Socio / A&D', 'fr-FR': 'Partenaire / A&D', 'de-DE': 'Partner / A&D'}, None),
  ],
  'source': [
    ('web_form',          {'it-IT': 'Form sito', 'en-US': 'Web form', 'en-GB': 'Web enquiry', 'es-ES': 'Formulario web', 'fr-FR': 'Formulaire web', 'de-DE': 'Web-Formular'}, None),
    ('showroom_visit',    {'it-IT': 'Visita showroom', 'en-US': 'Showroom visit', 'en-GB': 'Showroom visit', 'es-ES': 'Visita al showroom', 'fr-FR': 'Visite showroom', 'de-DE': 'Showroom-Besuch'}, None),
    ('incoming_call',     {'it-IT': 'Telefonata in arrivo', 'en-US': 'Incoming call', 'en-GB': 'Incoming call', 'es-ES': 'Llamada entrante', 'fr-FR': 'Appel entrant', 'de-DE': 'Eingehender Anruf'}, None),
    ('whatsapp',          {'it-IT': 'WhatsApp', 'en-US': 'WhatsApp', 'en-GB': 'WhatsApp', 'es-ES': 'WhatsApp', 'fr-FR': 'WhatsApp', 'de-DE': 'WhatsApp'}, None),
    ('business_meeting',  {'it-IT': 'Business meeting', 'en-US': 'Business meeting', 'en-GB': 'Business meeting', 'es-ES': 'Reunión de negocios', 'fr-FR': 'Réunion professionnelle', 'de-DE': 'Geschäftstermin'}, None),
    ('event',             {'it-IT': 'Evento', 'en-US': 'Event', 'en-GB': 'Event', 'es-ES': 'Evento', 'fr-FR': 'Événement', 'de-DE': 'Veranstaltung'}, None),
    ('referral',          {'it-IT': 'Referral', 'en-US': 'Referral', 'en-GB': 'Referral', 'es-ES': 'Referido', 'fr-FR': 'Recommandation', 'de-DE': 'Empfehlung'}, None),
    ('architect_referral',{'it-IT': 'Referral architetto', 'en-US': 'Architect referral', 'en-GB': 'Architect referral', 'es-ES': 'Referencia de arquitecto', 'fr-FR': "Recommandation d'architecte", 'de-DE': 'Architekten-Empfehlung'}, None),
    ('social_lead',       {'it-IT': 'Lead social', 'en-US': 'Social lead', 'en-GB': 'Social lead', 'es-ES': 'Lead social', 'fr-FR': 'Lead réseaux sociaux', 'de-DE': 'Social-Media-Lead'}, None),
    ('manual_entry',      {'it-IT': 'Inserimento manuale', 'en-US': 'Manual entry', 'en-GB': 'Manual entry', 'es-ES': 'Entrada manual', 'fr-FR': 'Saisie manuelle', 'de-DE': 'Manueller Eintrag'}, None),
    ('existing_client_new', {'it-IT': 'Cliente esistente — nuova richiesta', 'en-US': 'Existing client — new request', 'en-GB': 'Existing client — new enquiry', 'es-ES': 'Cliente existente — nueva petición', 'fr-FR': 'Client existant — nouvelle demande', 'de-DE': 'Bestandskunde — neue Anfrage'}, None),
  ],
  'interaction_type': [
    ('call',                  {'it-IT': 'Telefonata',             'en-US': 'Call',                'en-GB': 'Call',                'es-ES': 'Llamada',                'fr-FR': 'Appel',                  'de-DE': 'Anruf'}, None),
    ('email',                 {'it-IT': 'Email',                  'en-US': 'Email',               'en-GB': 'Email',               'es-ES': 'Email',                  'fr-FR': 'Email',                  'de-DE': 'E-Mail'}, None),
    ('whatsapp',              {'it-IT': 'WhatsApp',               'en-US': 'WhatsApp',            'en-GB': 'WhatsApp',            'es-ES': 'WhatsApp',               'fr-FR': 'WhatsApp',               'de-DE': 'WhatsApp'}, None),
    ('showroom_visit',        {'it-IT': 'Visita in showroom',     'en-US': 'Showroom visit',      'en-GB': 'Showroom visit',      'es-ES': 'Visita al showroom',     'fr-FR': 'Visite showroom',        'de-DE': 'Showroom-Besuch'}, None),
    ('external_visit',        {'it-IT': 'Visita esterna',         'en-US': 'External visit',      'en-GB': 'External visit',      'es-ES': 'Visita externa',         'fr-FR': 'Visite extérieure',      'de-DE': 'Außentermin'}, None),
    ('business_meeting',      {'it-IT': 'Business meeting',       'en-US': 'Business meeting',    'en-GB': 'Business meeting',    'es-ES': 'Reunión de negocios',    'fr-FR': 'Réunion professionnelle','de-DE': 'Geschäftstermin'}, None),
    ('event',                 {'it-IT': 'Evento',                 'en-US': 'Event',               'en-GB': 'Event',               'es-ES': 'Evento',                 'fr-FR': 'Événement',              'de-DE': 'Veranstaltung'}, None),
    ('casual_meeting',        {'it-IT': 'Incontro informale',     'en-US': 'Casual meeting',      'en-GB': 'Informal meeting',    'es-ES': 'Reunión informal',       'fr-FR': 'Rencontre informelle',   'de-DE': 'Informelles Treffen'}, None),
    ('discovery_interview',   {'it-IT': 'Discovery interview',    'en-US': 'Discovery interview', 'en-GB': 'Discovery interview', 'es-ES': 'Entrevista de descubrimiento','fr-FR': 'Entretien de découverte', 'de-DE': 'Discovery-Interview'}, None),
    ('follow_up',             {'it-IT': 'Follow-up',              'en-US': 'Follow-up',           'en-GB': 'Follow-up',           'es-ES': 'Seguimiento',            'fr-FR': 'Suivi',                  'de-DE': 'Follow-up'}, None),
    ('moodboard_sent',        {'it-IT': 'Moodboard inviata',      'en-US': 'Moodboard sent',      'en-GB': 'Moodboard sent',      'es-ES': 'Moodboard enviada',      'fr-FR': 'Moodboard envoyée',      'de-DE': 'Moodboard gesendet'}, None),
    ('moodboard_viewed',      {'it-IT': 'Moodboard visualizzata', 'en-US': 'Moodboard viewed',    'en-GB': 'Moodboard viewed',    'es-ES': 'Moodboard vista',        'fr-FR': 'Moodboard consultée',    'de-DE': 'Moodboard angesehen'}, None),
    ('proposal_sent',         {'it-IT': 'Proposta inviata',       'en-US': 'Proposal sent',       'en-GB': 'Proposal sent',       'es-ES': 'Propuesta enviada',      'fr-FR': 'Proposition envoyée',    'de-DE': 'Vorschlag gesendet'}, None),
    ('proposal_opened',       {'it-IT': 'Proposta aperta',        'en-US': 'Proposal opened',     'en-GB': 'Proposal opened',     'es-ES': 'Propuesta abierta',      'fr-FR': 'Proposition ouverte',    'de-DE': 'Vorschlag geöffnet'}, None),
    ('proposal_review',       {'it-IT': 'Revisione proposta',     'en-US': 'Proposal review',     'en-GB': 'Proposal review',     'es-ES': 'Revisión de propuesta',  'fr-FR': 'Revue de proposition',   'de-DE': 'Vorschlagsprüfung'}, None),
    ('material_selection',    {'it-IT': 'Selezione materiali',    'en-US': 'Material selection',  'en-GB': 'Material selection',  'es-ES': 'Selección de materiales','fr-FR': 'Sélection de matériaux', 'de-DE': 'Materialauswahl'}, None),
    ('project_update',        {'it-IT': 'Aggiornamento progetto', 'en-US': 'Project update',      'en-GB': 'Project update',      'es-ES': 'Actualización del proyecto','fr-FR': 'Mise à jour du projet','de-DE': 'Projekt-Update'}, None),
    ('post_visit_report',     {'it-IT': 'Report post-visita',     'en-US': 'Post-visit report',   'en-GB': 'Post-visit report',   'es-ES': 'Informe post-visita',    'fr-FR': 'Rapport post-visite',    'de-DE': 'Bericht nach Besuch'}, None),
    ('internal_note',         {'it-IT': 'Nota interna',           'en-US': 'Internal note',       'en-GB': 'Internal note',       'es-ES': 'Nota interna',           'fr-FR': 'Note interne',           'de-DE': 'Interne Notiz'}, None),
    ('voice_note',            {'it-IT': 'Nota vocale',            'en-US': 'Voice note',          'en-GB': 'Voice note',          'es-ES': 'Nota de voz',            'fr-FR': 'Note vocale',            'de-DE': 'Sprachnotiz'}, None),
    ('ai_summary',            {'it-IT': 'Sintesi AI',             'en-US': 'AI summary',          'en-GB': 'AI summary',          'es-ES': 'Resumen IA',             'fr-FR': 'Synthèse IA',            'de-DE': 'KI-Zusammenfassung'}, None),
    ('web_lead_generation',   {'it-IT': 'Lead da form',           'en-US': 'Web lead generation', 'en-GB': 'Web enquiry capture', 'es-ES': 'Lead web',               'fr-FR': 'Lead web',               'de-DE': 'Web-Lead'}, None),
    ('stage_change',          {'it-IT': 'Cambio stage',           'en-US': 'Stage change',        'en-GB': 'Stage change',        'es-ES': 'Cambio de etapa',        'fr-FR': "Changement d'étape",     'de-DE': 'Stage-Wechsel'}, None),
  ],
  'action_type': [
    ('call_back',           {'it-IT': 'Richiama',            'en-US': 'Call back',          'en-GB': 'Call back',          'es-ES': 'Devolver llamada',   'fr-FR': 'Rappeler',             'de-DE': 'Zurückrufen'}, None),
    ('send_email',          {'it-IT': 'Invia email',         'en-US': 'Send email',         'en-GB': 'Send email',         'es-ES': 'Enviar email',       'fr-FR': 'Envoyer un email',     'de-DE': 'E-Mail senden'}, None),
    ('send_moodboard',      {'it-IT': 'Invia moodboard',     'en-US': 'Send moodboard',     'en-GB': 'Send moodboard',     'es-ES': 'Enviar moodboard',   'fr-FR': 'Envoyer la moodboard', 'de-DE': 'Moodboard senden'}, None),
    ('follow_up',           {'it-IT': 'Follow-up',           'en-US': 'Follow-up',          'en-GB': 'Follow-up',          'es-ES': 'Seguimiento',        'fr-FR': 'Suivi',                'de-DE': 'Follow-up'}, None),
    ('schedule_meeting',    {'it-IT': 'Pianifica meeting',   'en-US': 'Schedule meeting',   'en-GB': 'Schedule meeting',   'es-ES': 'Programar reunión',  'fr-FR': 'Planifier une réunion','de-DE': 'Termin planen'}, None),
    ('deliver_project',     {'it-IT': 'Consegna progetto',   'en-US': 'Deliver project',    'en-GB': 'Deliver project',    'es-ES': 'Entregar proyecto',  'fr-FR': 'Livrer le projet',     'de-DE': 'Projekt liefern'}, None),
    ('deliver_moodboard',   {'it-IT': 'Consegna moodboard',  'en-US': 'Deliver moodboard',  'en-GB': 'Deliver moodboard',  'es-ES': 'Entregar moodboard', 'fr-FR': 'Livrer la moodboard',  'de-DE': 'Moodboard liefern'}, None),
    ('material_deadline',   {'it-IT': 'Scadenza materiali', 'en-US': 'Material deadline',   'en-GB': 'Material deadline',  'es-ES': 'Plazo materiales',   'fr-FR': 'Échéance matériaux',   'de-DE': 'Materialfrist'}, None),
    ('proposal_feedback',   {'it-IT': 'Feedback proposta',  'en-US': 'Proposal feedback',   'en-GB': 'Proposal feedback',  'es-ES': 'Feedback propuesta', 'fr-FR': 'Retour proposition',   'de-DE': 'Vorschlag-Feedback'}, None),
    ('send_quote',          {'it-IT': 'Invia preventivo',   'en-US': 'Send quote',          'en-GB': 'Send quote',         'es-ES': 'Enviar presupuesto', 'fr-FR': 'Envoyer le devis',     'de-DE': 'Angebot senden'}, None),
    ('review_needed',       {'it-IT': 'Revisione necessaria','en-US': 'Review needed',      'en-GB': 'Review needed',      'es-ES': 'Revisión necesaria', 'fr-FR': 'Revue requise',        'de-DE': 'Prüfung nötig'}, None),
    ('no_activity_alert',   {'it-IT': 'Allarme nessuna attività','en-US': 'No activity alert','en-GB': 'No activity alert','es-ES': 'Alerta sin actividad','fr-FR': "Alerte d'inactivité",  'de-DE': 'Inaktivitäts-Alarm'}, None),
    ('engagement_alert',    {'it-IT': 'Allarme engagement', 'en-US': 'Engagement alert',    'en-GB': 'Engagement alert',   'es-ES': 'Alerta de interés',  'fr-FR': "Alerte d'engagement",  'de-DE': 'Engagement-Alarm'}, None),
  ],
  'priority': [
    ('low',     {'it-IT': 'Bassa',   'en-US': 'Low',     'en-GB': 'Low',     'es-ES': 'Baja',     'fr-FR': 'Basse',    'de-DE': 'Niedrig'}, {'bg': '#e6e2dc', 'ink': '#7a7060'}),
    ('normal',  {'it-IT': 'Normale', 'en-US': 'Normal',  'en-GB': 'Normal',  'es-ES': 'Normal',   'fr-FR': 'Normale',  'de-DE': 'Normal'},  {'bg': '#dfe7ea', 'ink': '#3a5a6b'}),
    ('high',    {'it-IT': 'Alta',    'en-US': 'High',    'en-GB': 'High',    'es-ES': 'Alta',     'fr-FR': 'Élevée',   'de-DE': 'Hoch'},    {'bg': '#f0e4ce', 'ink': '#7a6332'}),
    ('urgent',  {'it-IT': 'Urgente', 'en-US': 'Urgent',  'en-GB': 'Urgent',  'es-ES': 'Urgente',  'fr-FR': 'Urgente',  'de-DE': 'Dringend'},{'bg': '#ecdada', 'ink': '#7a4344'}),
  ],
  'budget_range': [
    ('under_50k',  {'it-IT': '< 50k €',     'en-US': 'Under $50k',     'en-GB': 'Under £50k',     'es-ES': '< 50k €',      'fr-FR': '< 50k €',       'de-DE': 'Unter 50.000 €'}, None),
    ('50_120k',    {'it-IT': '50–120k €',   'en-US': '$50k–$120k',     'en-GB': '£50k–£120k',     'es-ES': '50–120k €',    'fr-FR': '50–120k €',     'de-DE': '50.000–120.000 €'}, None),
    ('120_250k',   {'it-IT': '120–250k €',  'en-US': '$120k–$250k',    'en-GB': '£120k–£250k',    'es-ES': '120–250k €',   'fr-FR': '120–250k €',    'de-DE': '120.000–250.000 €'}, None),
    ('250_500k',   {'it-IT': '250–500k €',  'en-US': '$250k–$500k',    'en-GB': '£250k–£500k',    'es-ES': '250–500k €',   'fr-FR': '250–500k €',    'de-DE': '250.000–500.000 €'}, None),
    ('500k_1m',    {'it-IT': '500k – 1M €', 'en-US': '$500k – $1M',    'en-GB': '£500k – £1M',    'es-ES': '500k – 1M €',  'fr-FR': '500k – 1M €',   'de-DE': '500.000 € – 1 Mio.'}, None),
    ('over_1m',    {'it-IT': '> 1M €',      'en-US': 'Over $1M',       'en-GB': 'Over £1M',       'es-ES': '> 1M €',       'fr-FR': '> 1M €',        'de-DE': 'Über 1 Mio. €'}, None),
  ],
  'timing_range': [
    ('immediate',   {'it-IT': 'Immediato',     'en-US': 'Immediate',     'en-GB': 'Immediate',     'es-ES': 'Inmediato',    'fr-FR': 'Immédiat',       'de-DE': 'Sofort'}, None),
    ('within_3m',   {'it-IT': 'Entro 3 mesi',  'en-US': 'Within 3 months','en-GB': 'Within 3 months','es-ES': 'En 3 meses',  'fr-FR': 'Sous 3 mois',    'de-DE': 'Innerhalb 3 Monaten'}, None),
    ('within_6m',   {'it-IT': 'Entro 6 mesi',  'en-US': 'Within 6 months','en-GB': 'Within 6 months','es-ES': 'En 6 meses',  'fr-FR': 'Sous 6 mois',    'de-DE': 'Innerhalb 6 Monaten'}, None),
    ('within_12m',  {'it-IT': 'Entro 12 mesi', 'en-US': 'Within 12 months','en-GB':'Within 12 months','es-ES': 'En 12 meses', 'fr-FR': 'Sous 12 mois',  'de-DE': 'Innerhalb 12 Monaten'}, None),
    ('exploratory', {'it-IT': 'Esplorativo',   'en-US': 'Exploratory',   'en-GB': 'Exploratory',   'es-ES': 'Exploratorio', 'fr-FR': 'Exploratoire',   'de-DE': 'Sondierung'}, None),
  ],
  'style': [
    ('warm_minimalism',      {'it-IT': 'Warm Minimalism',      'en-US': 'Warm Minimalism',      'en-GB': 'Warm Minimalism',      'es-ES': 'Minimalismo cálido',    'fr-FR': 'Minimalisme chaleureux', 'de-DE': 'Warmer Minimalismus'}, None),
    ('contemporary_italian', {'it-IT': 'Contemporary Italian', 'en-US': 'Contemporary Italian', 'en-GB': 'Contemporary Italian', 'es-ES': 'Italiano contemporáneo','fr-FR': 'Italien contemporain',   'de-DE': 'Italienisch zeitgenössisch'}, None),
    ('mediterranean',        {'it-IT': 'Mediterraneo',         'en-US': 'Mediterranean',        'en-GB': 'Mediterranean',        'es-ES': 'Mediterráneo',          'fr-FR': 'Méditerranéen',          'de-DE': 'Mediterran'}, None),
    ('japandi',              {'it-IT': 'Japandi',              'en-US': 'Japandi',              'en-GB': 'Japandi',              'es-ES': 'Japandi',               'fr-FR': 'Japandi',                'de-DE': 'Japandi'}, None),
    ('quiet_luxury',         {'it-IT': 'Quiet Luxury',         'en-US': 'Quiet Luxury',         'en-GB': 'Quiet Luxury',         'es-ES': 'Lujo silencioso',       'fr-FR': 'Luxe discret',           'de-DE': 'Stiller Luxus'}, None),
    ('soft_brutalism',       {'it-IT': 'Soft Brutalism',       'en-US': 'Soft Brutalism',       'en-GB': 'Soft Brutalism',       'es-ES': 'Brutalismo suave',      'fr-FR': 'Brutalisme doux',        'de-DE': 'Sanfter Brutalismus'}, None),
    ('classic_contemporary', {'it-IT': 'Classico contemporaneo','en-US':'Classic Contemporary',  'en-GB': 'Classic Contemporary', 'es-ES': 'Clásico contemporáneo', 'fr-FR': 'Classique contemporain', 'de-DE': 'Klassisch-Modern'}, None),
    ('organic_modern',       {'it-IT': 'Organic Modern',       'en-US': 'Organic Modern',       'en-GB': 'Organic Modern',       'es-ES': 'Moderno orgánico',      'fr-FR': 'Moderne organique',      'de-DE': 'Organisch-Modern'}, None),
  ],
  'material': [
    ('travertine', {'it-IT': 'Travertino', 'en-US': 'Travertine', 'en-GB': 'Travertine', 'es-ES': 'Travertino', 'fr-FR': 'Travertin', 'de-DE': 'Travertin'}, None),
    ('marble',     {'it-IT': 'Marmo',      'en-US': 'Marble',     'en-GB': 'Marble',     'es-ES': 'Mármol',     'fr-FR': 'Marbre',    'de-DE': 'Marmor'}, None),
    ('walnut',     {'it-IT': 'Noce',       'en-US': 'Walnut',     'en-GB': 'Walnut',     'es-ES': 'Nogal',      'fr-FR': 'Noyer',     'de-DE': 'Nussbaum'}, None),
    ('oak',        {'it-IT': 'Rovere',     'en-US': 'Oak',        'en-GB': 'Oak',        'es-ES': 'Roble',      'fr-FR': 'Chêne',     'de-DE': 'Eiche'}, None),
    ('bronze',     {'it-IT': 'Bronzo',     'en-US': 'Bronze',     'en-GB': 'Bronze',     'es-ES': 'Bronce',     'fr-FR': 'Bronze',    'de-DE': 'Bronze'}, None),
    ('glass',      {'it-IT': 'Vetro',      'en-US': 'Glass',      'en-GB': 'Glass',      'es-ES': 'Vidrio',     'fr-FR': 'Verre',     'de-DE': 'Glas'}, None),
    ('stone',      {'it-IT': 'Pietra',     'en-US': 'Stone',      'en-GB': 'Stone',      'es-ES': 'Piedra',     'fr-FR': 'Pierre',    'de-DE': 'Stein'}, None),
    ('linen',      {'it-IT': 'Lino',       'en-US': 'Linen',      'en-GB': 'Linen',      'es-ES': 'Lino',       'fr-FR': 'Lin',       'de-DE': 'Leinen'}, None),
    ('leather',    {'it-IT': 'Pelle',      'en-US': 'Leather',    'en-GB': 'Leather',    'es-ES': 'Cuero',      'fr-FR': 'Cuir',      'de-DE': 'Leder'}, None),
    ('terracotta', {'it-IT': 'Terracotta', 'en-US': 'Terracotta', 'en-GB': 'Terracotta', 'es-ES': 'Terracota',  'fr-FR': 'Terre cuite','de-DE':'Terrakotta'}, None),
    ('brass',      {'it-IT': 'Ottone',     'en-US': 'Brass',      'en-GB': 'Brass',      'es-ES': 'Latón',      'fr-FR': 'Laiton',    'de-DE': 'Messing'}, None),
  ],
  'atmosphere': [
    ('warm',       {'it-IT': 'Calda',      'en-US': 'Warm',       'en-GB': 'Warm',       'es-ES': 'Cálida',     'fr-FR': 'Chaleureuse','de-DE':'Warm'}, None),
    ('calm',       {'it-IT': 'Calma',      'en-US': 'Calm',       'en-GB': 'Calm',       'es-ES': 'Tranquila',  'fr-FR': 'Calme',     'de-DE': 'Ruhig'}, None),
    ('sculptural', {'it-IT': 'Scultorea',  'en-US': 'Sculptural', 'en-GB': 'Sculptural', 'es-ES': 'Escultórica','fr-FR': 'Sculpturale','de-DE': 'Skulptural'}, None),
    ('bright',     {'it-IT': 'Luminosa',   'en-US': 'Bright',     'en-GB': 'Bright',     'es-ES': 'Luminosa',   'fr-FR': 'Lumineuse', 'de-DE': 'Hell'}, None),
    ('dramatic',   {'it-IT': 'Drammatica', 'en-US': 'Dramatic',   'en-GB': 'Dramatic',   'es-ES': 'Dramática',  'fr-FR': 'Dramatique','de-DE': 'Dramatisch'}, None),
    ('natural',    {'it-IT': 'Naturale',   'en-US': 'Natural',    'en-GB': 'Natural',    'es-ES': 'Natural',    'fr-FR': 'Naturelle', 'de-DE': 'Natürlich'}, None),
    ('refined',    {'it-IT': 'Raffinata',  'en-US': 'Refined',    'en-GB': 'Refined',    'es-ES': 'Refinada',   'fr-FR': 'Raffinée',  'de-DE': 'Verfeinert'}, None),
    ('hotel_like', {'it-IT': 'Hotel',      'en-US': 'Hotel-like', 'en-GB': 'Hotel-like', 'es-ES': 'Tipo hotel', 'fr-FR': 'Esprit hôtel','de-DE': 'Hotel-Atmosphäre'}, None),
  ],
  'visibility_level': [
    ('full',            {'it-IT': 'Accesso completo', 'en-US': 'Full access',     'en-GB': 'Full access',     'es-ES': 'Acceso completo',  'fr-FR': 'Accès complet',     'de-DE': 'Voller Zugriff'}, None),
    ('crm_only',        {'it-IT': 'Solo CRM',         'en-US': 'CRM only',        'en-GB': 'CRM only',        'es-ES': 'Sólo CRM',         'fr-FR': 'CRM uniquement',    'de-DE': 'Nur CRM'}, None),
    ('moodboards_only', {'it-IT': 'Solo moodboard',   'en-US': 'Moodboards only', 'en-GB': 'Moodboards only', 'es-ES': 'Sólo moodboards',  'fr-FR': 'Moodboards seulement','de-DE': 'Nur Moodboards'}, None),
    ('projects_only',   {'it-IT': 'Solo progetti',    'en-US': 'Projects only',   'en-GB': 'Projects only',   'es-ES': 'Sólo proyectos',   'fr-FR': 'Projets seulement', 'de-DE': 'Nur Projekte'}, None),
    ('commercial_only', {'it-IT': 'Solo commerciale', 'en-US': 'Commercial only', 'en-GB': 'Commercial only', 'es-ES': 'Sólo comercial',   'fr-FR': 'Commercial seulement','de-DE': 'Nur kommerziell'}, None),
    ('read_only',       {'it-IT': 'Sola lettura',     'en-US': 'Read only',       'en-GB': 'Read only',       'es-ES': 'Sólo lectura',     'fr-FR': 'Lecture seule',     'de-DE': 'Nur lesen'}, None),
  ],
  'relationship_health': [
    ('excellent',       {'it-IT': 'Eccellente', 'en-US': 'Excellent',       'en-GB': 'Excellent',       'es-ES': 'Excelente',       'fr-FR': 'Excellente',         'de-DE': 'Ausgezeichnet'},     {'bg': '#cfe1d7', 'ink': '#2e5b48'}),
    ('healthy',         {'it-IT': 'Salutare',   'en-US': 'Healthy',         'en-GB': 'Healthy',         'es-ES': 'Saludable',       'fr-FR': 'Saine',              'de-DE': 'Gesund'},            {'bg': '#dee9e0', 'ink': '#3f6147'}),
    ('needs_attention', {'it-IT': 'Da seguire', 'en-US': 'Needs attention', 'en-GB': 'Needs attention', 'es-ES': 'Necesita atención','fr-FR': 'Requiert attention', 'de-DE': 'Aufmerksamkeit nötig'},{'bg': '#f0e4ce', 'ink': '#7a6332'}),
    ('at_risk',         {'it-IT': 'A rischio',  'en-US': 'At risk',         'en-GB': 'At risk',         'es-ES': 'En riesgo',       'fr-FR': 'À risque',           'de-DE': 'Gefährdet'},          {'bg': '#ecdada', 'ink': '#7a4344'}),
    ('dormant',         {'it-IT': 'Dormiente',  'en-US': 'Dormant',         'en-GB': 'Dormant',         'es-ES': 'Inactivo',        'fr-FR': 'Dormant',            'de-DE': 'Inaktiv'},            {'bg': '#e6e2dc', 'ink': '#7a7060'}),
  ],
  'communication_preference': [
    ('email',     {'it-IT': 'Email',     'en-US': 'Email',     'en-GB': 'Email',     'es-ES': 'Email',     'fr-FR': 'Email',     'de-DE': 'E-Mail'}, None),
    ('phone',     {'it-IT': 'Telefono',  'en-US': 'Phone',     'en-GB': 'Phone',     'es-ES': 'Teléfono',  'fr-FR': 'Téléphone', 'de-DE': 'Telefon'}, None),
    ('whatsapp',  {'it-IT': 'WhatsApp',  'en-US': 'WhatsApp',  'en-GB': 'WhatsApp',  'es-ES': 'WhatsApp',  'fr-FR': 'WhatsApp',  'de-DE': 'WhatsApp'}, None),
    ('in_person', {'it-IT': 'Di persona','en-US': 'In person', 'en-GB': 'In person', 'es-ES': 'En persona','fr-FR': 'En personne','de-DE': 'Persönlich'}, None),
  ],
}


def upsert(c, tenant_id, group_key, value_key, label, sort_order, color=None):
    existing = (c.table('relationship_lookups').select('id,metadata')
                .eq('tenant_id', tenant_id)
                .eq('group_key', group_key)
                .eq('value_key', value_key).limit(1).execute().data or [])
    meta = {}
    if existing and existing[0].get('metadata'):
        meta = dict(existing[0]['metadata'])
    if color:
        meta['color'] = color
    row = {
        'tenant_id': tenant_id, 'group_key': group_key, 'value_key': value_key,
        'label': label, 'sort_order': sort_order, 'active': True,
        'metadata': meta,
        'updated_at': _iso(),
    }
    if existing:
        c.table('relationship_lookups').update(row).eq('id', existing[0]['id']).execute()
    else:
        row['id'] = str(uuid.uuid4())
        row['created_at'] = _iso()
        c.table('relationship_lookups').insert(row).execute()


def main():
    c = db()
    t = c.table('tenants').select('id').eq('slug', TENANT_SLUG).limit(1).execute().data
    if not t:
        raise SystemExit(f'tenant {TENANT_SLUG} missing')
    tid = t[0]['id']
    total = 0
    for group_key, items in LOOKUPS.items():
        for i, entry in enumerate(items):
            value_key, label, color = entry
            upsert(c, tid, group_key, value_key, label, i, color=color)
            total += 1
    # Update tenant locale settings → enforce BCP-47 active locales + default it-IT
    c.table('tenants').update({
        'default_language':    'it-IT',
        'active_languages':    ['it-IT','en-US','en-GB','es-ES','fr-FR','de-DE'],
    }).eq('id', tid).execute()
    print(f'✓ seeded {total} lookup values across {len(LOOKUPS)} groups for tenant {TENANT_SLUG}')
    print('✓ tenant locale_settings normalised to BCP-47 (default it-IT, active 6 locales)')


if __name__ == '__main__':
    main()
