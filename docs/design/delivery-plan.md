# Production delivery plan and design decisions

[Design index](README.md) · Proposed implementation backlog and acceptance gates

## Delivery strategy

Deliver a bounded supervised pilot before high availability or new workflows. Each phase produces code, migrations/contracts, tests, operating evidence, and updated design documents. Owner roles below must be assigned to named team/site members before work starts. Effort ranges are engineering estimates, not calendar promises; they exclude site procurement and external approvals.

| Phase | Work packages | Owner roles | Indicative effort | Dependency / exit gate |
|---|---|---|---|---|
| P0: baseline | API/schema snapshot; model/data inventory; threat review; pilot hardware/workload agreement | Tech lead, site owner, QA | 3–5 engineer-days | G0: signed scope, corpus plan, risk register, baseline measurements |
| P1: identity and data | Closed provisioning/OIDC; role separation; scoped FKs/RLS; file revisions; retention model | Backend, data, security | 10–15 engineer-days | P0; G1: isolation tests, permission matrix, migration/rollback rehearsal |
| P2: durable execution | API/worker split; jobs/leases/fencing; effect ledger; durable ingestion; shared admission | Backend, platform | 10–15 engineer-days | P1; G2: crash/replay/cancel tests with no lost jobs or duplicate publication |
| P3: artifact review and UX | Evidence manifests; validators; review API; workspace/trace/review UI; v2 client | Backend, frontend, QA, domain reviewer | 10–15 engineer-days | P1 and P2 publication contract; G3: full independent review workflow passes |
| P4: deployment and operations | Dedicated sandbox host; network policy; secrets/TLS; offline bundle; monitoring and restore | Platform, security | 8–12 engineer-days | P1/P2; G4: security tests, egress evidence, full restore and release rehearsal |
| P5: qualification and pilot | Held-out evaluation; load/soak; accessibility; supervised users; measured time savings | QA, domain reviewers, site owner | 8–12 engineer-days plus observation window | P3/P4; G5: quality targets and pilot-owner acceptance |

Some preparation can overlap, but do not deploy multiple workers before P2. No date commitment should be made until owner capacity, identity integration, hardware, and dataset access are confirmed. HA is a separate follow-on scope after pilot measurements.

## Implementation-ready work packages

| ID | Deliverable | Acceptance evidence |
|---|---|---|
| ID-01 | Enterprise identity adapter and closed signup | Invalid issuer/state/nonce denied; revoked session/stream fails; break-glass audited |
| AUTH-01 | Permission service and workspace grants | Positive/negative matrix across every API and worker entry point |
| AUTH-02 | Platform model administration and organization allowlists | Organization owner cannot change another organization's/global model state |
| DB-01 | Scoped keys, revision tables, normalized task inputs | No null/ambiguous tenant backfill; FK and RLS tests under runtime roles |
| DB-02 | Retention/hold/deletion workflow | Purge covers files, extraction, vectors, previews; restore replays tombstones |
| JOB-01 | Dedicated worker entry point and atomic claims | Two workers cannot own valid publication rights for one job |
| JOB-02 | Leases, effects and cancellation reconciliation | Crash before/after dispatch/publication; stale token writes rejected |
| ING-01 | Durable extraction and staged indexing | API restart does not abandon accepted ingestion; partial index never activated |
| MODEL-01 | Global inference slots and immutable model config | Multiple workers honor site concurrency; change recorded by digest |
| ART-01 | Validation/provenance publication pipeline | Missing objects/hashes block publication; all revisions retain evidence |
| REVIEW-01 | Review requests/decisions with separation of duties | Self-approval and stale revision rejected; decision append-only |
| API-01 | Versioned contracts, limits, idempotency, cursors, events | OpenAPI diff, replay/conflict, reconnect, pagination isolation tests |
| UI-01 | Feature modules and generated client | No cross-workspace cache, duplicate submit, or invalid optimistic approval |
| UI-02 | Review/evidence interface and accessibility | Keyboard/screen-reader completion; visible warnings and source provenance |
| SEC-01 | Sandbox host separation and execution profiles | Escape/resource/network fixtures and orphan cleanup report |
| SEC-02 | Independent boundary evidence and audit export | Inconclusive/stale handled correctly; runtime cannot erase retained audit |
| OPS-01 | TLS/secrets/offline release package | Clean offline install; no runtime external downloads; manifest verified |
| OPS-02 | Monitoring, backup and restore | Actual RPO/RTO report and tested incident actions |
| EVAL-01 | Versioned held-out workflows and failure taxonomy | All runs recorded, thresholds met, critical failures resolved |
| PILOT-01 | Supervised pilot and handover | User completion/time-review data, operating owner and known-limitations acceptance |

## Requirement traceability

