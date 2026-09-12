"use client";

import { useState } from "react";

import { Trace } from "@/components/control-plane/trace-security";

export default function TracePage() {
  const [selectedRun, setSelectedRun] = useState("8D7-204");
  return <Trace selected={selectedRun} setSelected={setSelectedRun} />;
}
