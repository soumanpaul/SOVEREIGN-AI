"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Archive, ArrowRight, Check, ChevronRight, Download, Eye, FileText, Image as ImageIcon, LockKeyhole, Play, Plus, Sparkles, Upload, X, Zap } from "lucide-react";

import { Badge, Head, Title } from "./ui";
import { formatBytes, request, traceSteps, type InferenceResult, type StoredFile, type Workspace } from "./types";

export function Workbench() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("Review the available local context and explain sovereign local AI in three concise sentences.");
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const inference = useMutation({
    mutationFn: (value: string) => request<InferenceResult>("/inference/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: value }) }),
  });

  useEffect(() => {
    request<Workspace[]>("/workspaces").then(async ([first]) => {
      if (!first) return;
      setWorkspace(first);
      setFiles(await request<StoredFile[]>(`/workspaces/${first.id}/files`));
    }).catch((reason: Error) => setError(reason.message));
  }, []);

  async function upload(selected: FileList | null) {
    if (!workspace || !selected?.length) return;
    setError("");
    try {
      const uploaded: StoredFile[] = [];
      for (const file of Array.from(selected)) {
        const data = new FormData(); data.append("file", file);
        uploaded.push(await request<StoredFile>(`/workspaces/${workspace.id}/files`, { method: "POST", body: data }));
      }
      setFiles((current) => [...uploaded, ...current]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Upload failed."); }
  }

  const done = inference.isPending ? 3 : inference.data ? traceSteps.length : 0;
  return <>
    <Title eyebrow="MISSION CONTROL" title="Agentic Workbench" copy="Turn confidential files into verified decisions and deliverables—entirely inside your network." action={<button className="secondary" onClick={() => { setPrompt(""); inference.reset(); }}><Archive size={15} /> New workspace</button>} />
    {error && <div className="api-error" role="alert">{error}</div>}
    <div className="workbench">
      <section className="panel files">
        <Head n="01" label="INPUTS" title="Workspace files" action={<button className="square" aria-label="Add files" onClick={() => fileInput.current?.click()}><Plus size={16} /></button>} />
        <input ref={fileInput} className="hidden-file" type="file" multiple accept=".pdf,.md,.txt,.csv,.png,.jpg,.jpeg" onChange={(event) => void upload(event.target.files)} />
        <div className="drop" onClick={() => fileInput.current?.click()}><Upload size={20} /><b>Drop confidential files</b><small>PDF, Markdown, text, CSV, PNG or JPEG · max 20 MB</small><button>Browse local files</button></div>
        <div className="file-list">{files.slice(0, 3).map((file) => <div className="file-row" key={file.id}><i className={/\.(png|jpe?g)$/i.test(file.display_name) ? "blue" : "amber"}>{/\.(png|jpe?g)$/i.test(file.display_name) ? <ImageIcon size={18} /> : <FileText size={18} />}</i><div><b>{file.display_name}</b><small>{formatBytes(file.size_bytes)} · {file.status}</small></div><em>LOCAL</em><X size={14} /></div>)}{!files.length && <p className="empty-copy">No local files uploaded yet.</p>}</div>
        <div className="isolated"><LockKeyhole size={14} /><span><b>Workspace isolated</b><small>{workspace ? `Workspace ${workspace.name}` : "Waiting for workspace"}</small></span></div>
      </section>
      <section className="panel task">
        <Head n="02" label="TASK" title="Describe the outcome" action={<Badge tone="blue">{files.length} FILES AVAILABLE</Badge>} />
        <textarea value={prompt} maxLength={8000} onChange={(event) => setPrompt(event.target.value)} />
        <div className="hints"><span><Sparkles size={14} /> Local model inference</span><span><LockKeyhole size={14} /> Configured API only</span></div>
        <div className="router"><i><Eye size={18} /></i><div><small>LOCAL ROUTING</small><b>General reasoning task</b><span>Registry-selected Ollama model</span></div><ArrowRight size={17} /><div className="model"><i>AI</i><span><small>SELECTED PROVIDER</small><b>{inference.data?.model_name ?? "Automatic"}</b></span></div></div>
        <button className="run" onClick={() => prompt.trim() && inference.mutate(prompt.trim())} disabled={inference.isPending || !prompt.trim()}><Play size={15} fill="currentColor" />{inference.isPending ? "Executing locally…" : "Run sovereign agent"}<kbd>⌘ ↵</kbd></button>
      </section>
      <section className="panel execution">
        <Head n="03" label="EXECUTION" title="Live agent trace" action={<Badge tone={inference.isPending ? "amber" : inference.data ? "green" : "neutral"}>{inference.isPending ? <><i className="dot amber" /> RUNNING</> : inference.data ? <><Check size={12} /> COMPLETE</> : "READY"}</Badge>} />
        <div className="run-meta"><span>LIVE API RUN</span><span>{inference.data ? `${(inference.data.duration_ms / 1000).toFixed(1)} SEC` : "—"}</span><span>LOCAL PROVIDER</span></div>
        <div className="steps">{traceSteps.map((step, index) => <div className={`step ${index < done ? "done" : inference.isPending && index === done ? "current" : "pending"}`} key={step[0]}><i>{index < done ? <Check size={12} /> : inference.isPending && index === done ? <Zap size={12} /> : index + 1}</i><div><b>{step[0]}</b><small>{index === 3 && inference.data ? inference.data.model_name : step[1]}</small></div><time>{index < done ? (index >= 3 && inference.data ? `${(inference.data.duration_ms / 1000).toFixed(1)}s` : step[2]) : "—"}</time></div>)}</div>
        <button className="trace-link" onClick={() => router.push("/trace")}>Open audit view <ChevronRight size={13} /></button>
      </section>
    </div>
    <div className="results">
      <section className="panel finding"><div><span className="eyebrow">LOCAL RESPONSE</span><h2>{inference.data ? `${inference.data.model_name} completed the task` : "Run a task to generate a verified response"}</h2></div>{inference.data && <Badge tone="green">LOCAL</Badge>}<div className="response-text">{inference.isError ? <span className="error-copy">{inference.error.message}</span> : inference.data?.content ?? "The model response will appear here without leaving the configured local control plane."}</div></section>
      <section className="panel artifact"><i><FileText size={25} /></i><div><span className="eyebrow">RESULT METADATA</span><h2>{inference.data ? `Response from ${inference.data.model_name}` : "No result generated"}</h2><small>{inference.data ? `${inference.data.provider} · ${inference.data.duration_ms} ms · local` : "Submit a task to begin"}</small></div><button disabled title="Artifact generation API is not available"><Download size={16} /> Download</button></section>
    </div>
  </>;
}
