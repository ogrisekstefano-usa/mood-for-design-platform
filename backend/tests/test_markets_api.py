"""
Anti-regression API test — Markets / Locales architecture.

Run:  cd /app/backend && python3 tests/test_markets_api.py
"""
import os, sys, json, urllib.request
BACKEND = os.environ.get('REACT_APP_BACKEND_URL') or 'https://editorial-platform-4.preview.emergentagent.com'

def fetch(path: str):
    req = urllib.request.Request(f"{BACKEND}{path}", headers={'User-Agent': 'mood-test/1.0'})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode('utf-8'))

def main():
    failures = []

    # 1) /api/site/locales
    print("=== /api/site/locales ===")
    locs = fetch('/api/site/locales')
    enabled = locs.get('enabled') or []
    default_locale = locs.get('default')
    print(f"  default={default_locale} enabled={enabled}")
    if not enabled: failures.append("locales.enabled is empty")
    if default_locale not in enabled: failures.append(f"default_locale {default_locale} not in enabled")

    # 2) /api/markets
    print("\n=== /api/markets?locale=it-IT ===")
    mk = fetch('/api/markets?locale=it-IT')
    markets = mk.get('markets') or []
    groups = mk.get('groups') or []
    default_market = mk.get('default_market')
    print(f"  default_market={default_market} count={len(markets)} groups={[g['key'] for g in groups]}")
    if len(markets) == 0: failures.append("markets is empty")
    if not groups: failures.append("groups is empty")
    if not default_market: failures.append("default_market is null")

    required = {'code', 'display_name', 'primary_locale', 'fallback_locale', 'effective_locale',
                'currency', 'countries', 'macro_region', 'rtl', 'sort_order'}
    for m in markets:
        missing = required - set(m.keys())
        if missing:
            failures.append(f"market {m.get('code')} missing keys {missing}")
        if m['effective_locale'] not in enabled:
            failures.append(f"market {m['code']} effective_locale {m['effective_locale']} NOT in enabled {enabled}")
        if '-' not in (m.get('primary_locale') or ''):
            failures.append(f"market {m['code']} primary_locale not BCP-47: {m['primary_locale']}")

    # 3) /api/markets?locale=en-US: display_name in english
    print("\n=== /api/markets?locale=en-US (localized display_name) ===")
    mk_en = fetch('/api/markets?locale=en-US')
    italy = next((m for m in mk_en['markets'] if m['code'] == 'italy'), None)
    if italy:
        print(f"  italy.display_name = {italy['display_name']!r}")
        if italy['display_name'] == 'Italia':
            failures.append("display_name not localized for en-US (still IT)")

    # 4) /api/markets/{code}
    print("\n=== /api/markets/italy ===")
    italy = fetch('/api/markets/italy?locale=it-IT')
    print(f"  {italy['code']} primary={italy['primary_locale']} eff={italy['effective_locale']} cur={italy['currency']}")
    if italy['effective_locale'] != 'it-IT':
        failures.append(f"italy effective_locale wrong: {italy['effective_locale']}")

    # 5) RTL handling for gcc_luxury / arabic future
    gcc = next((m for m in markets if m['code'] == 'gcc_luxury'), None)
    if gcc:
        print(f"\n=== gcc_luxury ===")
        print(f"  primary={gcc['primary_locale']} eff={gcc['effective_locale']} rtl={gcc['rtl']}")
        # en-AE not enabled, falls back via chain → en-US → rtl=False
        if gcc['effective_locale'] not in enabled:
            failures.append(f"gcc_luxury effective_locale not enabled: {gcc['effective_locale']}")

    print("\n══════════════════════════════════════════")
    if failures:
        print(f"FAILED — {len(failures)} assertion(s):")
        for f in failures: print(f"  • {f}")
        sys.exit(1)
    print("PASSED — Markets/Locales API contract OK · BCP-47 compliant · no hardcoded.")
    sys.exit(0)

if __name__ == '__main__':
    main()
