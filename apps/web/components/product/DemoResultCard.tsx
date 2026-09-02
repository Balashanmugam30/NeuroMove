"use client";

import React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Zap,
  ShieldCheck,
  Cpu,
  BrainCircuit,
  Clock,
  Sparkles,
} from "lucide-react";
import { DemoResult } from "@neuromove/contracts";

interface DemoResultCardProps {
  result: DemoResult;
}

export function DemoResultCard({ result }: DemoResultCardProps) {
  const isPass = result.status === "PASS";
  const isBlocked = result.status === "BLOCKED";

  const getStatusBadge = () => {
    if (isPass) {
      return {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
        pill: "bg-emerald-50 text-emerald-800 border-emerald-300",
        label: "DEMONSTRATION PASSED",
      };
    }
    if (isBlocked) {
      return {
        icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
        pill: "bg-amber-50 text-amber-800 border-amber-300",
        label: "SAFETY INTERLOCKED",
      };
    }
    return {
      icon: <XCircle className="w-4 h-4 text-rose-600" />,
      pill: "bg-rose-50 text-rose-800 border-rose-300",
      label: "DEMONSTRATION FAILED",
    };
  };

  const status = getStatusBadge();

  return (
    <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs font-sans space-y-4">
      {/* Header with Result Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              End-to-End Demonstration Result Summary
            </h3>
            <span className="text-2xs text-slate-500 font-mono">Run ID: {result.run_id}</span>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full border ${status.pill}`}
        >
          {status.icon}
          {status.label}
        </span>
      </div>

      {/* Grid of Key Pillars */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Prediction */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
          <div className="flex items-center gap-1.5 text-2xs text-slate-400 font-mono">
            <BrainCircuit className="w-3.5 h-3.5 text-blue-600" />
            <span>Decoded Intent:</span>
          </div>
          <div className="text-sm font-bold text-slate-900 font-mono">
            {result.candidate_intent}
          </div>
        </div>

        {/* Confidence */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
          <div className="flex items-center gap-1.5 text-2xs text-slate-400 font-mono">
            <Zap className="w-3.5 h-3.5 text-purple-600" />
            <span>Confidence Score:</span>
          </div>
          <div className="text-sm font-bold text-purple-700 font-mono">
            {(result.confidence_score * 100).toFixed(1)}%
          </div>
        </div>

        {/* Safety Verdict */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
          <div className="flex items-center gap-1.5 text-2xs text-slate-400 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Safety Verdict:</span>
          </div>
          <div
            className={`text-sm font-bold font-mono ${
              result.safety_verdict === "AUTHORIZED" ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {result.safety_verdict}
          </div>
        </div>

        {/* HIL Status */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
          <div className="flex items-center gap-1.5 text-2xs text-slate-400 font-mono">
            <Cpu className="w-3.5 h-3.5 text-sky-600" />
            <span>HIL Status:</span>
          </div>
          <div className="text-sm font-bold text-slate-800 font-mono">
            {result.hil_status}
          </div>
        </div>
      </div>

      {/* Human-Readable Narrative Explanation */}
      <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-1">
        <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 font-mono">
          Executive Explanation:
        </span>
        <p className="text-xs text-slate-700 leading-relaxed">
          {result.explanation_text}
        </p>
      </div>

      {/* Latency Breakdown Bar */}
      {result.latency_breakdown && Object.keys(result.latency_breakdown).length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-2xs font-mono text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Stage Latency Profile:
            </span>
            <span className="font-bold text-slate-700">
              Total:{" "}
              {Object.values(result.latency_breakdown)
                .reduce((a, b) => a + b, 0)
                .toFixed(1)}
              ms
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1 text-2xs font-mono">
            {Object.entries(result.latency_breakdown).map(([k, v]) => (
              <div
                key={k}
                className="p-1.5 bg-slate-50 rounded-md border border-slate-100 text-center"
              >
                <div className="text-slate-400 truncate text-3xs uppercase">{k}</div>
                <div className="font-bold text-slate-700">{v.toFixed(1)}ms</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
