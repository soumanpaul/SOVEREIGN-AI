export function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone = ["ok", "ready"].includes(normalized)
    ? "success"
    : ["degraded", "unknown"].includes(normalized)
      ? "warning"
      : "danger";

  return <span className={`status-pill ${tone}`}>{status.replaceAll("_", " ")}</span>;
}

