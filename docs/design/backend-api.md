# Backend and API design

[Design index](README.md) · Current route inventory plus proposed production contracts

## Existing HTTP surface

The table below is extracted from the current FastAPI route declarations. Status codes are declared success responses; authorization and other errors are separate. `/docs` and `/openapi.json` are framework routes outside this table. Request/response schemas live in [backend/app/schemas](../../backend/app/schemas).

| Current method and path | Success | Source handler |
|---|---|---|
| `POST /api/v1/auth/signup` | 201 | [auth:signup](../../backend/app/api/routes/auth.py) |
| `POST /api/v1/auth/signin` | 200 | [auth:signin](../../backend/app/api/routes/auth.py) |
| `GET /api/v1/auth/me` | 200 | [auth:me](../../backend/app/api/routes/auth.py) |
| `PATCH /api/v1/auth/me` | 200 | [auth:change_profile](../../backend/app/api/routes/auth.py) |
| `GET /api/v1/auth/sessions` | 200 | [auth:sessions](../../backend/app/api/routes/auth.py) |
| `DELETE /api/v1/auth/sessions/{session_id}` | 204 | [auth:delete_session](../../backend/app/api/routes/auth.py) |
| `POST /api/v1/auth/signout` | 204 | [auth:signout](../../backend/app/api/routes/auth.py) |
| `GET /api/v1/health` | 200 | [health:health](../../backend/app/api/routes/health.py) |
| `GET /api/v1/readiness` | 200 | [health:readiness](../../backend/app/api/routes/health.py) |
| `POST /api/v1/inference/chat` | 200 | [inference:chat](../../backend/app/api/routes/inference.py) |
| `GET /api/v1/workspaces` | 200 | [knowledge:list_workspaces](../../backend/app/api/routes/knowledge.py) |
| `POST /api/v1/workspaces` | 201 | [knowledge:create_workspace](../../backend/app/api/routes/knowledge.py) |
| `GET /api/v1/workspaces/{workspace_id}/files` | 200 | [knowledge:list_files](../../backend/app/api/routes/knowledge.py) |
| `POST /api/v1/workspaces/{workspace_id}/files` | 201 | [knowledge:upload_file](../../backend/app/api/routes/knowledge.py) |
| `DELETE /api/v1/workspaces/{workspace_id}/files/{file_id}` | 204 | [knowledge:remove_file](../../backend/app/api/routes/knowledge.py) |
| `GET /api/v1/knowledge-bases` | 200 | [knowledge:list_knowledge_bases](../../backend/app/api/routes/knowledge.py) |
| `POST /api/v1/knowledge-bases` | 201 | [knowledge:create_knowledge_base](../../backend/app/api/routes/knowledge.py) |
| `POST /api/v1/knowledge-bases/{kb_id}/ingestions` | 202 | [knowledge:ingest](../../backend/app/api/routes/knowledge.py) |
| `GET /api/v1/ingestions/{job_id}` | 200 | [knowledge:ingestion_status](../../backend/app/api/routes/knowledge.py) |
| `POST /api/v1/knowledge-bases/{kb_id}/search` | 200 | [knowledge:search](../../backend/app/api/routes/knowledge.py) |
| `GET /api/v1/models` | 200 | [models:models](../../backend/app/api/routes/models.py) |
| `POST /api/v1/models` | 201 | [models:create_model](../../backend/app/api/routes/models.py) |
| `PATCH /api/v1/models/{model_id}` | 200 | [models:update_model_state](../../backend/app/api/routes/models.py) |
| `POST /api/v1/models/{model_id}/health-check` | 200 | [models:model_health](../../backend/app/api/routes/models.py) |
| `POST /api/v1/security/egress-test` | 200 | [security:egress_test](../../backend/app/api/routes/security.py) |
| `GET /api/v1/security/status` | 200 | [security:sovereignty_status](../../backend/app/api/routes/security.py) |
| `POST /api/v1/tasks` | 202 | [tasks:submit_task](../../backend/app/api/routes/tasks.py) |
| `GET /api/v1/tasks` | 200 | [tasks:tasks](../../backend/app/api/routes/tasks.py) |
| `GET /api/v1/tasks/{task_id}` | 200 | [tasks:task_detail](../../backend/app/api/routes/tasks.py) |
| `POST /api/v1/tasks/{task_id}/cancel` | 202 | [tasks:cancel](../../backend/app/api/routes/tasks.py) |
| `POST /api/v1/tasks/{task_id}/retry` | 202 | [tasks:retry](../../backend/app/api/routes/tasks.py) |
| `GET /api/v1/runs/{run_id}/steps` | 200 | [tasks:run_steps](../../backend/app/api/routes/tasks.py) |
| `GET /api/v1/runs/{run_id}/artifacts` | 200 | [tasks:run_artifacts](../../backend/app/api/routes/tasks.py) |
| `GET /api/v1/artifacts/{artifact_id}/content` | 200 | [tasks:artifact_content](../../backend/app/api/routes/tasks.py) |
| `GET /api/v1/artifacts/{artifact_id}/preview` | 200 | [tasks:artifact_preview](../../backend/app/api/routes/tasks.py) |
| `GET /api/v1/audit-events` | 200 | [tasks:audit_events](../../backend/app/api/routes/tasks.py) |

