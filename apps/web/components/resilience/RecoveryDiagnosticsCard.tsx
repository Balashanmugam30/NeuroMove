"use client";

import React from "react";
import { RotateCcw, CheckCircle2 } from "lucide-react";
import { RecoveryCheckpoint } from "@neuromove/contracts";

interface RecoveryDiagnosticsCardProps {
  checkpoints: RecoveryCheckpoint[];
  latestRecoveryStatus?: string;
  dataLossStatus?: string;
}

export function RecoveryDiagnosticsCard({
  checkpoints,
  latestRecoveryStatus = "RECOVERED_CLEANLY",
  dataLossStatus = "NONE",
}: RecoveryDiagnosticsCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Deterministic Recovery & Checkpoints</h3>
            <p className="text-xs text-slate-500">
              Dependency-ordered restoration and cryptographic checkpoint verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
            Recovery: {latestRecoveryStatus}
          </span>
          <span className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-700">
            Data Loss: {dataLossStatus}
          </span>
        </div>
      </div>

      {/* Recovery Invariants Banner */}
      <div className="my-4 p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1.5">
        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-teal-600" />
          Conservative Safe Recovery Contract Guarantees:
        </div>
        <ul className="list-disc pl-5 space-y-1 text-slate-600">
          <li>
            <strong>Zero Accidental Resumption:</strong> Recovery strictly restores into <code>SAFE_IDLE</code>. Never auto-authorizes in-flight candidate intents.
          </li>
          <li>
            <strong>E-Stop & Lockout Inviolability:</strong> Reboots occurring while in Emergency Stop or Lockout strictly recover back into Emergency Stop or Lockout.
          </li>
          <li>
            <strong>Topological Order:</strong> Database &rarr; Core Storage &rarr; Confidence &rarr; Intent &rarr; Safety Gate &rarr; Transport.
          </li>
        </ul>
      </div>

      {/* Checkpoints Table */}
      <div className="mt-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Stored Recovery Checkpoints
        </div>
        {checkpoints.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
            No recovery checkpoints captured yet. Checkpoints are automatically saved when running experiments.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Checkpoint ID</th>
                  <th className="py-2.5 px-3">Component</th>
                  <th className="py-2.5 px-3">Safe State</th>
                  <th className="py-2.5 px-3">Sequence</th>
                  <th className="py-2.5 px-3">SHA-256 Checksum</th>
                  <th className="py-2.5 px-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {checkpoints.slice(0, 10).map((chk) => (
                  <tr key={chk.checkpoint_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2 px-3 font-semibold text-slate-900">{chk.checkpoint_id}</td>
                    <td className="py-2 px-3 text-slate-700 font-sans">{chk.component}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                        {chk.last_known_safe_state}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600">#{chk.sequence_number}</td>
                    <td className="py-2 px-3 text-slate-500">{chk.checksum}</td>
                    <td className="py-2 px-3 text-right text-slate-400 font-sans text-xs">{chk.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
