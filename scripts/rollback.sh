#!/bin/bash
set -e

ENVIRONMENT="${1:-staging}"
PREVIOUS_TAG=$(cat ".last_deploy_${ENVIRONMENT}" 2>/dev/null || echo "latest")

echo "🔄 Rolling back to: $PREVIOUS_TAG"

COMPOSE_FILE="docker-compose.yml"
[ -f "docker-compose.${ENVIRONMENT}.yml" ] && \
    COMPOSE_FILE="$COMPOSE_FILE -f docker-compose.${ENVIRONMENT}.yml"

IMAGE_TAG="$PREVIOUS_TAG" docker compose -f $COMPOSE_FILE up -d --force-recreate

echo "✅ Rollback complete"
