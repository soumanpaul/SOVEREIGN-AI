import Link from "next/link";

import { ReadinessPanel } from "@/components/readiness-panel";

export default function Dashboard() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Day 1 foundation</p>
          <h2>Local AI control plane</h2>
          <p className="lede">
            Verify every dependency before confidential work enters the system.
          </p>
        </div>
        <Link className="button primary" href="/workbench">
          Open workbench
        </Link>
      </header>

      <section className="metric-grid" aria-label="Foundation status">
        <article className="metric-card">
          <span>Cloud AI providers</span>
          <strong>0</strong>
          <small>None configured</small>
        </article>
        <article className="metric-card">
          <span>Model concurrency</span>
          <strong>1</strong>
          <small>M1 8 GB profile</small>
        </article>
        <article className="metric-card">
          <span>Execution mode</span>
          <strong>Local</strong>
          <small>Native Ollama</small>
        </article>
      </section>

      <ReadinessPanel />

      <section className="panel split-panel">
        <div>
          <p className="eyebrow">Milestone</p>
          <h2>Foundation before autonomy</h2>
        </div>
        <p>
          Today proves UI → API → registry → local model. Document ingestion, routing,
          agent tools, and sandbox execution are deliberately added as later vertical slices.
        </p>
      </section>
    </div>
  );
}

