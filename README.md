# SovereignForge

Local-first agentic AI workbench for confidential industrial work. The current implementation milestone is the Day 1 foundation: UI, API, PostgreSQL model registry, Qdrant readiness, and native Ollama inference.

The repository uses Turborepo with npm workspaces to coordinate frontend and Python-backend development, checks, tests, and builds. Python commands remain managed by `uv`.

Read the engineering plan at [`docs/README.md`](docs/README.md).

## M1 8 GB development profile

Ollama runs natively on macOS so it can use Apple Metal. PostgreSQL, Qdrant, the API, and frontend run through Docker Compose. The defaults permit one model request and one loaded model at a time.

Recommended lightweight models:

- `qwen3:1.7b` — general text/reasoning
- `qwen2.5-coder:1.5b` — coding
- `nomic-embed-text` — embeddings

The first two occupy roughly 1 GB each in their common Ollama quantizations, while the embedding model is roughly 274 MB. Pulling models is an explicit setup operation, never part of application startup.

## Prerequisites

- Docker Desktop or compatible Docker daemon
- standalone `docker-compose` (this Mac's installed command)
- Ollama running natively
- Node.js 22+ and `uv` for optional host development

## First start

```bash
cp .env.example .env
make ollama-serve
```

In another terminal:

```bash
make ollama-models
make setup
make up
```

Then open <http://localhost:3000>. API documentation is at <http://localhost:8000/docs>.

## Verification

```bash
curl http://localhost:8000/api/v1/health
curl http://localhost:8000/api/v1/readiness
make check
```

Common monorepo commands:

```bash
npm run dev
npm run check
npm run build
```

## Host development

Run infrastructure with Docker but use host processes for rapid development. Override `DATABASE_URL` and `QDRANT_URL` to localhost if publishing those ports in a development-only Compose override. The default Compose intentionally keeps data stores private.

## Important boundaries

- No cloud model provider is configured.
- Ollama is started with its cloud features disabled by the provided target.
- Native Ollama is reachable by the backend through `host.docker.internal`.
- Qdrant and PostgreSQL are not exposed to the host/public network.
- The temporary inference endpoint exists only to prove the Day 1 vertical slice. Workflow tasks replace it in later milestones.
- `make up` uses an ignored project-local Docker CLI state directory because this machine's historical global buildx state is root-owned.
