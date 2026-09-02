"use client";

import React, { useState } from "react";
import { ModelVersion } from "@neuromove/contracts";
import { GitBranch, RotateCcw, CheckCircle2 } from "lucide-react";

interface VersionChainGraphProps {
  versions: ModelVersion[];
  onRollback: (targetModelId: string, reason: string) => Promise<void>;
  isProcessing: boolean;
  isResearchMode: boolean;
}

export const VersionChainGraph: React.FC<VersionChainGraphProps> = ({
  versions,
  onRollback,
  isProcessing,
  isResearchMode,
}) => {
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [rollbackReason, setRollbackReason] = useState<string>("");
  const [showRollbackModal, setShowRollbackModal] = useState<boolean>(false);

  const handleTriggerRollbackModal = (modelId: string) => {
    setSelectedTargetId(modelId);
    setShowRollbackModal(true);
  };

  const handleConfirmRollback = async () => {
    if (!selectedTargetId || !rollbackReason.trim()) return;
    await onRollback(selectedTargetId, rollbackReason);
    setRollbackReason("");
    setShowRollbackModal(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">
              Model Version Lineage & Rollback Management
            </h3>
            <p className="text-xs text-slate-500">
              Immutable parent-linked version graph ($v1 \leftarrow v2 \leftarrow v3$)
            </p>
          </div>
        </div>
      </div>

      {/* Version Tree List */}
      <div className="space-y-3">
        {versions.map((ver) => {
          const isCurrentActive = ver.is_active;


          return (
            <div
              key={ver.model_id}
              className={`p-3.5 rounded-xl border transition-all ${
                isCurrentActive
                  ? "bg-blue-50/70 border-blue-300 ring-1 ring-blue-400"
                  : "bg-slate-50/60 border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
                    v{ver.version_number}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-xs">
                        {ver.model_id}
                      </span>
                      {isCurrentActive && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          ACTIVE
                        </span>
                      )}
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                        {ver.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Subject: {ver.subject_id || "Population"} • Parent:{" "}
                      {ver.parent_model_id || "Root (None)"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right font-mono text-xs">
                    <span className="block text-slate-500 text-[10px]">Balanced Acc</span>
                    <span className="font-bold text-slate-900">
                      {((ver.metrics.balanced_accuracy ?? 0) * 100).toFixed(1)}%
                    </span>
                  </div>

                  {!isCurrentActive && ver.status !== "REJECTED" && (
                    <button
                      onClick={() => handleTriggerRollbackModal(ver.model_id)}
                      disabled={isProcessing}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Rollback Here
                    </button>
                  )}
                </div>
              </div>

              {isResearchMode && (
                <div className="mt-2 pt-2 border-t border-slate-200/60 font-mono text-[10px] text-slate-400 flex justify-between">
                  <span>SHA-256: {ver.artifact_checksum_sha256}</span>
                  <span>Registered: {ver.created_at}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Rollback Modal */}
      {showRollbackModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-amber-600 font-semibold text-sm">
              <RotateCcw className="w-5 h-5" />
              <span>Confirm Model Rollback</span>
            </div>
            <p className="text-xs text-slate-600">
              You are about to roll back the active research model to version{" "}
              <strong className="font-mono">{selectedTargetId}</strong>. The currently active version will be preserved in history.
            </p>
            <textarea
              value={rollbackReason}
              onChange={(e) => setRollbackReason(e.target.value)}
              placeholder="Provide reason for rollback (e.g., observed domain shift or validation discrepancy)..."
              rows={3}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRollbackModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRollback}
                disabled={!rollbackReason.trim() || isProcessing}
                className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
              >
                Execute Rollback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
