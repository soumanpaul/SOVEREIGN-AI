.PHONY: setup up down logs migrate test check backend-dev frontend-dev ollama-serve ollama-models

setup:
	test -f .env || cp .env.example .env
	npm install
	cd backend && uv sync --dev

up:
	DOCKER_CONFIG=$(CURDIR)/.docker-local DOCKER_HOST=unix://$(HOME)/.colima/default/docker.sock docker-compose up --build -d

down:
	DOCKER_CONFIG=$(CURDIR)/.docker-local DOCKER_HOST=unix://$(HOME)/.colima/default/docker.sock docker-compose down

logs:
	DOCKER_CONFIG=$(CURDIR)/.docker-local DOCKER_HOST=unix://$(HOME)/.colima/default/docker.sock docker-compose logs -f --tail=200

migrate:
	DOCKER_CONFIG=$(CURDIR)/.docker-local DOCKER_HOST=unix://$(HOME)/.colima/default/docker.sock docker-compose run --rm api-worker alembic upgrade head

test:
	npm run test

check:
	npm run check

backend-dev:
	npm run dev --workspace=@sovereignforge/backend

frontend-dev:
	npm run dev --workspace=@sovereignforge/frontend

ollama-serve:
	OLLAMA_NO_CLOUD=1 OLLAMA_NUM_PARALLEL=1 OLLAMA_MAX_LOADED_MODELS=1 OLLAMA_KEEP_ALIVE=2m ollama serve

ollama-models:
	ollama pull qwen3:1.7b
	ollama pull qwen2.5-coder:1.5b
	ollama pull nomic-embed-text
