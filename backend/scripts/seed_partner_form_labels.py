#!/usr/bin/env python3
"""
Seed script: Create/Update partner_form_labels CMS section for partner-application page.
Run: python3 /app/backend/scripts/seed_partner_form_labels.py
"""
import os
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, '/app/backend')
os.chdir('/app/backend')

from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

from database import db

TENANT_SLUG  = 'studio'
PAGE_KEY     = 'partner-application'
SECTION_TYPE = 'partner_form_labels'

def now():
    return datetime.now(timezone.utc).isoformat()

LOCALE_CONTENT = {
    "it-IT": {
        "s1_title": "Identità professionale",
        "s2_title": "Profilo online",
        "s3_title": "Contesto geografico",
        "s4_title": "Intenti di collaborazione",
        "field_nome": "Nome *",
        "field_cognome": "Cognome *",
        "field_studio": "Studio / Azienda *",
        "field_email": "Email professionale *",
        "field_telefono": "Telefono",
        "field_ruolo": "Ruolo professionale *",
        "field_sito": "Sito Web",
        "field_instagram": "Instagram (handle)",
        "field_linkedin": "LinkedIn (URL profilo)",
        "field_area": "Area geografica (città, regione o paese)",
        "field_tipo_collab": "Tipologia di collaborazione desiderata",
        "field_interessi": "Seleziona tutto ciò che ti riguarda:",
        "field_racconto": "Raccontaci come immagini una collaborazione.",
        "ph_ruolo": "Seleziona ruolo...",
        "ph_collab": "Seleziona...",
        "ph_racconto": "Descrivici il tuo approccio al progetto...",
        "cta_submit": "Invia candidatura",
        "privacy_text": "I tuoi dati vengono utilizzati esclusivamente per valutare la collaborazione. Nessun dato viene condiviso con terzi.",
        "error_generic": "Si è verificato un errore. Riprova o scrivici a info@studio.com.",
        "error_required": "Compila tutti i campi obbligatori.",
        "roles": [
            {"value": "architect",         "label": "Architetto"},
            {"value": "interior_designer", "label": "Interior Designer"},
            {"value": "contractor",        "label": "General Contractor"},
            {"value": "showroom",          "label": "Showroom"},
            {"value": "brand",             "label": "Brand"},
            {"value": "artisan",           "label": "Artigiano"},
            {"value": "developer",         "label": "Developer"},
        ],
        "collab_types": [
            {"value": "residential", "label": "Progetti residenziali"},
            {"value": "hospitality", "label": "Progetti hospitality"},
            {"value": "retail",      "label": "Retail / Showroom"},
            {"value": "contract",    "label": "Contract / Developer"},
        ],
        "interests": [
            {"id": "collab_residential", "label": "Vorrei collaborare su progetti residenziali"},
            {"id": "collab_hospitality", "label": "Vorrei collaborare su progetti hospitality"},
            {"id": "propose_services",   "label": "Vorrei proporre i miei servizi allo studio"},
            {"id": "receive_opp",        "label": "Vorrei ricevere opportunità da MOOD for DESIGN"},
            {"id": "network",            "label": "Vorrei entrare nella rete professionale"},
        ],
    },
    "en-US": {
        "s1_title": "Professional identity",
        "s2_title": "Online profile",
        "s3_title": "Geographic context",
        "s4_title": "Collaboration intent",
        "field_nome": "First name *",
        "field_cognome": "Last name *",
        "field_studio": "Studio / Company *",
        "field_email": "Professional email *",
        "field_telefono": "Phone",
        "field_ruolo": "Professional role *",
        "field_sito": "Website",
        "field_instagram": "Instagram (handle)",
        "field_linkedin": "LinkedIn (profile URL)",
        "field_area": "Geographic area (city, region or country)",
        "field_tipo_collab": "Desired type of collaboration",
        "field_interessi": "Select all that apply:",
        "field_racconto": "Tell us how you envision a collaboration.",
        "ph_ruolo": "Select role...",
        "ph_collab": "Select...",
        "ph_racconto": "Describe your approach to design...",
        "cta_submit": "Submit application",
        "privacy_text": "Your data is used exclusively to evaluate the collaboration. No data is shared with third parties.",
        "error_generic": "An error occurred. Please try again or write to us at info@studio.com.",
        "error_required": "Please fill in all required fields.",
        "roles": [
            {"value": "architect",         "label": "Architect"},
            {"value": "interior_designer", "label": "Interior Designer"},
            {"value": "contractor",        "label": "General Contractor"},
            {"value": "showroom",          "label": "Showroom"},
            {"value": "brand",             "label": "Brand"},
            {"value": "artisan",           "label": "Artisan"},
            {"value": "developer",         "label": "Developer"},
        ],
        "collab_types": [
            {"value": "residential", "label": "Residential projects"},
            {"value": "hospitality", "label": "Hospitality projects"},
            {"value": "retail",      "label": "Retail / Showroom"},
            {"value": "contract",    "label": "Contract / Developer"},
        ],
        "interests": [
            {"id": "collab_residential", "label": "I want to collaborate on residential projects"},
            {"id": "collab_hospitality", "label": "I want to collaborate on hospitality projects"},
            {"id": "propose_services",   "label": "I want to propose my services to the studio"},
            {"id": "receive_opp",        "label": "I want to receive opportunities from MOOD for DESIGN"},
            {"id": "network",            "label": "I want to join the professional network"},
        ],
    },
    "en-GB": {
        "s1_title": "Professional identity",
        "s2_title": "Online profile",
        "s3_title": "Geographic context",
        "s4_title": "Collaboration intent",
        "field_nome": "First name *",
        "field_cognome": "Last name *",
        "field_studio": "Studio / Company *",
        "field_email": "Professional email *",
        "field_telefono": "Phone",
        "field_ruolo": "Professional role *",
        "field_sito": "Website",
        "field_instagram": "Instagram (handle)",
        "field_linkedin": "LinkedIn (profile URL)",
        "field_area": "Geographic area (city, region or country)",
        "field_tipo_collab": "Desired type of collaboration",
        "field_interessi": "Select all that apply:",
        "field_racconto": "Tell us how you envision a collaboration.",
        "ph_ruolo": "Select role...",
        "ph_collab": "Select...",
        "ph_racconto": "Describe your approach to design...",
        "cta_submit": "Submit application",
        "privacy_text": "Your data is used exclusively to evaluate the collaboration. No data is shared with third parties.",
        "error_generic": "An error occurred. Please try again or write to us at info@studio.com.",
        "error_required": "Please fill in all required fields.",
        "roles": [
            {"value": "architect",         "label": "Architect"},
            {"value": "interior_designer", "label": "Interior Designer"},
            {"value": "contractor",        "label": "General Contractor"},
            {"value": "showroom",          "label": "Showroom"},
            {"value": "brand",             "label": "Brand"},
            {"value": "artisan",           "label": "Artisan"},
            {"value": "developer",         "label": "Developer"},
        ],
        "collab_types": [
            {"value": "residential", "label": "Residential projects"},
            {"value": "hospitality", "label": "Hospitality projects"},
            {"value": "retail",      "label": "Retail / Showroom"},
            {"value": "contract",    "label": "Contract / Developer"},
        ],
        "interests": [
            {"id": "collab_residential", "label": "I want to collaborate on residential projects"},
            {"id": "collab_hospitality", "label": "I want to collaborate on hospitality projects"},
            {"id": "propose_services",   "label": "I want to propose my services to the studio"},
            {"id": "receive_opp",        "label": "I want to receive opportunities from MOOD for DESIGN"},
            {"id": "network",            "label": "I want to join the professional network"},
        ],
    },
    "fr-FR": {
        "s1_title": "Identité professionnelle",
        "s2_title": "Profil en ligne",
        "s3_title": "Contexte géographique",
        "s4_title": "Intentions de collaboration",
        "field_nome": "Prénom *",
        "field_cognome": "Nom de famille *",
        "field_studio": "Studio / Entreprise *",
        "field_email": "Email professionnel *",
        "field_telefono": "Téléphone",
        "field_ruolo": "Rôle professionnel *",
        "field_sito": "Site web",
        "field_instagram": "Instagram (identifiant)",
        "field_linkedin": "LinkedIn (URL du profil)",
        "field_area": "Zone géographique (ville, région ou pays)",
        "field_tipo_collab": "Type de collaboration souhaité",
        "field_interessi": "Sélectionnez tout ce qui vous concerne :",
        "field_racconto": "Dites-nous comment vous imaginez une collaboration.",
        "ph_ruolo": "Sélectionnez un rôle...",
        "ph_collab": "Sélectionnez...",
        "ph_racconto": "Décrivez votre approche du projet...",
        "cta_submit": "Envoyer la candidature",
        "privacy_text": "Vos données sont utilisées exclusivement pour évaluer la collaboration. Aucune donnée n'est partagée avec des tiers.",
        "error_generic": "Une erreur s'est produite. Réessayez ou écrivez-nous à info@studio.com.",
        "error_required": "Veuillez remplir tous les champs obligatoires.",
        "roles": [
            {"value": "architect",         "label": "Architecte"},
            {"value": "interior_designer", "label": "Designer d'intérieur"},
            {"value": "contractor",        "label": "Entrepreneur général"},
            {"value": "showroom",          "label": "Showroom"},
            {"value": "brand",             "label": "Marque"},
            {"value": "artisan",           "label": "Artisan"},
            {"value": "developer",         "label": "Promoteur"},
        ],
        "collab_types": [
            {"value": "residential", "label": "Projets résidentiels"},
            {"value": "hospitality", "label": "Projets hôteliers"},
            {"value": "retail",      "label": "Retail / Showroom"},
            {"value": "contract",    "label": "Contrat / Promoteur"},
        ],
        "interests": [
            {"id": "collab_residential", "label": "Je veux collaborer sur des projets résidentiels"},
            {"id": "collab_hospitality", "label": "Je veux collaborer sur des projets hôteliers"},
            {"id": "propose_services",   "label": "Je veux proposer mes services au studio"},
            {"id": "receive_opp",        "label": "Je veux recevoir des opportunités de MOOD for DESIGN"},
            {"id": "network",            "label": "Je veux rejoindre le réseau professionnel"},
        ],
    },
    "de-DE": {
        "s1_title": "Berufliche Identität",
        "s2_title": "Online-Profil",
        "s3_title": "Geografischer Kontext",
        "s4_title": "Kooperationsabsichten",
        "field_nome": "Vorname *",
        "field_cognome": "Nachname *",
        "field_studio": "Studio / Unternehmen *",
        "field_email": "Berufliche E-Mail *",
        "field_telefono": "Telefon",
        "field_ruolo": "Berufliche Rolle *",
        "field_sito": "Website",
        "field_instagram": "Instagram (Handle)",
        "field_linkedin": "LinkedIn (Profil-URL)",
        "field_area": "Geografisches Gebiet (Stadt, Region oder Land)",
        "field_tipo_collab": "Gewünschte Art der Zusammenarbeit",
        "field_interessi": "Wählen Sie alles aus, was auf Sie zutrifft:",
        "field_racconto": "Erzählen Sie uns, wie Sie sich eine Zusammenarbeit vorstellen.",
        "ph_ruolo": "Rolle auswählen...",
        "ph_collab": "Auswählen...",
        "ph_racconto": "Beschreiben Sie Ihren Ansatz zum Projekt...",
        "cta_submit": "Bewerbung einreichen",
        "privacy_text": "Ihre Daten werden ausschließlich zur Bewertung der Zusammenarbeit verwendet. Keine Daten werden an Dritte weitergegeben.",
        "error_generic": "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut oder schreiben Sie uns an info@studio.com.",
        "error_required": "Bitte füllen Sie alle Pflichtfelder aus.",
        "roles": [
            {"value": "architect",         "label": "Architekt"},
            {"value": "interior_designer", "label": "Innenarchitekt"},
            {"value": "contractor",        "label": "Generalunternehmer"},
            {"value": "showroom",          "label": "Showroom"},
            {"value": "brand",             "label": "Marke"},
            {"value": "artisan",           "label": "Handwerker"},
            {"value": "developer",         "label": "Entwickler"},
        ],
        "collab_types": [
            {"value": "residential", "label": "Wohnprojekte"},
            {"value": "hospitality", "label": "Hotelprojekte"},
            {"value": "retail",      "label": "Einzelhandel / Showroom"},
            {"value": "contract",    "label": "Vertrag / Entwickler"},
        ],
        "interests": [
            {"id": "collab_residential", "label": "Ich möchte an Wohnprojekten mitarbeiten"},
            {"id": "collab_hospitality", "label": "Ich möchte an Hotelprojekten mitarbeiten"},
            {"id": "propose_services",   "label": "Ich möchte meine Dienste dem Studio anbieten"},
            {"id": "receive_opp",        "label": "Ich möchte Möglichkeiten von MOOD for DESIGN erhalten"},
            {"id": "network",            "label": "Ich möchte dem professionellen Netzwerk beitreten"},
        ],
    },
    "es-ES": {
        "s1_title": "Identidad profesional",
        "s2_title": "Perfil en línea",
        "s3_title": "Contexto geográfico",
        "s4_title": "Intenciones de colaboración",
        "field_nome": "Nombre *",
        "field_cognome": "Apellido *",
        "field_studio": "Estudio / Empresa *",
        "field_email": "Email profesional *",
        "field_telefono": "Teléfono",
        "field_ruolo": "Rol profesional *",
        "field_sito": "Sitio web",
        "field_instagram": "Instagram (usuario)",
        "field_linkedin": "LinkedIn (URL del perfil)",
        "field_area": "Área geográfica (ciudad, región o país)",
        "field_tipo_collab": "Tipo de colaboración deseado",
        "field_interessi": "Selecciona todo lo que corresponda:",
        "field_racconto": "Cuéntanos cómo imaginas una colaboración.",
        "ph_ruolo": "Selecciona rol...",
        "ph_collab": "Selecciona...",
        "ph_racconto": "Describe tu enfoque al proyecto...",
        "cta_submit": "Enviar candidatura",
        "privacy_text": "Tus datos se utilizan exclusivamente para evaluar la colaboración. No se comparte ningún dato con terceros.",
        "error_generic": "Se produjo un error. Inténtalo de nuevo o escríbenos a info@studio.com.",
        "error_required": "Por favor, completa todos los campos obligatorios.",
        "roles": [
            {"value": "architect",         "label": "Arquitecto"},
            {"value": "interior_designer", "label": "Diseñador de interiores"},
            {"value": "contractor",        "label": "Contratista general"},
            {"value": "showroom",          "label": "Showroom"},
            {"value": "brand",             "label": "Marca"},
            {"value": "artisan",           "label": "Artesano"},
            {"value": "developer",         "label": "Promotor"},
        ],
        "collab_types": [
            {"value": "residential", "label": "Proyectos residenciales"},
            {"value": "hospitality", "label": "Proyectos de hospitalidad"},
            {"value": "retail",      "label": "Retail / Showroom"},
            {"value": "contract",    "label": "Contrato / Promotor"},
        ],
        "interests": [
            {"id": "collab_residential", "label": "Quiero colaborar en proyectos residenciales"},
            {"id": "collab_hospitality", "label": "Quiero colaborar en proyectos de hospitalidad"},
            {"id": "propose_services",   "label": "Quiero proponer mis servicios al estudio"},
            {"id": "receive_opp",        "label": "Quiero recibir oportunidades de MOOD for DESIGN"},
            {"id": "network",            "label": "Quiero unirme a la red profesional"},
        ],
    },
    "es-MX": {
        "s1_title": "Identidad profesional",
        "s2_title": "Perfil en línea",
        "s3_title": "Contexto geográfico",
        "s4_title": "Intenciones de colaboración",
        "field_nome": "Nombre *",
        "field_cognome": "Apellido *",
        "field_studio": "Estudio / Empresa *",
        "field_email": "Email profesional *",
        "field_telefono": "Teléfono",
        "field_ruolo": "Rol profesional *",
        "field_sito": "Sitio web",
        "field_instagram": "Instagram (usuario)",
        "field_linkedin": "LinkedIn (URL del perfil)",
        "field_area": "Área geográfica (ciudad, estado o país)",
        "field_tipo_collab": "Tipo de colaboración deseado",
        "field_interessi": "Selecciona todo lo que aplique:",
        "field_racconto": "Cuéntanos cómo imaginas una colaboración.",
        "ph_ruolo": "Selecciona rol...",
        "ph_collab": "Selecciona...",
        "ph_racconto": "Describe tu enfoque al proyecto...",
        "cta_submit": "Enviar solicitud",
        "privacy_text": "Tus datos se utilizan exclusivamente para evaluar la colaboración. No se comparte ningún dato con terceros.",
        "error_generic": "Se produjo un error. Por favor intenta de nuevo o escríbenos a info@studio.com.",
        "error_required": "Por favor, completa todos los campos requeridos.",
        "roles": [
            {"value": "architect",         "label": "Arquitecto"},
            {"value": "interior_designer", "label": "Diseñador de interiores"},
            {"value": "contractor",        "label": "Contratista general"},
            {"value": "showroom",          "label": "Showroom"},
            {"value": "brand",             "label": "Marca"},
            {"value": "artisan",           "label": "Artesano"},
            {"value": "developer",         "label": "Desarrollador"},
        ],
        "collab_types": [
            {"value": "residential", "label": "Proyectos residenciales"},
            {"value": "hospitality", "label": "Proyectos de hospitalidad"},
            {"value": "retail",      "label": "Retail / Showroom"},
            {"value": "contract",    "label": "Contrato / Desarrollador"},
        ],
        "interests": [
            {"id": "collab_residential", "label": "Quiero colaborar en proyectos residenciales"},
            {"id": "collab_hospitality", "label": "Quiero colaborar en proyectos de hospitalidad"},
            {"id": "propose_services",   "label": "Quiero proponer mis servicios al estudio"},
            {"id": "receive_opp",        "label": "Quiero recibir oportunidades de MOOD for DESIGN"},
            {"id": "network",            "label": "Quiero unirme a la red profesional"},
        ],
    },
}


