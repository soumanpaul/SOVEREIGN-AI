"use client";

import { DragEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Archive, ArrowRight, Check, ChevronRight, Download, Eye, FileText, Image as ImageIcon, LockKeyhole, Play, Plus, Sparkles, Upload, X, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { API_URL } from "@/lib/api";
import { Badge, Head, Title } from "./ui";
import { elapsedSeconds, formatBytes, isTaskActive, request, type AgentTask, type KnowledgeBase, type StoredFile, type TaskAccepted, type Workspace } from "./types";

function displayableMarkdown(value: string) {
  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\/?think>/gi, "")
    .trim();
}

function isCodingInput(file: StoredFile) {
  return /\.(zip|py|js|jsx|ts|tsx|json|toml|ya?ml|md|txt)$/i.test(file.display_name);
}

function activeAgentMessage(status: AgentTask["status"] | undefined, lastStepKind: string | undefined, lastStepTitle: string | undefined, taskType: string | undefined, modelName: string) {
  if (status === "cancel_requested") return {
    title: "Stopping the agent safely",
    detail: "Waiting for the current bounded operation to finish before closing the run.",
  };
  if (status === "queued" || !lastStepKind) return {
    title: "Preparing local execution",
    detail: "Starting the governed worker and reserving local resources.",
  };
  if (lastStepKind === "classification") return {
    title: "Selecting the safest capable model",
    detail: "Matching task requirements against locally registered capabilities.",
  };
  if (lastStepKind === "routing") return {
    title: taskType === "coding" ? "Isolating the repository" : "Gathering permitted evidence",
    detail: taskType === "coding" ? "Copying only selected source files into a run-scoped working tree." : "Reading selected files and searching selected knowledge indexes.",
  };
  if (lastStepKind === "repository") return {
    title: "Proving the sandbox boundary",
    detail: "Launching a disposable non-root container and checking that external network access fails.",
  };
  if (lastStepKind === "patch") return {
    title: "Running isolated verification",
    detail: "Testing the proposed changes with fixed commands and bounded resources.",
  };
  if (lastStepKind === "sandbox" && lastStepTitle?.includes("failed")) return {
    title: "Repairing the failed attempt",
    detail: `${modelName} is using bounded test output to prepare one safer retry.`,
  };
  if (lastStepKind === "sandbox") return {
    title: "Preparing the minimal patch",
    detail: `${modelName} is reasoning over the isolated repository snapshot.`,
  };
  if (lastStepKind === "retrieval") return {
    title: "Generating a grounded answer",
    detail: `${modelName} is reasoning over the ranked local evidence.`,
  };
  if (lastStepKind === "model") return {
    title: "Building validated deliverables",
    detail: "Converting the response into requested artifacts and checking their structure.",
  };
  return {
    title: "Finalizing the governed run",
    detail: "Committing validation evidence and the immutable audit trail.",
  };
}

