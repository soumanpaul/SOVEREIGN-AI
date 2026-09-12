import { Braces, Check, CheckCircle2, Cpu, Database, Download, HardDrive, Network, ShieldCheck, TerminalSquare } from "lucide-react";

import type { Readiness } from "@/lib/api";
import { traceSteps } from "./types";
import { Badge, Head, Title } from "./ui";

const sampleRuns = [
  ["Inspection review · P-204B", "Document agent", "7.9s", "8D7-204"],
  ["Repair temperature monitor", "Code agent", "12.4s", "A12-881"],
  ["Compare vendor quotations", "Procurement agent", "18.1s", "C35-109"],
  ["Summarize safety audit", "Document agent", "6.6s", "F20-432"],
] as const;

export function Trace({ selected, setSelected }: { selected: string; setSelected: (value: string) => void }) {
  return <>
    <Title eyebrow="COMPLETE AUDIT TRAIL" title="Execution Trace" copy="Inspect the local run flow. Persistent audit events require a future backend endpoint." action={<button className="secondary" disabled title="Audit export API is not available"><Download size={15} /> Export audit JSON</button>} />
    <div className="trace-layout"><aside className="run-list"><span className="eyebrow">DESIGN PREVIEW RUNS</span>{sampleRuns.map((run) => <button className={selected === run[3] ? "active" : ""} onClick={() => setSelected(run[3])} key={run[3]}><span><b>{run[0]}</b><small>{run[3]} · {run[2]}</small></span><Check size={13} /></button>)}</aside><section className="panel trace-detail"><div className="trace-head"><div><Badge tone="neutral">PREVIEW DATA</Badge><h2>Inspection review · P-204B</h2><p>Run SF-{selected} · backend audit persistence not yet available</p></div><dl><div><dt>RUNTIME</dt><dd>7.9s</dd></div><div><dt>STEPS</dt><dd>{traceSteps.length}</dd></div><div><dt>PROVIDER</dt><dd>Local</dd></div><div><dt>RETRIES</dt><dd>0</dd></div></dl></div><div className="timeline">{traceSteps.map((step, index) => <div className="event" key={step[0]}><time>STEP {String(index + 1).padStart(2, "0")}</time><i><Check size={11} /></i><div><span>{["TASK_SUBMITTED", "MODEL_SELECTED", "CONTEXT_READ", "LOCAL_INFERENCE", "RESULT_RECEIVED"][index]}</span><h3>{step[0]}</h3><p>{step[1]} · {step[2]}</p>{index === 1 && <code>selection = backend registry priority · provider = ollama</code>}</div></div>)}</div></section></div>
  </>;
}

export function Security({ readiness }: { readiness?: Readiness }) {
  const dependencies = Object.entries(readiness?.details.dependencies ?? {});
  const controls = [
    [Network, "External AI", "NOT CONFIGURED", "Frontend uses the configured SovereignForge API"],
    [Cpu, "Model inference", "LOCAL", "Ollama provider through the backend"],
    [Database, "Knowledge index", "LOCAL", "Embeddings and vectors reported by readiness"],
    [HardDrive, "Document storage", "LOCAL", "Workspace file service"],
    [Braces, "API health", readiness?.status?.toUpperCase() ?? "CHECKING", `${dependencies.length} dependencies observed`],
    [ShieldCheck, "Data boundary", "CONFIGURED", "NEXT_PUBLIC_API_URL controls the API destination"],
  ] as const;
  return <>
    <Title eyebrow="ZERO-EGRESS ASSURANCE" title="Sovereignty Monitor" copy="Live evidence from the current readiness API, separated from controls that require operating-system verification." action={<button className="primary" disabled title="Egress-test API is not available"><TerminalSquare size={15} /> Run egress test</button>} />
    <section className="sovereign"><div className="orbit"><ShieldCheck size={43} /></div><div><Badge tone={readiness?.status === "ok" ? "green" : "amber"}><i className="dot" /> API {readiness?.status?.toUpperCase() ?? "CHECKING"}</Badge><h2>{readiness?.status === "ok" ? "Local services ready" : "Checking data boundary"}</h2><p>Observed from {readiness?.service ?? "SovereignForge backend"}</p></div><div><span>READY DEPENDENCIES</span><b>{dependencies.filter(([, state]) => state.status === "ready").length}</b><small>of {dependencies.length} reported services</small></div></section>
    <div className="security-grid">{controls.map(([Icon, label, value, copy]) => <article className="panel control" key={label}><i><Icon size={19} /></i><div><small>{label}</small><h3>{value}</h3><p>{copy}</p></div><CheckCircle2 size={18} /></article>)}</div>
    <div className="proof"><section className="panel"><Head n="READINESS" label="LIVE" title="Dependency verification" action={<Badge tone={readiness?.status === "ok" ? "green" : "amber"}>API DATA</Badge>} /><div className="terminal">{dependencies.map(([name, state]) => <p key={name}><span>$</span> {name} <em>{state.status}{state.latency_ms == null ? "" : ` · ${state.latency_ms} ms`}</em></p>)}{!dependencies.length && <em>Waiting for backend readiness response…</em>}<b>Network isolation itself is not asserted without a dedicated verification endpoint.</b></div></section><section className="panel policies"><Head n="CURRENT" label="COVERAGE" title="Integrated safeguards" />{["Configured API boundary", "Local model registry", "Workspace file service", "MIME and file-size validation", "Knowledge ingestion jobs", "Model health observations"].map((item) => <div key={item}><Check size={13} /><span>{item}</span><Badge tone="green">ACTIVE</Badge></div>)}</section></div>
  </>;
}