def main():
    sb = db()

    # Get tenant
    tenants = sb.table('tenants').select('id').eq('slug', TENANT_SLUG).limit(1).execute().data or []
    if not tenants:
        print(f"ERROR: Tenant '{TENANT_SLUG}' not found")
        return
    tenant_id = tenants[0]['id']
    print(f"Tenant ID: {tenant_id}")

    # Get or create page
    pages = (sb.table('cms_pages').select('id')
             .eq('tenant_id', tenant_id).eq('page_key', PAGE_KEY)
             .limit(1).execute()).data or []
    if not pages:
        page_id = str(uuid.uuid4())
        sb.table('cms_pages').insert({
            'id':         page_id,
            'tenant_id':  tenant_id,
            'page_key':   PAGE_KEY,
            'title':      PAGE_KEY.replace('-', ' ').title(),
            'status':     'published',
            'created_at': now(),
            'updated_at': now(),
        }).execute()
        print(f"Created page: {page_id}")
    else:
        page_id = pages[0]['id']
        print(f"Existing page: {page_id}")

    # Check if section already exists
    sections = (sb.table('cms_sections').select('id')
                .eq('page_id', page_id).eq('section_type', SECTION_TYPE)
                .limit(1).execute()).data or []
    if sections:
        sb.table('cms_sections').update({
            'locale_content': LOCALE_CONTENT,
            'updated_at':     now(),
        }).eq('id', sections[0]['id']).execute()
        print(f"Updated existing section: {sections[0]['id']}")
        return

    section_id = str(uuid.uuid4())
    sb.table('cms_sections').insert({
        'id':             section_id,
        'tenant_id':      tenant_id,
        'page_id':        page_id,
        'section_type':   SECTION_TYPE,
        'locale_content': LOCALE_CONTENT,
        'settings':       {},
        'visible':        True,
        'sort_order':     10,
        'created_at':     now(),
        'updated_at':     now(),
    }).execute()
    print(f"Created section: {section_id}")
    print("Done! partner_form_labels seeded for 7 locales.")


if __name__ == '__main__':
    main()
