"use client";

import React from "react";
import Link from "next/link";
import { useMode } from "@/components/providers/ModeProvider";
import { SectionCard } from "@/components/ui/SectionCard";
import { ModeBadge } from "@/components/ui/ModeBadge";
import {
  Activity,
  ShieldCheck,
  BrainCircuit,
  ArrowRight,
  Radio,
  Cpu,
  Layers,
} from "lucide-react";

export default function HomePage() {
  const { uiIdentity } = useMode();

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Brand Hero */}
      <div className="border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-950 to-slate-900/50 p-8 rounded-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <span className="px-2.5 py-1 rounded border border-blue-800/60 bg-blue-950/40 text-blue-300 font-mono text-xs uppercase tracking-wider">
            Phase 01 Engineering Platform
          </span>
          <ModeBadge mode="SIMULATION" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-mono font-bold tracking-tight text-slate-100">
          NEUROMOVE
        </h1>
        <p className="mt-2 text-lg text-slate-300 font-sans max-w-2xl">
          {uiIdentity === "PRODUCT"
            ? "From neural intent to safe mobility."
            : "Motor-Imagery BCI Pipeline, Real-Time DSP, and Deterministic Safety Arbitration Core."}
        </p>

        <p className="mt-3 text-xs font-mono text-slate-400 max-w-2xl">
          Research-grade, real-time motor-imagery EEG mobility command station.
          Decodes sensorimotor rhythm ($\mu$/$\beta$) Event-Related
          Desynchronization (ERD/ERS) over motor cortex ($C_3, C_z, C_4$).
        </p>

        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            href="/live"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-semibold tracking-wider uppercase transition-all shadow-md shadow-blue-950/50"
          >
            <span>Launch Live Control</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/overview"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-mono text-xs font-semibold tracking-wider uppercase transition-all"
          >
            <span>Platform Overview</span>
          </Link>
        </div>
      </div>

      {/* Core Platform Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <SectionCard
          title="Neural Decoding"
          description="Motor-imagery ERD/ERS feature extraction and classification"
        >
          <div className="space-y-3 mt-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-blue-400" />
              <span>Filter Bank CSP + Regularized LDA</span>
            </div>
            <p>
              Targeting $C_3$, $C_z$, and $C_4$ 10-20 electrode topology for
              left/right hand imagery intent detection.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Safety Arbitration"
          description="Fail-closed deterministic state machine & guardrails"
        >
          <div className="space-y-3 mt-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Multi-Tier Gated Execution</span>
            </div>
            <p>
              Neural confidence verification $\to$ Temporal confirmation $\to$
              Safety arbitration before any actuation command.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Local Control Core"
          description="Air-gapped safety loop independent of cloud latency"
        >
          <div className="space-y-3 mt-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              <span>FastAPI + SQLite + ESP32 Protocol</span>
            </div>
            <p>
              Guaranteed real-time determinism with zero reliance on cloud
              connectivity for physical safety.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
