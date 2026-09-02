"use client";

import React from "react";
import {
  Play,
  RotateCcw,
  ShieldAlert,
  Layers,
  Database,
  Flame,
  Sparkles,
} from "lucide-react";
import { DemoScenario } from "@neuromove/contracts";

interface DemoScenarioSelectorProps {
  scenarios: DemoScenario[];
  selectedScenarioId: string;
  onSelectScenario: (scenarioId: string) => void;
  onRunFull: (scenarioId: string) => void;
  onStartStepByStep: (scenarioId: string) => void;
  onAdvanceStep: () => void;
  onReset: () => void;
  isRunActive: boolean;
  loading: boolean;
}

const SCENARIO_ICONS: Record<string, React.ReactNode> = {
  PRODUCT_A: <Sparkles className="w-4 h-4 text-emerald-600" />,
  PRODUCT_B: <ShieldAlert className="w-4 h-4 text-amber-600" />,
  PRODUCT_C: <Layers className="w-4 h-4 text-indigo-600" />,
  PRODUCT_D: <Database className="w-4 h-4 text-blue-600" />,
  PRODUCT_E: <Flame className="w-4 h-4 text-rose-600" />,
  PRODUCT_F: <RotateCcw className="w-4 h-4 text-slate-600" />,
};

export function DemoScenarioSelector({
  scenarios,
  selectedScenarioId,
  onSelectScenario,
  onRunFull,
  onStartStepByStep,
  onAdvanceStep,
  onReset,
  isRunActive,
  loading,
}: DemoScenarioSelectorProps) {
  return (
    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs font-sans space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Select Golden Demonstration Scenario
          </h3>
          <p className="text-xs text-slate-500">
            Pre-configured deterministic verification workflows demonstrating safety, multimodal fusion, and HIL execution.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span>Reset Demo</span>
        </button>
      </div>

      {/* Grid of 6 Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {scenarios.map((sc) => {
          const isSelected = selectedScenarioId === sc.id;
          const icon = SCENARIO_ICONS[sc.id] || <Sparkles className="w-4 h-4 text-blue-600" />;

          return (
            <div
              key={sc.id}
              onClick={() => onSelectScenario(sc.id)}
              className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? "bg-blue-50/50 border-blue-300 ring-2 ring-blue-100 shadow-2xs"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white rounded-lg border border-slate-200">
                      {icon}
                    </div>
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {sc.name}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 text-2xs font-bold uppercase rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                    {sc.source}
                  </span>
                </div>

                <div className="text-2xs font-semibold text-slate-700">
                  {sc.tagline}
                </div>

                <p className="text-2xs text-slate-500 leading-relaxed line-clamp-2">
                  {sc.description}
                </p>
              </div>

              <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-2xs">
                <span className="font-mono text-slate-500">
                  Expected: <strong className="text-slate-800">{sc.expected_outcome}</strong>
                </span>
                <span className="font-mono text-emerald-700">
                  Safety: <strong>{sc.expected_safety}</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Controls Toolbar */}
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-600 font-mono">
          <span>Active Scenario:</span>
          <strong className="text-blue-700 font-bold">{selectedScenarioId}</strong>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isRunActive ? (
            <button
              type="button"
              onClick={onAdvanceStep}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-2xs disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Advance Next Step</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onStartStepByStep(selectedScenarioId)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 text-slate-500" />
                <span>Start Step-by-Step</span>
              </button>

              <button
                type="button"
                onClick={() => onRunFull(selectedScenarioId)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-2xs disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Run Full Demo</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
