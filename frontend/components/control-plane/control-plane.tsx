"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BookOpen, ChevronDown, ChevronRight, Cpu, Gauge, LockKeyhole, Menu, ShieldCheck, Sparkles } from "lucide-react";

import { getJson, type Readiness, type RegisteredModel } from "@/lib/api";
import type { View } from "./types";
import { Badge } from "./ui";

const nav = [
  { id: "workbench", href: "/workbench", label: "Workbench", icon: Sparkles },
  { id: "overview", href: "/overview", label: "Overview", icon: Gauge },
  { id: "models", href: "/models", label: "Model registry", icon: Cpu },
  { id: "knowledge", href: "/knowledge", label: "Knowledge base", icon: BookOpen },
  { id: "trace", href: "/trace", label: "Execution trace", icon: Activity },
  { id: "security", href: "/security", label: "Sovereignty", icon: ShieldCheck },
] satisfies { id: View; href: string; label: string; icon: typeof Activity }[];

export function ControlPlane({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const readiness = useQuery({ queryKey: ["readiness"], queryFn: () => getJson<Readiness>("/readiness"), refetchInterval: 30_000 });
  const models = useQuery({ queryKey: ["models"], queryFn: () => getJson<RegisteredModel[]>("/models"), refetchInterval: 30_000 });
  const readyModels = models.data?.filter((model) => model.latest_health?.status === "ready").length ?? 0;
  const current = nav.find((item) => pathname === item.href) ?? nav[0];

  return <div className="shell">
    <aside className={drawer ? "sidebar open" : "sidebar"}>
      <div className="brand"><i><ShieldCheck size={21} /></i><div><b>SOVEREIGN<span>FORGE</span></b><small>LOCAL AI CONTROL PLANE</small></div></div>
      <nav>{nav.map(({ id, href, label, icon: Icon }) => <Link className={pathname === href ? "active" : ""} onClick={() => setDrawer(false)} href={href} key={id}><Icon size={18} />{label}{id === "security" && <em />}</Link>)}</nav>
      <div className="node">
        <div><i className={`dot ${readiness.data?.status === "ok" ? "" : "amber"}`} /><b>Node SF-01</b><small>{readiness.isPending ? "Checking local services…" : readiness.data?.status === "ok" ? "All systems operational" : "Service attention required"}</small></div>
        <label>Ready models <b>{readyModels} / {models.data?.length ?? 0}</b></label>
        <progress value={readyModels} max={Math.max(models.data?.length ?? 1, 1)} />
        <label>Execution mode <b>Local API</b></label><progress value="100" max="100" />
      </div>
    </aside>
    <main>
      <header><button className="menu" aria-label="Toggle navigation" onClick={() => setDrawer(!drawer)}><Menu size={19} /></button><div className="crumb">SovereignForge <ChevronRight size={13} /> <b>{current.label}</b></div><div className="identity"><Badge tone={readiness.data?.status === "ok" ? "green" : "amber"}><LockKeyhole size={12} /> SOVEREIGN MODE</Badge><i>SP</i><span><b>Systems Engineer</b><small>Engineering Unit</small></span><ChevronDown size={14} /></div></header>
      <div className="page">{children}</div>
    </main>
    {drawer && <button className="overlay" aria-label="Close navigation" onClick={() => setDrawer(false)} />}
  </div>;
}
