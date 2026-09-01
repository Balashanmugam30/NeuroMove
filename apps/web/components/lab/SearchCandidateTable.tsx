"use client";

import React from "react";
import { SearchCandidateResult } from "@neuromove/contracts";
import { Trophy, CheckCircle2 } from "lucide-react";

interface SearchCandidateTableProps {
  candidates: SearchCandidateResult[];
}

export function SearchCandidateTable({
  candidates,
}: SearchCandidateTableProps) {

  if (!candidates || candidates.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-slate-400 font-sans">
        No inner CV search candidates recorded.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white font-sans">
      <table className="w-full text-left text-xs text-slate-600">
        <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          <tr>
            <th className="px-3 py-2.5">Rank</th>
            <th className="px-3 py-2.5">Candidate ID</th>
            <th className="px-3 py-2.5">Hyperparameters</th>
            <th className="px-3 py-2.5 text-right">Mean Inner Score</th>
            <th className="px-3 py-2.5 text-right">Score Std</th>
            <th className="px-3 py-2.5 text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {candidates.map((cand) => {
            const isWinner = cand.rank === 1;
            return (
              <tr
                key={cand.candidate_id}
                className={isWinner ? "bg-blue-50/60 font-semibold" : "hover:bg-slate-50/50"}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center space-x-1.5">
                    {isWinner ? (
                      <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    ) : (
                      <span className="text-slate-400 text-[11px]">#{cand.rank}</span>
                    )}
                    <span className={isWinner ? "text-blue-900 font-bold" : "text-slate-700"}>
                      {cand.rank}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">
                  {cand.candidate_id}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(cand.parameters).map(([k, v]) => (
                      <span
                        key={k}
                        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 border border-slate-200 text-slate-800"
                      >
                        <span className="text-slate-500 mr-1">{k}:</span>
                        {String(v)}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-800">
                  {(cand.mean_inner_score * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-500">
                  ±{(cand.std_inner_score * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2.5 text-center">
                  {isWinner ? (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Selected</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Evaluated</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
