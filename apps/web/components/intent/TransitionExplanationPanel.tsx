"use client";

import React, { useState } from "react";
import { IntentStateSnapshot, IntentStateTransition } from "@neuromove/contracts";
import { Info, ChevronDown, ChevronUp, Send, Layers } from "lucide-react";


interface TransitionExplanationPanelProps {
  snapshot: IntentStateSnapshot | null;
  lastTransition?: IntentStateTransition | null;
}

export function TransitionExplanationPanel({
  snapshot,
  lastTransition,
}: TransitionExplanationPanelProps) {
  const [showJson, setShowJson] = useState(false);

  if (!snapshot) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-xs text-slate-500">
        No state transitions evaluated yet.
      </div>
    );
  }

  const prev = lastTransition?.previous_state || "NO_INTENT";
  const curr = snapshot.current_state;
  const reason = snapshot.transition_reason || lastTransition?.reason || "STATE_RESTORE";
  const trigger = lastTransition?.trigger || "HANDOFF_CONFIRMED";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Transition Explanation & Audit Breakdown</h3>
            <p className="text-xs text-slate-500">Explanatory semantics and machine-readable trigger audit</p>
          </div>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Sequence: #{snapshot.transition_count}
        </div>
      </div>

      {/* Primary Transition Flow Badge */}
      <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px]">Transition:</span>
          <span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
            {prev}
          </span>
          <span className="text-slate-400">&rarr;</span>
          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            {curr}
          </span>
        </div>

        <div className="hidden sm:block text-slate-300">|</div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Trigger:</span>
          <span className="font-mono text-slate-800 font-semibold">{trigger}</span>
        </div>

        <div className="hidden sm:block text-slate-300">|</div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Reason:</span>
          <span className="font-mono text-teal-700 font-semibold">{reason}</span>
        </div>
      </div>

      {/* Informative Explanation */}
      <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-3 text-xs">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-slate-900">Transition Narrative</div>
          <p className="text-slate-700 leading-relaxed font-mono">
            {lastTransition?.details ||
              `State machine advanced to ${curr} triggered by ${trigger} with reason ${reason}.`}
          </p>
        </div>
      </div>

      {/* Phase 17 Safety Arbitration Gateway Handoff Preview */}
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-900">
            <Send className="w-3.5 h-3.5 text-indigo-600" />
            Phase 17 Safety Arbitration Handoff Contract
          </div>
          <button
            onClick={() => setShowJson(!showJson)}
            className="text-xs text-indigo-700 hover:text-indigo-900 font-medium flex items-center gap-1"
          >
            {showJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showJson ? "Hide Snapshot Payload" : "View Snapshot Payload"}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2 rounded bg-white border border-indigo-100">
            <div className="text-[10px] text-slate-400 font-medium">INTENT CLASS</div>
            <div className="font-bold text-slate-900">{snapshot.intent_class || "NONE"}</div>
          </div>
          <div className="p-2 rounded bg-white border border-indigo-100">
            <div className="text-[10px] text-slate-400 font-medium">LIFECYCLE STATE</div>
            <div className="font-bold text-blue-600">{snapshot.current_state}</div>
          </div>
          <div className="p-2 rounded bg-white border border-indigo-100">
            <div className="text-[10px] text-slate-400 font-medium">ACTIVE INTENT ID</div>
            <div className="font-mono text-slate-700 truncate" title={snapshot.active_intent_id || "None"}>
              {snapshot.active_intent_id ? snapshot.active_intent_id.slice(0, 10) + "..." : "None"}
            </div>
          </div>
          <div className="p-2 rounded bg-white border border-indigo-100">
            <div className="text-[10px] text-slate-400 font-medium">SAFETY CLEARANCE</div>
            <div className="font-semibold text-slate-500">PENDING (PHASE 17)</div>
          </div>
        </div>

        {showJson && (
          <div className="mt-3 p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto">
            <pre>{JSON.stringify(snapshot, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
