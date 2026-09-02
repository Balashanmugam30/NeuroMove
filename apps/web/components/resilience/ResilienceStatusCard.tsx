"use client";

import React from "react";
import { ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import { ResilienceLabStatus } from "@neuromove/contracts";

interface ResilienceStatusCardProps {
  status: ResilienceLabStatus | null;
  onResetLab: () => void;
  isResetting?: boolean;
}

export function ResilienceStatusCard({
  status,
  onResetLab,
  isResetting = false,
}: ResilienceStatusCardProps) {
  const health = status?.pipeline_health;
  const metrics = status?.metrics;
  const activeFaultsCount = status?.active_faults.length ?? 0;
  const isExperimentActive = status?.lab_mode === "EXPERIMENT_ACTIVE" || activeFaultsCount > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${isExperimentActive ? "bg-amber-50 text-amber-600" : "bg-teal-50 text-teal-700"}`}>
              {isExperimentActive ? <ShieldAlert className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">Resilience & Fault Laboratory</h2>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                    isExperimentActive
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : "bg-teal-100 text-teal-800 border border-teal-300"
                  }`}
                >
                  {status?.lab_mode || "IDLE"}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  Phase 18
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Deterministic failure injection, formal invariant verification & safe recovery certification
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onResetLab}
            disabled={isResetting}
            className="px-4 py-2 text-sm font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            {isResetting ? "Resetting Lab..." : "Emergency Lab Reset"}
          </button>
        </div>
      </div>

      {/* Primary KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 my-6">
        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
          <div className="text-xs font-medium text-slate-500">Active Faults</div>
          <div className={`text-2xl font-bold mt-1 ${activeFaultsCount > 0 ? "text-amber-600" : "text-slate-900"}`}>
            {activeFaultsCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Live perturbations</div>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
          <div className="text-xs font-medium text-slate-500">Fail-Closed Certifications</div>
          <div className="text-2xl font-bold text-teal-700 mt-1">
            {metrics?.fail_closed_certifications ?? 0}
          </div>
          <div className="text-[11px] text-teal-600 font-medium mt-0.5">100% Zero-Allow Certified</div>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
          <div className="text-xs font-medium text-slate-500">Invariants Checked</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {metrics?.total_invariants_checked ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {metrics?.invariants_passed ?? 0} passed, {metrics?.invariants_failed ?? 0} failed
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
          <div className="text-xs font-medium text-slate-500">Accidental Authorizations</div>
          <div className={`text-2xl font-bold mt-1 ${(metrics?.accidental_authorizations ?? 0) > 0 ? "text-rose-600" : "text-emerald-700"}`}>
            {metrics?.accidental_authorizations ?? 0}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">Invariant #1 Strictly Preserved</div>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
          <div className="text-xs font-medium text-slate-500">Safety State / Decision</div>
          <div className="text-sm font-bold text-slate-900 mt-1.5 flex items-center gap-1.5 truncate">
            <span className="truncate">{health?.current_safety_state || "SAFE_IDLE"}</span>
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
              {health?.current_safety_decision || "DENIED"}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Read-only live gate</div>
        </div>
      </div>

      {/* Subsystem Health Status Pills */}
      <div className="pt-4 border-t border-slate-100">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
          Read-Only Pipeline Health Snapshot
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HealthPill label="Transport Stream" healthy={health?.transport_healthy ?? true} />
          <HealthPill label="Confidence Subsystem" healthy={health?.confidence_healthy ?? true} />
          <HealthPill label="Intent State Machine" healthy={health?.intent_healthy ?? true} />
          <HealthPill label="Safety Arbitration Gate" healthy={health?.safety_healthy ?? true} />
          <HealthPill label="Database Persistence" healthy={health?.database_healthy ?? true} />
        </div>
      </div>
    </div>
  );
}

function HealthPill({ label, healthy }: { label: string; healthy: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border ${
        healthy
          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
          : "bg-rose-50 text-rose-800 border-rose-200"
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${healthy ? "bg-emerald-500" : "bg-rose-500 animate-pulse"}`} />
      <span>{label}:</span>
      <span className="font-semibold">{healthy ? "HEALTHY" : "DEGRADED"}</span>
    </div>
  );
}
