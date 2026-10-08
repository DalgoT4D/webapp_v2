#!/usr/bin/env bash
# Pre-PR gate for refactor branches (spec §5).
# Usage: bash e2e/scripts/refactor-gate.sh <base-ref>
# Set ALLOW_REMOVED_TRACKING=1 only when the removed trackEvent lines live in deleted dead code
# (list them in the PR description).
set -uo pipefail
BASE="${1:?usage: refactor-gate.sh <base-ref>}"
cd "$(git rev-parse --show-toplevel)"
failed=0

echo "▶ 1/4 lint"
npm run lint --silent || failed=1

echo "▶ 2/4 jest"
npx jest --silent || failed=1

echo "▶ 3/4 TypeScript error count"
baseline=$(cat e2e/scripts/tsc-baseline.txt)
current=$(npx tsc --noEmit -p . 2>/dev/null | grep "error TS" | grep -vcE "^\.next/" || true)
echo "  baseline=$baseline current=$current"
if [ "$current" -gt "$baseline" ]; then
  echo "  ✗ more TypeScript errors than the baseline"
  failed=1
fi

# Blind spot: only the first line of each trackEvent( call is diffed/compared below —
# multi-line call props (e.g. an object spread over several lines) aren't checked.
echo "▶ 4/4 analytics calls preserved"
normalize() { sed -E 's/^[-+][[:space:]]*//; s/[[:space:]]+$//' | sed '/^$/d' | sort; }
diff_lines() { git diff "$BASE"...HEAD -U0 -- app components hooks lib stores; }
removed=$(diff_lines | grep -E '^-[^-].*trackEvent\(' | normalize || true)
added=$(diff_lines | grep -E '^\+[^+].*trackEvent\(' | normalize || true)
missing=$(comm -23 <(printf '%s\n' "$removed" | sed '/^$/d') <(printf '%s\n' "$added" | sed '/^$/d'))
if [ -n "$missing" ]; then
  echo "  trackEvent lines removed and not re-added:"
  echo "$missing" | sed 's/^/    /'
  if [ "${ALLOW_REMOVED_TRACKING:-0}" != "1" ]; then failed=1; fi
else
  echo "  ok"
fi

if [ "$failed" -eq 0 ]; then echo "✔ gate passed"; else echo "✘ gate failed"; exit 1; fi
