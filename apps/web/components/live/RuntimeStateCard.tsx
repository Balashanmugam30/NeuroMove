"use client";

import React from "react";
import { RuntimeState } from "@neuromove/contracts";
import { Activity, Clock, AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";

interface RuntimeStateCardProps {
  state: RuntimeState;
  elapsedSeconds?: number;
  activeFaults?: string[];
  className?: string;
}

export function RuntimeStateCard({
  state,
  elapsedSeconds = 0,
  activeFaults = [],
  className,
}: RuntimeStateCardProps) {
  const stateSteps: { label: RuntimeState; title: string }[] = [
    { label: "IDLE", title: "Idle Rest" },
    { label: "READY", title: "Armed" },
    { label: "CANDIDATE", title: "Cue Detected" },
    { label: "CONFIRMED", title: "Temporal Gate" },
    { label: "EXECUTING", title: "Active Drive" },
  ];

  const getStateBadge = (s: RuntimeState) => {
    switch (s) {
      case "EXECUTING":
        return {
          bg: "bg-blue-50 text-blue-700 border-blue-200",
          text: "EXECUTING",
          color: "text-blue-600",
        };
      case "CONFIRMED":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          text: "CONFIRMED",
          color: "text-emerald-600",
        };
      case "EMERGENCY":
        return {
          bg: "bg-red-100 text-red-800 border-red-300",
          text: "EMERGENCY STOP",
          color: "text-red-600",
        };
      case "BLOCKED":
        return {
          bg: "bg-amber-50 text-amber-700 border-amber-200",
          text: "BLOCKED",
          color: "text-amber-600",
        };
      case "FAULT":
        return {
          bg: "bg-red-50 text-red-700 border-red-200",
          text: "SYSTEM FAULT",
          color: "text-red-600",
        };
      case "IDLE":
      default:
        return {
          bg: "bg-slate-100 text-slate-700 border-slate-200",
          text: s,
          color: "text-slate-600",
        };
    }
  };

  const badge = getStateBadge(state);

  return (
    <div
      data-testid="runtime-state-card"
      className={cn(
        "p-5 rounded-xl border border-slate-200 bg-white shadow-xs font-sans flex flex-col justify-between transition-all",
        className
      )}
    >
      <div>
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Temporal Runtime Engine
              </h3>
              <p className="text-2xs text-slate-400 font-normal">
                Deterministic finite-state automaton
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-2xs font-mono font-semibold uppercase bg-slate-100 text-slate-600 border border-slate-200">
            FSM ENGINE
          </span>
        </div>

        {/* Primary State Display */}
        <div className="mt-4 flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <Activity className={cn("w-6 h-6", badge.color)} />
            </div>
            <div>
              <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">
                Current FSM State
              </span>
              <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {badge.text}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">
              Dwell Time
            </span>
            <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
              <Clock className="w-3 h-3 text-slate-400" />
              {elapsedSeconds.toFixed(1)}s
            </span>
          </div>
        </div>

        {/* Active Fault Alerts */}
        {activeFaults.length > 0 && (
          <div className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700 font-medium">
            <AlertOctagon className="w-4 h-4 shrink-0" />
            <span>Active Faults: {activeFaults.join(", ")}</span>
          </div>
        )}

        {/* State Machine Transition Flow */}
        <div className="mt-4 space-y-1.5">
          <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 block">
            Nominal State Trajectory
          </span>
          <div className="grid grid-cols-5 gap-1 text-center">
            {stateSteps.map((step) => {
              const isCurrent = state === step.label;
              return (
                <div
                  key={step.label}
                  className={cn(
                    "p-1.5 rounded-md border text-3xs font-mono transition-all",
                    isCurrent
                      ? "bg-blue-600 text-white font-bold border-blue-600 shadow-xs"
                      : "bg-slate-50 text-slate-500 border-slate-200"
                  )}
                >
                  <span className="block truncate">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-2.5 border-t border-slate-100 text-2xs text-slate-400 font-mono flex items-center justify-between">
        <span>Confirmation: 350ms</span>
        <span>Transition: Deterministic</span>
      </div>
    </div>
  );
}
