"use client";

import React from "react";
import { Intent } from "@neuromove/contracts";
import { Brain, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Square, HelpCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface IntentConfidenceCardProps {
  intent: Intent;
  confidence: number;
  cue?: string;
  probabilities?: Record<string, number>;
  uiIdentity?: "PRODUCT" | "RESEARCH";
  className?: string;
}

export function IntentConfidenceCard({
  intent,
  confidence,
  cue = "REST",
  probabilities = {
    RIGHT: intent === "RIGHT" ? 0.92 : 0.04,
    LEFT: intent === "LEFT" ? 0.91 : 0.04,
    NONE: intent === "NONE" ? 0.95 : 0.04,
  },
  uiIdentity = "PRODUCT",
  className,
}: IntentConfidenceCardProps) {
  const getIntentIcon = (i: Intent) => {
    switch (i) {
      case "RIGHT":
        return <ArrowRight className="w-6 h-6 text-blue-600" />;
      case "LEFT":
        return <ArrowLeft className="w-6 h-6 text-teal-600" />;
      case "FORWARD":
        return <ArrowUp className="w-6 h-6 text-emerald-600" />;
      case "BACKWARD":
        return <ArrowDown className="w-6 h-6 text-amber-600" />;
      case "STOP":
        return <Square className="w-6 h-6 text-red-600 fill-current" />;
      case "UNCERTAIN":
        return <HelpCircle className="w-6 h-6 text-amber-500" />;
      case "NONE":
      default:
        return <Brain className="w-6 h-6 text-slate-400" />;
    }
  };

  const confidencePct = Math.min(100, Math.max(0, Math.round(confidence * 100)));
  const isHighConfidence = confidence >= 0.8;
  const isMediumConfidence = confidence >= 0.6 && confidence < 0.8;

  return (
    <div
      data-testid="intent-confidence-card"
      className={cn(
        "p-5 rounded-xl border border-slate-200 bg-white shadow-xs font-sans flex flex-col justify-between transition-all",
        className
      )}
    >
      <div>
        {/* Header Title & Attribution */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Decoded Neural Intent
              </h3>
              <p className="text-2xs text-slate-400 font-normal">
                Sensorimotor rhythm ERD/ERS classifier
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-2xs font-mono font-semibold uppercase bg-slate-100 text-slate-600 border border-slate-200">
            SIMULATED DECODER
          </span>
        </div>

        {/* Primary Decoded Intent Readout */}
        <div className="mt-4 flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              {getIntentIcon(intent)}
            </div>
            <div>
              <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">
                Target Direction
              </span>
              <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {intent}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">
              Active Visual Cue
            </span>
            <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {cue}
            </span>
          </div>
        </div>

        {/* Neural Confidence Meter */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Neural Confidence Gate
            </span>
            <span className="font-mono font-bold text-slate-900">
              {confidencePct}%{" "}
              <span className="text-2xs text-slate-500 font-normal">
                ({confidence.toFixed(2)})
              </span>
            </span>
          </div>

          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/60">
            <div
              className={cn(
                "h-full transition-all duration-300 rounded-full",
                isHighConfidence
                  ? "bg-emerald-500"
                  : isMediumConfidence
                  ? "bg-amber-500"
                  : "bg-red-500"
              )}
              style={{ width: `${confidencePct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-2xs text-slate-400 font-mono">
            <span>Threshold: 70%</span>
            <span>
              {confidence >= 0.7 ? "Gated: CONFIRMED" : "Gated: UNCERTAIN"}
            </span>
          </div>
        </div>

        {/* Class Probabilities Distribution */}
        {uiIdentity === "RESEARCH" && (
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 block">
              Posterior Probability Vector (P(C|x))
            </span>
            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              {Object.entries(probabilities).map(([cls, prob]) => (
                <div
                  key={cls}
                  className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-center"
                >
                  <span className="text-2xs text-slate-500 block">{cls}</span>
                  <span className="font-bold text-slate-900">
                    {(prob * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Scientific Disclaimer Footer */}
      <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-400 font-mono">
        <span>Model: CSP+LDA v1</span>
        <span>Window: 1000ms</span>
      </div>
    </div>
  );
}
