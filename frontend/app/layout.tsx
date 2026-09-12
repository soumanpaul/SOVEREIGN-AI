import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ControlPlane } from "@/components/control-plane/control-plane";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SovereignForge · Local AI Control Plane",
  description: "Sovereign on-premise agentic AI workbench for confidential industrial work.",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body><Providers><ControlPlane>{children}</ControlPlane></Providers></body></html>;
}
