"use client";

import React from "react";
import { ShieldCheck, ShieldAlert, ArrowRight } from "lucide-react";

interface SafetyExplanationCardProps {
  safetyVerdict: string;
  isBlocked?: boolean;
  blockReason?: string | null;
  candidateIntent?: string;
  confidenceScore?: number;
  explanationText?: string;
}

export function SafetyExplanationCard({
  safetyVerdict,
  isBlocked = false,
  blockReason,
  candidateIntent = "REST",
  confidenceScore = 0.0,
  explanationText,
}: SafetyExplanationCardProps) {
  const isAuthorized = safetyVerdict === "AUTHORIZED" && !isBlocked;

  return (
    <div
      className={`p-4 rounded-xl border font-sans space-y-3 transition-all ${
        isAuthorized
          ? "bg-emerald-50/40 border-emerald-200"
          : "bg-amber-50/40 border-amber-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded-lg border ${
              isAuthorized
                ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                : "bg-amber-100 text-amber-700 border-amber-300"
            }`}
          >
            {isAuthorized ? (
              <ShieldCheck className="w-4 h-4" />
            ) : (
              <ShieldAlert className="w-4 h-4" />
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">
              Safety Arbitration & Execution Authorization
            </h4>
            <p className="text-2xs text-slate-500">
              Phase 17 authoritative fail-closed decision gate.
            </p>
          </div>
        </div>

        <span
          className={`px-2.5 py-0.5 text-2xs font-bold rounded-full border ${
            isAuthorized
              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
              : "bg-amber-100 text-amber-800 border-amber-300"
          }`}
        >
          {isAuthorized ? "EXECUTION AUTHORIZED" : "EXECUTION HELD / BLOCKED"}
        </span>
      </div>

      {/* Structured Explanation Flow */}
      <div className="p-3 bg-white rounded-lg border border-slate-200/80 space-y-2">
        <div className="text-xs font-semibold text-slate-800">
          {isAuthorized ? "Execution Flow Trace:" : "Safety Interlock Trace:"}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-2xs font-mono">
          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
            Intent: {candidateIntent}
          </span>
          <ArrowRight className="w-3 h-3 text-slate-400" />
          <span
            className={`px-2 py-0.5 rounded-md border ${
              confidenceScore >= 0.70
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            Confidence: {(confidenceScore * 100).toFixed(1)}%
          </span>
          <ArrowRight className="w-3 h-3 text-slate-400" />
          <span
            className={`px-2 py-0.5 rounded-md border ${
              isAuthorized
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            Safety: {safetyVerdict}
          </span>
          <ArrowRight className="w-3 h-3 text-slate-400" />
          <span
            className={`px-2 py-0.5 rounded-md border ${
              isAuthorized
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : "bg-slate-100 text-slate-500 border-slate-200"
            }`}
          >
            HIL: {isAuthorized ? "ACKNOWLEDGED" : "0 TRANSMISSIONS"}
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed pt-1">
          {explanationText ||
            (isAuthorized
              ? `The candidate intent [${candidateIntent}] satisfied all 12 deterministic safety constraints with ${(confidenceScore * 100).toFixed(1)}% confidence. Execution Authorization was granted and acknowledged by the Phase 20 ESP32 Virtual HIL Emulator.`
              : `Safety Interlock Active: ${blockReason || "Confidence below 0.70 threshold or auxiliary sensor contradiction"}. Zero command frames were framed or transmitted across the transport layer.`)}
        </p>
      </div>
    </div>
  );
}
