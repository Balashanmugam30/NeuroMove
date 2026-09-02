"use client";

import React from "react";
import { ArrowRight, Clock, GitCommit } from "lucide-react";
import { SafetyTransition } from "@neuromove/contracts";

interface SafetyTimelineProps {
  transitions: SafetyTransition[];
  loading?: boolean;
}

export const SafetyTimeline: React.FC<SafetyTimelineProps> = ({ transitions, loading = false }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
        Loading safety transition history...
      </div>
    );
  }

  if (!transitions.length) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
        No state machine transitions recorded yet.
      </div>
    );
  }

  const getStateColor = (s: string) => {
    switch (s) {
      case "AUTHORIZED":
        return "text-emerald-700 bg-emerald-50 border-emerald-200";
      case "HELD":
        return "text-amber-700 bg-amber-50 border-amber-200";
      case "DENIED":
        return "text-rose-700 bg-rose-50 border-rose-200";
      case "EMERGENCY_STOP":
        return "text-white bg-red-600 border-red-700";
      case "LOCKED_OUT":
        return "text-purple-700 bg-purple-50 border-purple-200";
      case "RESET_PENDING":
        return "text-orange-700 bg-orange-50 border-orange-200";
      case "EVALUATING":
        return "text-blue-700 bg-blue-50 border-blue-200";
      default:
        return "text-slate-700 bg-slate-100 border-slate-200";
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Safety State Transition Audit Log</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable trace of deterministic state machine transitions.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-500 font-medium">
          {transitions.length} Transitions
        </span>
      </div>

      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {transitions.slice(0, 15).map((trans) => (
          <div key={trans.transition_id} className="relative group">
            {/* Dot icon */}
            <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-slate-300 group-hover:border-blue-500 flex items-center justify-center transition-colors">
              <GitCommit className="w-3 h-3 text-slate-400 group-hover:text-blue-500" />
            </div>

            <div className="bg-slate-50 hover:bg-slate-100/80 rounded-lg p-3 border border-slate-200/80 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-slate-500">
                    #{trans.sequence_number}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getStateColor(
                      trans.previous_state
                    )}`}
                  >
                    {trans.previous_state}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getStateColor(
                      trans.next_state
                    )}`}
                  >
                    {trans.next_state}
                  </span>
                  <span className="text-xs font-medium text-slate-600 font-mono">
                    [{trans.trigger_name}]
                  </span>
                </div>
                <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(trans.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>

              <p className="text-xs text-slate-700 mt-1.5 font-medium">{trans.reason}</p>

              {trans.evaluation_id && (
                <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>Evaluation: {trans.evaluation_id}</span>
                  {trans.intent_id && <span>Intent: {trans.intent_id}</span>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
