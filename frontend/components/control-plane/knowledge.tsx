"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Check, FileText, Layers3, Search, Upload } from "lucide-react";

import { Badge, Title } from "./ui";
import { formatBytes, request, type Hit, type Job, type KnowledgeBase, type StoredFile, type Workspace } from "./types";

export function Knowledge() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [knowledgeBaseId, setKnowledgeBaseId] = useState("");
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [collection, setCollection] = useState<"all" | "indexed" | "processing">("all");
  const [selected, setSelected] = useState<File | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [query, setQuery] = useState("What is the safe pump isolation procedure?");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const loadWorkspace = useCallback(async (id: string, preferredBaseId?: string) => {
    const [bases, stored] = await Promise.all([
      request<KnowledgeBase[]>(`/knowledge-bases?workspace_id=${id}`),
      request<StoredFile[]>(`/workspaces/${id}/files`),
    ]);
    setKnowledgeBases(bases);
    setKnowledgeBaseId(bases.some((base) => base.id === preferredBaseId) ? preferredBaseId! : (bases[0]?.id ?? ""));
    setFiles(stored);
  }, []);

  useEffect(() => {
    request<Workspace[]>("/workspaces").then((available) => {
      if (!available[0]) throw new Error("Your organization has no workspace. Apply the latest database migrations, then reload this page.");
      setWorkspaces(available);
      const preferred = window.localStorage.getItem("sovereign-default-workspace");
      setWorkspaceId(available.some((item) => item.id === preferred) ? preferred! : available[0].id);
    }).catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    // Remote-state hydration is the purpose of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadWorkspace(workspaceId).catch((reason: Error) => setError(reason.message));
  }, [loadWorkspace, workspaceId]);

  const workspace = workspaces.find((item) => item.id === workspaceId) ?? null;
  const knowledgeBase = knowledgeBases.find((item) => item.id === knowledgeBaseId) ?? null;
  const visibleFiles = files.filter((file) => collection === "all" || (collection === "indexed" ? file.indexed : !file.indexed));

  async function uploadAndIndex() {
    if (!workspace || !selected) return;
    setBusy(true); setError(""); setHits([]);
    try {
      let kb = knowledgeBase;
      if (!kb) {
        kb = await request<KnowledgeBase>("/knowledge-bases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_id: workspace.id, name: "Operations Library" }) });
        setKnowledgeBases((current) => [...current, kb!]);
        setKnowledgeBaseId(kb.id);
      }
      const data = new FormData(); data.append("file", selected);
      const uploaded = await request<StoredFile>(`/workspaces/${workspace.id}/files`, { method: "POST", body: data });
      setFiles((current) => [uploaded, ...current]);
      const ingestion = await request<Job>(`/knowledge-bases/${kb.id}/ingestions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_ids: [...files.map((file) => file.id), uploaded.id] }) });
      setJob(ingestion); let current = ingestion;
      while (["queued", "running"].includes(current.status)) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        current = await request<Job>(`/ingestions/${ingestion.id}`); setJob(current);
      }
      if (current.status === "failed") throw new Error(current.error_message ?? "Indexing failed.");
      await loadWorkspace(workspace.id, kb.id); setSelected(null); if (input.current) input.current.value = "";
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Upload failed."); } finally { setBusy(false); }
  }

  async function search(event: FormEvent) {
    event.preventDefault(); if (!knowledgeBase) return;
    setBusy(true); setError("");
    try {
      const result = await request<{ hits: Hit[] }>(`/knowledge-bases/${knowledgeBase.id}/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, limit: 5 }) });
      setHits(result.hits);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Search failed."); } finally { setBusy(false); }
  }

  return <>
    <Title eyebrow="LOCAL KNOWLEDGE" title="Knowledge Base" copy="Index internal policies, SOPs, and manuals for source-grounded agent decisions." action={<button className="primary" onClick={() => input.current?.click()}><Upload size={15} /> Upload documents</button>} />
    {error && <div className="api-error" role="alert">{error}</div>}
    <input ref={input} className="hidden-file" type="file" accept=".pdf,.md,.txt,.csv,.png,.jpg,.jpeg" onChange={(event) => setSelected(event.target.files?.[0] ?? null)} />
    <form className="toolbar" onSubmit={search}><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${files.filter((file) => file.indexed).length} indexed documents…`} /></label><button className="secondary" disabled={busy || !knowledgeBase?.active_index_version || query.trim().length < 2} type="submit"><Search size={15} /> Search</button><label className="select-control"><span>Workspace</span><select aria-label="Knowledge workspace" value={workspaceId} onChange={(event) => { setWorkspaceId(event.target.value); setHits([]); }}><option value="" disabled>Select workspace</option>{workspaces.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label className="select-control"><Layers3 size={15} /><select aria-label="Knowledge library" value={knowledgeBaseId} onChange={(event) => { setKnowledgeBaseId(event.target.value); setHits([]); }}><option value="">New Operations Library</option>{knowledgeBases.map((base) => <option value={base.id} key={base.id}>{base.name}</option>)}</select></label></form>
    {selected && <div className="upload-strip"><span><FileText size={16} /><b>{selected.name}</b><small>{formatBytes(selected.size)}</small></span><button className="primary" disabled={busy} onClick={() => void uploadAndIndex()}>{busy ? "Indexing…" : "Upload and index"}</button></div>}
    <div className="kb"><aside><span className="eyebrow">COLLECTIONS</span><button className={collection === "all" ? "active" : ""} onClick={() => setCollection("all")}>All knowledge <b>{files.length}</b></button><button className={collection === "indexed" ? "active" : ""} onClick={() => setCollection("indexed")}>Indexed <b>{files.filter((file) => file.indexed).length}</b></button><button className={collection === "processing" ? "active" : ""} onClick={() => setCollection("processing")}>Not indexed <b>{files.filter((file) => !file.indexed).length}</b></button></aside><section className="panel doc-table"><table><thead><tr><th>Document</th><th>Size</th><th>Status</th><th>Scope</th></tr></thead><tbody>{visibleFiles.map((file) => <tr key={file.id}><td><div className="doc"><i><FileText size={17} /></i><span><b>{file.display_name}</b><small>{file.id.slice(0, 8)}</small></span></div></td><td>{formatBytes(file.size_bytes)}</td><td><Badge tone={file.indexed ? "green" : "amber"}>{file.indexed && <Check size={11} />}{file.indexed ? "indexed" : file.status}</Badge></td><td>LOCAL</td></tr>)}</tbody></table>{!visibleFiles.length && <p className="empty-copy">No documents in this collection.</p>}</section></div>
    <section className="panel retrieval"><div><span className="eyebrow">RETRIEVAL TEST</span><h2>Verify what the agent can find</h2><p>Test semantic search with page-level traceability.</p></div><form onSubmit={search}><label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} /><button disabled={busy || !knowledgeBase?.active_index_version || query.trim().length < 2}>{busy ? "Searching…" : "Search locally"}</button></label></form><div className="answers">{hits.map((hit, index) => <div className="answer" key={`${hit.citation.display_name}-${index}`}><Badge tone="blue">{Math.round(hit.score * 100)}% MATCH</Badge><b>{hit.citation.display_name} · Page {hit.citation.page_start}{hit.citation.page_end !== hit.citation.page_start ? `–${hit.citation.page_end}` : ""}</b><p>{hit.text}</p></div>)}{!hits.length && <p className="empty-copy">Indexed evidence will appear here with its source and page.</p>}</div>{job && <Badge tone={job.status === "failed" ? "amber" : "green"}>INGESTION {job.status.toUpperCase()}</Badge>}</section>
  </>;
}
