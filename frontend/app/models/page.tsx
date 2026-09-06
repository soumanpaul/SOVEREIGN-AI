"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { StatusPill } from "@/components/status-pill";
import { API_URL, formatContextWindow, getJson, type RegisteredModel } from "@/lib/api";

export default function ModelsPage() {
  const client = useQueryClient();
  const models = useQuery({
    queryKey: ["models"],
    queryFn: () => getJson<RegisteredModel[]>("/models"),
  });
  const health = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_URL}/models/${id}/health-check`, { method: "POST" });
      if (!response.ok) throw new Error(`Health check failed (${response.status})`);
      return (await response.json()) as RegisteredModel;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["models"] }),
  });

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Local capability registry</p>
          <h2>Models</h2>
          <p className="lede">Configured models are metadata; readiness is observed from Ollama.</p>
        </div>
      </header>

      {models.isPending && <div className="panel muted">Loading model registry…</div>}
      {models.isError && <div className="panel error-panel">Could not load the model registry.</div>}
      {models.data && (
        <section className="model-grid">
          {models.data.map((model) => (
            <article className="model-card" key={model.id}>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{model.provider}</p>
                  <h3>{model.name}</h3>
                </div>
                <StatusPill status={model.latest_health?.status ?? "unknown"} />
              </div>
              <code>{model.model_key}</code>
              <div className="tag-row">
                {model.capabilities.map((capability) => (
                  <span className="tag" key={capability}>{capability}</span>
                ))}
              </div>
              <dl className="detail-list">
                <div><dt>Context</dt><dd>{formatContextWindow(model.context_window)}</dd></div>
                <div><dt>Quantization</dt><dd>{model.quantization ?? "Unknown"}</dd></div>
                <div><dt>Priority</dt><dd>{model.priority}</dd></div>
              </dl>
              <button
                className="button secondary"
                disabled={health.isPending}
                onClick={() => health.mutate(model.id)}
              >
                {health.isPending ? "Checking…" : "Check readiness"}
              </button>
            </article>
          ))}
        </section>
      )}
      {health.isError && <p className="inline-error">The health check request failed.</p>}
    </div>
  );
}

