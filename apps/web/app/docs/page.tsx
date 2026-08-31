"use client";

import React from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { InsightCard } from "@/components/ui/InsightCard";
import { BookOpen, ShieldCheck, Code2, Network } from "lucide-react";

export default function DocsPage() {
  const { operatingMode } = useMode();

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        category="System"
        title="Architecture & System Documentation"
        description="System boundaries, canonical event contracts, domain invariants, and air-gapped safety principles."
        mode={operatingMode}
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Architecture Invariants"
          value="6 Invariants"
          subtitle="Strict runtime enforcement"
          variant="brand"
          icon={<ShieldCheck className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          title="Cross-Language Parity"
          value="100% Typed"
          subtitle="TypeScript + Pydantic v2"
          icon={<Code2 className="w-4 h-4 text-teal-600" />}
        />
        <MetricCard
          title="Transport Protocol"
          value="WebSocket v1"
          subtitle="JSON envelopes + backpressure"
          variant="safe"
          icon={<Network className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          title="Security Boundary"
          value="Air-Gapped"
          subtitle="Local localhost:8000 only"
          variant="accent"
          source="SYSTEM SECURITY"
        />
      </div>

      {/* Core Architectural Principles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SectionCard
          title="1. Air-Gapped Local Safety Loop"
          description="Local machine Control Station physical boundaries"
        >
          <div className="space-y-2 text-xs text-slate-600 font-sans leading-relaxed">
            <p>
              The physical mobility control loop is completely hosted on the local Control Station. Sensorimotor decoding, safety state arbitration, and serial ESP32 dispatch execute strictly on <code className="text-code">127.0.0.1:8000</code>.
            </p>
            <p>
              No safety-critical decision is ever delegated to external cloud services or network APIs.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="2. Universal Canonical Event Envelope"
          description="Monotonically sequenced, typed telemetry contracts"
        >
          <div className="space-y-2 text-xs text-slate-600 font-sans leading-relaxed">
            <p>
              Every event across core streaming, database persistence, and web telemetry conforms to the strongly-typed <code className="text-code">EventEnvelope&lt;T&gt;</code> schema with guaranteed bit-level parity between TypeScript and Python.
            </p>
            <p>
              Includes correlation IDs, UTC microsecond timestamps, and strict sequence numbering.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="3. Fail-Closed Safety State Machine"
          description="Deterministic transitions with mandatory confirmation"
        >
          <div className="space-y-2 text-xs text-slate-600 font-sans leading-relaxed">
            <p>
              The safety engine initializes in <code className="text-code">IDLE</code> and transitions through <code className="text-code">READY &rarr; CANDIDATE &rarr; CONFIRMED &rarr; EXECUTING</code> only when multi-tier Bayesian posterior confidence and proximity sensor criteria are satisfied.
            </p>
            <p>
              Any violation instantly defaults to safe stop (<code className="text-code">EMERGENCY</code>).
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="4. Real-Time Telemetry & Backpressure"
          description="Ring-buffered queues with bounded frontend memory"
        >
          <div className="space-y-2 text-xs text-slate-600 font-sans leading-relaxed">
            <p>
              High-frequency electrophysiology data (250 Hz) is dispatched over dedicated WebSocket channels (<code className="text-code">/ws/eeg</code>) with ring buffers.
            </p>
            <p>
              Control state broadcasts use latest-value caching to eliminate memory bloat and UI thrashing.
            </p>
          </div>
        </SectionCard>
      </div>

      <InsightCard
        title="Protocol Specification Reference"
        variant="brand"
        icon={<BookOpen className="w-5 h-5 text-blue-600" />}
      >
        Complete architectural specification files are maintained in the repository under <code className="text-code">docs/architecture/</code>.
      </InsightCard>
    </div>
  );
}
