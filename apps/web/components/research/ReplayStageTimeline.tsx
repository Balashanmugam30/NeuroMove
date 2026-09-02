"use client";

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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              15-Stage Canonical Pipeline Replay
            </h3>
            <p className="text-xs text-slate-400">
              Deterministic stage-by-stage provenance tracking from biopotential source to HIL
            </p>
          </div>
        </div>
        <div className="text-xs text-slate-400 font-mono">
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
                    ? "bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500"
                    : isExecuted
                    ? "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                    : "bg-slate-950/30 border-slate-900 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <span className="text-3xs font-mono font-bold text-slate-400">
                    #{String(idx + 1).padStart(2, "0")}
                  </span>
                  {isExecuted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-slate-600" />
                  )}
                </div>

                <div className="font-bold text-xs text-white truncate w-full mb-1">
                  {stageName}
                </div>

                {stageRes ? (
                  <div className="space-y-0.5 text-3xs text-slate-400 font-mono w-full">
                    <div className="flex justify-between">
                      <span>Lat:</span>
                      <span className="text-slate-300">{stageRes.latency_ms.toFixed(1)}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Out/In:</span>
                      <span className="text-slate-300">{stageRes.output_count}/{stageRes.input_count}</span>
                    </div>
                    <div className="truncate text-indigo-400" title={stageRes.stage_checksum}>
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
