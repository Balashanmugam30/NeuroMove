"use client";

import React from "react";
import Link from "next/link";
import { useMode } from "@/components/providers/ModeProvider";
import { SectionCard } from "@/components/ui/SectionCard";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { RealtimeStatusBadge } from "@/components/ui/RealtimeStatusBadge";
import { InsightCard } from "@/components/ui/InsightCard";
import { Button } from "@/components/ui/Button";
import {
  ShieldCheck,
  BrainCircuit,
  ArrowRight,
  Cpu,
  Waves,
  Bot,
  Activity,
  Sparkles,
} from "lucide-react";

export default function HomePage() {
  const { uiIdentity, operatingMode } = useMode();

  return (
    <div className="space-y-8 max-w-6xl font-sans">
      {/* Brand Hero Banner */}
      <div className="border border-slate-200 bg-white p-6 sm:p-8 rounded-2xl shadow-xs transition-all">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-2xs font-bold uppercase tracking-wider">
              Research Platform v0.1.0
            </span>
            <ModeBadge mode={operatingMode} size="sm" />
          </div>
          <RealtimeStatusBadge />
        </div>

        <div className="max-w-3xl">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 font-sans">
            NeuroMove
          </h1>
          <p className="mt-2 text-base sm:text-lg text-slate-700 font-medium leading-normal">
            {uiIdentity === "PRODUCT"
              ? "From neural intent to safe mobility — research-grade Brain-Computer Interface platform."
              : "Sensorimotor Rhythm (μ/β Band) DSP Pipeline, Event-Related Desynchronization (ERD/ERS), and Local Fail-Closed Safety Arbitration."}
          </p>
          <p className="mt-3 text-xs text-slate-500 font-normal leading-relaxed">
            Real-time motor-imagery EEG platform designed for assistive robotics. Features 250 Hz continuous signal decoding over motor cortex (C3, Cz, C4), sub-2ms local transport IPC, and an air-gapped safety arbitration loop.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/live">
            <Button variant="primary" size="md" icon={<ArrowRight className="w-4 h-4" />}>
              Launch Live Control Station
            </Button>
          </Link>
          <Link href="/eeg">
            <Button variant="outline" size="md" icon={<Waves className="w-4 h-4 text-blue-600" />}>
              Electrophysiology Lab
            </Button>
          </Link>
          <Link href="/overview">
            <Button variant="secondary" size="md">
              Platform Architecture
            </Button>
          </Link>
        </div>
      </div>

      {/* Product vs Research Callout */}
      {uiIdentity === "RESEARCH" ? (
        <InsightCard
          title="Electrophysiological Pipeline Parameters"
          variant="accent"
          icon={<BrainCircuit className="w-5 h-5 text-teal-600" />}
        >
          Sampling rate: <strong>250 Hz</strong> | Bandpass: <strong>8.0–30.0 Hz Butterworth (4th Order)</strong> | Spatial Filter: <strong>Common Average Reference (CAR)</strong> | Feature Extraction: <strong>Common Spatial Pattern (CSP) 6 Filters</strong> | Classifier: <strong>Shrinkage Regularized Linear Discriminant Analysis (LDA)</strong>.
        </InsightCard>
      ) : (
        <InsightCard
          title="Assistive Mobility System Highlights"
          variant="brand"
          icon={<Sparkles className="w-5 h-5 text-blue-600" />}
        >
          NeuroMove translates intended directional motor imagery into robotic wheelchair commands with multi-tier temporal validation and proximity-based collision avoidance.
        </InsightCard>
      )}

      {/* Core Architectural Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <SectionCard
          title="Neural Decoding"
          description="Motor-imagery ERD/ERS feature extraction and classification"
        >
          <div className="space-y-3 mt-1 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <BrainCircuit className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Filter Bank CSP + Regularized LDA</span>
            </div>
            <p className="leading-relaxed text-2xs text-slate-500">
              Targets C3, Cz, and C4 10-20 electrode topology for left/right hand imagery intent detection with Bayes posterior gating.
            </p>
            <Link
              href="/models"
              className="inline-flex items-center gap-1 text-2xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <span>Explore AI Model Artifacts</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </SectionCard>

        <SectionCard
          title="Safety Arbitration"
          description="Fail-closed deterministic state machine & guardrails"
        >
          <div className="space-y-3 mt-1 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Multi-Tier Gated Execution</span>
            </div>
            <p className="leading-relaxed text-2xs text-slate-500">
              Neural confidence verification → Temporal confirmation → Proximity arbitration before dispatching any motor actuation.
            </p>
            <Link
              href="/safety"
              className="inline-flex items-center gap-1 text-2xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              <span>Inspect Transition Matrix</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </SectionCard>

        <SectionCard
          title="Local Control Core"
          description="Air-gapped safety loop independent of cloud latency"
        >
          <div className="space-y-3 mt-1 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Cpu className="w-4 h-4 text-teal-600 shrink-0" />
              <span>FastAPI + SQLite + ESP32 Protocol</span>
            </div>
            <p className="leading-relaxed text-2xs text-slate-500">
              Sub-2ms local loopback IPC with guaranteed physical safety, independent of external internet connectivity.
            </p>
            <Link
              href="/system"
              className="inline-flex items-center gap-1 text-2xs font-semibold text-teal-600 hover:text-teal-700"
            >
              <span>View System Diagnostics</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </SectionCard>
      </div>

      {/* Quick Route Grid */}
      <div className="border border-slate-200 bg-slate-50/70 p-5 rounded-xl space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Core Workspaces & Subsystems
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Link
            href="/live"
            className="p-3 rounded-lg bg-white border border-slate-200 hover:border-blue-300 hover:shadow-2xs transition-all flex items-center gap-2.5"
          >
            <Activity className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-slate-800">Live Control</span>
          </Link>
          <Link
            href="/eeg"
            className="p-3 rounded-lg bg-white border border-slate-200 hover:border-teal-300 hover:shadow-2xs transition-all flex items-center gap-2.5"
          >
            <Waves className="w-4 h-4 text-teal-600" />
            <span className="font-semibold text-slate-800">EEG Lab</span>
          </Link>
          <Link
            href="/robot"
            className="p-3 rounded-lg bg-white border border-slate-200 hover:border-slate-400 hover:shadow-2xs transition-all flex items-center gap-2.5"
          >
            <Bot className="w-4 h-4 text-slate-700" />
            <span className="font-semibold text-slate-800">Robot Mobility</span>
          </Link>
          <Link
            href="/safety"
            className="p-3 rounded-lg bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-2xs transition-all flex items-center gap-2.5"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-slate-800">Safety Engine</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
