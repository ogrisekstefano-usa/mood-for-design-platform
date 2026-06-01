"""
Seed Italian + English labels for countries into editorial_blocks.
Namespace: geo.country.<ISO2>.label
"""
import asyncio, sys, hashlib
sys.path.insert(0, '/app/backend')
from sqlalchemy import text
from database import AsyncSessionLocal
from tenant_resolver import get_corporate_tenant

# Italian names — focus on countries most relevant to MOOD's audience.
# Countries not in this dict fall back to the English name_en in the DB.
COUNTRIES_IT = {
    'IT': 'Italia',                  'FR': 'Francia',                 'DE': 'Germania',
    'GB': 'Regno Unito',             'IE': 'Irlanda',                 'ES': 'Spagna',
    'PT': 'Portogallo',              'CH': 'Svizzera',                'AT': 'Austria',
    'BE': 'Belgio',                  'LU': 'Lussemburgo',             'NL': 'Paesi Bassi',
    'MC': 'Monaco',                  'AD': 'Andorra',                 'SM': 'San Marino',
    'VA': 'Città del Vaticano',      'LI': 'Liechtenstein',
    'SE': 'Svezia',                  'NO': 'Norvegia',                'DK': 'Danimarca',
    'FI': 'Finlandia',               'IS': 'Islanda',
    'GR': 'Grecia',                  'HR': 'Croazia',                 'SI': 'Slovenia',
    'PL': 'Polonia',                 'CZ': 'Repubblica Ceca',         'SK': 'Slovacchia',
    'HU': 'Ungheria',                'RO': 'Romania',                 'BG': 'Bulgaria',
    'EE': 'Estonia',                 'LV': 'Lettonia',                'LT': 'Lituania',
    'MT': 'Malta',                   'CY': 'Cipro',                   'TR': 'Turchia',
    'RS': 'Serbia',                  'ME': 'Montenegro',              'MK': 'Macedonia del Nord',
    'AL': 'Albania',                 'BA': 'Bosnia ed Erzegovina',
    'US': 'Stati Uniti',             'CA': 'Canada',                  'MX': 'Messico',
    'BR': 'Brasile',                 'AR': 'Argentina',               'CL': 'Cile',
    'CO': 'Colombia',                'PE': 'Perù',                    'UY': 'Uruguay',
    'PY': 'Paraguay',                'EC': 'Ecuador',                 'VE': 'Venezuela',
    'BO': 'Bolivia',                 'CR': 'Costa Rica',              'PA': 'Panama',
    'GT': 'Guatemala',               'HN': 'Honduras',                'SV': 'El Salvador',
    'NI': 'Nicaragua',               'DO': 'Repubblica Dominicana',   'CU': 'Cuba',
    'JM': 'Giamaica',                'TT': 'Trinidad e Tobago',
    'AE': 'Emirati Arabi Uniti',     'SA': 'Arabia Saudita',          'QA': 'Qatar',
    'KW': 'Kuwait',                  'BH': 'Bahrein',                 'OM': 'Oman',
    'IL': 'Israele',                 'JO': 'Giordania',               'LB': 'Libano',
    'EG': 'Egitto',                  'MA': 'Marocco',                 'TN': 'Tunisia',
    'DZ': 'Algeria',                 'LY': 'Libia',                   'ZA': 'Sudafrica',
    'NG': 'Nigeria',                 'KE': 'Kenya',                   'GH': 'Ghana',
    'ET': 'Etiopia',                 'TZ': 'Tanzania',                'UG': 'Uganda',
    'CN': 'Cina',                    'JP': 'Giappone',                'KR': 'Corea del Sud',
    'IN': 'India',                   'ID': 'Indonesia',               'PH': 'Filippine',
    'TH': 'Thailandia',              'VN': 'Vietnam',                 'MY': 'Malesia',
    'SG': 'Singapore',               'HK': 'Hong Kong',               'TW': 'Taiwan',
    'PK': 'Pakistan',                'BD': 'Bangladesh',              'LK': 'Sri Lanka',
    'NP': 'Nepal',                   'KZ': 'Kazakistan',
    'AU': 'Australia',               'NZ': 'Nuova Zelanda',           'FJ': 'Figi',
    'RU': 'Russia',                  'UA': 'Ucraina',                 'BY': 'Bielorussia',
    'GE': 'Georgia',                 'AM': 'Armenia',                 'AZ': 'Azerbaigian',
    'MD': 'Moldavia',                'AX': 'Isole Åland',             'FO': 'Isole Fær Øer',
}

async def main():
    tenant = await get_corporate_tenant()
    tid = tenant['id']
    async with AsyncSessionLocal() as s:
        # Pull all countries
        countries = (await s.execute(text(
            "SELECT iso2, name_en FROM countries ORDER BY iso2"))).mappings().all()
        upserts = 0
        for c in countries:
            iso = c['iso2']
            it_label = COUNTRIES_IT.get(iso, c['name_en'])
            en_label = c['name_en']
            src_hash = hashlib.sha256(it_label.encode()).hexdigest()
            row = (await s.execute(text("""
                INSERT INTO editorial_blocks
                  (id, tenant_id, namespace, block_key, source_value,
                   source_hash, is_active, scope)
                VALUES (gen_random_uuid(), :t, 'geo.country', :k, :v, :h, TRUE, 'tenant')
                ON CONFLICT (tenant_id, namespace, block_key) DO UPDATE
                  SET source_value = EXCLUDED.source_value,
                      source_hash  = EXCLUDED.source_hash
                RETURNING id
            """), {"t": tid, "k": f"{iso}.label",
                   "v": it_label, "h": src_hash})).mappings().first()
            bid = row['id']
            await s.execute(text("""
                INSERT INTO editorial_block_translations (id, block_id, locale, value)
                VALUES (gen_random_uuid(), :b, 'it-IT', :v)
                ON CONFLICT (block_id, locale) DO UPDATE SET value = EXCLUDED.value
            """), {"b": bid, "v": it_label})
            await s.execute(text("""
                INSERT INTO editorial_block_translations (id, block_id, locale, value)
                VALUES (gen_random_uuid(), :b, 'en-US', :v)
                ON CONFLICT (block_id, locale) DO UPDATE SET value = EXCLUDED.value
            """), {"b": bid, "v": en_label})
            upserts += 1
        await s.commit()
    print(f"Seeded {upserts} country labels (it-IT + en-US).")


if __name__ == '__main__':
    asyncio.run(main())
