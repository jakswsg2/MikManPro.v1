.PHONY: help build up down restart logs shell \
        migrate makemigrations test backup restore \
        deploy-prod deploy-staging health

# Default target
help:
	@echo "Smart Lounge — Available Commands"
	@echo ""
	@echo "  Development:"
	@echo "    make dev              Start dev environment"
	@echo "    make build            Build all images"
	@echo "    make up               Start all services"
	@echo "    make down             Stop all services"
	@echo "    make restart          Restart all services"
	@echo "    make logs             Follow logs"
	@echo ""
	@echo "  Database:"
	@echo "    make migrate          Run migrations"
	@echo "    make makemigrations   Create migrations"
	@echo "    make shell            Django shell"
	@echo "    make dbshell          PostgreSQL shell"
	@echo ""
	@echo "  Testing:"
	@echo "    make test             Run tests"
	@echo "    make test-cov         Run tests with coverage"
	@echo "    make lint             Run linters"
	@echo ""
	@echo "  Backup:"
	@echo "    make backup           Create backup now"
	@echo "    make restore FILE=... Restore from backup"
	@echo ""
	@echo "  Deployment:"
	@echo "    make deploy-staging   Deploy to staging"
	@echo "    make deploy-prod      Deploy to production"
	@echo "    make health           Run health checks"

# ===== Development =====
dev:
	docker compose -f docker-compose.yml \
	              -f docker-compose.override.yml up -d

build:
	docker compose build --parallel

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f --tail=100

logs-backend:
	docker compose logs -f backend

shell:
	docker compose exec backend python manage.py shell

dbshell:
	docker compose exec postgres psql -U $${POSTGRES_USER} -d $${POSTGRES_DB}

# ===== Database =====
migrate:
	docker compose exec backend python manage.py migrate

makemigrations:
	docker compose exec backend python manage.py makemigrations

createsuperuser:
	docker compose exec backend python manage.py createsuperuser

# ===== Testing =====
test:
	docker compose exec backend pytest

test-cov:
	docker compose exec backend pytest --cov=. --cov-report=html

lint:
	docker compose exec backend ruff check .
	docker compose exec backend black --check .

format:
	docker compose exec backend ruff check --fix .
	docker compose exec backend black .

# ===== Backup =====
backup:
	./scripts/backup-now.sh

restore:
	@if [ -z "$(FILE)" ]; then \
		echo "Usage: make restore FILE=path/to/backup.sql.gz"; \
		exit 1; \
	fi
	./scripts/restore.sh "$(FILE)"

# ===== Deployment =====
deploy-staging:
	./scripts/deploy.sh staging

deploy-prod:
	./scripts/deploy.sh production

health:
	./scripts/health-check.sh

# ===== Utilities =====
prune:
	docker system prune -f
	docker volume prune -f

ps:
	docker compose ps
