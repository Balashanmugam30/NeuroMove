"use client";

import React from "react";
import { ReproducibilityResult } from "@neuromove/contracts";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";

interface ReproducibilityAuditPanelProps {
  audit: ReproducibilityResult | null | undefined;
  onRunAudit: () => Promise<void>;
  isAuditing?: boolean;
}

export function ReproducibilityAuditPanel({
  audit,
  onRunAudit,
  isAuditing = false,
}: ReproducibilityAuditPanelProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-teal-500/10 text-teal-400 rounded-lg border border-teal-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Reproducibility & Tamper Verification
              {audit && (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                    audit.status === "PASS"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : audit.status === "APPROXIMATE"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  }`}
                >
                  {audit.status === "PASS" && <CheckCircle2 className="w-3 h-3" />}
                  {audit.status === "APPROXIMATE" && <AlertTriangle className="w-3 h-3" />}
                  {audit.status === "FAIL" && <XCircle className="w-3 h-3" />}
                  {audit.status}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Byte-for-byte SHA-256 validation and numerical drift audit across reruns
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRunAudit}
          disabled={isAuditing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? "animate-spin" : ""}`} />
          {isAuditing ? "Auditing Rerun..." : "Audit Reproducibility"}
        </button>
      </div>

      {audit ? (
        <div className="space-y-3">
          {/* Explanation Alert */}
          <div
            className={`p-3 rounded-lg border text-xs font-mono flex items-start gap-2.5 ${
              audit.status === "PASS"
                ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                : audit.status === "APPROXIMATE"
                ? "bg-amber-950/30 border-amber-500/30 text-amber-300"
                : "bg-rose-950/30 border-rose-500/30 text-rose-300"
            }`}
          >
            {audit.status === "FAIL" ? (
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            ) : (
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            )}
            <div>{audit.explanation}</div>
          </div>

          {/* Sub-Checks Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Source Checksum:</span>
              <span className={audit.source_hash_match ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                {audit.source_hash_match ? "MATCH" : "FAIL"}
              </span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Manifest Config:</span>
              <span className={audit.manifest_hash_match ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                {audit.manifest_hash_match ? "MATCH" : "FAIL"}
              </span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Stage Checksums:</span>
              <span className={audit.stage_hashes_match ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                {audit.stage_hashes_match ? "MATCH" : "APPROX"}
              </span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Max Deviation:</span>
              <span className="text-slate-200 font-bold">
                {audit.max_metric_deviation.toFixed(6)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-950 p-6 rounded-lg border border-slate-800 text-center text-xs text-slate-400">
          Click &quot;Audit Reproducibility&quot; to rerun the benchmark against identical parameters and verify exact deterministic outputs.
        </div>
      )}
    </div>
  );
}
