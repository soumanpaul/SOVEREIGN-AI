"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { API_URL } from "@/lib/api";

type InferenceResult = {
  model_id: string;
  model_name: string;
  provider: "ollama";
  content: string;
  duration_ms: number;
  local: true;
};

export default function WorkbenchPage() {
  const [prompt, setPrompt] = useState("Explain sovereign local AI in three concise sentences.");
  const inference = useMutation({
    mutationFn: async (value: string) => {
      const response = await fetch(`${API_URL}/inference/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: value }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(body?.error?.message ?? `Inference failed (${response.status})`);
      }
      return (await response.json()) as InferenceResult;
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = prompt.trim();
    if (clean) inference.mutate(clean);
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Foundation vertical slice</p>
          <h2>Local model workbench</h2>
          <p className="lede">This temporary endpoint verifies the local provider path.</p>
        </div>
      </header>

      <div className="workbench-grid">
        <section className="panel">
          <form onSubmit={submit} className="prompt-form">
            <label htmlFor="prompt">Task</label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={8000}
              rows={8}
            />
            <div className="form-footer">
              <small>{prompt.length} / 8,000</small>
              <button className="button primary" disabled={inference.isPending || !prompt.trim()}>
                {inference.isPending ? "Running locally…" : "Run locally"}
              </button>
            </div>
          </form>
        </section>

        <section className="panel result-panel" aria-live="polite">
          <div className="panel-heading">
            <div><p className="eyebrow">Result</p><h2>Local response</h2></div>
            {inference.data && <span className="status-pill success">verified local</span>}
          </div>
          {!inference.data && !inference.isError && (
            <p className="muted">Submit a task to verify browser → API → Ollama.</p>
          )}
          {inference.isError && (
            <div className="error-panel">
              <strong>Inference unavailable</strong>
              <p>{inference.error.message}</p>
            </div>
          )}
          {inference.data && (
            <>
              <div className="response-copy">{inference.data.content}</div>
              <dl className="result-meta">
                <div><dt>Model</dt><dd>{inference.data.model_name}</dd></div>
                <div><dt>Provider</dt><dd>{inference.data.provider}</dd></div>
                <div><dt>Duration</dt><dd>{(inference.data.duration_ms / 1000).toFixed(1)} s</dd></div>
                <div><dt>External AI</dt><dd>Not configured</dd></div>
              </dl>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

