#!/bin/bash
# Anti-regression: no hardcoded locale/market arrays in frontend src.
# Returns non-zero exit if any forbidden token is found.

set -e
ROOT=/app/frontend/src

# Patterns are forbidden as IDENTIFIERS (assignments, not as comments / docs).
# We grep for `IDENTIFIER\s*=` patterns.
forbidden=(
  "LOCALE_LABELS[[:space:]]*="
  "LOCALE_FULL_NAMES[[:space:]]*="
  "LEGACY_ALIAS[[:space:]]*="
  "COUNTRY_OPTIONS[[:space:]]*="
  "BOOTSTRAP_DEFAULT[[:space:]]*="
)

exit_code=0
for pat in "${forbidden[@]}"; do
  hits=$(grep -rn --include='*.jsx' --include='*.js' -E "$pat" "$ROOT" 2>/dev/null | grep -v '\* ' | grep -v '^.*://' || true)
  if [ -n "$hits" ]; then
    echo "FORBIDDEN: $pat"
    echo "$hits"
    exit_code=1
  fi
done

if [ "$exit_code" -eq 0 ]; then
  echo "PASSED — No hardcoded locale/market arrays in frontend src/."
fi

exit $exit_code
