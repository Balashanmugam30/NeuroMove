"use client";

import React from "react";
import Link from "next/link";
import { useMode } from "@/components/providers/ModeProvider";
import { SectionCard } from "@/components/ui/SectionCard";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { ShieldCheck, BrainCircuit, ArrowRight, Cpu } from "lucide-react";

export default function HomePage() {
  const { uiIdentity } = useMode();

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Brand Hero */}
      <div className="border border-slate-200 bg-white p-8 rounded-2xl shadow-xs transition-all">
        <div className="flex items-center justify-between mb-4">
          <span className="px-3 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700 font-sans text-xs font-semibold uppercase tracking-wide">
            Phase 02 Canonical Platform
          </span>
          <ModeBadge mode="SIMULATION" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 font-sans">
          NeuroMove
        </h1>
        <p className="mt-2 text-lg text-slate-600 font-sans max-w-2xl font-medium">
          {uiIdentity === "PRODUCT"
            ? "From neural intent to safe mobility."
            : "Motor-Imagery BCI Pipeline, Real-Time DSP, and Deterministic Safety Arbitration Core."}
        </p>

        <p className="mt-3 text-xs text-slate-500 max-w-2xl font-normal leading-relaxed">
          Research-grade, real-time motor-imagery EEG mobility command station.
          Decodes sensorimotor rhythm (μ/β) Event-Related Desynchronization
          (ERD/ERS) over motor cortex (C3, Cz, C4).
        </p>

        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            href="/live"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold tracking-wide uppercase transition-all shadow-xs"
          >
            <span>Launch Live Control</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/overview"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold tracking-wide uppercase transition-all shadow-xs"
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
          <div className="space-y-3 mt-2 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-medium text-slate-900">
              <BrainCircuit className="w-4 h-4 text-blue-600" />
              <span>Filter Bank CSP + Regularized LDA</span>
            </div>
            <p className="leading-relaxed">
              Targeting C3, Cz, and C4 10-20 electrode topology for left/right
              hand imagery intent detection.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Safety Arbitration"
          description="Fail-closed deterministic state machine & guardrails"
        >
          <div className="space-y-3 mt-2 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-medium text-slate-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Multi-Tier Gated Execution</span>
            </div>
            <p className="leading-relaxed">
              Neural confidence verification → Temporal confirmation → Safety
              arbitration before any actuation command.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Local Control Core"
          description="Air-gapped safety loop independent of cloud latency"
        >
          <div className="space-y-3 mt-2 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-medium text-slate-900">
              <Cpu className="w-4 h-4 text-teal-600" />
              <span>FastAPI + SQLite + ESP32 Protocol</span>
            </div>
            <p className="leading-relaxed">
              Guaranteed real-time determinism with zero reliance on cloud
              connectivity for physical safety.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