export function Workbench() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("Review the available local context and prepare a concise approval recommendation with safety caveats.");
  const [taskMode, setTaskMode] = useState<"document" | "coding">("document");
  const [testCommand, setTestCommand] = useState<"pytest" | "unittest" | "compile">("pytest");
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKnowledgeBaseIds, setSelectedKnowledgeBaseIds] = useState<Set<string>>(new Set());
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    request<Workspace[]>("/workspaces").then((available) => {
      setWorkspaces(available);
      const preferred = window.localStorage.getItem("sovereign-default-workspace");
      setWorkspaceId(available.some((item) => item.id === preferred) ? preferred! : (available[0]?.id ?? ""));
    }).catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    Promise.all([
      request<StoredFile[]>(`/workspaces/${workspaceId}/files`),
      request<KnowledgeBase[]>(`/knowledge-bases?workspace_id=${workspaceId}`),
    ]).then(([stored, bases]) => {
      setFiles(stored);
      setKnowledgeBases(bases);
      setSelectedFileIds(new Set(stored.map((file) => file.id)));
      setSelectedKnowledgeBaseIds(new Set(bases.filter((base) => base.status === "ready" && base.active_index_version != null).map((base) => base.id)));
    }).catch((reason: Error) => setError(reason.message));
  }, [workspaceId]);

  const taskQuery = useQuery({
    queryKey: ["task", activeTaskId],
    queryFn: () => request<AgentTask>(`/tasks/${activeTaskId}`),
    enabled: Boolean(activeTaskId),
    refetchInterval: (query) => isTaskActive(query.state.data?.status) ? 1000 : false,
  });
  const task = taskQuery.data;
  const run = task?.latest_run;
  const readyBases = knowledgeBases.filter((base) => base.status === "ready" && base.active_index_version != null);

  const submit = useMutation({
    mutationFn: () => request<TaskAccepted>("/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        workspace_id: workspaceId,
        goal: prompt.trim(),
        input_file_ids: [...selectedFileIds],
        knowledge_base_ids: taskMode === "coding" ? [] : [...selectedKnowledgeBaseIds],
        mode: taskMode,
        test_command: testCommand,
        requested_outputs: taskMode === "coding" ? ["patch", "repository", "sandbox_report"] : ["docx"],
      }),
    }),
    onSuccess: (accepted) => setActiveTaskId(accepted.task_id),
  });
  const cancel = useMutation({
    mutationFn: () => request<AgentTask>(`/tasks/${activeTaskId}/cancel`, { method: "POST" }),
    onSuccess: () => void taskQuery.refetch(),
  });

  async function upload(selected: FileList | null) {
    if (!workspaceId || !selected?.length) return;
    setError("");
    try {
      const uploaded: StoredFile[] = [];
      for (const file of Array.from(selected)) {
        const data = new FormData();
        data.append("file", file);
        uploaded.push(await request<StoredFile>(`/workspaces/${workspaceId}/files`, { method: "POST", body: data }));
      }
      setFiles((current) => [...uploaded, ...current]);
      setSelectedFileIds((current) => new Set([...current, ...uploaded.map((file) => file.id)]));
      if (fileInput.current) fileInput.current.value = "";
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed.");
    }
  }

  async function removeFile(file: StoredFile) {
    if (!window.confirm(`Remove ${file.display_name} from this workspace? Existing audit records are retained.`)) return;
    try {
      await request<void>(`/workspaces/${workspaceId}/files/${file.id}`, { method: "DELETE" });
      setFiles((current) => current.filter((item) => item.id !== file.id));
      setSelectedFileIds((current) => {
        const next = new Set(current); next.delete(file.id); return next;
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove the file.");
    }
  }

  function dropFiles(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); setDragging(false); void upload(event.dataTransfer.files);
  }

  function toggleFile(id: string) {
    setSelectedFileIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleKnowledgeBase(id: string) {
    setSelectedKnowledgeBaseIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const status = task?.status ?? (submit.isPending ? "queued" : "ready");
  const displayedError = error || (submit.error instanceof Error ? submit.error.message : "") || (taskQuery.error instanceof Error ? taskQuery.error.message : "");
  const modelName = run?.route.selected_model_key ?? "Automatic";
  const workspace = workspaces.find((item) => item.id === workspaceId);
  const lastStep = run?.steps.at(-1);
  const agentMessage = activeAgentMessage(task?.status, lastStep?.kind, lastStep?.title, task?.task_type, modelName);

  return <>
    <Title eyebrow="MISSION CONTROL" title="Agentic Workbench" copy="Turn confidential files into verified decisions and deliverables—entirely inside your network." action={<button className="secondary" onClick={() => { setPrompt(""); setTaskMode("document"); setTestCommand("pytest"); setActiveTaskId(null); setSelectedFileIds(new Set()); setSelectedKnowledgeBaseIds(new Set()); submit.reset(); }}><Archive size={15} /> New task</button>} />
    {displayedError && <div className="api-error" role="alert">{displayedError}</div>}
    <div className="workbench">
      <section className="panel files">
        <Head n="01" label="INPUTS" title="Workspace files" action={<><select className="compact-select" aria-label="Workspace" value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>{workspaces.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><button className="square" aria-label="Add files" onClick={() => fileInput.current?.click()}><Plus size={16} /></button></>} />
        <input ref={fileInput} className="hidden-file" type="file" multiple accept=".pdf,.md,.txt,.csv,.png,.jpg,.jpeg,.zip,.py,.js,.jsx,.ts,.tsx,.json,.toml,.yaml,.yml" onChange={(event) => void upload(event.target.files)} />
        <div className={`drop ${dragging ? "dragging" : ""}`} onClick={() => fileInput.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={dropFiles}><Upload size={20} /><b>{taskMode === "coding" ? "Drop a repository ZIP or source files" : "Drop confidential files"}</b><small>{taskMode === "coding" ? "ZIP, Python, JS/TS, JSON, TOML or YAML · max 20 MB" : "PDF, Markdown, text, CSV, PNG or JPEG · max 20 MB"}</small><button type="button">Browse local files</button></div>
        <label className="select-all-files"><input type="checkbox" checked={files.length > 0 && selectedFileIds.size === files.length} disabled={!files.length} onChange={(event) => setSelectedFileIds(event.target.checked ? new Set(files.map((file) => file.id)) : new Set())} /><span>Select all files</span><small>{selectedFileIds.size} / {files.length}</small></label>
        <div className="file-list all-files">{files.map((file) => <div className={`file-row ${selectedFileIds.has(file.id) ? "selected" : ""}`} key={file.id} role="checkbox" aria-checked={selectedFileIds.has(file.id)} tabIndex={0} onClick={() => toggleFile(file.id)} onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); toggleFile(file.id); } }}><input type="checkbox" aria-label={`Include ${file.display_name}`} checked={selectedFileIds.has(file.id)} onChange={() => toggleFile(file.id)} onClick={(event) => event.stopPropagation()} /><i className={/\.(png|jpe?g)$/i.test(file.display_name) ? "blue" : "amber"}>{/\.(png|jpe?g)$/i.test(file.display_name) ? <ImageIcon size={18} /> : <FileText size={18} />}</i><div><b>{file.display_name}</b><small>{formatBytes(file.size_bytes)} · {file.indexed ? "indexed" : file.status}</small></div><em>LOCAL</em><button className="file-remove" aria-label={`Remove ${file.display_name}`} onClick={(event) => { event.stopPropagation(); void removeFile(file); }}><X size={14} /></button></div>)}{!files.length && <p className="empty-copy">No local files uploaded yet.</p>}</div>
        {taskMode !== "coding" && readyBases.length > 0 && <div className="kb-picker"><span className="eyebrow">KNOWLEDGE CONTEXT</span>{readyBases.map((base) => <label key={base.id}><input type="checkbox" checked={selectedKnowledgeBaseIds.has(base.id)} onChange={() => toggleKnowledgeBase(base.id)} /><span>{base.name}</span><small>v{base.active_index_version}</small></label>)}</div>}
        <div className="isolated"><LockKeyhole size={14} /><span><b>Workspace isolated</b><small>{workspace ? `${workspace.name} · ${selectedKnowledgeBaseIds.size} knowledge ${selectedKnowledgeBaseIds.size === 1 ? "base" : "bases"} selected` : "Waiting for workspace"}</small></span></div>
      </section>
      <section className="panel task">
        <Head n="02" label="TASK" title="Describe the outcome" action={<Badge tone="blue">{selectedFileIds.size} OF {files.length} SELECTED</Badge>} />
        <textarea value={prompt} maxLength={8000} onChange={(event) => setPrompt(event.target.value)} />
        <div className="task-options"><label><span>WORKFLOW</span><select value={taskMode} onChange={(event) => { const mode = event.target.value as "document" | "coding"; setTaskMode(mode); if (mode === "coding") { setSelectedKnowledgeBaseIds(new Set()); setSelectedFileIds(new Set(files.filter(isCodingInput).map((file) => file.id))); setPrompt((current) => current ? current : "Fix the defect in this repository and verify the complete test suite."); } }}><option value="document">Document agent</option><option value="coding">Coding agent</option></select></label>{taskMode === "coding" && <label><span>VERIFICATION</span><select value={testCommand} onChange={(event) => setTestCommand(event.target.value as "pytest" | "unittest" | "compile")}><option value="pytest">pytest -q</option><option value="unittest">unittest discover</option><option value="compile">compileall</option></select></label>}<Badge tone={taskMode === "coding" ? "amber" : "green"}>{taskMode === "coding" ? "NO-NETWORK SANDBOX" : "GROUNDED LOCAL"}</Badge></div>
        <div className="hints"><span><Sparkles size={14} /> Bounded local agent</span><span><LockKeyhole size={14} /> Organization scoped</span></div>
        <div className="router"><i><Eye size={18} /></i><div><small>DETERMINISTIC ROUTING</small><b>{task?.task_type ? `${task.task_type.replaceAll("_", " ")} task` : "Capability-based route"}</b><span>{run?.agent_profile?.replaceAll("_", " ") ?? "Classified after submission"}</span></div><ArrowRight size={17} /><div className="model"><i>AI</i><span><small>SELECTED MODEL</small><b>{modelName}</b></span></div></div>
        <button className="run" onClick={() => submit.mutate()} disabled={submit.isPending || isTaskActive(task?.status) || !workspaceId || !prompt.trim() || (taskMode === "coding" && selectedFileIds.size === 0)}><Play size={15} fill="currentColor" />{isTaskActive(task?.status) || submit.isPending ? "Executing locally…" : taskMode === "coding" && selectedFileIds.size === 0 ? "Select repository files" : "Run sovereign agent"}<kbd>LOCAL</kbd></button>
        {isTaskActive(task?.status) && <button className="trace-link" onClick={() => cancel.mutate()} disabled={cancel.isPending}>Cancel safely</button>}
      </section>
      <section className="panel execution">
        <Head n="03" label="EXECUTION" title="Live agent trace" action={<Badge tone={status === "completed" ? "green" : isTaskActive(status) ? "amber" : "neutral"}>{isTaskActive(status) ? <><i className="dot amber" /> {status.toUpperCase()}</> : status === "completed" ? <><Check size={12} /> COMPLETE</> : status.toUpperCase()}</Badge>} />
        <div className="run-meta"><span>{run ? `ATTEMPT ${run.attempt}` : "NO RUN"}</span><span>{elapsedSeconds(run?.started_at, run?.completed_at)}</span><span>{run?.step_count ?? 0} STEPS</span></div>
        <div className="steps">{run?.steps.map((step) => <div className={`step ${step.status === "completed" ? "done" : step.status === "failed" ? "current" : "pending"}`} key={step.id}><i>{step.status === "completed" ? <Check size={12} /> : <Zap size={12} />}</i><div><b>{step.title}</b><small>{step.detail}</small></div><time>{step.duration_ms == null ? "—" : `${(step.duration_ms / 1000).toFixed(1)}s`}</time></div>)}{isTaskActive(task?.status) && <div className="agent-working" role="status" aria-live="polite"><i className="agent-orbit"><Sparkles size={13} /></i><div><b>{agentMessage.title}</b><small>{agentMessage.detail}</small><span className="agent-progress"><i /></span></div><em aria-hidden="true"><i /><i /><i /></em></div>}{!run?.steps.length && !isTaskActive(task?.status) && <p className="empty-copy">Submit a task to see every governed step as it is committed.</p>}</div>
        <button className="trace-link" onClick={() => router.push(`/trace${task ? `?task=${task.id}` : ""}`)}>Open audit view <ChevronRight size={13} /></button>
      </section>
    </div>
    <div className="results">
      <section className="panel finding"><div><span className="eyebrow">AGENT RESULT</span><h2>{task ? `${modelName} · ${task.status}` : "Run a task to generate a governed response"}</h2></div>{task?.status === "completed" && <Badge tone="green">VERIFIED LOCAL</Badge>}<div className="response-text">{run?.error_message ? <span className="error-copy">{run.error_message}</span> : run?.result_text ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayableMarkdown(run.result_text)}</ReactMarkdown> : "The grounded result will appear here after routing, tool access, and local inference complete."}</div>{Boolean(run?.citations.length) && <div className="result-sources"><span className="eyebrow">USED SOURCES</span>{run?.citations.map((citation) => <div key={citation.source_id}><Badge tone="blue">{citation.source_id}</Badge><span><b>{citation.display_name}</b><small>Page {citation.page_start}{citation.page_end !== citation.page_start ? `–${citation.page_end}` : ""} · {citation.retrieval_mode.replaceAll("_", " ")}{citation.knowledge_base_name ? ` · ${citation.knowledge_base_name}` : ""}</small></span></div>)}</div>}</section>
      <section className="panel artifact artifact-list"><i><FileText size={25} /></i><div><span className="eyebrow">VALIDATED ARTIFACTS</span>{run?.artifacts.length ? run.artifacts.map((item) => <div className="artifact-item" key={item.id}><span><h2>{item.display_name}</h2><small>{formatBytes(item.size_bytes)} · {item.validation_status} · SHA-256 {item.sha256.slice(0, 12)}…</small></span><a className="artifact-download" href={`${new URL(API_URL).origin}${item.download_url}`}><Download size={16} /> Download</a></div>) : <><h2>No artifact generated yet</h2><small>Artifacts are generated atomically after a successful task.</small></>}</div></section>
    </div>
  </>;
}
