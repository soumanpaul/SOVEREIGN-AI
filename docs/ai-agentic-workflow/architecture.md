# Architecture

┌───────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                 │
│                                                                       │
│   Browser Workbench           Admin Console          Audit Viewer     │
│   React / Next.js             Models/Tools           Network Proof    │
└───────────────┬─────────────────────┬─────────────────────┬───────────┘
                │                     │                     │
                └─────────────────────┼─────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────┐
│                       FASTAPI APPLICATION                             │
│                                                                       │
│ Auth │ Sessions │ Upload │ Tasks │ Artifacts │ Audit │ Model API      │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    AGENT ORCHESTRATION ENGINE                         │
│                                                                       │
│  Intent Classifier                                                    │
│        │                                                              │
│        ▼                                                              │
│  Task Planner ───────→ Model Router                                   │
│        │                   │                                          │
│        │                   ▼                                          │
│        │              Model Registry                                  │
│        │                                                              │
│        ▼                                                              │
│  Workflow Executor                                                    │
│        │                                                              │
│        ├──────── File Tool                                            │
│        ├──────── Knowledge Search                                     │
│        ├──────── OCR / Vision                                         │
│        ├──────── Python Sandbox                                       │
│        ├──────── Spreadsheet Tool                                     │
│        ├──────── DOCX Generator                                       │
│        └──────── Validation Tool                                      │
│                                                                       │
│   Max Steps │ Timeout │ Tool Permissions │ Human Approval             │
└─────────────┬───────────────────────────────┬─────────────────────────┘
              │                               │
              ▼                               ▼
┌──────────────────────────────┐  ┌────────────────────────────────────┐
│       LOCAL MODEL LAYER      │  │        LOCAL KNOWLEDGE LAYER       │
│                              │  │                                    │
│ vLLM / Ollama                │  │ Document ingestion                 │
│                              │  │ ↓                                  │
│ General/Vision Model         │  │ parsing/OCR                        │
│ Coding Model                 │  │ ↓                                  │
│ Embedding Model              │  │ chunking                           │
│ OCR/Vision Model             │  │ ↓                                  │
│                              │  │ embeddings                         │
│ Model Registry               │  │ ↓                                  │
│                              │  │ Qdrant / pgvector                   │
└──────────────────────────────┘  └────────────────────────────────────┘

              │                               │
              └───────────────┬───────────────┘
                              ▼
┌───────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                    │
│                                                                       │
│ PostgreSQL                 Local Files/Object Storage                 │
│                                                                       │
│ tasks                      uploads                                    │
│ runs                       outputs                                    │
│ tool_calls                 documents                                  │
│ artifacts                  generated artifacts                        │
│ audit_events                                                          │
│ model_registry                                                        │
└───────────────────────────────────────────────────────────────────────┘

                              │
                              ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    SECURITY / SOVEREIGNTY LAYER                       │
│                                                                       │
│ Host Firewall                                                        │
│ No outbound routing                                                  │
│ Docker isolated network                                              │
│ Tool allowlists                                                      │
│ Read-only mounts where possible                                      │
│ Sandbox containers                                                   │
│ Network activity logging                                             │
│ Complete execution audit                                             │
└───────────────────────────────────────────────────────────────────────┘


# Component Breakdown

# Frontend
- One application with four screens.

1. A. Workbench
┌──────────────┬────────────────────────────┬────────────────────────┐
│ Files        │ Conversation / Task        │ Execution              │
│              │                            │                        │
│ SOP.pdf      │ "Review inspection..."     │ Plan                   │
│ Report.pdf   │                            │ ✓ OCR                  │
│ image.jpg    │                            │ ✓ SOP search           │
│              │                            │ ● Generate DOCX        │
└──────────────┴────────────────────────────┴────────────────────────┘

2. B. Agent Trace
Step 1  analyse task
Step 2  read document
Step 3  OCR page 2
Step 4  search SOP
Step 5  compare requirements
Step 6  generate document

3. C. Model Registry
MODEL                   CAPABILITIES            STATUS
General-7B              text,retrieval           Ready
Vision-4B               text,image,OCR           Ready
Coder-7B                code,tools               Ready

4. D. Sovereignty Dashboard
- External calls must visibly remain zero.


# Backend
Use a modular monolith
Not microservices.

backend/
├── api/
├── agents/
├── models/
├── tools/
├── rag/
├── sandbox/
├── artifacts/
├── audit/
└── security/
You retain proper module boundaries without deployment overhead.

