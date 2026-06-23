"""
Anti-regression test for the Studio Activation Manifest copy.

PURPOSE
═══════════════════════════════════════════════════════════════════════
Verifica che il CMS `editorial_blocks` namespace `studio.activation`
restituisca il copy NEW approvato, e che non possa essere sovrascritto
silenziosamente con il copy LEGACY (vedi ONBOARDING_RENDER_AUDIT.md).

Le 4 chiavi critiche monitorate:
  • entrance.headline
  • entrance.sublead
  • entrance.return_link
  • entrance.return_destination

Forbidden substrings:
  • "Apri un nuovo capitolo del tuo studio"
  • "compone lo spazio operativo delle pratiche"
  • "Sei già dentro MOOD"
  • "Continua il tuo Design Journey"

Runs against the backend live at $REACT_APP_BACKEND_URL.

Usage:
  cd /app/backend && python3 tests/test_studio_manifest_copy.py
  (exits 0 if all assertions pass, 1 otherwise)
"""
import os
import sys
import json
import urllib.request

BACKEND_URL = os.environ.get('REACT_APP_BACKEND_URL') or 'https://design-journey-cms.preview.emergentagent.com'

EXPECTED = {
    'it-IT': {
        'studio.activation.entrance.eyebrow':            'Composizione',
        'studio.activation.entrance.headline':           'Componi il tuo Studio.',
        'studio.activation.entrance.sublead':            'Una sequenza editoriale di sei movimenti per attivare il tuo Blueprint™ con MOOD.',
        'studio.activation.entrance.cta':                'Inizia la composizione',
        'studio.activation.entrance.return_link':        'Hai già iniziato?',
        'studio.activation.entrance.return_destination': 'Riprendi da dove sei',
    },
    'en-US': {
        'studio.activation.entrance.eyebrow':            'Composition',
        'studio.activation.entrance.headline':           'Compose your Studio.',
        'studio.activation.entrance.sublead':            'An editorial sequence in six movements to activate your Blueprint™ with MOOD.',
        'studio.activation.entrance.cta':                'Begin composition',
        'studio.activation.entrance.return_link':        'Already started?',
        'studio.activation.entrance.return_destination': 'Resume where you left off',
    },
}

# Legacy substrings that MUST NOT appear anywhere in entrance copy.
FORBIDDEN_SUBSTRINGS = [
    'Apri un nuovo capitolo',
    'compone lo spazio operativo',
    'Sei già dentro MOOD',
    'Continua il tuo Design Journey',
    'modellano l\'interior contemporaneo',
]


def fetch_manifest(locale: str) -> dict:
    url = f"{BACKEND_URL}/api/studio/activation/manifest?locale={locale}"
    req = urllib.request.Request(url, headers={'User-Agent': 'studio-manifest-test/1.0'})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode('utf-8'))


def main():
    failures = []
    for locale, expected_map in EXPECTED.items():
        print(f"\n=== Verifying locale={locale} ===")
        manifest = fetch_manifest(locale)
        copy = manifest.get('copy') or {}

        # 1) Expected values match
        for key, expected_value in expected_map.items():
            actual = copy.get(key)
            if actual != expected_value:
                failures.append({
                    'locale': locale, 'key': key,
                    'expected': expected_value, 'actual': actual,
                })
                print(f"  ✗ {key}\n      expected: {expected_value!r}\n      actual:   {actual!r}")
            else:
                print(f"  ✓ {key}")

        # 2) No legacy substrings anywhere in entrance copy
        for key, val in copy.items():
            if not key.startswith('studio.activation.entrance'):
                continue
            for forbidden in FORBIDDEN_SUBSTRINGS:
                if forbidden in (val or ''):
                    failures.append({
                        'locale': locale, 'key': key,
                        'forbidden_substring': forbidden, 'actual': val,
                    })
                    print(f"  ✗ LEGACY found in {key} [{locale}]: {forbidden!r}")

    print(f"\n══════════════════════════════════════════")
    if failures:
        print(f"FAILED — {len(failures)} assertion(s) broken:")
        for f in failures:
            print(f"  • {f}")
        sys.exit(1)
    print("PASSED — All critical Studio Activation entrance keys are aligned (NEW copy active).")
    sys.exit(0)


if __name__ == '__main__':
    main()
