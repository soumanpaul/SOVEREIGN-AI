# Minimum Viable Product

# MUST WORK LIVE

# 1. Local open-weight model inference
- At least two locally hosted models available.

# Example:
- Model A
General reasoning / document work
- Model B
Coding / technical task
- A practical baseline is a multimodal Gemma-family or Qwen-family model plus a smaller code-oriented model. Gemma 3 supports image+text input, up to 128K context in several variants, and sizes including 4B, 12B and 27B, making smaller variants feasible for workstation demonstrations.


# 2. Automatic model router
- Judge gives: “Analyse this inspection report.”

# System displays:
    - Task detected:
        DOCUMENT_ANALYSIS
    - Selected model:
        - Multimodal-General-Model
    - Reason:
        - Requires document + vision understanding

- Then judge gives: “Fix this Python script.”
    System displays:
    - Task detected:
        - CODE_EXECUTION

    - Selected model:
        - Code-Optimized-Model

- This directly satisfies the PS requirement


# 3. One agentic document workflow
- One agentic document workflow

Scanned Inspection PDF
        ↓
OCR / Vision
        ↓
Extract Findings
        ↓
Search Internal SOP
        ↓
Compare Findings vs SOP
        ↓
Generate Recommendations
        ↓
Create Approval Note
        ↓
DOCX

- The judge should be able to download/open: MRPL_Inspection_Approval_Note.docx

# 4. One coding workflow
- Input:
broken_temperature_analysis.py
sample_data.csv

# Agent: Read code
→ identify bug
→ modify file
→ execute sandbox
→ inspect result
→ run tests
→ mark verified

# Final output:
✓ Code modified
✓ 7/7 tests passed
✓ No external network access


# 5. Multimodal understanding
- Upload a scanned inspection report containing:
text
equipment photograph
handwritten annotation
Show that OCR/vision extracts useful content.


# 6. Visible sovereignty proof
- This should be a permanent panel:

SOVEREIGN MODE

Internet Access          BLOCKED
External API Calls       0
Cloud LLM Calls          0
External DNS Requests    0
Local Model Calls        14
Local Tool Calls         8

✓ All processing remained on-premise
This is one of the highest-priority demo features because the PS explicitly demands proof.


# Can Be Simulated / Deferred
- For the hackathon:
enterprise SSO
Active Directory integration
Kubernetes
multi-node GPU scheduling
document-level ACL synchronization
120B models
high availability
complex multi-tenancy
distributed vector search
full SIEM integration
production malware sandbox
enterprise backup/DR

- Show these on the architecture slide as Scale Vision.

# Expected Challenges & Mitigation

| Challenge                     | Mitigation                                 |
| ----------------------------- | ------------------------------------------ |
| GPU memory insufficient       | 4-bit quantized 4B–14B models              |
| Downloading models at venue   | Pre-download models before hackathon       |
| Multimodal model latency      | Limit page/image resolution and context    |
| OCR unreliable                | native PDF extraction → OCR fallback       |
| Agent loops forever           | max-step budget + timeout                  |
| Code execution dangerous      | isolated Docker sandbox                    |
| RAG hallucinations            | return retrieved passages + citations      |
| Local models weak at tool use | constrained structured JSON planning       |
| Generating Word/Excel/PPT     | deterministic Python tools                 |
| Network proof questioned      | Docker network isolation + network monitor |
| Tool misuse                   | per-tool allowlist and execution policy    |
| Demo crashes                  | prepare cached demo task + recorded backup |

