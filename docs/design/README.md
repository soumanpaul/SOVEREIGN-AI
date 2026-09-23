# Production design and delivery plan

**SovereignForgeAI · SIH26117 · Team BOMBE**  
Design baseline: **24 September 2026** · Status: **proposed production design, grounded in the current prototype**

This package specifies the work required to move the demonstration into a supervised industrial deployment. It does not claim those changes are already implemented. The [root README](../../README.md) contains recorded demonstration evidence; source links below identify the implementation baseline.

## Read the design

| Document | Decisions and deliverables |
|---|---|
| [Architecture](architecture.md) | Corrected diagram, trust boundaries, service responsibilities, execution lifecycle, failure handling, deployment profiles |
| [Backend and API](backend-api.md) | Current route inventory, target contracts, authorization matrix, job semantics, errors, pagination, approvals |
| [Database and storage](database.md) | Existing schema, target ER diagram, constraints, tenant isolation, migrations, retention, recovery |
| [Frontend](frontend.md) | Navigation, screen design, review flows, state model, API mapping, accessibility, component boundaries |
| [Security](security.md) | Threat model, identity, sandbox isolation, egress evidence, document controls, audit integrity |
| [Operations and evaluation](operations.md) | Deployment, offline distribution, monitoring, capacity, SLO targets, backups, incident runbooks, release gates |
| [Delivery plan](delivery-plan.md) | Dependencies, work packages, owner roles, acceptance criteria, risk register, decision log |

## Product scope and assumptions

Initial production scope is **one organization at one industrial site**, with separate workspaces for maintenance, engineering, and procurement. Organization isolation remains mandatory so future deployments do not depend on assumptions embedded in queries. Deployment is on organization-controlled infrastructure; no cloud model provider is required.

Planning workload, to be validated with the pilot owner: 25 named users, 5 simultaneous browser sessions, 2 admitted inference jobs, 10,000 indexed document pages, and up to 100 accepted tasks per day. These are sizing inputs, not supported-capacity claims. The existing M1/8 GB demonstration profile remains a development profile.

Supported pilot workflows:

1. Inspection evidence and SOPs → cited draft report → engineer review.
2. Python repository and approved tests → candidate patch → isolated verification → code review.
3. Quotations and versioned procurement policy → deterministic comparison → workbook and recommendation → procurement review.

The initial release does not operate plant equipment, issue purchase orders, deploy generated code, or make final safety decisions. Documents and repository content are untrusted input. External integrations require a later reviewed connector design with scoped identities and explicit action approvals.

## Current state versus target

| Area | Current source-backed baseline | Production target |
|---|---|---|
| Execution | API lifespan starts a local task worker; in-process execution lock | Independent workers, transactional leases, fenced writes, bounded retry and recovery |
| Ingestion | FastAPI background task after ingestion row creation | Durable queued extraction/indexing with worker restart recovery |
| Identity | Local users, sessions, one organization per user | On-premise OIDC, controlled provisioning, workspace permissions, separate platform administration |
| Model control | Global registry; organization owner can modify it | Platform-only model management; organization-specific model allowlists |
| Data | PostgreSQL metadata, Qdrant vectors, local files | Consistent tenant keys, immutable revisions, recoverable artifact storage, retention controls |
| Review | Generated outputs and traces | Explicit draft/review/approval state bound to artifact revision |
| Network evidence | API probe plus sandbox controls | Independently observed multi-boundary tests and evidence freshness |
| Operations | Local Compose and prototype defaults | Private TLS ingress, managed secrets, monitored services, tested restore and release process |

Baseline references: [API startup](../../backend/app/main.py), [runtime](../../backend/app/tasks/runtime.py), [ingestion routes](../../backend/app/api/routes/knowledge.py), [model routes](../../backend/app/api/routes/models.py), [schema](../../backend/app/db/models.py), [Compose](../../docker-compose.yml).

## Quality targets

Targets below become release criteria only after pilot hardware and workload are agreed. They are not measured results.

| Attribute | Pilot target and measurement |
|---|---|
| Availability | 99.5% during agreed service hours over a rolling 30-day window; separately report planned maintenance |
| Control API responsiveness | p95 under 500 ms for metadata reads at 5 concurrent sessions; exclude inference, transfer, and ingestion |
| Task acknowledgement | p95 under 1 second after validation; queue time reported separately |
| Recovery | RPO ≤15 minutes and RTO ≤4 hours, measured by full service restore drill |
| Isolation | Zero unauthorized cross-workspace or cross-organization reads/writes in the release test matrix |
| Evidence integrity | Every published artifact has a checksum, immutable revision, owning run, source manifest, and validation record |
| Accessibility | WCAG 2.2 AA target for core task and review flows; manual keyboard and screen-reader checks |
| Model quality | Per-workflow acceptance thresholds in [operations](operations.md); no global “accuracy” claim |

## Definition of production readiness

A release is ready for the agreed pilot only when its [delivery gates](delivery-plan.md) pass with retained evidence: identity and isolation, crash recovery, output evaluation, sandbox/network tests, backup restore, usability, and an owner-approved operating runbook. A completed document or passing unit suite alone does not meet this definition.

## Design conventions

- **Current** means observable in linked code or committed records, not independently production-certified.
- **Proposed** means specified here but awaiting implementation and verification.
- API examples marked proposed are contracts to implement; current routes retain their existing schemas.
- Changes to risk, schema, contracts, or deployment boundaries update the relevant document and decision log.
- External references substantiate individual design principles, not endorsements or compliance certifications.
