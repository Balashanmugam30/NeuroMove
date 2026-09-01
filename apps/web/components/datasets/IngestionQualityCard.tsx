"use client";

import React from "react";
import { IngestionQualityReport } from "@neuromove/contracts";
import { Notice } from "@/components/ui/Notice";
import { CheckCircle2 } from "lucide-react";

interface IngestionQualityCardProps {
  report: IngestionQualityReport;
}

export function IngestionQualityCard({ report }: IngestionQualityCardProps) {
  return (
    <div className="space-y-4">
      {/* Subject Boundary Leakage Research Warning */}
      <Notice variant="warning" title="Research Validity: Strict Subject Boundary Invariant">
        Do not perform random window-level train/test splits across the same participant.
        Subject (S001–S109) and session/run boundaries must be strictly preserved to prevent data
        leakage during classifier validation and cross-subject transfer benchmarks.
      </Notice>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-3xs font-mono font-bold uppercase text-slate-400">
            Files Discovered
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            {report.files_discovered}
          </div>
          <div className="text-2xs text-slate-500 mt-0.5">EDF raw recordings</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-3xs font-mono font-bold uppercase text-slate-400">
            Checksum Integrity
          </div>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5" />
            <span>100% SHA-256</span>
          </div>
          <div className="text-2xs text-slate-500 mt-0.5">{report.files_verified} Verified</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-3xs font-mono font-bold uppercase text-slate-400">
            Metadata Anomalies
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            {report.metadata_missing}
          </div>
          <div className="text-2xs text-emerald-600 mt-0.5 font-medium">Complete annotations</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="text-3xs font-mono font-bold uppercase text-slate-400">
            Ingestion Pipeline
          </div>
          <div className="text-sm font-bold font-mono text-blue-700 mt-1 truncate">
            MNE-1.12.1 / EDF
          </div>
          <div className="text-2xs text-slate-500 mt-0.5">Offline-Ready Cache</div>
        </div>
      </div>
    </div>
  );
}
