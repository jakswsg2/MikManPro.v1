#!/bin/bash
set -e

MAX_RETRIES=30
RETRY_DELAY=5

check_endpoint() {
    local url="$1"
    curl -sf -o /dev/null -w "%{http_code}" "$url" | grep -q "200"
}

echo "🏥 Running health checks..."

for i in $(seq 1 $MAX_RETRIES); do
    if check_endpoint "http://localhost/health" || \
       check_endpoint "http://localhost:8000/health/" || \
       check_endpoint "http://localhost/api/v1/health/"; then
        echo "✅ All health checks passed"
        exit 0
    fi
    echo "⏳ Attempt $i/$MAX_RETRIES failed, retrying in ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
done

echo "❌ Health checks failed after $MAX_RETRIES attempts"
exit 1
