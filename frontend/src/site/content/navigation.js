// EXE INTERIOR — Demo Storefront Navigation
// Mirrors the mockup: top utility row (lang + Magazine/PMS/Area Riservata/CTA),
// centered serif brand wordmark, main nav row beneath the brand.

const T = (it, en, fr, de, es, ae) => ({ it, en, fr, de, es, ae });

export const navigationContent = {
  brand: {
    name: 'EXE INTERIOR',
    suffix: '',
    logoSrc: '',                                  // wordmark only — no logo image
    tagline: T(
      'Italian Design Excellence',
      'Italian Design Excellence',
      'L’excellence du design italien',
      'Italienische Designexzellenz',
      'Excelencia del diseño italiano',
      'تميّز التصميم الإيطالي',
    ),
  },
  header: {
    // Main horizontal nav (under the brand block).
    links: [
      { id: 'home',         href: '/',              label: T('Home',           'Home',          'Accueil',           'Start',         'Inicio',           'الرئيسية') },
      { id: 'servizi',      href: '#services',      label: T('Servizi',        'Services',      'Services',          'Leistungen',    'Servicios',        'الخدمات') },
      { id: 'progetti',     href: '/projects',      label: T('Progetti',       'Projects',      'Projets',           'Projekte',      'Proyectos',        'المشاريع') },
      { id: 'partnership',  href: '#ad-partnership',label: T('A&D Partnership','A&D Partnership','A&D Partnership',  'A&D Partnership','A&D Partnership','شراكة A&D') },
      { id: 'magazine',     href: '/magazine',      label: T('Magazine',       'Magazine',      'Magazine',          'Magazin',       'Revista',          'المجلة') },
      { id: 'chi-siamo',    href: '#about',         label: T('Chi Siamo',      'About',         'À Propos',          'Über Uns',      'Nosotros',         'من نحن') },
      { id: 'contatti',     href: '#contact',       label: T('Contatti',       'Contact',       'Contact',           'Kontakt',       'Contacto',         'تواصل معنا') },
    ],
    access: {
      label: T('Area Riservata', 'Members Area', 'Espace Privé', 'Mitgliederbereich', 'Área Privada', 'منطقة خاصة'),
      href: '/auth/login',
    },
    cta: {
      label: T('Richiedi Progetto', 'Request Project', 'Demander un Projet', 'Projekt Anfragen', 'Solicitar Proyecto', 'اطلب مشروعاً'),
      href: '/start-project',
    },
    // Utility links shown in the top row, between the language switcher and the CTA.
    utility: [
      { id: 'magazine', href: '/magazine',   label: T('Magazine',        'Magazine',     'Magazine',     'Magazin',      'Revista',      'المجلة') },
      { id: 'pms',      href: '#pms',        label: T('PMS',             'PMS',          'PMS',          'PMS',          'PMS',          'PMS') },
      { id: 'area',     href: '/auth/login', label: T('Area Riservata',  'Members Area', 'Espace Privé', 'Mitglieder',   'Área Privada', 'منطقة خاصة') },
    ],
  },
  footer: {
    tagline: T(
      'EXE Interior\nItalian Design Excellence',
      'EXE Interior\nItalian Design Excellence',
      'EXE Interior\nL’excellence du design italien',
      'EXE Interior\nItalienische Designexzellenz',
      'EXE Interior\nExcelencia del diseño italiano',
      'EXE Interior\nتميّز التصميم الإيطالي',
    ),
    columns: [
      {
        id: 'company', title: T('EXE Interior', 'EXE Interior', 'EXE Interior', 'EXE Interior', 'EXE Interior', 'EXE Interior'),
        links: [
          { href: '#about',    label: T('Chi siamo',           'About us',          'À propos',                     'Über uns',          'Nosotros',                   'من نحن') },
          { href: '#showroom', label: T('Showroom',            'Showroom',          'Showroom',                     'Showroom',          'Showroom',                   'صالة العرض') },
          { href: '#press',    label: T('Press',               'Press',             'Presse',                       'Presse',            'Prensa',                     'الصحافة') },
          { href: '#careers',  label: T('Lavora con noi',      'Careers',           'Rejoindre',                    'Karriere',          'Únete',                      'وظائف') },
        ],
      },
      {
        id: 'services', title: T('Servizi', 'Services', 'Services', 'Leistungen', 'Servicios', 'الخدمات'),
        links: [
          { href: '#services/progettazione',       label: T('Progettazione su misura', 'Bespoke design',         'Conception sur mesure',         'Maßgeschneiderte Planung',  'Diseño a medida',              'تصميم مخصص') },
          { href: '#services/arredi',              label: T('Arredi Made in Italy',    'Made in Italy furniture','Mobilier Made in Italy',        'Möbel Made in Italy',       'Mobiliario Made in Italy',     'أثاث صنع في إيطاليا') },
          { href: '#services/moodboard',           label: T('Moodboard & Concept',     'Moodboards & concept',   'Moodboards & concept',          'Moodboards & Konzept',      'Moodboards y concepto',        'لوحات إلهام وكونسبت') },
          { href: '#services/project-management',  label: T('Project Management',      'Project management',     'Gestion de projet',             'Projektmanagement',         'Gestión de proyecto',          'إدارة المشاريع') },
          { href: '#services/ad-partnership',      label: T('A&D Partnership',         'A&D Partnership',        'Partenariat A&D',               'A&D Partnerschaft',         'Partnership A&D',              'شراكة A&D') },
        ],
      },
      {
        id: 'resources', title: T('Risorse', 'Resources', 'Ressources', 'Ressourcen', 'Recursos', 'مصادر'),
        links: [
          { href: '/magazine', label: T('Magazine',  'Magazine',  'Magazine',  'Magazin',  'Revista',  'المجلة') },
          { href: '/projects', label: T('Progetti',  'Projects',  'Projets',   'Projekte', 'Proyectos','المشاريع') },
          { href: '#brands',   label: T('Brand',     'Brands',    'Marques',   'Marken',   'Marcas',   'العلامات') },
        ],
      },
      {
        id: 'legal', title: T('Legal', 'Legal', 'Légal', 'Rechtliches', 'Legal', 'قانوني'),
        links: [
          { href: '#privacy', label: T('Privacy Policy',           'Privacy Policy',     'Confidentialité', 'Datenschutz',          'Privacidad',          'سياسة الخصوصية') },
          { href: '#cookies', label: T('Cookie Policy',            'Cookie Policy',      'Politique cookies','Cookie-Richtlinie',   'Política de cookies', 'سياسة الكوكيز') },
          { href: '#terms',   label: T('Termini e Condizioni',     'Terms & Conditions', 'CGU',             'AGB',                  'Términos',            'الشروط والأحكام') },
        ],
      },
    ],
    showroom: {
      title: T('Showroom', 'Showroom', 'Showroom', 'Showroom', 'Showroom', 'صالة العرض'),
      addressLines: [
        'Via della Manifattura 12',
        '33080 Porcia (PN) — Italia',
        '+39 0434 123456',
        'info@exeinterior.com',
      ],
      bookCta: {
        label: T('Prenota una visita', 'Book a visit', 'Réserver une visite', 'Besuch buchen', 'Reservar una visita', 'احجز زيارة'),
        href: '#book',
      },
    },
    socials: [
      { id: 'instagram', href: 'https://instagram.com/', label: 'Instagram', icon: 'instagram' },
      { id: 'pinterest', href: 'https://pinterest.com/', label: 'Pinterest', icon: 'pinterest' },
      { id: 'linkedin',  href: 'https://linkedin.com/',  label: 'LinkedIn',  icon: 'linkedin' },
    ],
    copyright: T(
      '© {year} EXE Interior — Tutti i diritti riservati. Powered by MOOD for DESIGN\u2122.',
      '© {year} EXE Interior — All rights reserved. Powered by MOOD for DESIGN\u2122.',
      '© {year} EXE Interior — Tous droits réservés. Powered by MOOD for DESIGN\u2122.',
      '© {year} EXE Interior — Alle Rechte vorbehalten. Powered by MOOD for DESIGN\u2122.',
      '© {year} EXE Interior — Todos los derechos reservados. Powered by MOOD for DESIGN\u2122.',
      '© {year} EXE Interior — جميع الحقوق محفوظة. مدعوم من MOOD for DESIGN\u2122.',
    ),
  },
};
