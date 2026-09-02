"use client";

import React, { useState } from "react";
import { Play, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

interface Scenario {
  id: string;
  name: string;
}

interface MultimodalScenariosPanelProps {
  scenarios: Scenario[];
  onRunScenario: (scenarioId: string) => Promise<Record<string, any>>;
  isLoading?: boolean;
}

export const MultimodalScenariosPanel: React.FC<MultimodalScenariosPanelProps> = ({
  scenarios,
  onRunScenario,
  isLoading = false,
}) => {
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [scenarioResults, setScenarioResults] = useState<Record<string, Record<string, any>>>({});

  const handleRun = async (scenarioId: string) => {
    setRunningScenario(scenarioId);
    try {
      const res = await onRunScenario(scenarioId);
      setScenarioResults((prev) => ({ ...prev, [scenarioId]: res }));
    } finally {
      setRunningScenario(null);
    }
  };

  const handleRunAll = async () => {
    for (const sc of scenarios) {
      await handleRun(sc.id);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-slate-100">12 Golden Verification Scenarios</h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Audit Suite
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated compliance & verification harness validating single-modality, desync, contradiction holds, and non-actuation invariants.
          </p>
        </div>

        <button
          onClick={handleRunAll}
          disabled={isLoading || runningScenario !== null}
          className="py-1.5 px-3 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5" /> Run All 12 Scenarios
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {scenarios.map((sc) => {
          const isRunning = runningScenario === sc.id;
          const result = scenarioResults[sc.id];
          const hasRun = result !== undefined;
          const passed = result?.passed === true;

          return (
            <div
              key={sc.id}
              className={`border rounded-lg p-3.5 flex flex-col justify-between space-y-3 bg-slate-950/60 ${
                hasRun
                  ? passed
                    ? "border-emerald-500/40"
                    : "border-rose-500/40"
                  : "border-slate-800"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-400">{sc.id}</span>
                  {hasRun && (
                    <span
                      className={`flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        passed
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {passed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {passed ? "PASSED" : "FAILED"}
                    </span>
                  )}
                </div>
                <h3 className="text-xs font-semibold text-slate-200 mt-1.5 leading-snug">
                  {sc.name}
                </h3>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <button
                  onClick={() => handleRun(sc.id)}
                  disabled={isLoading || isRunning}
                  className="py-1 px-2.5 text-xs font-mono font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Play className="w-3 h-3" /> {isRunning ? "Running..." : "Run Test"}
                </button>
                {hasRun && result?.data?.safety_verdict && (
                  <span className="text-[10px] font-mono text-slate-400">
                    Verdict: <span className="text-slate-200">{result.data.safety_verdict}</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
