# Document Workflow

INPUT
scanned PDF
   ↓
File classification
   ↓
Text extraction
   ↓
OCR where necessary
   ↓
Vision analysis
   ↓
Structured finding extraction
   ↓
Entity extraction
Equipment / defect / severity / recommendation
   ↓
Local knowledge search
   ↓
Relevant SOP chunks
   ↓
Grounded reasoning
   ↓
Citation construction
   ↓
Approval-note schema
   ↓
DOCX generation
   ↓
Artifact validation
   ↓
OUTPUT

# Coding Workflow
INPUT
code repository
   ↓
Planner
   ↓
File search
   ↓
Read relevant code
   ↓
Coding model
   ↓
Proposed modification
   ↓
Write into temporary sandbox
   ↓
Execute tests
   ↓
              PASS?
             /     \
           NO       YES
           │         │
       inspect logs  │
           │         │
         retry       │
                     ↓
                validated code

# Hard limits:
MAX_AGENT_STEPS = 12
MAX_CODE_RETRIES = 3
SANDBOX_TIMEOUT = 60 sec
NETWORK = disabled


# PostgreSQL Core Schema
workspaces
CREATE TABLE workspaces (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

# tasks
CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL
        REFERENCES workspaces(id),

    title VARCHAR(500),
    user_goal TEXT NOT NULL,

    task_type VARCHAR(50),

    status VARCHAR(30),

    selected_model_id UUID,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

# models
CREATE TABLE models (
    id UUID PRIMARY KEY,

    name VARCHAR(255) NOT NULL,

    provider VARCHAR(50)
        DEFAULT 'local',

    model_path TEXT NOT NULL,

    capabilities JSONB NOT NULL,

    context_length INTEGER,

    gpu_memory_required_mb INTEGER,

    enabled BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

# Example capabilities:
[
  "reasoning",
  "vision",
  "coding",
  "tool_calling"
]

# task_steps
CREATE TABLE task_steps (
    id UUID PRIMARY KEY,

    task_id UUID NOT NULL
        REFERENCES tasks(id),

    sequence_no INTEGER NOT NULL,

    action_type VARCHAR(100),

    tool_name VARCHAR(100),

    status VARCHAR(30),

    input_json JSONB,

    output_json JSONB,

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ
);

# task_steps
CREATE TABLE task_steps (
    id UUID PRIMARY KEY,

    task_id UUID NOT NULL
        REFERENCES tasks(id),

    sequence_no INTEGER NOT NULL,

    action_type VARCHAR(100),

    tool_name VARCHAR(100),

    status VARCHAR(30),

    input_json JSONB,

    output_json JSONB,

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ
);

# artifacts
CREATE TABLE artifacts (
    id UUID PRIMARY KEY,

    task_id UUID NOT NULL
        REFERENCES tasks(id),

    artifact_type VARCHAR(50),

    filename TEXT,

    local_path TEXT,

    sha256 VARCHAR(64),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

# tool_calls
CREATE TABLE tool_calls (
    id UUID PRIMARY KEY,

    task_id UUID NOT NULL
        REFERENCES tasks(id),

    tool_name VARCHAR(100),

    arguments JSONB,

    result JSONB,

    success BOOLEAN,

    duration_ms INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

# audit_events
CREATE TABLE audit_events (
    id UUID PRIMARY KEY,

    task_id UUID,

    event_type VARCHAR(100),

    actor VARCHAR(100),

    payload JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);


# API Contract 1 — Execute Agentic Task
Request
POST /api/v1/tasks
{
  "workspace_id": "f190...",
  "goal": "Review the pump inspection report, compare findings with the maintenance SOP and generate an approval note.",
  "document_ids": [
    "doc-inspection-001",
    "doc-sop-001"
  ],
  "output_formats": [
    "docx"
  ]
}

# Response
{
  "task_id": "task-801",
  "status": "running",
  "task_type": "document_analysis",
  "selected_model": {
    "id": "vision-general-7b",
    "reason": "Task requires scanned document understanding and long-form reasoning."
  },
  "plan": [
    {
      "step": 1,
      "action": "extract_inspection_findings"
    },
    {
      "step": 2,
      "action": "retrieve_relevant_sop"
    },
    {
      "step": 3,
      "action": "compare_requirements"
    },
    {
      "step": 4,
      "action": "generate_approval_note"
    }
  ]
}


# API Contract 2 — Task Execution Trace
GET /api/v1/tasks/task-801
Response:
{
  "task_id": "task-801",
  "status": "completed",

  "model": "vision-general-7b",

  "steps": [
    {
      "step": 1,
      "tool": "document_reader",
      "status": "completed",
      "duration_ms": 1422
    },
    {
      "step": 2,
      "tool": "knowledge_search",
      "status": "completed",
      "duration_ms": 211
    },
    {
      "step": 3,
      "tool": "local_llm",
      "status": "completed",
      "duration_ms": 8234
    },
    {
      "step": 4,
      "tool": "docx_generator",
      "status": "completed",
      "duration_ms": 912
    }
  ],

  "artifacts": [
    {
      "name": "Pump_P204B_Approval_Note.docx",
      "url": "/api/v1/artifacts/art-901"
    }
  ],

  "sovereignty": {
    "external_requests": 0,
    "cloud_ai_requests": 0
  }
}

