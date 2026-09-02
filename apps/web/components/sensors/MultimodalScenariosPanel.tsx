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
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-bold text-slate-900">12 Golden Verification Scenarios</h2>
            <span className="text-2xs font-mono font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
              Audit Suite
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Automated compliance & verification harness validating single-modality, desync, contradiction holds, and non-actuation invariants.
          </p>
        </div>

        <button
          onClick={handleRunAll}
          disabled={isLoading || runningScenario !== null}
          className="py-1.5 px-3 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
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
              className={`border rounded-xl p-3.5 flex flex-col justify-between space-y-3 bg-white transition-all shadow-2xs ${
                hasRun
                  ? passed
                    ? "border-emerald-300 ring-1 ring-emerald-100"
                    : "border-rose-300 ring-1 ring-rose-100"
                  : "border-slate-200"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-mono font-bold text-teal-700">{sc.id}</span>
                  {hasRun && (
                    <span
                      className={`flex items-center gap-1 text-2xs font-mono font-bold px-2 py-0.5 rounded border ${
                        passed
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}
                    >
                      {passed ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-600" />}
                      {passed ? "PASSED" : "FAILED"}
                    </span>
                  )}
                </div>
                <h3 className="text-xs font-bold text-slate-900 mt-1.5 leading-snug">
                  {sc.name}
                </h3>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => handleRun(sc.id)}
                  disabled={isLoading || isRunning}
                  className="py-1 px-2.5 text-xs font-mono font-bold rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-2xs"
                >
                  <Play className="w-3 h-3 text-teal-600" /> {isRunning ? "Running..." : "Run Test"}
                </button>
                {hasRun && result?.data?.safety_verdict && (
                  <span className="text-3xs font-mono text-slate-500">
                    Verdict: <span className="text-slate-900 font-bold">{result.data.safety_verdict}</span>
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
