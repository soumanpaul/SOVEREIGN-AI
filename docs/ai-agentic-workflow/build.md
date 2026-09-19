# 6. 36-HOUR HACKATHON BUILD TIMELINE

# Block 1 — Hours 0–6
Environment, Scaffolding & Data Preparation
Do not touch fancy features yet.

# Developer A — Platform
Git repo
docker-compose
FastAPI
Postgres
Qdrant
local model server

# Developer B — Frontend
Create:
workbench
file upload
execution panel
artifact panel

# Developer C — AI/Data
Prepare:
inspection_report.pdf
maintenance_sop.pdf
broken Python task
engineering image
Test local model.

# Target at Hour 6
This must work:
browser
→ FastAPI
→ local LLM
→ browser
And:
curl internet
→ BLOCKED

# Block 2 — Hours 6–12
Core Pipeline & API Integration
Build:
upload endpoint
document storage
PDF extraction
OCR
knowledge ingestion
Qdrant retrieval
Implement tools:
read_file()
search_knowledge()
create_docx()
execute_python()
Add structured tool responses.

# Target Hour 12
Ask:
“What is the allowed vibration limit according to this SOP?”
System returns answer with a local citation.


# Block 3 — Hours 12–18
AI/ML Inference + Agent Runtime
Implement:
intent classifier
model router
planner
workflow executor
retry
timeout
Integrate second model.
Demonstrate:
document
→ general/vision model

code
→ coding model
Implement agent trace.

# Target Hour 18
Document workflow works without UI polish:
PDF
→ OCR
→ RAG
→ reasoning
→ DOCX

# Block 4 — Hours 18–24
Frontend UI & Dashboard Binding
Build the impressive UI now.
Main screen:
┌─────────────────────────────────────────────────────┐
│ SOVEREIGN AI                    OFFLINE ●            │
├────────────┬─────────────────────────┬───────────────┤
│ FILES      │ TASK                    │ AGENT TRACE   │
│            │                         │               │
│ Report.pdf │ Review inspection...    │ ✓ Read PDF    │
│ SOP.pdf    │                         │ ✓ OCR         │
│ image.jpg  │                         │ ✓ SOP Search  │
│            │                         │ ● Generate    │
├────────────┴─────────────────────────┴───────────────┤
│ Local Models 3 │ External Calls 0 │ GPU 67%         │
└─────────────────────────────────────────────────────┘
Do not build a map. This PS has no GIS requirement.
Instead visualize:
agents
models
execution
documents
GPU
sovereign status

# Target Hour 24
The entire flagship workflow runs from browser.

# Block 5 — Hours 24–30
End-to-End Integration & Hardening
Freeze scope.
Do not add features.
Test exactly three scenarios.

# Demo A — Multimodal document
inspection report
+
image
+
SOP

→ approval note

# Demo B — Coding
broken Python script
→ repair
→ sandbox
→ tests pass

# Demo C — Model routing
Show different models selected automatically.
Now test:
bad PDF
empty file
tool timeout
model unavailable
invalid Python
agent retry
Add fallback:
If coding model unavailable
→ compatible general model

# Block 6 — Hours 30–36
Presentation, Video & Live Demo Polish
Stop coding unless something blocks the demonstration.

Your presentation should be roughly:

1. Problem
2. Why cloud AI cannot solve it
3. Sovereign Workbench
4. Architecture
5. Live Demo
6. Model Routing
7. Sovereignty Proof
8. Security & Auditability
9. MRPL Use Cases
10. National Scale Vision

Three-Minute Demo Script
0:00–0:20

- “Industrial organizations possess some of India's most sensitive engineering and business information. Cloud AI creates unacceptable data-exfiltration risk. Our workbench brings agentic AI entirely inside the organization's security boundary.”

0:20–1:45
# Upload:
inspection-report.pdf
pump-photo.jpg
Ask:
“Review this inspection, compare it with the maintenance SOP and prepare an approval note.”

# UI shows:
Multimodal task detected
↓
Vision model selected
↓
Report analysed
↓
SOP retrieved
↓
Compliance checked
↓
Approval note generated

# Open:
Approval_Note.docx
1:45–2:25
Switch to coding task.
“Fix this script and verify it.”
Show:
Coder model selected

Read source
→ modify
→ sandbox execution
→ tests

7/7 PASSED
2:25–2:45
Show:
Sovereignty Monitor
Cloud APIs               0
External connections     0
Internet egress          BLOCKED
Model inference          LOCAL
Embeddings               LOCAL
Documents                LOCAL
Then actually attempt an external request from the application container and show it fail.
That is your proof moment.
2:45–3:00
Finish with:
“We aren't proposing another chatbot. We are proposing a sovereign AI execution layer for India's confidential industrial knowledge work — where models can evolve, but organizational data never leaves the premises.”