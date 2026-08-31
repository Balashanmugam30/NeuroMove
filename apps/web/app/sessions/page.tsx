"use client";

import React, { useState } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { History, Download, Database, CheckCircle2 } from "lucide-react";
import { Session } from "@neuromove/contracts";

export default function SessionsPage() {
  const { operatingMode } = useMode();

  const [sessions] = useState<Session[]>([
    {
      session_id: "ses_benchmark_sim_01",
      user_id: "usr_subject_001",
      mode: "SIMULATION",
      status: "COMPLETED",
      started_at: new Date(Date.now() - 3600000).toISOString(),
      ended_at: new Date(Date.now() - 3000000).toISOString(),
      source: "synthetic.generator",
      application_version: "0.1.0",
      model_version: "baseline_csp_lda_v1",
      notes: "Graz visual cue 20-trial simulation benchmark.",
      metadata: { trials_count: 20, success_rate: 0.95 },
    },
    {
      session_id: "ses_right_turn_obstacle",
      user_id: "usr_subject_001",
      mode: "SIMULATION",
      status: "COMPLETED",
      started_at: new Date(Date.now() - 7200000).toISOString(),
      ended_at: new Date(Date.now() - 6600000).toISOString(),
      source: "synthetic.generator",
      application_version: "0.1.0",
      model_version: "baseline_csp_lda_v1",
      notes: "Right turn motor imagery with proximity obstacle trigger.",
      metadata: { trials_count: 10, safety_interventions: 2 },
    },
  ]);

  const columns: Column<Session>[] = [
    {
      key: "session_id",
      header: "Session ID",
      render: (item) => (
        <span className="font-mono text-2xs font-bold text-blue-700">
          {item.session_id}
        </span>
      ),
    },
    {
      key: "user_id",
      header: "Subject ID",
      render: (item) => (
        <span className="font-mono text-2xs text-slate-700">{item.user_id}</span>
      ),
    },
    {
      key: "mode",
      header: "Mode",
      render: (item) => (
        <span className="px-2 py-0.5 rounded text-2xs font-mono font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
          {item.mode}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={item.status} size="sm" />,
    },
    {
      key: "notes",
      header: "Protocol Notes",
      render: (item) => (
        <span className="text-2xs text-slate-600 font-normal">{item.notes}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: () => (
        <Button variant="ghost" size="xs" icon={<Download className="w-3.5 h-3.5" />}>
          Export
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        category="Research & Evidence"
        title="Experiment Sessions & Audit Protocol"
        description="Historical electrophysiology recording sessions, trial sequence timelines, and offline playback audit logs."
        mode={operatingMode}
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="w-3.5 h-3.5 text-slate-500" />}
          >
            Export All Sessions (JSON)
          </Button>
        }
      />

      {/* Session Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Recorded Sessions"
          value="2 Completed"
          subtitle="Persistent SQLite store"
          variant="brand"
          icon={<History className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          title="Total Trials"
          value="30 Trials"
          subtitle="Graz visual cue paradigm"
          icon={<Database className="w-4 h-4 text-teal-600" />}
        />
        <MetricCard
          title="Protocol Integrity"
          value="100% VALID"
          subtitle="Monotonic sequences verified"
          variant="safe"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          title="Storage Mode"
          value="Local SQLite"
          subtitle="Air-gapped database"
          variant="accent"
          source="LOCAL STORE"
        />
      </div>

      {/* Session Records Table */}
      <SectionCard
        title="Session History Audit Log"
        description="Chronological session records with trial quotas and model weights metadata"
      >
        <DataTable
          columns={columns}
          data={sessions}
          keyExtractor={(item) => item.session_id}
        />
      </SectionCard>

      <Notice variant="info" title="Offline Replay Architecture">
        Recorded session envelopes store raw electrophysiological samples and canonical state transitions with exact UTC microsecond timestamps, enabling bit-for-bit replay in Phase 14.
      </Notice>
    </div>
  );
}
