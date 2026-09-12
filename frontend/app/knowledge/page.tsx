"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { API_URL } from "../../lib/api";

type Workspace = { id: string; name: string };
type StoredFile = { id: string; display_name: string; size_bytes: number; status: string };
type KnowledgeBase = { id: string; name: string; status: string; active_index_version: number | null };
type Job = { id: string; status: string; completed_documents: number; total_documents: number; error_message: string | null };
type Hit = { score: number; text: string; citation: { display_name: string; page_start: number; page_end: number } };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  return body as T;
}

export default function KnowledgePage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [selected, setSelected] = useState<File | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [query, setQuery] = useState("What is the safe pump isolation procedure?");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const workspaces = await request<Workspace[]>("/workspaces");
    if (!workspaces[0]) throw new Error("No workspace is configured. Run the Day 2 migration.");
    setWorkspace(workspaces[0]);
    const [bases, stored] = await Promise.all([
      request<KnowledgeBase[]>(`/knowledge-bases?workspace_id=${workspaces[0].id}`),
      request<StoredFile[]>(`/workspaces/${workspaces[0].id}/files`),
    ]);
    setKnowledgeBase(bases[0] ?? null);
    setFiles(stored);
  }, []);

  useEffect(() => {
    // Initial remote-state hydration is the purpose of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((reason: Error) => setError(reason.message));
  }, [load]);

  async function uploadAndIndex(event: FormEvent) {
    event.preventDefault();
    if (!workspace || !selected) return;
    setBusy(true); setError(""); setHits([]);
    try {
      let kb = knowledgeBase;
      if (!kb) {
        kb = await request<KnowledgeBase>("/knowledge-bases", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace_id: workspace.id, name: "Operations Library" }),
        });
        setKnowledgeBase(kb);
      }
      const data = new FormData(); data.append("file", selected);
      const uploaded = await request<StoredFile>(`/workspaces/${workspace.id}/files`, { method: "POST", body: data });
      setFiles((current) => [uploaded, ...current]);
      const ingestion = await request<Job>(`/knowledge-bases/${kb.id}/ingestions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_ids: [...files.map((file) => file.id), uploaded.id] }),
      });
      setJob(ingestion);
      let current = ingestion;
      while (["queued", "running"].includes(current.status)) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        current = await request<Job>(`/ingestions/${ingestion.id}`); setJob(current);
      }
      if (current.status === "failed") throw new Error(current.error_message ?? "Indexing failed.");
      await load(); setSelected(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed.");
    } finally { setBusy(false); }
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!knowledgeBase) return;
    setBusy(true); setError("");
    try {
      const result = await request<{ hits: Hit[] }>(`/knowledge-bases/${knowledgeBase.id}/search`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: 5 }),
      });
      setHits(result.hits);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Search failed."); }
    finally { setBusy(false); }
  }

  return <div className="page-stack">
    <header className="page-header"><div><p className="eyebrow">Day 2 · grounded knowledge</p><h2>Knowledge library</h2><p className="lede">Upload local documents, build a private vector index, and retrieve evidence with page citations.</p></div><span className="status-pill success">Local only</span></header>
    {error && <section className="panel error-panel" role="alert">{error}</section>}
    <div className="knowledge-grid">
      <section className="panel"><div className="panel-heading"><div><h3>1. Add evidence</h3><p className="muted">PDF, Markdown, text, CSV, PNG, or JPEG · 20 MB max</p></div></div>
        <form className="upload-form" onSubmit={uploadAndIndex}>
          <label className="file-drop"><input aria-label="Choose knowledge document" type="file" accept=".pdf,.md,.txt,.csv,.png,.jpg,.jpeg" onChange={(event) => setSelected(event.target.files?.[0] ?? null)} /><strong>{selected?.name ?? "Choose a document"}</strong><span>{selected ? `${Math.ceil(selected.size / 1024)} KB ready` : "Stored and processed entirely on this Mac"}</span></label>
          <button className="button primary" disabled={!selected || busy}>{busy && job ? "Indexing…" : "Upload and index"}</button>
        </form>
        {job && <div className="job-row"><span>Index version {knowledgeBase?.active_index_version ?? job.id.slice(0, 4)}</span><span className={`status-pill ${job.status === "failed" ? "danger" : "success"}`}>{job.status}</span></div>}
        <div className="file-list">{files.map((file) => <div key={file.id} className="file-row"><div><strong>{file.display_name}</strong><small>{Math.ceil(file.size_bytes / 1024)} KB</small></div><span className="status-pill success">{file.status}</span></div>)}{files.length === 0 && <p className="muted">No documents uploaded yet.</p>}</div>
      </section>
      <section className="panel"><h3>2. Search the evidence</h3><p className="muted">Semantic retrieval uses nomic-embed-text through local Ollama.</p>
        <form className="search-form" onSubmit={search}><label htmlFor="knowledge-query">Question</label><textarea id="knowledge-query" value={query} onChange={(event) => setQuery(event.target.value)} /><button className="button primary" disabled={busy || !knowledgeBase?.active_index_version || query.length < 2}>Search knowledge</button></form>
        <div className="search-results">{hits.map((hit, index) => <article key={`${hit.citation.display_name}-${index}`} className="search-hit"><div><span className="rank">{index + 1}</span><strong>{hit.citation.display_name} · p. {hit.citation.page_start}{hit.citation.page_end !== hit.citation.page_start ? `–${hit.citation.page_end}` : ""}</strong><small>{Math.round(hit.score * 100)}% match</small></div><p>{hit.text}</p></article>)}{hits.length === 0 && <p className="muted result-placeholder">Indexed evidence will appear here with its source and page.</p>}</div>
      </section>
    </div>
  </div>;
}
