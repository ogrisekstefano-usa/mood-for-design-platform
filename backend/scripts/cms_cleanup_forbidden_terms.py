"""
CMS Forbidden Terms Cleanup
═══════════════════════════════════════════════════════════════════════
Sostituisce in modo IDEMPOTENTE le occorrenze residue di
`Atelier`, `Maison`, e `Demo` (admin-internal "Golden Demo Tenant" →
"Golden Sandbox Tenant") nel CMS, preservando la grammatica per locale.

STRATEGY:
  • UPDATE diretto su `editorial_blocks.source_value` e
    `editorial_block_translations.value` con substitution map per term.
  • Case-preserving via regex multi-pattern.
  • Idempotente — re-runnable: se il termine è già rimosso, non fa nulla.
  • Compatibile con hold P0: nessun DELETE, solo UPDATE.

Sostituzioni:
  Atelier → Studio (generic) | Practice (tier) | Studio (default)
  atelier → studio
  Maison  → Casa (FR/IT generic)
  Demo Tenant → Sandbox Tenant (admin-internal feature)
  Demo Governance → Sandbox Governance
  Golden Demo Tenant → Golden Sandbox Tenant
  Demo-Tenant → Sandbox-Tenant (DE)
  Demo-Mandant → Sandbox-Mandant (DE)
  Gobernanza Demo → Gobernanza Sandbox (ES)
  Demo-Governance → Sandbox-Governance (DE)

Authority:
  • LOCALE_ARCHITECTURE_DIRECTIVE.md
  • TIER_NAMING_FINAL_REVISION.md
  • PRICING_POSITIONING_REVISION.md
"""
import os
import re
import sys
import hashlib
import psycopg2
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')

DATABASE_URL = os.environ.get('SESSION_POOLER_URL') or os.environ.get('DATABASE_URL')


