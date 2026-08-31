"use client";

import React from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { History } from "lucide-react";

export default function SessionsPage() {
  const { operatingMode } = useMode();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
            Experiment Sessions & Replay
          </h1>
          <p className="text-xs text-slate-500 font-sans mt-1">
            Historical recording sessions, offline playback, and event sequence
            audit.
          </p>
        </div>
        <ModeBadge mode={operatingMode} />
      </div>

      <SectionCard
        title="Session History"
        description="Persistent trial recordings stored locally in SQLite"
      >
        <EmptyState
          title="Session Container Schema Active"
          description="Canonical Session and Trial contracts defined. Persistence and offline replay will be initialized in calibration and replay phases."
          icon={<History className="w-6 h-6 text-blue-600" />}
        />
      </SectionCard>
    </div>
  );
}
