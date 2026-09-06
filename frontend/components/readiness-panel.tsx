"use client";

import { useQuery } from "@tanstack/react-query";

import { StatusPill } from "@/components/status-pill";
import { getJson, type Readiness } from "@/lib/api";

export function ReadinessPanel() {
  const query = useQuery({
    queryKey: ["readiness"],
    queryFn: () => getJson<Readiness>("/readiness"),
    refetchInterval: 15_000,
  });

  if (query.isPending) return <div className="panel muted">Checking local services…</div>;
  if (query.isError)
    return (
      <div className="panel error-panel">
        <strong>API unavailable</strong>
        <p>Start the local stack and try again.</p>
      </div>
    );

  const dependencies = query.data.details.dependencies ?? {};
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Runtime readiness</p>
          <h2>Local service boundary</h2>
        </div>
        <StatusPill status={query.data.status} />
      </div>
      <div className="service-grid">
        {Object.entries(dependencies).map(([name, state]) => (
          <article key={name} className="service-card">
            <div className="service-title">
              <strong>{name}</strong>
              <StatusPill status={state.status} />
            </div>
            <span>{state.latency_ms === undefined ? "No latency data" : `${state.latency_ms} ms`}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

