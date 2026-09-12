import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SovereignForge",
  description: "Local-first agentic AI workbench",
};

const navigation = [
  ["Dashboard", "/"],
  ["Workbench", "/workbench"],
  ["Knowledge", "/knowledge"],
  ["Models", "/models"],
] as const;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="app-shell">
            <aside className="sidebar">
              <div className="brand-mark">SF</div>
              <div>
                <p className="eyebrow">Local AI operations</p>
                <h1 className="brand">SovereignForge</h1>
              </div>
              <nav aria-label="Primary navigation">
                {navigation.map(([label, href]) => (
                  <Link key={href} href={href} className="nav-link">
                    {label}
                  </Link>
                ))}
              </nav>
              <div className="sovereign-badge">
                <span className="status-dot" /> Sovereign mode
                <small>Local providers only</small>
              </div>
            </aside>
            <main className="main-content">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
