"use client";

import React from "react";
import { StageResult } from "@neuromove/contracts";
import { CheckCircle2, Clock, Layers } from "lucide-react";

interface ReplayStageTimelineProps {
  stages: StageResult[];
  activeStage?: string;
  onSelectStage?: (stageName: string) => void;
}

const CANONICAL_STAGES: StageResult["stage"][] = [
  "SOURCE", "ACQUISITION", "CLOCK", "QC", "DSP",
  "EPOCH", "FEATURES", "CSP", "MODEL", "PERSONALIZATION",
  "ADAPTATION", "CONFIDENCE", "INTENT", "SAFETY", "HIL"
];

export function ReplayStageTimeline({
  stages,
  activeStage,
  onSelectStage,
}: ReplayStageTimelineProps) {
  const stageMap = new Map<string, StageResult>(stages.map((s) => [s.stage, s]));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              15-Stage Canonical Pipeline Replay
            </h3>
            <p className="text-xs text-slate-500">
              Deterministic stage-by-stage provenance tracking from biopotential source to HIL
            </p>
          </div>
        </div>
        <div className="text-xs text-slate-600 font-mono font-semibold">
          {stages.length} / 15 Stages Verified
        </div>
      </div>

      {/* Horizontal Scrollable Stages Container */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-center gap-2 min-w-max">
          {CANONICAL_STAGES.map((stageName, idx) => {
            const stageRes = stageMap.get(stageName);
            const isExecuted = !!stageRes;
            const isSelected = activeStage === stageName;

            return (
              <button
                type="button"
                key={stageName}
                onClick={() => onSelectStage && onSelectStage(stageName)}
                className={`flex flex-col items-start text-left p-3 rounded-xl border transition-all w-36 shrink-0 ${
                  isSelected
                    ? "bg-blue-50 border-blue-400 ring-2 ring-blue-200 shadow-2xs"
                    : isExecuted
                    ? "bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60"
                    : "bg-slate-50/40 border-slate-100 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <span className="text-3xs font-mono font-bold text-slate-400">
                    #{String(idx + 1).padStart(2, "0")}
                  </span>
                  {isExecuted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>

                <div className="font-bold text-xs text-slate-900 truncate w-full mb-1">
                  {stageName}
                </div>

                {stageRes ? (
                  <div className="space-y-0.5 text-3xs text-slate-500 font-mono w-full">
                    <div className="flex justify-between">
                      <span>Lat:</span>
                      <span className="text-slate-800 font-semibold">{stageRes.latency_ms.toFixed(1)}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Out/In:</span>
                      <span className="text-slate-800 font-semibold">{stageRes.output_count}/{stageRes.input_count}</span>
                    </div>
                    <div className="truncate text-blue-700 font-bold" title={stageRes.stage_checksum}>
                      #{stageRes.stage_checksum.slice(0, 8)}
                    </div>
                  </div>
                ) : (
                  <span className="text-3xs text-slate-400 italic">Pending</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
