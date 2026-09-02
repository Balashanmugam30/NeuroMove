"use client";

import React from "react";
import { CalibrationHistoryItem } from "@neuromove/contracts";
import { History } from "lucide-react";


interface CalibrationHistoryViewerProps {
  history: CalibrationHistoryItem[];
  selectedCalibrationId?: string;
  onSelectCalibration?: (calibrationId: string) => void;
}

export function CalibrationHistoryViewer({
  history,
  selectedCalibrationId,
  onSelectCalibration,
}: CalibrationHistoryViewerProps) {
  if (history.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500 shadow-xs">
        No past calibration sessions recorded for this participant.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Calibration Version History</h3>
        </div>
        <span className="text-xs font-mono text-slate-500 font-semibold">{history.length} Sessions</span>
      </div>

      <div className="divide-y divide-slate-100">
        {history.map((item) => {
          const isSelected = selectedCalibrationId === item.calibration_id;
          const isReady = item.status === "READY" || item.status === "QUALITY_REVIEW";

          return (
            <div
              key={item.calibration_id}
              onClick={() => onSelectCalibration?.(item.calibration_id)}
              className={`p-4 flex items-center justify-between flex-wrap gap-3 hover:bg-slate-50/80 transition-colors cursor-pointer ${
                isSelected ? "bg-blue-50/40" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-mono font-bold text-xs text-slate-700">
                  v{item.session_number}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">{item.calibration_id}</span>
                    <span
                      className={`px-2 py-0.2 text-3xs font-semibold rounded ${
                        isReady ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div className="text-2xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{new Date(item.created_at).toLocaleString()}</span>
                    <span>•</span>
                    <span>{item.valid_trial_count}/{item.trial_count} valid trials</span>
                    <span>•</span>
                    <span className="uppercase">{item.source_mode}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                {item.heldout_balanced_accuracy !== null && item.heldout_balanced_accuracy !== undefined ? (
                  <div>
                    <div className="text-xs font-mono font-bold text-slate-900">
                      {(item.heldout_balanced_accuracy * 100).toFixed(1)}% Bal. Acc
                    </div>
                    <div className="text-3xs font-mono text-slate-400">{item.model_id}</div>
                  </div>
                ) : (
                  <span className="text-2xs text-slate-400">No Model Fitted</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
