#!/usr/bin/env bash
# ensure-uptimerobot-monitor.sh
#
# Idempotently ensure an UptimeRobot HTTPS monitor exists for the checkout
# health endpoint.
#
#   - API key:  UPTIMEROBOT_API_KEY env var, or UPTIMEROBOT_API_KEY=... in .env
#   - Host:     HEALTH_MONITOR_HOST env var, defaulting to sgcoalition-five.vercel.app
#   - Only creates the monitor if it doesn't already exist (no duplicates)
#   - /api/health returns 200 "ok" when Stripe checkout is healthy and 503
#     "degraded" when the key is missing or Stripe rejects it —
#     UptimeRobot marks 5xx DOWN, so an alert fires exactly when checkout breaks.
#
# The host matters more than it looks. sgcoalition-five.vercel.app is the domain the
# storefront is moving to, but it does not SERVE anything until the domain
# transfer out of Whop completes — until then it answers 404, and a monitor
# pointed at it would report DOWN continuously, which is a false alarm about
# a checkout that is working. So the default host is the one that currently
# serves, and it changes to the canonical domain at cutover:
#
#   HEALTH_MONITOR_HOST=sgcoalition-five.vercel.app bash scripts/ensure-uptimerobot-monitor.sh
#
# Usage:
#   UPTIMEROBOT_API_KEY=u123456-abc bash scripts/ensure-uptimerobot-monitor.sh
#   # or put UPTIMEROBOT_API_KEY=... in .env and just:
#   bash scripts/ensure-uptimerobot-monitor.sh
#
# Get a v2 API key: UptimeRobot dashboard -> My Settings -> API Settings.
# Note: free plan supports 5-minute intervals; 1-minute is a paid feature.

set -euo pipefail

# The host that currently serves /api/health. sgcoalition-five.vercel.app becomes the
# canonical one when the domain transfer completes.
HEALTH_HOST="${HEALTH_MONITOR_HOST:-sgcoalition-five.vercel.app}"
URL="https://${HEALTH_HOST}/api/health"
NAME="Checkout Health (Stripe key)"
# Default 300s (5 min, free plan). Override with UPTIMEROBOT_INTERVAL=60 on paid plans.
INTERVAL="${UPTIMEROBOT_INTERVAL:-300}"

# --- Resolve API key: env var first, then .env ---
API_KEY="${UPTIMEROBOT_API_KEY:-}"
if [[ -z "$API_KEY" && -f .env ]]; then
  API_KEY="$(grep -E '^UPTIMEROBOT_API_KEY=' .env | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)"
fi
if [[ -z "$API_KEY" ]]; then
  echo "ERROR: UPTIMEROBOT_API_KEY not set (env var or .env)" >&2
  echo "Get one at https://uptimerobot.com/dashboard#mySettings -> API Settings" >&2
  exit 1
fi

api() { # api <endpoint> <curl-data-args...>
  local ep="$1"; shift
  curl -sS --max-time 30 -X POST "https://api.uptimerobot.com/v2/$ep" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "api_key=$API_KEY" \
    --data-urlencode "format=json" "$@"
}

echo "==> Checking for an existing '$NAME' monitor..."
LIST="$(api getMonitors)"
echo "$LIST" | head -c 300; echo

if echo "$LIST" | grep -q '"friendly_name":"'"$NAME"'"'; then
  echo "==> Monitor already exists - nothing to do."
  exit 0
fi

echo "==> Creating monitor: $URL (interval ${INTERVAL}s)..."
NEW="$(api newMonitor \
  --data-urlencode "friendly_name=$NAME" \
  --data-urlencode "type=1" \
  --data-urlencode "url=$URL" \
  --data-urlencode "interval=$INTERVAL")"
echo "$NEW"

# Alert contacts: when omitted, alerts go to the account's default contact
# (verified email). To also page Slack/PagerDuty/SMS, add contacts at
# https://uptimerobot.com/dashboard#mySettings and pass:
#   --data-urlencode "alert_contacts=<id>_0_0"