Current access: health/readiness and signup/signin are unauthenticated; business routes use the current-user dependency. Model creation/state changes require the organization `owner` role, despite the registry being global. The production permission split below corrects that mismatch. Current list endpoints generally return arrays; proposed cursor envelopes are a breaking contract change and require a versioned rollout.

## Backend module boundaries

Retain FastAPI and domain modules for identity, workspaces, files, knowledge, tasks, model routing, tool policy, artifacts, reviews, and audit. HTTP handlers translate schemas and errors; services own transactions and authorization; repositories encapsulate tenant-aware queries. Workers call the same domain policy layer. Storage, model providers, sandbox execution, and time/ID generation use replaceable adapters for tests.

Split `runtime.py` into scheduler, run coordinator, workflow handlers, effects, and validators as behavior is covered by tests. No generic plugin may execute arbitrary Python inside the API. Keep document, coding, and procurement handlers independently evaluable.

## Proposed permissions

Roles are assignments of permissions, not UI labels. All permissions require organization and workspace scope. Platform operators do not automatically gain business-document access.

| Action | Viewer | Contributor | Reviewer | Organization admin | Platform operator |
|---|---|---|---|---|---|
| Read authorized outputs | Yes | Yes | Yes | With workspace membership | No by default |
| Upload and submit tasks | No | Yes | With contributor grant | With contributor grant | No by default |
| Cancel own task | No | Yes | With submitter grant | Scoped support permission | Operational stop only |
| Approve/reject artifacts | No | No | Yes; no self-approval | Only with reviewer grant | No |
| Manage workspace membership | No | No | No | Yes, within organization | No |
| Change global models/policies | No | No | No | Request approved configuration | Yes, audited |
| Read audit evidence | Own authorized scope | Own authorized scope | Review scope | Organization audit grant | Infrastructure scope |

Deny by default and check each object access, including downloads, previews, event streams, job retries, and nested IDs. This follows [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). Permission inheritance must be explicit, and tests must cover both allowed and denied cases.

## Current submission example

`POST /api/v1/tasks` with authenticated session and `Idempotency-Key: inspection-example-001`:

```json
{
  "workspace_id": "11111111-1111-4111-8111-111111111111",
  "goal": "Review the inspection evidence against the selected SOP and draft a report for approval.",
  "mode": "document",
  "input_file_ids": ["22222222-2222-4222-8222-222222222222"],
  "knowledge_base_ids": ["33333333-3333-4333-8333-333333333333"],
  "requested_outputs": ["docx"]
}
```

IDs above are placeholders; replace them with authorized uploaded resources. The existing `202` body contains `task_id`, `run_id`, `status`, and `created_at`. Current limits include goal ≤8,000 characters, ≤20 file IDs, ≤10 knowledge bases, and ≤3 requested outputs. Proposed production validation also bounds extracted content, archive expansion, tokens, storage, queue length, and organization budgets.

## Proposed v2 API contract

Implement new contracts under `/api/v2`; keep v1 operational during one announced migration window. Do not silently replace v1 array responses or change status meanings. Generate the TypeScript client from a reviewed OpenAPI snapshot and run compatibility checks in CI. Proposed endpoints below do not exist yet.

| Method/path under `/api/v2` | Permission | Request → response / semantics |
|---|---|---|
| `GET /auth/oidc/start`, `GET /auth/oidc/callback` | Public initiation; validated identity callback | Authorization-code flow with state, nonce, PKCE; server-managed session |
| `GET /me` | Authenticated | Identity, organization, workspace grants, permitted actions |
| `GET/POST /workspaces` | Member / workspace-create | Cursor list / `{name}` → `201 Workspace` |
| `PUT /workspaces/{id}/members/{user_id}` | Workspace-admin | `{role, expected_version}` → updated membership; no cross-org IDs |
| `POST /workspaces/{id}/files` | File-create | Bounded multipart upload → `202` quarantined file plus scan-job ID |
| `GET /files/{id}` | File-read | Revision, scan/extraction state, size/hash; no internal storage key |
| `DELETE /files/{id}` | File-delete | Reason + expected version → `202` deletion request; retention/hold checks |
| `POST /knowledge-bases/{id}/ingestions` | Knowledge-write | File revisions + expected active generation → `202` durable job |
| `GET /ingestions/{id}` | Knowledge-read | Progress, warnings, active/staged version and structured failure |
| `POST /knowledge-bases/{id}/search` | Knowledge-read | Query and optional authorized pinned version → cited, filtered results |
| `POST /tasks` | Task-create | Goal, typed inputs/outputs, profile → `202` task/run IDs and status URL |
| `GET /tasks`, `GET /tasks/{id}` | Task-read | Cursor summary list / detail without unbounded embedded steps |
| `GET /runs/{id}/steps` | Task-read | Cursor page of redacted execution observations |
| `GET /runs/{id}/events` | Task-read | SSE stream with monotonic event IDs and reconnect cursor |
| `POST /tasks/{id}/cancel` | Task-cancel | Expected run version → `202` cancellation requested, not instantly stopped |
| `POST /tasks/{id}/retry` | Task-retry | Failed run ID and reason → `202` new attempt; fresh permission checks |
| `GET /artifacts/{id}` | Artifact-read | Validation, provenance, review state, checksum and revision |
| `GET /artifacts/{id}/preview`, `GET /artifacts/{id}/content` | Artifact-read/export | Safe bounded preview / authorized streamed attachment |
| `POST /artifacts/{id}/review-requests` | Review-request | Expected revision/hash → `201` pending review |
| `GET /reviews`, `GET /reviews/{id}` | Review-read | Cursor inbox / exact revision, evidence summary and decision history; requester or eligible reviewer scope |
| `POST /reviews/{id}/decisions` | Review-decide | Decision, reason, revision/hash → `201` immutable decision |
| `GET /models` | Model-read | Permitted model capabilities and observed health |
| `POST/PATCH /admin/models[/{id}]` | Platform-model-admin | Approved model digest/config; create/update with version check |
| `GET /security/evidence` | Security-audit | Scoped evidence with boundary, method, time, expiry, and result |
| `POST /security/probes` | Security-test | Fixed allowlisted probe profile → `202` audited probe job |
| `GET /audit-events` | Audit-read | Cursor list with scoped filters and redacted payloads |
| `POST /audit-exports` | Audit-export | Time range, scope, reason → `202` job and expiring authorized download |

