"use client";

import React from "react";
import { ErrorAnalysisResult } from "@neuromove/contracts";
import { AlertTriangle, TrendingDown, Users, Calendar, ArrowRight } from "lucide-react";

interface ErrorAnalysisTableProps {
  analysis: ErrorAnalysisResult;
}

export function ErrorAnalysisTable({ analysis }: ErrorAnalysisTableProps) {
  if (!analysis || analysis.total_errors === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center text-emerald-800 font-sans">
        <h4 className="text-sm font-bold">Zero Misclassifications Detected</h4>
        <p className="text-xs text-emerald-600 mt-1">
          The model achieved 100% accuracy on all held-out out-of-fold trials.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Top Level Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Total Errors</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-800 font-mono">
            {analysis.total_errors}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Held-out out-of-fold trials</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Error Rate</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-600 font-mono">
            {(analysis.overall_error_rate * 100).toFixed(1)}%
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Accuracy: {((1 - analysis.overall_error_rate) * 100).toFixed(1)}%
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Difficult Subjects</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-800 font-mono">
            {analysis.difficult_subjects.filter((s) => s.z_score > 0.5).length}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Subjects with z-score &gt; 0.5</p>
        </div>
      </div>

      {/* Grid: Confused Pairs & Difficult Subjects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Confused Pairs */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
            <span>Most Confused Class Pairs</span>
          </h4>
          <div className="divide-y divide-slate-100">
            {analysis.most_confused_pairs.map((pair, idx) => (
              <div
                key={idx}
                className="py-2.5 flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700">
                    {pair.true_label}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    {pair.predicted_label}
                  </span>
                </div>
                <span className="font-mono font-bold text-slate-700">
                  {pair.count} errors
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Difficult Subjects Ranking */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>Subject Error Distribution</span>
          </h4>
          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {analysis.difficult_subjects.map((subj) => (
              <div
                key={subj.subject_id}
                className="py-2 flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-semibold text-slate-800">
                    {subj.subject_id}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({subj.total_samples} trials)
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="font-mono text-slate-700">
                    {(subj.error_rate * 100).toFixed(1)}% err
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      subj.z_score > 1.0
                        ? "bg-rose-100 text-rose-800"
                        : subj.z_score > 0
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    z = {subj.z_score > 0 ? `+${subj.z_score}` : subj.z_score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Difficult Sessions Table */}
      {analysis.difficult_sessions.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
            <Calendar className="w-3.5 h-3.5 text-teal-600" />
            <span>Session-Level Error Analysis</span>
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-700 uppercase">
                <tr>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Session</th>
                  <th className="px-3 py-2 text-right">Total Trials</th>
                  <th className="px-3 py-2 text-right">Error Rate</th>
                  <th className="px-3 py-2 text-right">Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analysis.difficult_sessions.map((sess, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2 font-mono font-medium text-slate-800">
                      {sess.subject_id}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-600">
                      {sess.session_id}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700">
                      {sess.total_samples}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-rose-600 font-semibold">
                      {(sess.error_rate * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-600 font-semibold">
                      {((1 - sess.error_rate) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
