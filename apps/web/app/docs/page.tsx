"use client";

import React from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { SectionCard } from "@/components/ui/SectionCard";

export default function DocsPage() {
  const { operatingMode } = useMode();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
            Architecture Documentation
          </h1>
          <p className="text-xs text-slate-500 font-sans mt-1">
            System boundaries, canonical event contracts, domain invariants, and
            safety principles.
          </p>
        </div>
        <ModeBadge mode={operatingMode} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SectionCard
          title="Air-Gapped Safety Loop"
          description="Local machine Control Station boundaries"
        >
          <div className="space-y-2 text-xs text-slate-600 font-sans leading-relaxed">
            <p>
              The physical mobility control loop is completely hosted on the
              local Control Station. Sensorimotor decoding, arbitration, and
              ESP32 dispatch never route through the cloud.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Universal Canonical Event Envelope"
          description="Monotonic sequence and typed payloads"
        >
          <div className="space-y-2 text-xs text-slate-600 font-sans leading-relaxed">
            <p>
              Every event across core streaming, database persistence, and web
              telemetry conforms to the strongly-typed EventEnvelope with
              guaranteed cross-language parity.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
