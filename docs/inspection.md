
  SovereignForgeAI is an on-premise agentic AI workbench for confidential industrial data. It processes documents, images, source code, and internal knowledge without sending inference or embeddings to external AI services.

  The three primary workflows are:

  1. Industrial inspection review
     Inspection report/image + SOP → cited findings → validated DOCX recommendation.

  2. Coding agent
     Source/tests → diagnosis → isolated patch → no-network test execution → patch, repository, and execution-report artifacts.

  3. Procurement analysis
     Quotations + procurement policy → comparison → cited recommendation → validated XLSX and DOCX.

  The product is intentionally a single-machine prototype, not a production enterprise platform. See Product Charter (docs/01-product-charter.md:3).

  ## Core requirements

  The main requirements are:

  - Local generation, vision, OCR, and embeddings.
  - Workspace and organization isolation.
  - Secure upload and opaque file identifiers.
  - PDF extraction with OCR fallback.
  - Qdrant-based RAG with page-level provenance.
  - Deterministic task classification and capability-based model routing.
  - Bounded task execution with timeouts, retries, cancellation, and durable steps.
  - Strictly typed, allowlisted tools.
  - Python execution in ephemeral, no-network containers.
  - Immutable, validated DOCX/XLSX and code artifacts.
  - Persistent audit records and evidence-based sovereignty reporting.
  - One active model-heavy task, with additional work queued.

  The authoritative acceptance criteria are in Requirements Specification (docs/02-requirements.md:5).

  ## Architecture and design

  The system uses a modular monolith with separate infrastructure processes:

  Next.js UI
      │ REST / polling
      ▼
  FastAPI modular monolith
      ├── PostgreSQL — authoritative state and audit
      ├── Qdrant — derived vector index
      ├── Local filesystem — uploads and artifacts
      ├── Ollama — local generation, vision and embeddings
      ├── Tesseract/PyMuPDF — document processing
      └── Sandbox controller
              └── Ephemeral no-network Python container

  Important design principles:

  - PostgreSQL is the source of truth; SSE/polling is only a delivery mechanism.
  - Model output is always untrusted.
  - Models propose actions but never grant themselves permissions.
  - Every tool request passes schema, permission, path, and resource validation.
  - The model never receives or supplies real host filesystem paths.
  - Artifacts are generated from typed structures and published atomically.
  - Retrieval keeps document, knowledge-base, page, section, and extraction provenance.
  - Completion depends on validators—not the model claiming success.
  - Published artifacts and historical task attempts are immutable.

  The architectural baseline is in Software Architecture (docs/04-architecture.md:3), with the implemented backend captured in Backend UML Design (docs/31-backend-uml-design.md:1).

  ## Current implementation status

  Implemented and recorded:

  - Day 1: platform, local models, UI shell, PostgreSQL and Qdrant.
  - Day 2: uploads, extraction, OCR fallback, embeddings and cited retrieval.
  - Day 3: routing, governed tasks, durable trace, audit, hybrid retrieval and DOCX.
  - Day 4: isolated coding workflow with patch/test artifacts.
  - Day 5: multimodal processing and procurement XLSX/DOCX workflow.

  The latest prototype status is “Day 5 complete” in docs/README.md:3. Presentation datasets have accepted runs for all three workflows, although they are synthetic.

  ## Important incomplete work

  The prototype should not yet be described as fully release-ready:

  - The application network allowed outbound HTTPS during the recorded probe; blocked runtime egress remains incomplete. See UI and Control Stabilization (docs/21-day-3-ui-stabilization.md:33).
  - The complete SEC-T01–SEC-T12 security suite is not recorded as passing.
  - Ten consecutive successful rehearsals are not recorded.
  - Fresh offline startup, restart recovery, backup/restore, and final release verification remain unchecked.
  - A cold inspection run failed immediately after a container rebuild, although an earlier warm run succeeded. See Presentation Dataset Build Record (docs/30-presentation-dataset-build-record.md:62).
  - The sandbox controller still controls Docker and is therefore a privileged prototype boundary.
  - Cancellation is cooperative and cannot stop an Ollama request already in flight.
  - Execution is serialized and not suitable for production concurrency.
  - Arbitrary quotation tables are not reconstructed automatically; structured procurement relies on CSV rows.
  - Authentication and workspace checks exist, but enterprise SSO, fine-grained RBAC, ACL synchronization, encryption/key management, and compliance hardening are deferred.

  The unchecked release items are visible in Traceability and Readiness Checklists (docs/14-traceability-and-checklists.md:15).

  ## Documentation issues

  A few documentation-maintenance problems should be corrected:

  - The traceability checklist is stale: it marks datasets, multimodal inputs, procurement, and artifact validation as unfinished even though later build records report them complete.
  - docs/README.md links to ../details.md, but the actual source brief appears to be docs/details.md.
  - There are two documents numbered 24.
  - Older material under docs/ai-agentic-workflow, docs/notes, and docs/development contains broader ideas that conflict with the frozen prototype scope. These should be treated as historical notes, not current requirements.
  - Some earlier documents describe proposed SSE, distributed workers, or abstract provider behavior that differs from the implemented prototype. The current UML and build records should take precedence.

  ## Product direction

  The future product strategy narrows the commercial entry point to maintenance review:

  NOW: synthetic SIH prototype
    ↓
  NEXT: maintenance review inbox and source-freshness controls
    ↓
  NEXT: paid pilot with SSO/ACLs and a read-only CMMS connector
    ↓
  LATER: approved CMMS/ERP write-back
    ↓
  LATER: multi-site deployment and additional workflow packs

  This separation between current and planned features is clearly documented in Product Architecture and Roadmap (docs/32-product-architecture-and-roadmap.md:122).

  Overall: the product requirements and safety-oriented architecture are strong and coherent. The three main vertical slices exist, but Day 6 security hardening and Day 7 reproducibility/release evidence are the critical remaining
  milestones. No files were changed during this review.
