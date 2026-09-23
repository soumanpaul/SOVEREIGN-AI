# Frontend product and implementation design

[Design index](README.md) · Proposed production UX; existing screens remain the implementation baseline

## Design objectives

A maintenance engineer should be able to supply evidence, understand what ran, inspect the source behind a conclusion, and send a specific output for review. A reviewer must distinguish generated content, deterministic checks, and their own approval. Operators need actionable system state without implying that a green indicator proves universal security.

Use the current Next.js App Router, React, TypeScript, and TanStack Query. Current pages are in [frontend/app](../../frontend/app); the shared interface is in [control-plane components](../../frontend/components/control-plane), and requests are in [lib/api.ts](../../frontend/lib/api.ts). This plan does not upgrade framework packages or assume new framework APIs.

## Navigation and screens

| Screen | Current route | Proposed production behavior | API dependency |
|---|---|---|---|
| Identity | `/signin`, `/signup` | Enterprise SSO; closed provisioning; session-expired return path | OIDC and `/me` |
| Overview | `/overview` | Own/workspace tasks, review backlog, system availability with observation time | Scoped task summaries and review list |
| Workbench | `/workbench` | Workflow selection, scoped attachments, knowledge version, submit, progress, results | Files, knowledge, tasks, events |
| Knowledge | `/knowledge` | Scan/extraction status, source revisions, index generations, search citations | File metadata, ingestions, search |
| Models | `/models` | Available capabilities for users; versioned administration only for operators | Model grants and admin model API |
| Trace | `/trace` | Task/run filters, routing reasons, tool observations, validations, audit export | Runs/steps/events and audit |
| Security | `/security` | Boundary-by-boundary controls and observed evidence; stale/unknown states | Security evidence/probes |
| Settings | `/settings` | Profile, sessions, organization membership if authorized | Identity and membership APIs |
| Reviews | New `/reviews`, `/reviews/{id}` | Inbox, evidence comparison, approve/reject exact revision | Proposed review endpoints |
| Task detail | New `/tasks/{id}` | Shareable authorized deep link with selected run and artifact | Task and artifact endpoints |

The backend plan includes proposed `GET /reviews` (cursor list scoped to eligible reviewer/requester) and `GET /reviews/{id}` (evidence summary, revision, decisions) for the review inbox. Use the same object authorization rules as artifact access.

## Workbench layout

```text
[Organization / workspace]                    [System status] [Profile]
Navigation | Goal and workflow               | Evidence and outputs
           | [Inspection | Code | Procurement]
           | Goal field                     | Attached file revisions
           | Files + knowledge selection    | Indexed SOP/version
           | Output selection               | Relevant warnings
           | [Run task]                     |
           |--------------------------------|-----------------------
           | Queued / Running / Validating  | Output preview
           | Timeline with expandable steps | Sources and validation
           | [Request cancellation]         | [Download draft]
           |                                | [Send for review]
```

Do not show configuration internals in the default user flow. Model routing and raw trace details are expandable. Display queue wait separately from execution time. Do not display an invented percentage when work length is unknown; use completed steps and elapsed time.

## Core interaction contracts

### Inspection

Select workspace → attach report/image → choose authorized SOP knowledge base → confirm output → submit. Missing/unindexed SOP shows a clear blocking explanation if required by the chosen template. Results present summary, cited source/page excerpts, extraction warnings, and a draft DOCX. Clicking a citation opens a safe local source preview at the referenced page/version. Missing or revoked sources show an explicit unavailable state; never fabricate a preview.

### Coding

Upload repository → display accepted/rejected file summary → select approved test profile → submit. Results show changed-file list, unified diff, baseline/final test outcomes, sandbox limits, and downloadable artifacts. “Tests passed” identifies commands and counts; it must not be labeled “safe for production.” No automatic apply, merge, or deployment action in the pilot UI.

### Procurement

Upload quotations and policy → show parsed columns/units and missing-field errors → compute comparison → preview Recommendation, Quotation Lines, and Policy Controls. Highlight failed controls in text as well as color. Display currency, tax assumptions, rounding, source policy revision, and human-review status. A cheaper noncompliant bid remains visible with its rejection reasons.

### Review

