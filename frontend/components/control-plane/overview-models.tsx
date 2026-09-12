"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowRight, CheckCircle2, CircleGauge, Cpu, Database, Files, Layers3, Plus } from "lucide-react";

import { formatContextWindow, getJson, type Readiness, type RegisteredModel } from "@/lib/api";
import { request } from "./types";
import { Badge, Flow, Head, Metric, Title } from "./ui";

export function Overview({ go, readiness, models }: { go: () => void; readiness?: Readiness; models: RegisteredModel[] }) {
  const dependencies = Object.entries(readiness?.details.dependencies ?? {});
  const ready = models.filter((model) => model.latest_health?.status === "ready").length;
  return <>
    <Title eyebrow="OPERATIONS OVERVIEW" title="Local control plane." copy="Live health from the current SovereignForge API and model registry." action={<button className="primary" onClick={go}><Plus size={15} /> Start new task</button>} />
    <div className="metrics"><Metric icon={CheckCircle2} value={readiness?.status === "ok" ? "Ready" : readiness?.status ?? "Checking"} label="API readiness" note={`${dependencies.filter(([, value]) => value.status === "ready").length}/${dependencies.length} dependencies ready`} /><Metric icon={CircleGauge} value={`${models.length}`} label="Registered models" note={`${ready} currently ready`} /><Metric icon={Cpu} value={`${ready}`} label="Local models ready" note="Observed via health checks" /><Metric icon={Database} value="0" label="Cloud providers" note="Local API configuration" /></div>
    <div className="overview">
      <section className="panel activity-card"><Head n="LIVE" label="DEPENDENCIES" title="Service readiness" action={<Badge tone={readiness?.status === "ok" ? "green" : "amber"}>{readiness?.status ?? "CHECKING"}</Badge>} /><div className="service-live">{dependencies.map(([name, state]) => <div key={name}><i className={`dot ${state.status === "ready" ? "" : "amber"}`} /><span><b>{name}</b><small>{state.latency_ms == null ? "No latency reported" : `${state.latency_ms} ms latency`}</small></span><strong>{state.status}</strong></div>)}{!dependencies.length && <p className="empty-copy">Waiting for backend readiness data…</p>}</div></section>
      <section className="panel health"><Head n="MODEL" label="HEALTH" title="Local infrastructure" action={<i className="dot" />} />{models.slice(0, 4).map((model) => <div className="health-row" key={model.id}><i><Cpu size={17} /></i><span><b>{model.name}</b><small>{model.provider} · {model.model_key}</small></span><strong>{model.latest_health?.status ?? "unknown"}</strong></div>)}{!models.length && <p className="empty-copy">No models registered.</p>}</section>
    </div>
    <section className="panel recent"><Head n="CURRENT" label="REGISTRY" title="Configured local models" /><table><thead><tr><th>Model</th><th>Provider</th><th>Status</th><th>Context</th><th>Priority</th></tr></thead><tbody>{models.map((model) => <tr key={model.id}><td><b>{model.name}</b></td><td>{model.provider}</td><td><Badge tone={model.latest_health?.status === "ready" ? "green" : "neutral"}>{model.latest_health?.status ?? "UNKNOWN"}</Badge></td><td>{formatContextWindow(model.context_window)}</td><td><code>{model.priority}</code></td></tr>)}</tbody></table></section>
  </>;
}

export function Models() {
  const client = useQueryClient();
  const models = useQuery({ queryKey: ["models"], queryFn: () => getJson<RegisteredModel[]>("/models") });
  const health = useMutation({ mutationFn: (id: string) => request<RegisteredModel>(`/models/${id}/health-check`, { method: "POST" }), onSuccess: () => client.invalidateQueries({ queryKey: ["models"] }) });
  const ready = models.data?.filter((model) => model.latest_health?.status === "ready").length ?? 0;
  return <>
    <Title eyebrow="LOCAL INFERENCE" title="Model Registry" copy="Capability-based routing across the models registered by the current backend." action={<button className="primary" disabled title="Model registration API is not available"><Plus size={15} /> Register model</button>} />
    <div className="summary"><span><b>{models.data?.length ?? 0}</b> registered models</span><span><b>{ready}</b> currently ready</span><span><b>{models.data?.filter((model) => model.enabled).length ?? 0}</b> enabled</span><span><b>0</b> cloud providers</span></div>
    {models.isError && <div className="api-error">Could not load the model registry.</div>}
    <div className="model-grid">{models.data?.map((model, index) => <article className="panel model-card" key={model.id}><div className="model-top"><i className={["blue", "amber", "green", "neutral"][index % 4]}>{model.name.charAt(0)}</i><div><small>{model.capabilities.join(" + ") || "GENERAL"}</small><h2>{model.name}</h2></div><Badge tone={model.latest_health?.status === "ready" ? "green" : "neutral"}>{model.latest_health?.status ?? "UNKNOWN"}</Badge></div><p>{model.model_key}</p><dl><div><dt>CONTEXT</dt><dd>{formatContextWindow(model.context_window)}</dd></div><div><dt>PRIORITY</dt><dd>{model.priority}</dd></div><div><dt>QUANTIZATION</dt><dd>{model.quantization ?? "—"}</dd></div><div><dt>PROVIDER</dt><dd>{model.provider}</dd></div></dl><footer><span><Activity size={13} /> {model.latest_health ? `Checked ${new Date(model.latest_health.observed_at).toLocaleTimeString()}` : "Not checked"}</span><button disabled={health.isPending} onClick={() => health.mutate(model.id)}>{health.isPending ? "Checking…" : "Check readiness"} <ArrowRight size={13} /></button></footer></article>)}</div>
    <section className="panel routing"><Head n="EXPLAINABLE" label="ROUTING" title="Capability router" action={<Badge tone="blue">BACKEND MANAGED</Badge>} /><div className="flow"><Flow icon={Files} title="Input signals" copy="Prompt and workspace context" /><ArrowRight /><Flow icon={Layers3} title="Required capabilities" copy="Matched against registry metadata" /><ArrowRight /><Flow icon={CircleGauge} title="Candidate ordering" copy="Enabled state and priority" /><ArrowRight /><Flow icon={Cpu} title="Selected model" copy={models.data?.[0]?.name ?? "Waiting for registry"} active /></div></section>
  </>;
}
