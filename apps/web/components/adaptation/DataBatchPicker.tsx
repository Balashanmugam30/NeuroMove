"use client";

import React, { useState } from "react";
import { AdaptationDataBatch } from "@neuromove/contracts";
import { Database, Plus, Check, AlertTriangle } from "lucide-react";

interface DataBatchPickerProps {
  batches: AdaptationDataBatch[];
  selectedBatchIds: string[];
  onToggleBatch: (batchId: string) => void;
  onSynthesizeBatch: () => Promise<void>;
  isResearchMode: boolean;
}

export const DataBatchPicker: React.FC<DataBatchPickerProps> = ({
  batches,
  selectedBatchIds,
  onToggleBatch,
  onSynthesizeBatch,
  isResearchMode,
}) => {
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const handleSynthesize = async () => {
    try {
      setIsSynthesizing(true);
      await onSynthesizeBatch();
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Candidate Data Batches</h3>
            <p className="text-xs text-slate-500">Newly recorded trials available for adaptation</p>
          </div>
        </div>
        <button
          onClick={handleSynthesize}
          disabled={isSynthesizing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white transition-colors disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          {isSynthesizing ? "Synthesizing..." : "New Candidate Batch"}
        </button>
      </div>

      {batches.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-slate-200 rounded-lg">
          <p className="text-xs text-slate-500">No candidate batches found for this subject.</p>
          <button
            onClick={handleSynthesize}
            className="mt-2 text-xs font-medium text-teal-600 hover:text-teal-700 underline"
          >
            Synthesize Candidate Batch
          </button>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
          {batches.map((batch) => {
            const isSelected = selectedBatchIds.includes(batch.batch_id);
            const isHighQuality = batch.quality_summary.is_sufficient;

            return (
              <div
                key={batch.batch_id}
                onClick={() => onToggleBatch(batch.batch_id)}
                className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                  isSelected
                    ? "bg-blue-50/60 border-blue-300 ring-1 ring-blue-400"
                    : "bg-slate-50/50 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border ${
                        isSelected
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="font-semibold text-slate-900">{batch.name}</span>
                  </div>
                  <span className="font-mono text-slate-500 text-[11px]">
                    {batch.trial_count} valid trials
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-2">
                    <span>
                      Left: {batch.class_distribution["LEFT_IMAGERY"] || 0}
                    </span>
                    <span>•</span>
                    <span>
                      Right: {batch.class_distribution["RIGHT_IMAGERY"] || 0}
                    </span>
                  </div>
                  {isHighQuality ? (
                    <span className="text-emerald-600 font-medium">QC Passed</span>
                  ) : (
                    <span className="text-amber-600 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Rejection {(batch.quality_summary.rejection_ratio * 100).toFixed(0)}%
                    </span>
                  )}
                </div>

                {isResearchMode && (
                  <div className="mt-2 pt-2 border-t border-slate-200/60 font-mono text-[10px] text-slate-400 truncate">
                    Fingerprint: {batch.source_fingerprint}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
