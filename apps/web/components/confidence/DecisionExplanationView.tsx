"use client";

import React, { useState } from "react";
import {
  ConfidenceDecision,
  Phase16IntentHandoffPayload,
} from "@neuromove/contracts";
import {
  Info,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Send,
  Layers,
} from "lucide-react";


interface DecisionExplanationViewProps {
  decision: ConfidenceDecision | null;
  handoffPayload?: Phase16IntentHandoffPayload | null;
}

export function DecisionExplanationView({
  decision,
  handoffPayload,
}: DecisionExplanationViewProps) {
  const [showHandoffJson, setShowHandoffJson] = useState(false);

  if (!decision) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-xs text-slate-500">
        No decision evaluated yet.
      </div>
    );
  }

  const c = decision.components;
  const factors = [
    {
      name: "Model Calibrated Score",
      symbol: "c_score",
      value: c.model_score_component,
      desc: "Platt/Isotonic/Sigmoid probability mapping",
      status: c.model_score_component >= 0.75 ? "good" : c.model_score_component >= 0.5 ? "warn" : "bad",
    },
    {
      name: "Class Margin Separation",
      symbol: "c_margin",
      value: c.class_margin_component,
      desc: "Separation between top prediction and runner-up",
      status: c.class_margin_component >= 0.4 ? "good" : "warn",
    },
    {
      name: "Electrophysiological Quality",
      symbol: "c_quality",
      value: c.signal_quality_component,
      desc: "Electrode impedance and artifact rejection",
      status: c.signal_quality_component >= 0.7 ? "good" : c.signal_quality_component >= 0.5 ? "warn" : "bad",
    },
    {
      name: "Data Freshness Factor",
      symbol: "c_freshness",
      value: c.freshness_component,
      desc: "Latency gate vs max allowable age (400ms)",
      status: c.freshness_component >= 0.8 ? "good" : c.freshness_component > 0 ? "warn" : "bad",
    },
    {
      name: "Model Operational Validity",
      symbol: "c_validity",
      value: c.model_validity_component,
      desc: "Version active, not rolled back, feature compatible",
      status: c.model_validity_component === 1.0 ? "good" : "bad",
    },
    {
      name: "Calibration Confidence Factor",
      symbol: "c_calibration",
      value: c.calibration_component,
      desc: "Fitted checkpoint zero-leakage confidence weighting",
      status: c.calibration_component >= 0.8 ? "good" : "warn",
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Decision Audit & Factor Decomposition</h3>
            <p className="text-xs text-slate-500">Six-factor multi-component breakdown and diagnostic reasoning</p>
          </div>
        </div>
        <div className="text-xs font-mono text-slate-400">
          ID: {decision.decision_id}
        </div>
      </div>

      {/* Narrative Explanation Box */}
      <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <div className="font-semibold text-slate-900">Diagnostic Decision Text</div>
          <div className="text-slate-700 leading-relaxed font-mono">
            {decision.decision_reason}
          </div>
        </div>
      </div>

      {/* Factor Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {factors.map((f, i) => (
          <div
            key={i}
            className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors flex flex-col justify-between space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">{f.name}</span>
              <span className="text-[11px] font-mono text-slate-400">({f.symbol})</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900">{(f.value * 100).toFixed(1)}%</span>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                  f.status === "good"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : f.status === "warn"
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {f.status.toUpperCase()}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Phase 16 Intent State Machine Handoff Contract */}
      {handoffPayload && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-900">
              <Send className="w-3.5 h-3.5 text-indigo-600" />
              Phase 16 Intent State Machine Handoff Payload
            </div>
            <button
              onClick={() => setShowHandoffJson(!showHandoffJson)}
              className="text-xs text-indigo-700 hover:text-indigo-900 font-medium flex items-center gap-1"
            >
              {showHandoffJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showHandoffJson ? "Hide Contract" : "View Contract"}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2 rounded bg-white border border-indigo-100">
              <div className="text-[10px] text-slate-400 font-medium">PREDICTION</div>
              <div className="font-bold text-slate-900">{handoffPayload.prediction}</div>
            </div>
            <div className="p-2 rounded bg-white border border-indigo-100">
              <div className="text-[10px] text-slate-400 font-medium">CONFIDENCE</div>
              <div className="font-bold text-blue-600">{(handoffPayload.confidence * 100).toFixed(1)}%</div>
            </div>
            <div className="p-2 rounded bg-white border border-indigo-100">
              <div className="text-[10px] text-slate-400 font-medium">TEMPORAL STATUS</div>
              <div className="font-bold text-teal-600">{handoffPayload.temporal_status}</div>
            </div>
            <div className="p-2 rounded bg-white border border-indigo-100">
              <div className="text-[10px] text-slate-400 font-medium">CONFIRMED</div>
              <div className="font-bold text-slate-900">
                {handoffPayload.temporally_confirmed ? (
                  <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> TRUE</span>
                ) : (
                  <span className="text-slate-400">FALSE</span>
                )}
              </div>
            </div>
          </div>

          {showHandoffJson && (
            <div className="mt-3 p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto">
              <pre>{JSON.stringify(handoffPayload, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
