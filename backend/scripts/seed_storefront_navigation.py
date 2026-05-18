"""
Phase S-CONNECT Step B Phase 2.a — Seed demo tenant's storefront with the
footer columns / showroom / socials content that previously lived hardcoded
in `frontend/src/site/content/navigation.js`.

After this, the public SiteFooter reads everything from DB and the tenant
can edit columns / showroom / socials directly from Storefront Studio.

Usage:
    python /app/backend/scripts/seed_storefront_navigation.py [tenant_slug]

Idempotent: skips when a `footer_columns` section already exists for the
tenant's `navigation` page.
"""
import os
import sys
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras

load_dotenv('/app/backend/.env')

DEMO_SLUG = sys.argv[1] if len(sys.argv) > 1 else 'mood-demo-studio-81a09e'

FOOTER_COLUMNS = [
    {"id": "company",   "title": {"it-IT": "EXE Interior",  "en-US": "EXE Interior", "fr-FR": "EXE Interior", "de-DE": "EXE Interior", "es-ES": "EXE Interior", "ar-AE": "EXE Interior"}, "links": [
        {"href": "#about",    "label": {"it-IT": "Chi siamo",      "en-US": "About us",   "fr-FR": "À propos",     "de-DE": "Über uns",    "es-ES": "Nosotros",     "ar-AE": "من نحن"}},
        {"href": "#showroom", "label": {"it-IT": "Showroom",       "en-US": "Showroom",   "fr-FR": "Showroom",     "de-DE": "Showroom",    "es-ES": "Showroom",     "ar-AE": "صالة العرض"}},
        {"href": "#press",    "label": {"it-IT": "Press",          "en-US": "Press",      "fr-FR": "Presse",       "de-DE": "Presse",      "es-ES": "Prensa",       "ar-AE": "الصحافة"}},
        {"href": "#careers",  "label": {"it-IT": "Lavora con noi", "en-US": "Careers",    "fr-FR": "Rejoindre",    "de-DE": "Karriere",    "es-ES": "Únete",        "ar-AE": "وظائف"}},
    ]},
    {"id": "services", "title": {"it-IT": "Servizi", "en-US": "Services", "fr-FR": "Services", "de-DE": "Leistungen", "es-ES": "Servicios", "ar-AE": "الخدمات"}, "links": [
        {"href": "#services/progettazione",       "label": {"it-IT": "Progettazione su misura", "en-US": "Bespoke design",         "fr-FR": "Conception sur mesure",  "de-DE": "Maßgeschneiderte Planung", "es-ES": "Diseño a medida",      "ar-AE": "تصميم مخصص"}},
        {"href": "#services/arredi",              "label": {"it-IT": "Arredi Made in Italy",    "en-US": "Made in Italy furniture","fr-FR": "Mobilier Made in Italy", "de-DE": "Möbel Made in Italy",     "es-ES": "Mobiliario Made in Italy","ar-AE": "أثاث صنع في إيطاليا"}},
        {"href": "#services/moodboard",           "label": {"it-IT": "Moodboard & Concept",     "en-US": "Moodboards & concept",   "fr-FR": "Moodboards & concept",   "de-DE": "Moodboards & Konzept",    "es-ES": "Moodboards y concepto","ar-AE": "لوحات إلهام وكونسبت"}},
        {"href": "#services/project-management",  "label": {"it-IT": "Project Management",      "en-US": "Project management",     "fr-FR": "Gestion de projet",      "de-DE": "Projektmanagement",       "es-ES": "Gestión de proyecto",  "ar-AE": "إدارة المشاريع"}},
        {"href": "#services/ad-partnership",      "label": {"it-IT": "A&D Partnership",         "en-US": "A&D Partnership",        "fr-FR": "Partenariat A&D",        "de-DE": "A&D Partnerschaft",       "es-ES": "Partnership A&D",      "ar-AE": "شراكة A&D"}},
    ]},
    {"id": "resources", "title": {"it-IT": "Risorse", "en-US": "Resources", "fr-FR": "Ressources", "de-DE": "Ressourcen", "es-ES": "Recursos", "ar-AE": "مصادر"}, "links": [
        {"href": "/magazine", "label": {"it-IT": "Magazine",  "en-US": "Magazine",  "fr-FR": "Magazine",  "de-DE": "Magazin",  "es-ES": "Revista",   "ar-AE": "المجلة"}},
        {"href": "/projects", "label": {"it-IT": "Progetti",  "en-US": "Projects",  "fr-FR": "Projets",   "de-DE": "Projekte", "es-ES": "Proyectos", "ar-AE": "المشاريع"}},
        {"href": "#brands",   "label": {"it-IT": "Brand",     "en-US": "Brands",    "fr-FR": "Marques",   "de-DE": "Marken",   "es-ES": "Marcas",    "ar-AE": "العلامات"}},
    ]},
    {"id": "legal", "title": {"it-IT": "Legal", "en-US": "Legal", "fr-FR": "Légal", "de-DE": "Rechtliches", "es-ES": "Legal", "ar-AE": "قانوني"}, "links": [
        {"href": "#privacy", "label": {"it-IT": "Privacy Policy",       "en-US": "Privacy Policy",    "fr-FR": "Confidentialité",  "de-DE": "Datenschutz",         "es-ES": "Privacidad",          "ar-AE": "سياسة الخصوصية"}},
        {"href": "#cookies", "label": {"it-IT": "Cookie Policy",        "en-US": "Cookie Policy",     "fr-FR": "Politique cookies","de-DE": "Cookie-Richtlinie",   "es-ES": "Política de cookies", "ar-AE": "سياسة الكوكيز"}},
        {"href": "#terms",   "label": {"it-IT": "Termini e Condizioni", "en-US": "Terms & Conditions","fr-FR": "CGU",              "de-DE": "AGB",                  "es-ES": "Términos",            "ar-AE": "الشروط والأحكام"}},
    ]},
]

