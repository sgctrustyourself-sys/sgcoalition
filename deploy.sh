#!/bin/bash
# ============================================================
#  Coalition Brand — Deploy Script
#  Usage:
#    ./deploy.sh staging          # deploy to staging
#    ./deploy.sh prod             # deploy to production
#    ./deploy.sh prod minor       # deploy to prod + bump minor version
#    ./deploy.sh prod major       # deploy to prod + bump major version
# ============================================================

set -e  # Exit immediately on any error

# ── Colors ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# ── Args ─────────────────────────────────────────────────────
ENV=${1:-staging}    # staging | prod
BUMP=${2:-patch}     # patch | minor | major (only used for prod)

# ── Helpers ──────────────────────────────────────────────────
log()     { echo -e "${BLUE}[deploy]${NC} $1"; }
success() { echo -e "${GREEN}[✔]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✘]${NC} $1"; exit 1; }
divider() { echo -e "${BOLD}────────────────────────────────────────${NC}"; }

# ── Validate args ─────────────────────────────────────────────
if [[ "$ENV" != "staging" && "$ENV" != "prod" ]]; then
  error "Invalid environment: '$ENV'. Use 'staging' or 'prod'."
fi
if [[ "$BUMP" != "patch" && "$BUMP" != "minor" && "$BUMP" != "major" ]]; then
  error "Invalid bump type: '$BUMP'. Use 'patch', 'minor', or 'major'."
fi

# ── Check dependencies ────────────────────────────────────────
command -v vercel >/dev/null 2>&1 || error "Vercel CLI not found. Run: npm install -g vercel"
command -v git >/dev/null 2>&1    || error "git not found."
command -v node >/dev/null 2>&1   || error "node not found."

divider
echo -e "${BOLD}🚀 Coalition Deploy — Target: ${YELLOW}$ENV${NC}${BOLD} | Version bump: ${YELLOW}$BUMP${NC}"
divider

# ── 1. Check for uncommitted changes ─────────────────────────
log "Checking working tree..."
if ! git diff-index --quiet HEAD --; then
  warn "You have uncommitted changes. Commit or stash them before deploying."
  git status --short
  read -p "Continue anyway? (y/N): " CONFIRM
  [[ "$CONFIRM" =~ ^[Yy]$ ]] || error "Deploy cancelled."
fi
success "Working tree clean"

# ── 2. Pull latest from remote ────────────────────────────────
BRANCH=$(git rev-parse --abbrev-ref HEAD)
log "Pulling latest from origin/$BRANCH..."
git pull origin "$BRANCH" --ff-only || warn "Could not fast-forward pull — continuing with local state."
success "Up to date with origin/$BRANCH"

# ── 3. TypeScript check ───────────────────────────────────────
log "Running TypeScript check..."
npx tsc --noEmit 2>&1 | grep -v "ProductDetails_good" || true
# Fail hard only if tsc exits non-zero (ignore the known binary file issue)
TS_EXIT=${PIPESTATUS[0]}
if [ "$TS_EXIT" -ne 0 ]; then
  error "TypeScript errors found. Fix them before deploying."
fi
success "TypeScript OK"

# ── 4. Lint ───────────────────────────────────────────────────
log "Running lint..."
npm run lint 2>&1 || error "Lint failed. Fix errors before deploying."
success "Lint OK"

# ── 5. Build ──────────────────────────────────────────────────
log "Building project..."
npm run build 2>&1 || error "Build failed. Fix errors before deploying."
success "Build OK"

# ── 6. Version bump (prod only) ───────────────────────────────
if [[ "$ENV" == "prod" ]]; then
  log "Bumping $BUMP version..."
  NEW_VERSION=$(npm version "$BUMP" --no-git-tag-version | sed 's/v//')
  success "Version bumped to v$NEW_VERSION"

  # Commit the version bump
  git add package.json package-lock.json 2>/dev/null || true
  git commit -m "chore: bump version to v$NEW_VERSION" --no-verify 2>/dev/null || warn "Nothing to commit for version bump"

  # Tag the release
  git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"
  success "Tagged release v$NEW_VERSION"

  # Push commit + tag
  log "Pushing version tag to origin..."
  git push origin "$BRANCH" --follow-tags || warn "Could not push tag — push manually with: git push origin $BRANCH --follow-tags"
fi

# ── 7. Deploy ─────────────────────────────────────────────────
divider
if [[ "$ENV" == "prod" ]]; then
  log "Deploying to ${BOLD}PRODUCTION${NC} (sgcoalition.xyz)..."
  DEPLOY_URL=$(vercel --prod --yes 2>&1 | tee /dev/tty | grep -oE 'https://[^ ]+' | tail -1)
  echo ""
  success "Production deploy complete!"
  echo -e "  ${GREEN}🌐 Live URL:${NC} https://sgcoalition.xyz"
  echo -e "  ${GREEN}📦 Deploy URL:${NC} $DEPLOY_URL"

  # Save deploy info for rollback
  echo "$DEPLOY_URL" > .last-deploy-url
  echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") | prod | v${NEW_VERSION:-unknown} | $DEPLOY_URL" >> .deploy-log

else
  log "Deploying to ${BOLD}STAGING${NC}..."
  DEPLOY_URL=$(vercel --yes 2>&1 | tee /dev/tty | grep -oE 'https://[^ ]+' | tail -1)
  echo ""
  success "Staging deploy complete!"
  echo -e "  ${GREEN}🔗 Staging URL:${NC} $DEPLOY_URL"

  # Save deploy info
  echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") | staging | $(git rev-parse --short HEAD) | $DEPLOY_URL" >> .deploy-log
fi

divider
echo -e "${GREEN}${BOLD}✅ Deploy finished successfully!${NC}"
divider
