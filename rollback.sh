#!/bin/bash
# ============================================================
#  Coalition Brand — Rollback Script
#  Instantly reverts the live site to the previous Vercel deploy
#
#  Usage:
#    ./rollback.sh              # rollback to last known deploy
#    ./rollback.sh list         # show recent deploy history
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log()     { echo -e "${BLUE}[rollback]${NC} $1"; }
success() { echo -e "${GREEN}[✔]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✘]${NC} $1"; exit 1; }
divider() { echo -e "${BOLD}────────────────────────────────────────${NC}"; }

command -v vercel >/dev/null 2>&1 || error "Vercel CLI not found. Run: npm install -g vercel"

# ── List mode ─────────────────────────────────────────────────
if [[ "$1" == "list" ]]; then
  divider
  echo -e "${BOLD}📋 Deploy History${NC}"
  divider
  if [ -f .deploy-log ]; then
    echo -e "${BOLD}Timestamp (UTC)          | Env      | Version  | URL${NC}"
    echo "─────────────────────────────────────────────────────────────────────"
    cat .deploy-log | tail -20
  else
    warn "No deploy log found. Run ./deploy.sh first."
  fi
  divider
  echo ""
  log "Showing last 5 Vercel deploys:"
  vercel ls --limit 5 2>/dev/null || warn "Run 'vercel login' to connect your account."
  exit 0
fi

# ── Rollback ──────────────────────────────────────────────────
divider
echo -e "${BOLD}⏪ Coalition Rollback${NC}"
divider

# Show recent deploys so user can pick
log "Fetching recent Vercel deploys..."
echo ""
vercel ls --limit 10 2>/dev/null || error "Could not fetch deploys. Make sure you're logged in: vercel login"
echo ""

divider
warn "You are about to roll back ${BOLD}sgcoalition.xyz${NC} to a previous deploy."
warn "This will immediately update the live site."
echo ""
read -p "Enter the Vercel deploy URL to roll back to (e.g. https://coalition-abc123.vercel.app): " TARGET_URL

if [[ -z "$TARGET_URL" ]]; then
  error "No URL provided. Rollback cancelled."
fi

# Confirm
echo ""
echo -e "${YELLOW}Rolling back production to:${NC}"
echo -e "  ${BOLD}$TARGET_URL${NC}"
echo ""
read -p "Are you sure? This will go live immediately. (y/N): " CONFIRM
[[ "$CONFIRM" =~ ^[Yy]$ ]] || error "Rollback cancelled."

# Execute rollback by promoting the deploy to production
log "Executing rollback..."
vercel promote "$TARGET_URL" --yes 2>/dev/null || {
  # Fallback: use vercel alias
  warn "vercel promote failed, trying alias method..."
  vercel alias set "$TARGET_URL" sgcoalition.xyz --yes
}

# Log the rollback
echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") | ROLLBACK | → $TARGET_URL" >> .deploy-log

echo ""
divider
success "Rollback complete! sgcoalition.xyz is now serving:"
echo -e "  ${GREEN}$TARGET_URL${NC}"
divider
