"use client";

import React, { useState } from "react";
import { PreprocessingStageAudit, PreprocessingManifest } from "@neuromove/contracts";
import { SectionCard } from "@/components/ui/SectionCard";
import { CheckCircle2, MinusCircle, AlertCircle, FileCode, X } from "lucide-react";

interface StageAuditCardProps {
  audits: PreprocessingStageAudit[];
  manifest: PreprocessingManifest | null;
  pipelineVersion: string;
}

export function StageAuditCard({ audits, manifest, pipelineVersion }: StageAuditCardProps) {
  const [showManifestModal, setShowManifestModal] = useState<boolean>(false);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Pipeline Execution Stage Audit"
        description="Deterministic stage-by-stage audit trail with computational execution times and parameter bindings."
        badge={{ label: pipelineVersion, variant: "brand" }}
        headerActions={
          manifest ? (
            <button
              type="button"
              onClick={() => setShowManifestModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors shadow-sm"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Export Manifest JSON</span>
            </button>
          ) : undefined
        }
      >
        <div className="space-y-3 pt-2">
          {audits.map((stageAudit, idx) => {
            const isCompleted = stageAudit.status === "COMPLETED";
            const isSkipped = stageAudit.status === "SKIPPED";

            return (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 gap-3"
              >
                <div className="flex items-center gap-3">
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : isSkipped ? (
                    <MinusCircle className="w-5 h-5 text-slate-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 tracking-wide">
                        {stageAudit.stage}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isCompleted
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : isSkipped
                            ? "bg-slate-100 text-slate-600 border-slate-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}
                      >
                        {stageAudit.status}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      {JSON.stringify(stageAudit.parameters)}
                    </div>
                  </div>
                </div>

                <div className="text-right sm:shrink-0 text-xs font-mono text-slate-600">
                  <span className="font-semibold">{stageAudit.duration_ms} ms</span>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Manifest Modal */}
      {showManifestModal && manifest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Preprocessing Manifest ({manifest.result_id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowManifestModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto font-mono text-xs text-slate-800 bg-slate-950 text-slate-100 rounded-b-xl flex-1">
              <pre className="whitespace-pre-wrap">{JSON.stringify(manifest, null, 2)}</pre>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowManifestModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
