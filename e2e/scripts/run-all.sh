#!/usr/bin/env bash
# Full E2E run: parallel projects first, then specs that need the org to themselves.
# Extra args are passed to both invocations, e.g. `npm run e2e -- --update-snapshots=changed`.
# Exit code is non-zero if either invocation fails.
set -u

# Staging health gate: a run against a slow/down backend produces hundreds of meaningless failures.
# One slow probe is noise; a majority of bad probes means staging is struggling.
BACKEND=$(grep -E '^NEXT_PUBLIC_BACKEND_URL=' .env | cut -d= -f2-)
PROBES=5
MAX_BAD=2
MAX_PROBE_SECONDS=3
bad=0
for i in $(seq 1 $PROBES); do
  out=$(curl -s -o /dev/null -m 10 -w "%{http_code} %{time_total}" "$BACKEND/api/currentuserv2" || echo "000 99")
  code=${out%% *}; t=${out##* }
  if [ "$code" = "000" ] || [ "${code:0:1}" = "5" ] || awk "BEGIN{exit !($t > $MAX_PROBE_SECONDS)}"; then
    bad=$((bad+1)); echo "  probe $i: HTTP $code in ${t}s (bad)"
  fi
  sleep 2
done
if [ $bad -gt $MAX_BAD ] && [ "${E2E_WAIT_FOR_STAGING:-0}" = "1" ]; then
  # Wait mode: re-probe every minute for up to WAIT_MINUTES instead of giving up
  WAIT_MINUTES=30
  for m in $(seq 1 $WAIT_MINUTES); do
    sleep 60
    out=$(curl -s -o /dev/null -m 10 -w "%{http_code} %{time_total}" "$BACKEND/api/currentuserv2" || echo "000 99")
    code=${out%% *}; t=${out##* }
    if [ "$code" != "000" ] && [ "${code:0:1}" != "5" ] && awk "BEGIN{exit !($t <= $MAX_PROBE_SECONDS)}"; then
      echo "✓ staging recovered after ${m} min (HTTP $code in ${t}s)"; bad=0; break
    fi
  done
fi
if [ $bad -gt $MAX_BAD ]; then
  echo "✘ staging unhealthy ($bad/$PROBES probes bad) — not running the suite. Try again later." >&2
  exit 2
fi
echo "✓ staging healthy enough ($bad/$PROBES slow probes)"

npx playwright test --project=chromium --project=public "$@"
status=$?

npx playwright test --project=isolated --workers=1 "$@" || status=1

exit $status
