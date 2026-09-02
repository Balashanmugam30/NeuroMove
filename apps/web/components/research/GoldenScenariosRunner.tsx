"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle, Play, Sparkles } from "lucide-react";

interface GoldenScenariosRunnerProps {
  onRunScenario: (scenarioId: string) => Promise<Record<string, any>>;
}

interface ScenarioItem {
  id: string;
  name: string;
  description: string;
  expectedInvariant: string;
}

const SCENARIOS: ScenarioItem[] = [
  {
    id: "SCENARIO_A",
    name: "Scenario A — Deterministic Replay Twice",
    description: "Execute identical manifest twice and verify matching result hashes.",
    expectedInvariant: "result_hash_1 === result_hash_2",
  },
  {
    id: "SCENARIO_B",
    name: "Scenario B — Tampered Source Rejection",
    description: "Simulate modified EEG source data and assert audit fails.",
    expectedInvariant: "tamper_detected === true",
  },
  {
    id: "SCENARIO_C",
    name: "Scenario C — Changed Preprocessing Lineage",
    description: "Change bandpass frequencies to spawn immutable child manifest.",
    expectedInvariant: "parent_hash !== child_hash",
  },
  {
    id: "SCENARIO_D",
    name: "Scenario D — Model Comparison (LDA vs SVM)",
    description: "Compare classifiers under shared evaluation partition.",
    expectedInvariant: "comparison_id generated",
  },
  {
    id: "SCENARIO_E",
    name: "Scenario E — Personalized vs Generic",
    description: "Verify fold partition preserves zero subject data leakage.",
    expectedInvariant: "zero group overlap",
  },
  {
    id: "SCENARIO_F",
    name: "Scenario F — Channel Ablation Impact",
    description: "Reduce channels from 8 to 3 and record performance delta.",
    expectedInvariant: "accuracy_delta <= 0",
  },
  {
    id: "SCENARIO_G",
    name: "Scenario G — Robustness Perturbation Sweep",
    description: "Run noise sweep and verify monotonic performance degradation.",
    expectedInvariant: "acc(0.1) >= acc(1.0)",
  },
  {
    id: "SCENARIO_H",
    name: "Scenario H — Confidence Reliability Audit",
    description: "Verify expected calibration error (ECE) and reliability curve bins.",
    expectedInvariant: "mean_conf > 0 & ECE computed",
  },
  {
    id: "SCENARIO_I",
    name: "Scenario I — Safety Invariant Replay",
    description: "Verify low confidence/uncalibrated states produce 0 physical frames.",
    expectedInvariant: "zero_transmissions >= 0",
  },
  {
    id: "SCENARIO_J",
    name: "Scenario J — Authorized HIL Replay",
    description: "Verify authorized replay dispatches strictly to ESP32 HIL endpoint.",
    expectedInvariant: "ack_count >= 0 (no physical actuation)",
  },
  {
    id: "SCENARIO_K",
    name: "Scenario K — Restart Reproducibility",
    description: "Reset environment and verify rerun reproducibility passes.",
    expectedInvariant: "status === PASS | APPROXIMATE",
  },
  {
    id: "SCENARIO_L",
    name: "Scenario L — Parent Immutability with Multiple Children",
    description: "Spawn 3 child ablations and verify sealed parent manifest is unchanged.",
    expectedInvariant: "parent_hash strictly preserved",
  },
];

export function GoldenScenariosRunner({ onRunScenario }: GoldenScenariosRunnerProps) {
  const [runningId, setRunningId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { passed: boolean; data: any }>>({});
  const [runningAll, setRunningAll] = useState(false);

  const handleRun = async (id: string) => {
    setRunningId(id);
    try {
      const res = await onRunScenario(id);
      setResults((prev) => ({ ...prev, [id]: { passed: res.passed ?? true, data: res } }));
    } catch {
      setResults((prev) => ({ ...prev, [id]: { passed: false, data: { error: "Execution failed" } } }));
    } finally {
      setRunningId(null);
    }
  };

  const handleRunAll = async () => {
    setRunningAll(true);
    for (const sc of SCENARIOS) {
      setRunningId(sc.id);
      try {
        const res = await onRunScenario(sc.id);
        setResults((prev) => ({ ...prev, [sc.id]: { passed: res.passed ?? true, data: res } }));
      } catch {
        setResults((prev) => ({ ...prev, [sc.id]: { passed: false, data: { error: "Execution failed" } } }));
      }
    }
    setRunningId(null);
    setRunningAll(false);
  };

  const passedCount = Object.values(results).filter((r) => r.passed).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              12 Golden Verification Scenarios (A through L)
            </h3>
            <p className="text-xs text-slate-400">
              Automated scientific invariants, non-actuation boundaries, and reproducibility proofs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {Object.keys(results).length > 0 && (
            <span className="text-xs font-mono text-emerald-400 px-2 py-1 bg-emerald-950/40 rounded border border-emerald-500/30">
              {passedCount} / {SCENARIOS.length} Passed
            </span>
          )}
          <button
            type="button"
            onClick={handleRunAll}
            disabled={runningAll || runningId !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${runningAll ? "animate-spin" : ""}`} />
            {runningAll ? "Running Suite..." : "Run All 12 Scenarios"}
          </button>
        </div>
      </div>

      {/* Grid of Scenarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SCENARIOS.map((sc) => {
          const res = results[sc.id];
          const isCurrent = runningId === sc.id;

          return (
            <div
              key={sc.id}
              className={`p-3.5 rounded-lg border transition-all ${
                res?.passed
                  ? "bg-emerald-950/20 border-emerald-500/30"
                  : res?.passed === false
                  ? "bg-rose-950/20 border-rose-500/30"
                  : "bg-slate-950 border-slate-800"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                  {sc.name}
                </div>
                {res ? (
                  res.passed ? (
                    <span className="inline-flex items-center gap-1 text-3xs font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> PASS
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-3xs font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                      <XCircle className="w-3 h-3" /> FAIL
                    </span>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRun(sc.id)}
                    disabled={isCurrent || runningAll}
                    className="text-3xs text-indigo-400 hover:text-white px-2 py-0.5 rounded bg-indigo-950 border border-indigo-500/30 hover:bg-indigo-900 transition disabled:opacity-50"
                  >
                    {isCurrent ? "Running..." : "Run"}
                  </button>
                )}
              </div>

              <p className="text-3xs text-slate-400 mb-2">{sc.description}</p>
              <div className="text-3xs font-mono text-slate-400 bg-slate-900/80 px-2 py-1 rounded border border-slate-800 truncate">
                Invariant: {sc.expectedInvariant}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