The model-admin path notation means `POST /admin/models` and `PATCH /admin/models/{id}`. Health endpoints remain separately exposed: public liveness contains no dependency details; authenticated operator readiness reports critical component state.

## Shared protocol rules

- **Identity:** same-origin secure HttpOnly session cookie; CSRF token plus Origin checks for mutations. Service identities use scoped, rotated credentials, not human cookies. Default public signup is disabled in production.
- **Idempotency:** require keys for submission, retry, ingestion, and review mutations. Unique scope `(organization, actor, route, key)`; canonical body hash; same body returns stored response, different body returns `409`. Atomically reserve key and create effect. Retain task-related keys for task retention and other keys at least 24 hours; expired keys cannot be assumed safe by clients.
- **Concurrency:** return resource version/ETag; require `If-Match` for mutable admin settings and review actions. A stale version returns `412`; business-state conflicts return `409`. Approval requires an exact immutable artifact revision and checksum.
- **Pagination:** `{items, next_cursor}`; default 25, maximum 100; opaque signed cursor binds scope, filter and `(created_at,id)` ordering. Prevent unrelated filters from reusing cursors. Large steps/artifacts are separate resources.
- **Events:** SSE uses persisted per-run event sequence, `Last-Event-ID`, heartbeat, authorization at connection and periodic revalidation. Reconnect replays; expired retention returns an explicit resync response. Clients deduplicate events; polling is the fallback.
- **Limits:** `413` for size, `415` for unsupported type, `422` for schema, `429` plus `Retry-After` for admission, `503` for unavailable infrastructure. Models must not receive work rejected by quotas.
- **Errors:** preserve `{error:{code,message,correlation_id,retryable,details}}`; normalize schema/unknown errors too. No prompts, secrets, stack traces, or file paths in client errors. `401` session expired, `403` denied action on visible scope, `404` absent/inaccessible object to avoid enumeration.
- **Downloads:** reauthorize every request, attachment disposition, MIME allowlist, bounded preview, no external resource resolution. Do not expose storage keys or permanent public URLs.

Example proposed error:

```json
{"error":{"code":"ARTIFACT_REVISION_CONFLICT","message":"This artifact changed. Refresh before reviewing.","correlation_id":"request-uuid","retryable":false,"details":{"current_revision":3}}}
```

## Approval and cancellation transactions

Review creation verifies that computation completed, validation passed, the reviewer can access source evidence, and the artifact is the requested revision. Decision creation locks the review row, rejects self-approval and closed requests, rechecks current permissions, inserts the immutable decision, updates review status, and appends audit evidence in one transaction. Rejection produces a new task/revision if rework is needed; it never overwrites the rejected artifact.

Cancellation updates a versioned flag. Workers check before every model/tool step, terminate owned sandbox executions, and transition only after effects are reconciled. No new artifact can publish after cancellation wins the final-state transaction. Document the already-completed race as a `409` rather than claiming a completed effect was reversed.

## API acceptance tests

Contract snapshots; exhaustive role/scope combinations; mixed authorized/unauthorized input IDs; replay and key-conflict tests; concurrent retry/approve/cancel races; pagination isolation; stream reconnect and permission revocation; malformed archives and oversize upload; model unavailable; dependency timeout; rate limits; error redaction. Test both HTTP access and worker service calls so policy cannot be bypassed by queue processing.

Long-running work moves outside the API process; FastAPI's [background-task documentation](https://fastapi.tiangolo.com/tutorial/background-tasks/) distinguishes small in-process work from heavier distributed execution. The PostgreSQL scheduler here is a deliberate initial design choice, not an assertion that the framework supplies durable jobs.
