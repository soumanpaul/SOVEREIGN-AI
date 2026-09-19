# Data Flow Pipeline

- Example: “Review this scanned inspection report and prepare approval note according to Pump Maintenance SOP.”

# Step 1
Browser uploads:
inspection_report.pdf
pump_sop.pdf

# Step 2
Backend stores both locally.
/data/uploads/{workspace_id}/

# Step 3
Document classifier determines:
inspection_report.pdf
type = scanned_document

# Step 4
OCR/VLM extracts:
{
  "equipment": "P-204B",
  "finding": "Seal leakage observed",
  "severity": "High"
}

# Step 5
Planner generates:
1. Extract inspection findings
2. Search pump maintenance SOP
3. Identify relevant requirement
4. Compare current condition
5. Produce corrective recommendation
6. Generate approval note

# Step 6
Knowledge engine retrieves local SOP passages.
# Step 7
Model synthesizes findings.
# Step 8
DOCX tool creates:
Approval_Note_P204B.docx
# Step 9
Artifact verifier confirms file exists and is readable.
# Step 10
UI renders:
Task completed

6/6 steps successful
Approval_Note_P204B.docx

External network requests: 0

