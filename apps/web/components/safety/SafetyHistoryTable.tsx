"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle, PauseCircle, AlertOctagon, Lock, Filter, Clock } from "lucide-react";
import { SafetyEvaluation } from "@neuromove/contracts";

interface SafetyHistoryTableProps {
  evaluations: SafetyEvaluation[];
  onSelectEvaluation?: (evaluation: SafetyEvaluation) => void;
  loading?: boolean;
}

export const SafetyHistoryTable: React.FC<SafetyHistoryTableProps> = ({
  evaluations,
  onSelectEvaluation,
  loading = false,
}) => {
  const [filterDecision, setFilterDecision] = useState<string>("ALL");

  const filtered = evaluations.filter((e) => {
    if (filterDecision === "ALL") return true;
    return e.decision === filterDecision;
  });

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case "AUTHORIZED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3" /> AUTHORIZED
          </span>
        );
      case "HELD":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300">
            <PauseCircle className="w-3 h-3" /> HELD
          </span>
        );
      case "EMERGENCY_STOP":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white border border-red-700">
            <AlertOctagon className="w-3 h-3" /> E-STOP
          </span>
        );
      case "LOCKED_OUT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-300">
            <Lock className="w-3 h-3" /> LOCKED OUT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-300">
            <XCircle className="w-3 h-3" /> DENIED
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50/50">
        <div>
          <h3 className="text-base font-bold text-slate-900">Safety Evaluation History</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit history of software execution authorization decisions.
          </p>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
          {["ALL", "AUTHORIZED", "HELD", "DENIED", "EMERGENCY_STOP", "LOCKED_OUT"].map((d) => (
            <button
              key={d}
              onClick={() => setFilterDecision(d)}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterDecision === d
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <th className="py-3 px-4">Evaluation ID</th>
              <th className="py-3 px-4">Decision</th>
              <th className="py-3 px-4">Intent Class</th>
              <th className="py-3 px-4">Primary Reason</th>
              <th className="py-3 px-4">Duration</th>
              <th className="py-3 px-4 text-right">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  Loading evaluations...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No evaluations matching filter.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr
                  key={item.evaluation_id}
                  onClick={() => onSelectEvaluation?.(item)}
                  className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-medium text-slate-900">
                    {item.evaluation_id}
                  </td>
                  <td className="py-3 px-4">{getDecisionBadge(item.decision)}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">
                    {item.intent_class || "—"}
                  </td>
                  <td className="py-3 px-4 text-slate-700 max-w-md truncate font-medium">
                    {item.primary_reason}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">
                    {item.duration_ms.toFixed(2)}ms
                  </td>
                  <td className="py-3 px-4 text-right text-slate-500 font-mono">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {new Date(item.evaluated_at).toLocaleTimeString()}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