| Product requirement | Design | Work packages | Release evidence |
|---|---|---|---|
| Confidential local execution | [Security](security.md), [architecture](architecture.md) | SEC-01/02, OPS-01 | Scoped network and sandbox tests |
| Reliable agent workflows | [Backend](backend-api.md), [architecture](architecture.md) | JOB-01/02, ING-01, MODEL-01 | Crash/lease/retry tests and workflow records |
| Grounded reviewable output | [Database](database.md), [frontend](frontend.md) | ART-01, REVIEW-01, UI-02 | Source manifests, validator results, independent decisions |
| Controlled access | [Backend](backend-api.md), [database](database.md) | ID-01, AUTH-01/02, DB-01 | Scope/role/RLS test matrix |
| Recoverable deployment | [Operations](operations.md) | DB-02, OPS-01/02 | Restore, rollback and tombstone replay |
| Useful industrial outcomes | [Frontend](frontend.md), [evaluation](operations.md) | EVAL-01, PILOT-01 | Held-out quality and supervised user measures |

## Release gates

**G0 — Scope:** site owner agrees workload, supported inputs, consequential-action boundary, hardware candidate, data policy, and reviewers. Unavailable real data does not block synthetic engineering, but does block claims of industrial validation.

**G1 — Isolation:** authentication, role separation, tenant/workspace constraints and RLS tests pass; migration rehearsed on a backup copy; ambiguous legacy rows resolved or quarantined.

**G2 — Reliability:** kill/restart worker at each effect boundary; run two workers; prove fenced completion, no lost acknowledgements, bounded retries, cancellation race handling, and durable ingestion.

**G3 — Reviewability:** every artifact binds exact input/model/policy/validator versions; unsupported inputs are surfaced; reviewer can inspect sources; self-approval and stale review fail.

**G4 — Operability:** secrets rotated, private network configured, sandbox isolated, offline install/upgrade/rollback demonstrated, full restore meets targets, incident owner assigned.

**G5 — Pilot release:** held-out quality, load, security, and accessibility gates pass; critical findings resolved; limitations documented; site owner accepts supervised use. If a threshold fails, reduce supported scope and reevaluate explicitly rather than relabeling failures as successes.

## Risk register

| Risk | Impact | Mitigation / owner |
|---|---|---|
| Small models miss critical facts or tool steps | Incorrect industrial recommendation | Held-out evaluation, escalation, larger qualified local profile; model/QA owner |
| Many workers exceed memory or duplicate effects | Outages and inconsistent artifacts | Admission slots, leases/fencing, effect ledger; backend/platform |
| Confidential content appears in logs or previews | Data exposure | Redaction, scoped views, retention and tests; security/frontend |
| Shared registry or nullable ownership weakens isolation | Cross-organization control/data access | Platform roles, scoped keys, backfill and RLS; backend/data |
| Sandbox controller compromise reaches host | Execution boundary failure | Dedicated host, stronger isolation qualification; platform/security |
| Document deletion conflicts with evidence retention | Broken provenance or improper retention | Holds, tombstones, reviewed policy and restore replay; data/site owner |
| Model/package update changes behavior | Quality regression | Digests, versioned evaluation, staged rollout and rollback; QA/platform |
| Prototype evidence is mistaken for production validation | Reviewer/customer distrust | Explicit current/proposed labels and scoped measured results; tech lead |

## Design decision log

| ID | Decision | Rationale and tradeoff | Revisit trigger |
|---|---|---|---|
| ADR-001 | Modular monolith with independent workers | Retains simple domain transactions; separates long jobs from HTTP lifecycle | Independently owned services or measured scaling bottleneck |
| ADR-002 | PostgreSQL job queue initially | One authoritative transactional store; must implement leases/fairness carefully | Sustained scheduler load or workflow complexity exceeds measured capacity |
| ADR-003 | One organization/site pilot with enforced tenant isolation | Focused deployment while preventing global-access assumptions | Multi-site or multi-organization operating agreement |
| ADR-004 | Local inference behind fixed gateway | Supports sovereignty; requires local capacity and model operations | Qualified alternative local serving engine needed |
| ADR-005 | Separate code-execution host | Reduces daemon compromise blast radius; adds deployment cost | Hostile multi-user expansion requires stronger execution boundary |
| ADR-006 | Immutable artifacts and separate human approval | Preserves evidence and accountability; more storage/review latency | Retention/storage measurements require policy tuning |
| ADR-007 | v2 for contract-breaking changes | Keeps current clients working; temporary dual maintenance | All supported clients migrate and rollback window closes |
| ADR-008 | No Kubernetes requirement for pilot | Avoids operating complexity unsupported by current scale | Site standard or HA fleet size justifies it |

## Decisions to resolve before deployment

These do not block writing or implementing the core design. They block final capacity, operating, or policy commitments.

- **Site owner:** identity provider, allowed data classes, retention/holds, permitted reviewers, operating hours, and support contacts.
- **Platform owner:** Linux host/VM inventory, candidate GPU/RAM, private blob service, backup destination, key management, and execution isolation technology.
- **Domain owners:** supported inspection/procurement templates, critical-error rubric, ground-truth cases, acceptable turnaround, and review responsibility.
- **Tech lead:** named work-package owners, estimation after P0, model/license approval, v1 deprecation window, and release evidence location.

## Reference principles

Authorization follows [OWASP's deny-by-default and per-request checking guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html); database isolation considers [PostgreSQL RLS role behavior](https://www.postgresql.org/docs/current/ddl-rowsecurity.html); frontend acceptance targets [WCAG 2.2](https://www.w3.org/TR/WCAG22/). The specific topology, estimates, thresholds, and backlog are project design decisions awaiting the described validation.