# Ordered substitution rules. Longer / more-specific patterns first.
# Each rule = (pattern_regex, replacement, flags, description)
SUBS = [
    # ── Compound admin labels (DE/ES locale-specific) ──
    (r'Golden Demo Tenant',             'Golden Sandbox Tenant',     0,           'EN: Golden Demo Tenant → Golden Sandbox Tenant'),
    (r'Golden Demo-Tenant',             'Golden Sandbox-Tenant',     0,           'DE: Golden Demo-Tenant → Golden Sandbox-Tenant'),
    (r'Demo Governance',                'Sandbox Governance',        0,           'EN/IT: Demo Governance → Sandbox Governance'),
    (r'Demo-Governance',                'Sandbox-Governance',        0,           'DE: Demo-Governance → Sandbox-Governance'),
    (r'Gobernanza Demo',                'Gobernanza Sandbox',        0,           'ES: Gobernanza Demo → Gobernanza Sandbox'),
    (r'Demo Tenant',                    'Sandbox Tenant',            0,           'EN/IT: Demo Tenant → Sandbox Tenant'),
    (r'Demo-Tenant',                    'Sandbox-Tenant',            0,           'DE: Demo-Tenant → Sandbox-Tenant'),
    (r'Demo-Mandant',                   'Sandbox-Mandant',           0,           'DE: Demo-Mandant → Sandbox-Mandant'),
    (r'Demo tenant',                    'Sandbox tenant',            0,           'IT: Demo tenant → Sandbox tenant'),

    # ── Atelier (public-facing + admin presets + tier reference) ──
    # Public site pricing — specifically "modalità Atelier" → "modalità Blueprint Practice"
    (r'modalità Atelier',               'modalità Blueprint Practice', 0,         'IT: modalità Atelier → modalità Blueprint Practice (tier reference)'),

    # Blueprint Atelier (home pillar) → Blueprint Practice (tier naming)
    (r'Blueprint Atelier',              'Blueprint Practice',        0,           'Blueprint Atelier → Blueprint Practice (tier naming alignment)'),

    # Atelier Presets (admin) → Studio Presets
    (r'Atelier Presets',                'Studio Presets',            0,           'EN: Atelier Presets → Studio Presets'),
    (r'Preset Atelier',                 'Preset Studio',             0,           'IT: Preset Atelier → Preset Studio'),
    (r'Atelier-Voreinstellungen',       'Studio-Voreinstellungen',   0,           'DE: Atelier-Voreinstellungen → Studio-Voreinstellungen'),
    (r'Préréglages Atelier',            'Préréglages Studio',        0,           'FR: Préréglages Atelier → Préréglages Studio'),
    (r"Préréglages d'atelier",          'Préréglages de studio',     0,           'FR: Préréglages d\'atelier → Préréglages de studio'),
    (r'Preajustes de Atelier',          'Preajustes de Studio',      0,           'ES: Preajustes de Atelier → Preajustes de Studio'),
    (r'Preajustes Atelier',             'Preajustes Studio',         0,           'ES: Preajustes Atelier → Preajustes Studio'),

    # Place / brand / project names
    (r'Atelier Milano',                 'Studio Milano',             0,           'Project tile: Atelier Milano → Studio Milano'),

    # System email (atelier as metaphor for tenant workspace) → studio
    (r"L'atelier",                      'Lo studio',                 0,           'IT: L\'atelier → Lo studio'),
    (r"l'atelier",                      'lo studio',                 0,           'IT lowercase: l\'atelier → lo studio'),
    (r"L'Atelier",                      'Lo Studio',                 0,           'IT: L\'Atelier → Lo Studio'),
    (r"d'atelier",                      'di studio',                 0,           'IT: d\'atelier → di studio'),
    # FR
    (r"l'atelier",                      'le studio',                 0,           'FR: l\'atelier → le studio'),
    (r"L'atelier",                      'Le studio',                 0,           'FR: L\'atelier → Le studio'),
    (r"votre atelier",                  'votre studio',              0,           'FR: votre atelier → votre studio'),
    (r"Votre atelier",                  'Votre studio',              0,           'FR: Votre atelier → Votre studio'),
    (r"identité atelier",               'identité studio',           0,           'FR: identité atelier → identité studio'),
    # DE
    (r'Atelier-Mandant',                'Studio-Mandant',            0,           'DE compound'),
    (r'das Atelier',                    'das Studio',                0,           'DE: das Atelier → das Studio'),
    (r'Das Atelier',                    'Das Studio',                0,           'DE: Das Atelier → Das Studio'),
    (r'Ihr Atelier',                    'Ihr Studio',                0,           'DE: Ihr Atelier → Ihr Studio'),
    (r'Ihrem Atelier',                  'Ihrem Studio',              0,           'DE: Ihrem Atelier → Ihrem Studio'),
    (r'Atelier zuzugreifen',            'Studio zuzugreifen',        0,           'DE'),
    (r'Atelier zu betreten',            'Studio zu betreten',        0,           'DE'),
    (r'Atelier Identity',               'Studio Identity',           0,           'DE: Atelier Identity → Studio Identity'),
    (r'die Ateliers',                   'die Studios',               0,           'DE plural'),
    (r'Die Ateliers',                   'Die Studios',               0,           'DE plural'),

    # EN
    (r'design atelier',                 'design studio',             0,           'EN: design atelier → design studio'),
    (r'Discover the atelier',           'Discover the studio',       0,           'EN-GB'),
    (r'Explore the atelier',            'Explore the studio',        0,           'EN-US'),
    (r'the atelier',                    'the studio',                0,           'EN'),
    (r'an atelier',                     'a studio',                  0,           'EN'),
    (r'Atelier presets',                'Studio presets',            0,           'EN'),
    (r'Atelier-presets',                'Studio-presets',            0,           'EN'),
    # ES
    (r'el atelier',                     'el studio',                 0,           'ES'),
    (r'Esplora el atelier',             'Esplora el studio',         0,           'ES'),
    (r'Explora el atelier',             'Explora el studio',         0,           'ES'),
    # ES generic
    (r'presets Atelier',                'presets Studio',            0,           'ES'),
    (r'preset Atelier',                 'preset Studio',             0,           'ES/IT'),

    # ── Generic IT public copy fallback for "Atelier" mentions ──
    (r'Atelier, studio, casa',          'Studio, brand, gruppo',     0,           'IT placeholder studio name'),
    (r'showroom curatoriali, retailer', 'showroom curatoriali, retailer', 0,      '(no-op safety anchor)'),

    # Atelier in showroom_continuity_body → studio digitale
    (r'atelier digitale',               'studio digitale',           0,           'IT: atelier digitale → studio digitale'),

    # Identity atelier label
    (r"L'atelier — chi compone con voi", 'Lo studio — chi compone con voi', 0,    'IT identity label'),

    # ── Generic word-boundary fallback: Atelier → Studio, atelier → studio ──
    # These must run LAST after all compound rules.
    (r'\bAtelier\b',                    'Studio',                    0,           'Generic Atelier → Studio'),
    (r'\batelier\b',                    'studio',                    0,           'Generic atelier → studio (lowercase)'),
    (r'\bAteliers\b',                   'Studios',                   0,           'Plural Ateliers → Studios'),
    (r'\bateliers\b',                   'studios',                   0,           'Plural ateliers → studios'),

    # ── Maison (FR registry token) ──
    (r'\bMaison\b',                     'Casa',                      0,           'FR: Maison → Casa (begin_journey chip)'),
    (r'\bmaison\b',                     'casa',                      0,           'FR lowercase'),
]


