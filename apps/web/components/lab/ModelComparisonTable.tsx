"use client";

import React from "react";
import { ModelComparisonResult } from "@neuromove/contracts";
import { Award, CheckCircle } from "lucide-react";

interface ModelComparisonTableProps {
  comparison: ModelComparisonResult;
}

export function ModelComparisonTable({
  comparison,
}: ModelComparisonTableProps) {
  if (!comparison || comparison.entries.length === 0) {
    return (
      <div className="text-center py-8 text-xs text-slate-400 font-sans">
        Select at least 2 experiments to view comparative matrix.
      </div>
    );
  }

  // Find best performing entry by balanced accuracy
  const sortedEntries = [...comparison.entries].sort(
    (a, b) => b.metrics.balanced_accuracy.mean - a.metrics.balanced_accuracy.mean
  );
  const bestExpId = sortedEntries[0]?.experiment_id;

  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div>
          <h3 className="text-sm font-bold text-slate-800">
            {comparison.comparison_name}
          </h3>
          <p className="text-xs text-slate-500">
            Task: <span className="font-mono text-slate-700">{comparison.common_task_id}</span> &bull; Protocol: <span className="font-mono text-slate-700">{comparison.common_protocol}</span>
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 self-start sm:self-auto">
          {comparison.entries.length} Models Benchmarked
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase">
            <tr>
              <th className="px-4 py-3">Model Family</th>
              <th className="px-4 py-3">Representation</th>
              <th className="px-4 py-3 text-right">Balanced Accuracy</th>
              <th className="px-4 py-3 text-right">F1 Score</th>
              <th className="px-4 py-3 text-right">Overall Accuracy</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {comparison.entries.map((entry) => {
              const isBest = entry.experiment_id === bestExpId;
              const balAcc = entry.metrics.balanced_accuracy;
              const f1 = entry.metrics.f1;
              const acc = entry.metrics.accuracy;

              return (
                <tr
                  key={entry.experiment_id}
                  className={isBest ? "bg-blue-50/50 font-semibold" : "hover:bg-slate-50/60"}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      {isBest && <Award className="w-4 h-4 text-amber-500 shrink-0" />}
                      <div>
                        <span className="font-bold text-slate-800 font-mono">
                          {entry.model_family}
                        </span>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {entry.experiment_id.slice(0, 12)}...
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">
                    {entry.representation}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span className={isBest ? "text-blue-700 font-bold" : "text-slate-800"}>
                      {(balAcc.mean * 100).toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">
                      ±{(balAcc.std * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {(f1.mean * 100).toFixed(1)}%
                    <span className="text-[10px] text-slate-400 ml-1">
                      ±{(f1.std * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {(acc.mean * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isBest ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                        <CheckCircle className="w-3 h-3" />
                        <span>Best Candidate</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">
                        Benchmarked
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
