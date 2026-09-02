"use client";

import React from "react";
import { IntentLifecycleState } from "@neuromove/contracts";
import { ArrowRight, ShieldCheck } from "lucide-react";


interface IntentLifecycleTimelineProps {
  currentState: IntentLifecycleState;
}

interface StepMeta {
  state: IntentLifecycleState;
  label: string;
  desc: string;
  order: number;
}

const PRIMARY_STEPS: StepMeta[] = [
  {
    state: "NO_INTENT",
    label: "No Intent",
    desc: "Baseline / Standby",
    order: 0,
  },
  {
    state: "CANDIDATE",
    label: "Candidate",
    desc: "Awaiting Confirmation",
    order: 1,
  },
  {
    state: "CONFIRMED",
    label: "Confirmed",
    desc: "Temporal Acceptance",
    order: 2,
  },
  {
    state: "ACTIVE",
    label: "Active Intent",
    desc: "Canonical Intent",
    order: 3,
  },
  {
    state: "COMPLETED",
    label: "Completed",
    desc: "Lifecycle Finished",
    order: 4,
  },
];

export function IntentLifecycleTimeline({ currentState }: IntentLifecycleTimelineProps) {
  const isTerminal = ["COMPLETED", "CANCELLED", "EXPIRED", "INTERRUPTED"].includes(currentState);

  const getCurrentStepIndex = () => {
    switch (currentState) {
      case "NO_INTENT":
        return 0;
      case "CANDIDATE":
        return 1;
      case "CONFIRMED":
        return 2;
      case "ACTIVE":
      case "REPLACEMENT_PENDING":
        return 3;
      case "COMPLETED":
        return 4;
      case "CANCELLED":
      case "EXPIRED":
      case "INTERRUPTED":
        return 4;
      default:
        return 0;
    }
  };

  const activeIndex = getCurrentStepIndex();

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Canonical Lifecycle Timeline</h3>
            <p className="text-xs text-slate-500">Deterministic progression through finite intent states</p>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Current State: <span className="font-bold text-slate-900">{currentState}</span>
        </div>
      </div>

      {/* Stepper Flow */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
        {PRIMARY_STEPS.map((step, idx) => {
          const isCurrent = (step.state === currentState) || (step.order === 4 && isTerminal);
          const isPassed = step.order < activeIndex;

          return (
            <div
              key={step.state}
              className={`relative p-3.5 rounded-lg border text-xs flex flex-col justify-between transition-all ${
                isCurrent
                  ? currentState === "ACTIVE"
                    ? "border-emerald-500 bg-emerald-50/40 shadow-sm"
                    : isTerminal && currentState !== "COMPLETED"
                    ? "border-rose-400 bg-rose-50/30 shadow-sm"
                    : "border-blue-500 bg-blue-50/40 shadow-sm"
                  : isPassed
                  ? "border-slate-200 bg-slate-50/70 text-slate-600"
                  : "border-slate-100 bg-slate-50/30 text-slate-400"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isCurrent
                        ? currentState === "ACTIVE"
                          ? "bg-emerald-600 text-white"
                          : isTerminal && currentState !== "COMPLETED"
                          ? "bg-rose-600 text-white"
                          : "bg-blue-600 text-white"
                        : isPassed
                        ? "bg-slate-300 text-slate-700"
                        : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    {step.order + 1}
                  </span>
                  {idx < PRIMARY_STEPS.length - 1 && (
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 hidden sm:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full" />
                  )}
                </div>

                <div className="font-semibold text-slate-900 pt-1">
                  {step.order === 4 && isTerminal && currentState !== "COMPLETED"
                    ? currentState
                    : step.label}
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">{step.desc}</p>
              </div>

              {isCurrent && (
                <div className="pt-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      currentState === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-800"
                        : isTerminal && currentState !== "COMPLETED"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    Current Position
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
