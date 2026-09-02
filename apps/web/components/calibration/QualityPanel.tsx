"use client";

import React from "react";
import { CalibrationQualitySummary } from "@neuromove/contracts";
import { ShieldAlert, ShieldCheck, CheckCircle2, AlertTriangle, XCircle, Scale } from "lucide-react";


interface QualityPanelProps {
  summary: CalibrationQualitySummary | null;
}

export function QualityPanel({ summary }: QualityPanelProps) {
  if (!summary) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-500">
        Quality control metrics will be computed once calibration trials are recorded.
      </div>
    );
  }

  const validPct = Math.round(summary.valid_ratio * 100);
  const rejectPct = Math.round(summary.rejection_ratio * 100);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
      {/* Sufficiency Banner */}
      <div
        className={`p-4 rounded-xl border flex items-start gap-3 ${
          summary.is_sufficient
            ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
            : "bg-amber-50/70 border-amber-200 text-amber-950"
        }`}
      >
        {summary.is_sufficient ? (
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        ) : (
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        )}
        <div className="space-y-1">
          <div className="text-xs font-bold">
            {summary.is_sufficient
              ? "Data Sufficiency Verified for Subject Personalization"
              : "Data Sufficiency Review Required"}
          </div>
          <p className="text-2xs text-slate-600 font-normal">
            {summary.is_sufficient
              ? "Sufficient valid trials and class balance available to train personalized CSP and motor-imagery decoders."
              : "Quality criteria or minimum class trial quotas not yet satisfied."}
          </p>
          {summary.sufficiency_warnings.length > 0 && (
            <ul className="text-2xs text-amber-800 space-y-0.5 pt-1 list-disc list-inside">
              {summary.sufficiency_warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* QC Summary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
          <div className="text-3xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Trials</div>
          <div className="text-lg font-mono font-bold text-slate-900">{summary.total_trials}</div>
          <div className="text-3xs text-slate-400 mt-0.5">Recorded sequence</div>
        </div>

        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40">
          <div className="text-3xs font-semibold text-emerald-800 uppercase tracking-wider mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Valid Trials
          </div>
          <div className="text-lg font-mono font-bold text-emerald-950">{summary.valid_trials}</div>
          <div className="text-3xs text-emerald-700 mt-0.5">{validPct}% pass rate</div>
        </div>

        <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40">
          <div className="text-3xs font-semibold text-rose-800 uppercase tracking-wider mb-1 flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-600" /> Rejected Trials
          </div>
          <div className="text-lg font-mono font-bold text-rose-950">{summary.rejected_trials}</div>
          <div className="text-3xs text-rose-700 mt-0.5">{rejectPct}% rejection ratio</div>
        </div>

        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40">
          <div className="text-3xs font-semibold text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> Warning Trials
          </div>
          <div className="text-lg font-mono font-bold text-amber-950">{summary.warn_trials}</div>
          <div className="text-3xs text-amber-700 mt-0.5">Low SNR or boundary warnings</div>
        </div>
      </div>

      {/* Class Balance Visualizer */}
      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-900">
          <span className="flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-teal-600" /> Class Balance Distribution (Valid Trials)
          </span>
          <span className="text-slate-500 font-normal text-2xs">Target: 50% / 50%</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(summary.class_balance).map(([cls, pct]) => {
            const isLeft = cls === "LEFT_IMAGERY";
            const pctVal = Math.round(pct * 100);
            return (
              <div key={cls} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">{isLeft ? "Left Hand" : "Right Hand"}</span>
                  <span className="font-mono font-bold text-slate-900">{pctVal}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isLeft ? "bg-blue-600" : "bg-teal-600"}`}
                    style={{ width: `${pctVal}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
