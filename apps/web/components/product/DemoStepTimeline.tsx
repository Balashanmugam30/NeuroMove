"use client";

import React from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Play,
} from "lucide-react";
import { DemoStep } from "@neuromove/contracts";

interface DemoStepTimelineProps {
  steps: DemoStep[];
  currentStep: number;
  isBlocked?: boolean;
}

export function DemoStepTimeline({
  steps,
  currentStep,
  isBlocked = false,
}: DemoStepTimelineProps) {
  const getStepStatusBadge = (status: string, index: number) => {
    if (status === "COMPLETED") {
      return {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
        ring: "border-emerald-500 bg-emerald-50 text-emerald-800",
        pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    }
    if (status === "BLOCKED") {
      return {
        icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
        ring: "border-amber-500 bg-amber-50 text-amber-800",
        pill: "bg-amber-50 text-amber-700 border-amber-200",
      };
    }
    if (status === "FAILED") {
      return {
        icon: <XCircle className="w-4 h-4 text-rose-600" />,
        ring: "border-rose-500 bg-rose-50 text-rose-800",
        pill: "bg-rose-50 text-rose-700 border-rose-200",
      };
    }
    if (index === currentStep) {
      return {
        icon: <Play className="w-3.5 h-3.5 text-blue-600 animate-pulse" />,
        ring: "border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-200",
        pill: "bg-blue-50 text-blue-700 border-blue-200",
      };
    }
    return {
      icon: <Clock className="w-3.5 h-3.5 text-slate-400" />,
      ring: "border-slate-300 bg-slate-50 text-slate-500",
      pill: "bg-slate-50 text-slate-500 border-slate-200",
    };
  };

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs font-sans space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            9-Stage Guided Demonstration Timeline
          </h3>
          <p className="text-xs text-slate-500">
            Real-time step progression with evidence validation and safety gating.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-600">
            Step <strong className="text-slate-900">{Math.min(currentStep, 9)}</strong> of 9
          </span>
          {isBlocked && (
            <span className="px-2 py-0.5 text-2xs font-bold bg-amber-100 text-amber-800 rounded-md">
              Safety Held
            </span>
          )}
        </div>
      </div>

      {/* Vertical Steps List */}
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const stepNum = idx + 1;
          const badge = getStepStatusBadge(step.status, stepNum);
          const isCurrent = stepNum === currentStep;

          return (
            <div
              key={step.step_key}
              className={`p-3 rounded-lg border transition-all ${
                isCurrent
                  ? "bg-blue-50/50 border-blue-200 shadow-2xs"
                  : step.status === "COMPLETED"
                  ? "bg-slate-50/50 border-slate-200"
                  : step.status === "BLOCKED"
                  ? "bg-amber-50/40 border-amber-200"
                  : "bg-white border-slate-100 opacity-80"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center border text-xs font-bold shrink-0 ${badge.ring}`}
                  >
                    {stepNum}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {step.title}
                      </span>
                      <span className="text-2xs font-mono text-slate-400 uppercase">
                        [{step.stage}]
                      </span>
                    </div>
                    <p className="text-2xs text-slate-600 leading-relaxed">
                      {step.explanation || step.description}
                    </p>

                    {/* Step Metrics */}
                    {step.metrics && Object.keys(step.metrics).length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {Object.entries(step.metrics).map(([k, v]) => (
                          <span
                            key={k}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-2xs font-mono text-slate-600"
                          >
                            <span className="text-slate-400 capitalize">{k.replace(/_/g, " ")}:</span>
                            <strong className="text-slate-800">{String(v)}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Pill */}
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold border shrink-0 ${badge.pill}`}
                >
                  {badge.icon}
                  {step.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