SHOWROOM = {
    "title":        {"it-IT": "Showroom", "en-US": "Showroom", "fr-FR": "Showroom", "de-DE": "Showroom", "es-ES": "Showroom", "ar-AE": "صالة العرض"},
    "addressLines": ["Via della Manifattura 12", "33080 Porcia (PN) — Italia", "+39 0434 123456", "info@exeinterior.com"],
    "bookCta":      {"label": {"it-IT": "Prenota una visita", "en-US": "Book a visit", "fr-FR": "Réserver une visite", "de-DE": "Besuch buchen", "es-ES": "Reservar una visita", "ar-AE": "احجز زيارة"}, "href": "#book"},
}

SOCIALS = [
    {"id": "instagram", "href": "https://instagram.com/", "label": "Instagram", "icon": "instagram"},
    {"id": "pinterest", "href": "https://pinterest.com/", "label": "Pinterest", "icon": "pinterest"},
    {"id": "linkedin",  "href": "https://linkedin.com/",  "label": "LinkedIn",  "icon": "linkedin"},
]


def upsert_page(cur, tenant_id: str, page_key: str, title: str) -> str:
    cur.execute("SELECT id FROM cms_pages WHERE tenant_id=%s AND page_key=%s", (tenant_id, page_key))
    row = cur.fetchone()
    if row:
        return row[0]
    new_id = str(uuid.uuid4())
    cur.execute(
        """INSERT INTO cms_pages (id, tenant_id, page_key, title, status, locale_meta, created_at, updated_at)
           VALUES (%s, %s, %s, %s, 'draft', '{}'::jsonb, NOW(), NOW())""",
        (new_id, tenant_id, page_key, title),
    )
    return new_id


def section_exists(cur, page_id: str, section_type: str) -> bool:
    cur.execute(
        "SELECT 1 FROM cms_sections WHERE page_id=%s AND section_type=%s LIMIT 1",
        (page_id, section_type),
    )
    return cur.fetchone() is not None


def insert_section(cur, page_id: str, tenant_id: str, section_type: str, sort_order: int, locale_content: dict, settings: dict):
    cur.execute(
        """INSERT INTO cms_sections
            (id, tenant_id, page_id, section_type, sort_order, visible,
             locale_content, settings, created_at, updated_at)
           VALUES (%s, %s, %s, %s, %s, TRUE,
                   %s::jsonb, %s::jsonb, NOW(), NOW())""",
        (
            str(uuid.uuid4()), tenant_id, page_id, section_type, sort_order,
            psycopg2.extras.Json(locale_content),
            psycopg2.extras.Json(settings),
        ),
    )


def main():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute("SELECT id, name FROM tenants WHERE slug = %s", (DEMO_SLUG,))
    row = cur.fetchone()
    if not row:
        print(f"Tenant not found: {DEMO_SLUG}")
        sys.exit(1)
    tenant_id, tenant_name = row
    print(f"Tenant: {tenant_name} ({tenant_id})")

    # Navigation page
    nav_page_id = upsert_page(cur, tenant_id, 'navigation', 'Navigation')
    print(f"navigation page id: {nav_page_id}")

    if section_exists(cur, nav_page_id, 'footer_columns'):
        print("[skip] footer_columns section already exists.")
    else:
        # locale_content keeps the column titles by locale; settings keeps structure.
        locale_content = {
            'it-IT': {'section_title': 'Footer'},
            'en-US': {'section_title': 'Footer'},
        }
        settings = {
            'columns':  FOOTER_COLUMNS,
            'showroom': SHOWROOM,
            'socials':  SOCIALS,
        }
        insert_section(cur, nav_page_id, tenant_id, 'footer_columns', 100, locale_content, settings)
        print("[ok] footer_columns section seeded.")

    # Also seed a `main_links` section mirroring the header nav, so admins
    # can edit the public header from Storefront Studio Navigation tab.
    if section_exists(cur, nav_page_id, 'main_links'):
        print("[skip] main_links section already exists.")
    else:
        main_links = [
            {"id": "home",         "href": "/",             "label": {"it-IT": "Home",       "en-US": "Home"}},
            {"id": "servizi",      "href": "#services",     "label": {"it-IT": "Servizi",    "en-US": "Services"}},
            {"id": "progetti",     "href": "/projects",     "label": {"it-IT": "Progetti",   "en-US": "Projects"}},
            {"id": "partnership",  "href": "#ad-partnership","label": {"it-IT": "A&D Partnership", "en-US": "A&D Partnership"}},
            {"id": "magazine",     "href": "/magazine",     "label": {"it-IT": "Magazine",   "en-US": "Magazine"}},
            {"id": "chi-siamo",    "href": "#about",        "label": {"it-IT": "Chi Siamo",  "en-US": "About"}},
            {"id": "contatti",     "href": "#contact",      "label": {"it-IT": "Contatti",   "en-US": "Contact"}},
        ]
        insert_section(
            cur, nav_page_id, tenant_id, 'main_links', 10,
            {'it-IT': {'section_title': 'Header'}, 'en-US': {'section_title': 'Header'}},
            {'links': main_links},
        )
        print("[ok] main_links section seeded.")

    # Mark page as published so the public endpoint serves it.
    cur.execute(
        "UPDATE cms_pages SET status='published', updated_at=NOW(), published_at=NOW() WHERE id=%s",
        (nav_page_id,),
    )
    print("[ok] navigation page marked published.")
    cur.close()
    conn.close()
    print("DONE.")


if __name__ == '__main__':
    main()