Reviewer opens exact artifact revision → reads source evidence, validation scope, and warnings → enters decision and reason. The submitter cannot approve their own output. Approval is disabled if required evidence is missing, access has changed, or the revision is stale. A `412` refreshes the view and requires a new deliberate decision. Completed computation, validation pass, and human approval have separate labels.

## State and error design

| State | UI behavior | Recovery |
|---|---|---|
| Empty workspace | Show three workflow examples and add-source action | Start a task with synthetic fixtures or approved local data |
| Uploading | Per-file progress and cancel where supported | Retry failed file only; preserve successful IDs |
| Quarantined/scanning | Explain why file cannot run yet | Observe scan job; never silently treat upload as trusted |
| Queued | Position only within authorized scope; elapsed wait | Cancel or wait; don't promise an unreliable ETA |
| Running | Timeline, current operation, connection freshness | Reconnect to durable task; navigation does not cancel it |
| Validating | Show checks pending | No successful-download claim before publication |
| Completed draft | Preview, validation scope, source links | Download or request review |
| Failed/timed out | Plain cause and correlation ID | Retry only if permitted; show a new attempt |
| Cancellation requested | Keep progress visible until confirmed stop | Explain completed-work race rather than reversing history |
| Offline/disconnected | Banner with last update; disable unsafe mutations | Reconnect/replay events, then refetch authoritative state |
| Session expired | Clear sensitive cache and request sign-in | Return to authorized task; do not silently resubmit |
| Stale security evidence | Show “last tested” and “unknown/stale” | Authorized operator may run a scoped probe |

## Frontend architecture

Refactor the broad control-plane coordinator incrementally into feature modules: `auth`, `workspaces`, `knowledge`, `tasks`, `artifacts`, `reviews`, `models`, and `security`. Shared components include `StatusBadge`, `EvidencePanel`, `SourceCitation`, `ArtifactPreview`, `RunTimeline`, `PermissionGate`, `EmptyState`, and accessible confirmation dialogs. PermissionGate is a usability affordance; the API enforces security.

Proposed data rules:

- Query keys include organization, workspace, resource ID, run/revision, and filter. Clear caches on logout and organization switch.
- Server state belongs in TanStack Query; unsent form fields remain local component/form state. Do not copy task state into multiple global stores.
- Use a generated v2 client with typed errors and cancellation; map transport errors centrally. Keep v1 adapter until migration ends.
- SSE updates are hints tied to event sequence; reconcile with authoritative resource versions. Poll with backoff/jitter if streams fail; stop active polling for terminal tasks and background tabs where appropriate.
- Generate submission idempotency keys once per deliberate submit; retain across a network retry. Never retry an unsafe mutation without its original key.
- Do not persist confidential goals, uploads, tokens, or responses in browser localStorage, analytics, or service-worker caches. Serve fonts/icons locally in offline builds.
- Sanitize generated Markdown/HTML; disable raw scriptable HTML and external embedded resources. Formula previews show inert text. Office previews use server-generated safe representations.

## Visual and accessibility system

Keep the current restrained dark interface, with consistent spacing tokens, readable body type, and distinct statuses. Use text plus icon for status, visible focus, semantic headings, labeled fields, and accessible error summaries. Target minimum 4.5:1 contrast for normal text, keyboard-complete forms/dialogs, and predictable focus after errors. Avoid rapidly announcing every generated token to assistive technology; announce meaningful status changes.

Target [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/). Validate core workflows at 200% zoom, keyboard-only navigation, screen reader, reduced motion, and narrow viewport. On smaller screens stack source/output panels; keep approval context and warnings visible. These are acceptance goals, not a current conformance claim.

## Frontend acceptance gates

- Browser tests: sign in → upload/index → run → reconnect → inspect citation → download → request review → independent reviewer decides.
- Separate tests for stale review, denied workspace, expired session, rejected upload, unavailable model, missing source, cancellation race, and offline recovery.
- Component checks for keyboard interaction, dialog focus, status semantics, empty/error/loading states, and safe preview rendering.
- Performance budget: route JS and large lists measured on the pilot network/browser; virtualize trace rows when necessary. Set numeric bundle budgets from a baseline rather than guessing a universal value.
- No duplicate submission after timeout/reload; no stale tenant cache after switching workspace/account; no secrets or document content in browser telemetry.
