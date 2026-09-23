# Production operations, evaluation, and release

[Design index](README.md) · Proposed operating targets; no performance claims are implied

## Deployment profiles

| Profile | Intended use | Required topology |
|---|---|---|
| Developer | Synthetic fixtures, debugging | Existing Compose/native Ollama; one local executor |
| Supervised pilot | One site, bounded users and workflows | Private TLS ingress, separate API/workers, private DB/vector/storage, local inference, dedicated sandbox host, enterprise identity |
| High availability | Agreed business service window and failover | Redundant control API, managed PostgreSQL replication/failover, replicated storage, redundant inference capacity and monitored workers |

Use organization-supported Linux hosts/VMs and service supervision for the pilot. A container orchestrator is optional until fleet scale warrants it. Separate process lifecycle, shared storage, and transactional job claiming are prerequisites to adding replicas. Native Apple Silicon remains a development profile, not the production sizing baseline.

## Capacity and admission

Planning inputs: 25 named users, 5 concurrent sessions, 2 admitted inference jobs, 10,000 indexed pages, 100 tasks/day. Measure hardware with the actual model/context, image workload, OCR, storage, and tokenizer before choosing RAM/GPU capacity. Record cold-start and warm-start results separately.

Storage sizing worksheet: original bytes + extracted text + chunk metadata + vector count × vector dimensions × bytes/value + index overhead + output artifacts × retention + audit/log retention + backup copies. Reserve operational headroom based on measured growth; avoid claiming “runs on existing hardware” without this inventory.

Initial proposed limits: 20 MB/file, 100 PDF pages/file, 20 files/task, 10 KB references/task, 10 pending tasks/workspace, 2 active inference slots/site. Pilot operator may lower these based on measurements. Large input should receive an explicit limit error, not be silently truncated. Context selection/truncation must be disclosed in result evidence. Keep model/token/deadline budgets per workflow profile.

## Service objectives and alerts

| Signal | Proposed objective | Alert/action |
|---|---|---|
| Availability | 99.5% in agreed service hours over 30 days | Page after 5 minutes of confirmed unavailability; report exclusions separately |
| Metadata reads | p95 <500 ms at planned load | Investigate sustained 10-minute breach |
| Task acceptance | p95 <1 second, excluding upload | Monitor admission/DB latency; retain idempotency during retries |
| Queue wait | Initial p95 target <60 seconds at baseline load | Warn if oldest runnable job >2 minutes; pause submissions if queue cap reached |
| Job integrity | No missing acknowledged jobs or duplicate published effects in recovery tests | Page on lost lease/fencing violations or stuck expired jobs |
| Storage | No published references to missing/corrupt bytes | Page on integrity mismatch; disable affected downloads |
| Sovereignty | Evidence fresh within 24 hours and after config change | Restrict new work on detected egress; mark unknown on missing evidence |
| Backup | RPO ≤15 min; full restore RTO ≤4 h | Page on failed archive/backup, alert on unverified restore age |

Measure full task time as queue + extraction/retrieval + inference + tools + validation. Publish p50/p95 and failure rates by workflow and hardware. Do not derive success rate from only completed jobs; denominator includes failed/timed-out eligible runs. Service availability and semantic task correctness are separate metrics.

## Observability

Use a local OpenTelemetry-compatible collector, a site-supported metrics dashboard, and structured logs. Correlate request, organization/workspace, task, run, job lease, sandbox execution, artifact, model digest, and policy version. Avoid tenant IDs as unbounded metrics labels; detailed scopes belong in permissioned logs.

Metrics: HTTP latency/errors, queue depth/age, active slots, token throughput, model load time, CPU/GPU/memory, OCR time, embedding time, retrieval misses, validator outcomes, sandbox failures, orphan objects, audit lag, backup age. Log prompts/document text only through an explicitly enabled restricted diagnostic process with expiry; redact secrets always. No external telemetry endpoint in the runtime profile.

Readiness checks assess DB/storage availability and required worker capability. A missing optional model marks only affected workflows unavailable; do not restart healthy APIs in a liveness loop because one model is down. Report model health observation age.

## Backup and recovery

- PostgreSQL: daily base backup plus continuous WAL archive to private encrypted storage with archive lag ≤15 minutes. RPO includes the slowest required store, not just PostgreSQL.
- Blob storage: versioned encrypted backup/replication with published artifact durability aligned to the DB recovery point. Record a manifest of object IDs/hashes for restore reconciliation.
- Qdrant: snapshot for faster recovery; preserve source/index manifests so it can be rebuilt. Preserve the embedding model digest needed for each pinned generation.
- Secrets/keys: separately escrow recovery material under site controls; test that an authorized recovery operator can decrypt the backup.
- Proposed backup retention: 30 days, pending data-owner approval; maintain separately approved audit/hold requirements.

