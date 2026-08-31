"use client";

import React from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { Terminal, ShieldAlert, Cpu, BookOpen } from "lucide-react";

export default function DocsPage() {
  const { operatingMode } = useMode();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 rounded-lg border border-slate-800 bg-slate-900/40 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-mono font-bold uppercase tracking-wider text-slate-100">
            System & Architecture Documentation
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Engineering boundaries, safety guardrails, and Canonical Event Model
            specifications.
          </p>
        </div>
        <ModeBadge mode={operatingMode} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SectionCard
          title="Runtime Boundaries"
          description="Local Control Station vs Public Web Platform"
        >
          <div className="space-y-3 text-xs text-slate-300 font-mono">
            <p>
              <strong>Local Safety Loop:</strong> Acquisition, DSP, ML
              inference, and physical safety arbitration execute strictly on the
              local machine with zero cloud dependencies.
            </p>
            <p>
              <strong>Web Platform:</strong> Next.js dashboard communicates with
              local FastAPI core over localhost HTTP/WebSocket for telemetry
              observation and session control.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Development Principles"
          description="Research integrity and deterministic safety"
        >
          <div className="space-y-3 text-xs text-slate-300 font-mono">
            <p>
              <strong>1. Safety First:</strong> Fail-closed state machines where
              no motor movement is possible without explicit, confirmed, and
              approved intent.
            </p>
            <p>
              <strong>2. Scientific Integrity:</strong> Decodes sensorimotor
              rhythm modulation ($C_3, C_z, C_4$); never fabricates measurements
              or claims thought-reading.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
