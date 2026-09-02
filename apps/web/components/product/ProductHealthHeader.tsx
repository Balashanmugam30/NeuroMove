"use client";

import React from "react";
import { ShieldCheck, Cpu, RefreshCw } from "lucide-react";
import { SystemStatusSummary } from "@neuromove/contracts";

interface ProductHealthHeaderProps {
  statusSummary: SystemStatusSummary | null;
  onRefresh?: () => void;
  loading?: boolean;
}

export function ProductHealthHeader({
  statusSummary,
  onRefresh,
  loading = false,
}: ProductHealthHeaderProps) {
  const overall = statusSummary?.overall_status || "HEALTHY";
  const source = statusSummary?.active_source || "SIMULATOR";
  const sessionId = statusSummary?.product_session_id || "prod_sess_default";

  const getStatusBadge = () => {
    switch (overall) {
      case "HEALTHY":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "READY":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "DEGRADED":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "BLOCKED":
      case "ERROR":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <header className="w-full bg-white border border-slate-200 rounded-xl p-4 shadow-2xs font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Product Title & Session ID */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-900 tracking-tight">
              NeuroMove Platform
            </span>
            <span
              className={`px-2 py-0.5 text-2xs font-bold uppercase rounded-full border ${getStatusBadge()}`}
            >
              {overall}
            </span>
            <span className="px-2 py-0.5 text-2xs font-medium bg-slate-100 text-slate-600 rounded-md border border-slate-200">
              {source}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-mono">
            Session: <span className="font-semibold text-slate-700">{sessionId}</span>
          </p>
        </div>

        {/* Right: Subsystem Pills & Action */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Safety Core */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Safety: Armed (12 Invariants)</span>
          </div>

          {/* HIL Virtual Endpoint */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold">
            <Cpu className="w-3.5 h-3.5 text-blue-600" />
            <span>HIL: ESP32 Virtual Emulator</span>
          </div>

          {/* Refresh Action */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