# Machine Learning Engine

# Three logical capabilities:
- General reasoning
- Multimodal vision/document reasoning
- Coding

You do not necessarily need three physical models.
Two models are sufficient for the MVP.

- For serving, vLLM already supports multimodal inputs, tool-related workflows and OpenAI-compatible serving patterns; it also exposes modern observability/deployment capabilities



3. DETAILED TECHNICAL STACK
# Frontend
Recommended
Next.js
TypeScript
Tailwind
shadcn/ui
TanStack Query
Zustand
React Flow
React Flow is useful for visualizing the agent execution graph.

# Important components
FileDropzone
TaskComposer
AgentExecutionTimeline
ModelBadge
ToolInvocationCard
CitationViewer
ArtifactPreview
NetworkIsolationWidget
ResourceMonitor

# Backend API
Python 3.12+
FastAPI
Pydantic
SQLAlchemy
Alembic
Execution

# For MVP:
FastAPI BackgroundTasks
or
asyncio task manager

# For production:
Redis
+
Celery / Dramatiq / Temporal
Temporal is attractive for durable multi-step agent workflows at scale, but don't integrate it during the hackathon unless you already know it.

# AI / ML / CV Engine
- Model serving
Hackathon

# Either:
- Ollama

for fastest integration,
or:
- vLLM

- if you have an NVIDIA GPU and want a stronger production story.
- vLLM currently supports a broad set of multimodal models and can serve them with configurable multimodal limits.

# General / multimodal model
Choose one model that actually fits the available GPU.
Potential pattern:
4–8 GB VRAM:
small quantized multimodal model

12–16 GB:
4B–8B multimodal

24 GB:
8B–14B comfortably, depending on quantization/context
Don't design the demo assuming a 120B model.
Gemma 3's multimodal variants include 4B/12B/27B sizes, which is exactly the kind of range that makes hardware-tier adaptation practical.

# Coding model
Use a code-specialized open-weight model that is supported by your chosen inference runtime.
Do not hard-code the platform to its name.
Model registry:
models:

  general:
    id: local-general
    capabilities:
      - reasoning
      - summarization
      - tool_calling

  vision:
    id: local-vision
    capabilities:
      - vision
      - scanned_documents

  coder:
    id: local-coder
    capabilities:
      - coding
      - debugging
      - tool_calling


# Embeddings
- Use a local sentence embedding model.

Pipeline:
document
→ chunk
→ local embedding model
→ vector DB
Never call external embedding APIs.

# Vector DB
MVP
Qdrant local Docker.
Alternative:
PostgreSQL + pgvector.
I'd use Qdrant during the hackathon because setup is simple.


# OCR
Pipeline:
PDF has text?
   │
   ├─ yes → PyMuPDF
   │
   └─ no
       ↓
    render page
       ↓
 local OCR
       ↓
 multimodal validation
Use:
PyMuPDF
PaddleOCR / Tesseract
and VLM as the semantic interpretation layer.

# Agent Orchestration
- Use a constrained state machine:
PLAN
  ↓
SELECT_TOOL
  ↓
EXECUTE
  ↓
OBSERVE
  ↓
CONTINUE | COMPLETE | FAIL


# State:
AgentState:
    task_id
    user_goal
    plan[]
    current_step
    files[]
    retrieved_context[]
    tool_results[]
    artifacts[]
    model_id
    attempts
You could implement this yourself or use LangGraph.
For an interview/architecture perspective, your own thin orchestration abstraction sitting above model/tool providers is more impressive than coupling the whole product directly to one agent framework.


# Database & Storage
PostgreSQL
Store control-plane metadata.
Users
Workspaces
Tasks
Runs
Messages
Tool calls
Models
Artifacts
Audit logs


# Files
- Hackathon:
./data/
- Production:
MinIO

because MinIO provides on-prem S3 semantics.

# Cache
- MVP:
none.
- Production:
Redis


# Infrastructure & Edge Deployment
Demo machine
# Recommended:
Ubuntu 22.04 / 24.04
32 GB RAM
8+ CPU cores
NVIDIA GPU
12–24 GB VRAM preferred
100+ GB SSD
A 24 GB card provides far more flexibility.
- But the architecture must also run on smaller machines by changing the model configuration.

# Docker topology
docker-compose.yml

frontend
backend
postgres
qdrant
model-server
sandbox
network-monitor

# Critical:
No default outbound internet route
for AI application containers.

