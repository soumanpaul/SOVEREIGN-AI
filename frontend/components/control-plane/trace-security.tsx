"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Braces, Check, CheckCircle2, Cpu, Database, Download, HardDrive, Network, ShieldCheck, TerminalSquare, XCircle } from "lucide-react";

import type { Readiness } from "@/lib/api";
import { elapsedSeconds, isTaskActive, request, type AgentTask, type AuditEvent, type EgressTest } from "./types";
import { Badge, Head, Title } from "./ui";

function retrievalSources(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null) : [];
}

export function Trace({ requestedTaskId }: { requestedTaskId?: string }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: () => request<AgentTask[]>("/tasks?limit=50"), refetchInterval: (query) => query.state.data?.some((task) => isTaskActive(task.status)) ? 1000 : 5000 });
  const selected = tasks.data?.find((task) => task.id === selectedId) ?? tasks.data?.find((task) => task.id === requestedTaskId) ?? tasks.data?.[0];
  const run = selected?.latest_run;
  const audits = useQuery({ queryKey: ["audits", run?.id], queryFn: () => request<AuditEvent[]>(`/audit-events?run_id=${run?.id}`), enabled: Boolean(run?.id), refetchInterval: isTaskActive(selected?.status) ? 1000 : false });
  const exportAudit = () => {
    const blob = new Blob([JSON.stringify({ task: selected, audit_events: audits.data ?? [] }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sovereign-audit-${run?.id ?? "empty"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return <>
    <Title eyebrow="COMPLETE AUDIT TRAIL" title="Execution Trace" copy="Inspect persisted classification, routing, tool use, inference, artifacts, and terminal state for every local task." action={<button className="secondary" onClick={exportAudit} disabled={!run}><Download size={15} /> Export audit JSON</button>} />
    {tasks.error instanceof Error && <div className="api-error" role="alert">{tasks.error.message}</div>}
    <div className="trace-layout"><aside className="run-list"><span className="eyebrow">PERSISTED RUNS</span>{tasks.data?.map((task) => <button className={selected?.id === task.id ? "active" : ""} onClick={() => { setSelectedId(task.id); router.replace(`/trace?task=${task.id}`, { scroll: false }); }} key={task.id}><span><b>{task.goal}</b><small>{task.latest_run?.agent_profile.replaceAll("_", " ") || "classifying"} · {elapsedSeconds(task.latest_run?.started_at, task.latest_run?.completed_at)}</small></span>{task.status === "completed" ? <Check size={13} /> : task.status === "failed" ? <XCircle size={13} /> : <i className="dot amber" />}</button>)}{!tasks.data?.length && <p className="empty-copy">No task runs yet. Start one in the Workbench.</p>}</aside><section className="panel trace-detail"><div className="trace-head"><div><Badge tone={selected?.status === "completed" ? "green" : isTaskActive(selected?.status) ? "amber" : "neutral"}>{selected?.status?.toUpperCase() ?? "NO RUN"}</Badge><h2>{selected?.goal ?? "No execution selected"}</h2><p>{run ? `Run ${run.id} · attempt ${run.attempt} · durable local record` : "Submit a Workbench task to create a trace"}</p></div><dl><div><dt>RUNTIME</dt><dd>{elapsedSeconds(run?.started_at, run?.completed_at)}</dd></div><div><dt>STEPS</dt><dd>{run?.steps.length ?? 0}</dd></div><div><dt>PROFILE</dt><dd>{run?.agent_profile?.replace("_agent", "") || "—"}</dd></div><div><dt>RETRIES</dt><dd>{run?.retry_count ?? 0}</dd></div></dl></div><div className="timeline">{run?.steps.map((step) => { const sources = retrievalSources(step.output.used_sources); return <div className="event" key={step.id}><time>STEP {String(step.sequence).padStart(2, "0")}</time><i>{step.status === "failed" ? <XCircle size={11} /> : <Check size={11} />}</i><div><span>{step.kind.toUpperCase()}{step.tool_name ? ` · ${step.tool_name}` : ""}</span><h3>{step.title}</h3><p>{step.detail}{step.duration_ms == null ? "" : ` · ${step.duration_ms} ms`}</p>{step.kind === "routing" && <code>{String(run.route.selection_reason ?? "deterministic capability route")} · model = {run.route.selected_model_key ?? "unavailable"}</code>}{sources.length > 0 && <div className="trace-sources">{sources.map((source, index) => <div key={String(source.source_id ?? index)}><b>{String(source.source_id ?? "SOURCE")} · {String(source.display_name ?? "Document")}</b><small>Page {String(source.page_start ?? 1)}{source.page_end !== source.page_start ? `–${String(source.page_end ?? 1)}` : ""} · {String(source.retrieval_mode ?? "retrieval").replaceAll("_", " ")}{source.knowledge_base_name ? ` · ${String(source.knowledge_base_name)}` : ""}</small></div>)}</div>}</div></div> })}{run?.error_message && <div className="api-error">{run.error_category}: {run.error_message}</div>}{!run?.steps.length && <p className="empty-copy">Execution events will appear here as the worker commits them.</p>}</div></section></div>
  </>;
}

export function Security({ readiness }: { readiness?: Readiness }) {
  const egress = useQuery({ queryKey: ["egress-test"], queryFn: () => request<EgressTest>("/security/egress-test", { method: "POST" }), enabled: false, retry: false });
  const dependencies = Object.entries(readiness?.details.dependencies ?? {});
  const controls = [
    [Network, "External AI", "NOT CONFIGURED", "Frontend uses the configured SOVEREIGN AI API"],
    [Cpu, "Model inference", "LOCAL", "Ollama provider through the backend"],
    [Database, "Knowledge index", "LOCAL", "Embeddings and vectors reported by readiness"],
    [HardDrive, "Document storage", "LOCAL", "Workspace file service"],
    [Braces, "API health", readiness?.status?.toUpperCase() ?? "CHECKING", `${dependencies.length} dependencies observed`],
    [ShieldCheck, "Data boundary", "CONFIGURED", "NEXT_PUBLIC_API_URL controls the API destination"],
  ] as const;
  return <>
    <Title eyebrow="ZERO-EGRESS ASSURANCE" title="Sovereignty Monitor" copy="Live evidence from the current readiness API, with an explicit outbound-connectivity probe." action={<button className="primary" disabled={egress.isFetching} onClick={() => void egress.refetch()}><TerminalSquare size={15} /> {egress.isFetching ? "Testing…" : "Run egress test"}</button>} />
    {egress.data && <div className={`egress-result ${egress.data.status}`} role="status"><b>{egress.data.status === "blocked" ? "Outbound connection blocked" : "Outbound connection detected"}</b><span>{egress.data.detail} Target: {egress.data.target} · {egress.data.duration_ms} ms</span></div>}
    {egress.error instanceof Error && <div className="api-error">{egress.error.message}</div>}
    <section className="sovereign"><div className="orbit"><ShieldCheck size={43} /></div><div><Badge tone={readiness?.status === "ok" ? "green" : "amber"}><i className="dot" /> API {readiness?.status?.toUpperCase() ?? "CHECKING"}</Badge><h2>{readiness?.status === "ok" ? "Local services ready" : "Checking data boundary"}</h2><p>Observed from {readiness?.service ?? "SOVEREIGN AI backend"}</p></div><div><span>READY DEPENDENCIES</span><b>{dependencies.filter(([, state]) => state.status === "ready").length}</b><small>of {dependencies.length} reported services</small></div></section>
    <div className="security-grid">{controls.map(([Icon, label, value, copy]) => <article className="panel control" key={label}><i><Icon size={19} /></i><div><small>{label}</small><h3>{value}</h3><p>{copy}</p></div><CheckCircle2 size={18} /></article>)}</div>
    <div className="proof"><section className="panel"><Head n="READINESS" label="LIVE" title="Dependency verification" action={<Badge tone={readiness?.status === "ok" ? "green" : "amber"}>API DATA</Badge>} /><div className="terminal">{dependencies.map(([name, state]) => <p key={name}><span>$</span> {name} <em>{state.status}{state.latency_ms == null ? "" : ` · ${state.latency_ms} ms`}</em></p>)}{!dependencies.length && <em>Waiting for backend readiness response…</em>}<b>{egress.data ? `Last egress probe: ${egress.data.status.replace("_", " ")}.` : "Run the egress probe to verify outbound connectivity from the API runtime."}</b></div></section><section className="panel policies"><Head n="CURRENT" label="COVERAGE" title="Integrated safeguards" />{["Configured API boundary", "Local model registry", "Workspace file service", "MIME and file-size validation", "Knowledge ingestion jobs", "Model health observations"].map((item) => <div key={item}><Check size={13} /><span>{item}</span><Badge tone="green">ACTIVE</Badge></div>)}</section></div>
  </>;
}
