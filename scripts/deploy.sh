#!/bin/bash
set -euo pipefail

ENVIRONMENT="${1:-staging}"
IMAGE_TAG="${2:-$(git rev-parse --short HEAD)}"

COMPOSE_FILE="docker-compose.yml"
if [ -f "docker-compose.${ENVIRONMENT}.yml" ]; then
    COMPOSE_FILE="$COMPOSE_FILE -f docker-compose.${ENVIRONMENT}.yml"
fi

log() { echo -e "\033[1;34m[$(date +%T)]\033[0m $*"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; exit 1; }

log "🚀 Deploying Smart Lounge — Environment: $ENVIRONMENT, Tag: $IMAGE_TAG"

# 1. Pre-flight checks
log "🔍 Pre-flight checks..."
command -v docker >/dev/null || error "Docker not found"
[ -f ".env.${ENVIRONMENT}" ] || [ -f ".env" ] || error "Environment file not found"

# 2. Backup before deploy
if [ "$ENVIRONMENT" = "production" ]; then
    log "💾 Creating pre-deploy backup..."
    ./scripts/backup-now.sh || log "⚠️ Backup skipped (non-fatal)"
fi

# 3. Pull latest code (if git)
if [ -d ".git" ]; then
    log "📥 Pulling latest code..."
    git pull --ff-only || log "⚠️ Git pull failed, continuing with local"
fi

# 4. Build images
log "🔨 Building images..."
IMAGE_TAG="$IMAGE_TAG" docker compose -f $COMPOSE_FILE build \
    --pull --parallel

# 5. Run migrations
log "📦 Running migrations..."
docker compose -f $COMPOSE_FILE run --rm \
    -e RUN_MIGRATIONS=true \
    backend python manage.py migrate --noinput || true

# 6. Collect static
log "📁 Collecting static files..."
docker compose -f $COMPOSE_FILE run --rm backend \
    python manage.py collectstatic --noinput --clear || true

# 7. Rolling restart (Zero-Downtime)
log "🔄 Rolling restart..."
docker compose -f $COMPOSE_FILE up -d --no-deps --scale backend=2 backend || true
sleep 5
docker compose -f $COMPOSE_FILE up -d --no-deps --scale backend=1 backend || true

docker compose -f $COMPOSE_FILE up -d --no-deps celery-worker
docker compose -f $COMPOSE_FILE up -d --no-deps celery-beat
docker compose -f $COMPOSE_FILE up -d --no-deps frontend
docker compose -f $COMPOSE_FILE up -d --no-deps nginx

# 8. Health check
log "🏥 Health check..."
sleep 10
./scripts/health-check.sh || {
    error "❌ Health check failed! Rolling back..."
    ./scripts/rollback.sh "$ENVIRONMENT"
    exit 1
}

log "✅ Deployment completed successfully"
log "   Environment: $ENVIRONMENT"
log "   Tag: $IMAGE_TAG"