def apply_subs(text: str) -> tuple[str, list[str]]:
    """Apply all substitutions sequentially. Return (new_text, applied_rules)."""
    if text is None:
        return text, []
    new_text = text
    applied = []
    for pattern, repl, flags, desc in SUBS:
        if re.search(pattern, new_text, flags):
            new_text = re.sub(pattern, repl, new_text, flags=flags)
            applied.append(desc)
    return new_text, applied


def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    stats = {'blocks_updated': 0, 'translations_updated': 0, 'rules_fired': {}, 'skipped': 0}

    try:
        # ── 1) editorial_blocks.source_value ──
        cur.execute("""
            SELECT id, namespace, block_key, source_value
            FROM editorial_blocks
            WHERE is_active = true
              AND (
                source_value ILIKE '%atelier%' OR
                source_value ILIKE '%maison%'  OR
                source_value ~* '\\mdemo\\M'
              )
        """)
        rows = cur.fetchall()
        print(f"[BLOCKS] {len(rows)} candidate rows")
        for _id, ns, key, val in rows:
            new_val, applied = apply_subs(val)
            if new_val != val:
                h = hashlib.md5((new_val or '').encode('utf-8')).hexdigest()
                cur.execute("""
                    UPDATE editorial_blocks
                       SET source_value = %s,
                           source_hash  = %s,
                           updated_at   = now()
                     WHERE id = %s
                """, (new_val, h, _id))
                stats['blocks_updated'] += 1
                for r in applied:
                    stats['rules_fired'][r] = stats['rules_fired'].get(r, 0) + 1
                print(f"  ✓ {ns}.{key}")
            else:
                stats['skipped'] += 1

        # ── 2) editorial_block_translations.value ──
        cur.execute("""
            SELECT t.block_id, t.locale, t.value, b.namespace, b.block_key
            FROM editorial_block_translations t
            JOIN editorial_blocks b ON b.id = t.block_id
            WHERE b.is_active = true
              AND (
                t.value ILIKE '%atelier%' OR
                t.value ILIKE '%maison%'  OR
                t.value ~* '\\mdemo\\M'
              )
        """)
        rows = cur.fetchall()
        print(f"[TRANSLATIONS] {len(rows)} candidate rows")
        for bid, loc, val, ns, key in rows:
            new_val, applied = apply_subs(val)
            if new_val != val:
                h = hashlib.md5((new_val or '').encode('utf-8')).hexdigest()
                cur.execute("""
                    UPDATE editorial_block_translations
                       SET value       = %s,
                           source_hash = %s,
                           updated_at  = now()
                     WHERE block_id = %s AND locale = %s
                """, (new_val, h, bid, loc))
                stats['translations_updated'] += 1
                for r in applied:
                    stats['rules_fired'][r] = stats['rules_fired'].get(r, 0) + 1
                print(f"  ✓ {ns}.{key} [{loc}]")
            else:
                stats['skipped'] += 1

        conn.commit()
    finally:
        cur.close()
        conn.close()

    print(f"\n══════════════════════════════════════════")
    print(f"BLOCKS updated:       {stats['blocks_updated']}")
    print(f"TRANSLATIONS updated: {stats['translations_updated']}")
    print(f"SKIPPED (no match):   {stats['skipped']}")
    print(f"\nRULES FIRED:")
    for r, c in sorted(stats['rules_fired'].items(), key=lambda x: -x[1]):
        print(f"  {c:>4} × {r}")
    sys.exit(0)


if __name__ == '__main__':
    main()