Monthly restore drill in an isolated environment: restore DB/blobs → validate manifests → restore/rebuild vectors → replay deletion tombstones → reconcile expired jobs/sandbox effects → test authorization and three workflows → record actual RPO/RTO. A successful backup command is not a restore test. HA failover does not replace backup against corruption or deletion.

## Offline release and updates

Build releases in a controlled staging environment. Pin dependencies, container digests, model digests and tokenizer/config versions. Bundle migration code, UI assets/fonts, OCR language packs, test fixtures, model licenses, SBOM, checksums, deployment templates, and runbooks. Verify signatures/checksums at import. Production startup must not download packages, fonts, telemetry scripts, or model weights.

Release sequence:

1. Validate compatibility against current schema and exported OpenAPI contract; run unit/integration/security/browser checks.
2. Benchmark candidate model/prompt/validator changes against the fixed evaluation corpus.
3. Test upgrade and rollback on a restored staging dataset; verify backups and key access.
4. Pause new admissions and drain or explicitly suspend running jobs; retain durable queue.
5. Apply additive migration once; deploy compatible API/workers; perform health and synthetic workflow checks.
6. Resume limited admissions, monitor error/queue/quality signals, then widen within pilot limits.
7. Roll back binary/config/model revisions if gates fail and schema remains compatible; otherwise stop admissions and forward-fix or restore under the approved recovery runbook.

## Evaluation design

Build a versioned held-out corpus before setting final acceptance claims. Proposed starting set: 30 inspection cases (including poor scans/conflicts), 30 Python repair tasks, and 30 procurement cases (including missing columns, currencies, policy conflicts). Separate prompt-development fixtures from held-out evaluation. Run stochastic model cases three times with recorded parameters; retain all attempts, not only successful outputs.

| Workflow/control | Measure | Initial pilot release target |
|---|---|---|
| Inspection | Required facts, source-supported claims, citation resolvability, reviewer rubric | ≥90% required-fact coverage; ≥95% citation resolvability; zero unsupported critical maintenance directives in evaluated set |
| Coding | Hidden-test correctness, unchanged tests, allowed-file scope, baseline comparison | ≥80% tasks pass hidden tests; 100% accepted patches obey file policy; no claim beyond tested scope |
| Procurement | Numeric totals, deterministic policy rules, correct review/escalation | 100% arithmetic and explicit policy checks on supported templates; ambiguous inputs require review |
| Artifact integrity | Valid structure, checksums, provenance, revision binding | 100% published artifacts satisfy required checks |
| Tenant isolation | Cross-scope API, worker, vector, preview/download access | Zero unauthorized successful accesses in enumerated matrix |
| Recovery | Crash/restart at each publication/claim boundary | Zero lost acknowledged jobs and zero duplicate published effects in test suite |
| Resource/network | Sandbox and runtime boundary probes | Zero prohibited successful actions in tested boundaries; stale/inconclusive never reported as verified |

These are proposed thresholds, not achieved results or statistical guarantees. Report dataset size, confidence/variation where meaningful, reviewer disagreement, failure taxonomy, and hardware. Critical failure blocks release even when an average score passes. Expand the set with pilot failures after anonymization/authorization and retain a separate held-out set.

## Incident runbooks

| Incident | Immediate response | Recovery and closure evidence |
|---|---|---|
| Unexpected egress | Stop new tasks, isolate affected worker/gateway, preserve network/audit evidence | Identify destination and scope; rotate exposed credentials; retest boundary; site security authorizes resumption |
| Stuck queue | Inspect leases, slot holders, dependency health; do not bulk-reset live jobs | Reconcile expired leases/effects; verify no duplicate publication; document root cause |
| Inference out-of-memory | Stop admission to node, retain queued work, inspect load/profile | Lower slots/context or move to qualified node; rerun model health and workflow sample |
| Artifact mismatch | Quarantine artifact/download and related review | Restore verified bytes or rerun under new revision; invalidate affected approval |
| Database/storage loss | Stop writes; invoke isolated restore | Meet RPO/RTO, manifest and deletion checks; controlled cutover |
| Compromised user | Revoke sessions/grants and cancel pending work | Audit reads/exports/actions, assess scope, restore access through identity owner |

Assign named operators and escalation contacts before pilot handover. This design uses owner roles until the team and site nominate people.

## Pilot evidence bundle

Store release ID, commit, deployment manifest, model/policy/validator digests, API/schema version, evaluated dataset, full results, network tests, restore report, security findings, accessibility results, known limitations, and approvals. Keep synthetic public evidence separate from confidential pilot reports. Link public summaries from the README only after redaction and review.
