"use client";

import React from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { History, FileArchive } from "lucide-react";

export default function SessionsPage() {
  const { operatingMode } = useMode();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 rounded-lg border border-slate-800 bg-slate-900/40 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-mono font-bold uppercase tracking-wider text-slate-100">
            Session History & Replay Archives
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Recorded experimental trial datasets, replay sessions, and canonical
            event envelope logs.
          </p>
        </div>
        <ModeBadge mode={operatingMode} />
      </div>

      <SectionCard
        title="Recorded Session Manifest"
        description="Search and replay historical GDF / SQLite experiment logs"
      >
        <EmptyState
          title="No Recorded Sessions in Storage"
          description="Local SQLite database initialized for Phase 01. Session recordings will accumulate starting in Phase 02."
          icon={<History className="w-6 h-6 text-blue-400" />}
        />
      </SectionCard>
    </div>
  );
}
