# Security and sovereignty design

[Design index](README.md) · Proposed controls and verification plan

## Assets and adversaries

Protect uploaded industrial information, extracted text, embeddings, prompts/results, generated artifacts, identities, credentials, model configurations, approvals, and audit history. Treat malicious users, compromised documents/repositories, prompt injection, stolen sessions, compromised dependencies, and mistakes by privileged operators as explicit threats. An administrator who controls the physical host remains a separate trust assumption; application controls alone cannot defeat that administrator.

## Threat model and tests

| Threat/boundary | Proposed mitigation | Required evidence |
|---|---|---|
| Cross-tenant object IDs or vector results | Scoped authorization, composite FKs, RLS, mandatory server filters | Denied HTTP/worker/vector access across every role/resource pair |
| Instructions embedded in SOP/PDF/image | Treat source text as data; fixed tool policy; typed arguments; no policy-changing model output | Injection fixtures cannot invoke prohibited tools or disclose unrelated sources |
| Untrusted Python/test code | Dedicated sandbox host; hardened disposable runtime; no credentials, network, host mounts, or daemon socket inside execution | Host filesystem, socket, network, process/fork, resource-exhaustion tests |
| Archive/parser attack | Expansion/file/page/pixel limits, traversal/symlink rejection, isolated extraction, local malware scan | ZIP bomb, malformed PDF, symlink and decompression fixtures |
| Stolen session or CSRF | TLS, HttpOnly/Secure cookies, bounded sessions, token/origin checks, revocation | Cross-origin mutation denied; revoked session invalidated |
| Model configuration abuse | Platform-only registry writes, digest pinning, reviewed allowlists | Organization owner cannot register or disable global serving configuration |
| SSRF/egress via tools or model gateway | Fixed upstreams and methods; deny arbitrary URLs; network firewall | DNS/HTTPS/IPv6/redirect and gateway misuse tests with local observations |
| Artifact tampering or stale approval | Immutable revisions, hash checks, exact-revision review, independent reviewer | Altered bytes denied; old approval never applies to new revision |
| Audit deletion or sensitive telemetry | Append-only runtime permissions, separate retained export, redaction | Runtime cannot update/delete audit; export verifies integrity |
| Supply-chain compromise | Version/digest pinning, reviewed model licenses, signed offline release manifest, vulnerability review | Artifact verification and provenance retained for deployed bundle |

## Identity and access

Use the organization's on-premise OIDC provider. Validate issuer/audience/signature, nonce/state and PKCE. Trust a configured issuer; never accept arbitrary discovery URLs. Map `(issuer,subject)` to identity, map groups through reviewed grants, and reject unknown organization mappings. MFA policy belongs at the identity provider. Pilot fallback local accounts are disabled except separately controlled break-glass administration with audited use.

Separate platform administrator, organization administrator, contributor, reviewer, and viewer responsibilities as described in [API permissions](backend-api.md). Deny new work when identity validation is unavailable; choose a documented bounded existing-session lifetime, not indefinite offline trust. Pilot target: 30-minute idle timeout and 8-hour maximum interactive session, subject to site policy. Revocation must reach active streams and future worker steps.

## Sandbox controls

Existing containers already provide useful constraints, but the Docker controller's daemon access is a privileged boundary. Move it to a dedicated host/VM with no application-data mounts. Execute only fixed profiles and approved images; server, not model, selects commands. Mount only the selected source revision read-only, with a separate bounded writable work area. Drop capabilities, enforce no-new-privileges, seccomp/host confinement, process/memory/CPU/output/time limits, and deny outbound networking.

For hostile multi-user code, evaluate a stronger VM or sandboxed-runtime boundary before expanding beyond the supervised pilot. Record the selected isolation technology and escape-test scope in the release decision. Terminate descendants, clean work directories, and reconcile orphan executions on controller restart. Never install arbitrary online packages during a job; reviewed dependencies are prepackaged in offline images.

## Network boundary policy

| Source | Allowed destination | Purpose |
|---|---|---|
| Browser | Internal HTTPS ingress | Application UI and authenticated API |
| API | PostgreSQL, private blob service, identity provider | Metadata, artifacts, authentication |
| Worker | PostgreSQL, blob store, Qdrant, model gateway, sandbox controller | Governed execution only |
| Model gateway | Approved inference nodes | Fixed inference/model-health methods |
| Sandbox execution | None | Offline tests and code execution |
| Telemetry agents | Local collector only | Redacted metrics and operational traces |
| Release staging host | Approved package/model sources during maintenance | Offline bundle preparation; separate from business runtime |

Production data services have no user-facing host-published ports. All administrative access goes through a controlled management network. DNS and time services must be organization-controlled and explicitly documented. Deny external DNS, IPv6 bypass paths, proxy environment bypasses, and metadata endpoints where applicable.

## Sovereignty evidence design

The current API probe maps connection failure to `blocked`; that alone cannot distinguish enforced filtering from a destination/network outage. The production evidence model must separate **configured**, **observed blocked**, **egress observed**, **inconclusive**, and **stale**.

Every record includes boundary ID, workload/run ID, test method/version, destination class, time window, policy digest, observer identity, result, and expiry. Use an organization-controlled test endpoint plus firewall/network observations to validate that the target is available but unreachable from restricted workloads. Cover API workers, inference nodes, sandboxes, gateways, DNS, and the control plane separately. Observers must not send business payloads.

Pilot freshness target: 24 hours and immediately after a network/configuration change. A dashboard must not aggregate missing or stale evidence into “fully verified.” Egress detected triggers restricted mode and incident response; inconclusive results require investigation without asserting zero leakage. Store reports locally with audit metadata.

## Content, output, and secrets

- Quarantine input until file checks finish. Classification follows the source through chunks, prompts, artifacts, and exports.
- Keep secrets in an on-premise managed secret store or root-controlled injected files; no development defaults, plaintext repository secrets, shared administrator credentials, or tokens in URLs.
- Encrypt sensitive volumes/backups and use TLS across host boundaries; define key owner, rotation, recovery, and access audit.
- Validate procurement numeric calculations with deterministic code. Escape spreadsheet text beginning with formula-trigger characters when derived from untrusted text; allow only generator-owned formulas and validate relationships.
- Generated content can be wrong despite a valid file. Require evidence presence, workflow-specific validation, uncertainty presentation, and human approval for consequential use.
- Treat retrieved content and images as untrusted context. Prompt delimiters assist interpretation but are not a security boundary.

## Audit and retention

Append audit events in the same transaction as changes to permissions, execution state, publication, and review decisions. Export asynchronously through an outbox to a separately controlled append-only store. A hash chain detects some modifications but cannot stop a privileged attacker rewriting the chain; use signed checkpoints or protected storage under a separate administrative role.

Record actor, scope, action, resource revision, policy version, time, request/run IDs, outcome, and bounded reason. Exclude raw confidential content and credentials by default. Retention, holds, and deletion behavior follow the [database plan](database.md). Export itself is a permissioned, audited action.

## Security release gate

No production deployment with development credentials, public database ports, unaudited global model writes, missing tenant tests, or an application-host Docker socket. Require scoped security testing with documented findings and dispositions, dependency/model license review, image manifest verification, permission-revocation tests, sandbox tests, and evidence freshness checks. Do not describe the product as certified unless a named independent assessment actually supports that claim.
