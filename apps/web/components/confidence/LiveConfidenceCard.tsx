"use client";

import React from "react";
import {
  ConfidenceDecision,
  ConfidenceBand,
  ConfidenceEligibility,
  FreshnessStatus,
} from "@neuromove/contracts";
import { CheckCircle2, AlertTriangle, XCircle, Clock, Activity, ShieldAlert, Cpu } from "lucide-react";

interface LiveConfidenceCardProps {
  decision: ConfidenceDecision | null;
  activeModelVersionId?: string;
  signalQuality?: number;
}

export function LiveConfidenceCard({
  decision,
  activeModelVersionId = "v1",
  signalQuality = 0.95,
}: LiveConfidenceCardProps) {
  if (!decision) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col items-center justify-center min-h-[280px] text-center">
        <Activity className="w-10 h-10 text-slate-300 animate-pulse mb-3" />
        <h3 className="text-sm font-semibold text-slate-700">Awaiting Electrophysiological Window</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Confidence estimation engine is listening for real-time model predictions and feature telemetry.
        </p>
      </div>
    );
  }

  const confidencePct = Math.round(decision.calibrated_confidence * 100);
  const rawScorePct = Math.round(decision.raw_score * 100);
  const signalQualityPct = Math.round((decision.signal_quality ?? signalQuality) * 100);

  const getBandBadge = (band: ConfidenceBand) => {
    switch (band) {
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> High Confidence
          </span>
        );
      case "MEDIUM":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Activity className="w-3.5 h-3.5" /> Medium Confidence
          </span>
        );
      case "LOW":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" /> Low Confidence
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <XCircle className="w-3.5 h-3.5" /> Unknown / Gated
          </span>
        );
    }
  };

  const getEligibilityBadge = (eligibility: ConfidenceEligibility) => {
    if (eligibility === "VALID") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          Eligible
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
        <ShieldAlert className="w-3 h-3" /> {eligibility}
      </span>
    );
  };

  const getFreshnessBadge = (freshness: FreshnessStatus) => {
    switch (freshness) {
      case "FRESH":
        return <span className="text-xs font-medium text-emerald-600 flex items-center gap-1"><Clock className="w-3 h-3" /> Fresh (&lt;200ms)</span>;
      case "AGING":
        return <span className="text-xs font-medium text-amber-600 flex items-center gap-1"><Clock className="w-3 h-3" /> Aging (200-400ms)</span>;
      case "STALE":
        return <span className="text-xs font-medium text-rose-600 flex items-center gap-1"><Clock className="w-3 h-3" /> Stale (&gt;400ms)</span>;
      default:
        return <span className="text-xs text-slate-500">Unknown</span>;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Live Prediction Confidence</h3>
            <p className="text-xs text-slate-500">Model version: {decision.model_version_id || activeModelVersionId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getEligibilityBadge(decision.eligibility)}
          {getBandBadge(decision.confidence_band)}
        </div>
      </div>

      {/* Main Score Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Prediction & Confidence Gauge */}
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Prediction</span>
          <div className="my-2">
            <div className="text-xl font-bold text-slate-900">{decision.prediction}</div>
            <div className="text-xs text-slate-500 mt-0.5">Raw Score: {rawScorePct}% ({decision.score_type})</div>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                decision.confidence_band === "HIGH"
                  ? "bg-emerald-500"
                  : decision.confidence_band === "MEDIUM"
                  ? "bg-blue-500"
                  : "bg-amber-500"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, confidencePct))}%` }}
            />
          </div>
        </div>

        {/* Calibrated Confidence Score */}
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Calibrated Confidence</span>
          <div className="my-2">
            <div className="text-3xl font-extrabold text-blue-600 tracking-tight">{confidencePct}%</div>
            <div className="text-xs text-slate-500 mt-0.5">Multi-factor combined</div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Floor: 40%</span>
            <span>Req: 75%</span>
          </div>
        </div>

        {/* Signal Quality & Freshness */}
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Signal & Freshness</span>
          <div className="my-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Quality Index:</span>
              <span className={`font-semibold ${signalQualityPct >= 80 ? "text-emerald-600" : signalQualityPct >= 50 ? "text-blue-600" : "text-rose-600"}`}>
                {signalQualityPct}%
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Data Freshness:</span>
              {getFreshnessBadge(decision.freshness)}
            </div>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Cpu className="w-3 h-3" /> Model Validity: {decision.model_validity}
          </div>
        </div>
      </div>

      {/* Class Margin Context */}
      {decision.runner_up_class && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-blue-50/50 border border-blue-100 text-xs">
          <div className="text-slate-700">
            <span className="font-semibold text-slate-900">Class Separation:</span> Runner-up is <span className="font-medium">{decision.runner_up_class}</span>
          </div>
          <div className="font-semibold text-blue-700">
            Margin: +{(decision.class_margin * 100).toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
}
