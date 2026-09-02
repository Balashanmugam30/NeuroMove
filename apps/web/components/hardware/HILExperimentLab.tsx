"use client";

import React, { useState } from "react";
import {
  HILExperiment,
  HILScenarioResult,
} from "@neuromove/contracts";
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  Filter,
} from "lucide-react";

interface HILExperimentLabProps {
  experiments: HILExperiment[];
  onRunScenario: (scenarioId: string) => Promise<HILScenarioResult>;
  onReplayExperiment: (experimentId: string) => Promise<void>;
  isLoading?: boolean;
}

const CANONICAL_SCENARIOS = [
  { id: "SCENARIO_A", category: "Connection", name: "Device Discovery", desc: "Safe enumeration without auto-opening ports" },
  { id: "SCENARIO_B", category: "Connection", name: "Clean Handshake", desc: "Handshake -> Negotiate -> Transition to READY" },
  { id: "SCENARIO_C", category: "Connection", name: "Capability Match", desc: "Verify advertised capabilities match HIL profile" },
  { id: "SCENARIO_D", category: "Command", name: "Authorized Execution", desc: "Phase 17 AUTHORIZED -> Framing -> Virtual HIL ACK" },
  { id: "SCENARIO_E", category: "Safety", name: "Denied Safety Gate", desc: "Phase 17 DENIED -> Verify 0 execution frames" },
  { id: "SCENARIO_F", category: "Safety", name: "Expired Authorization", desc: "Phase 17 EXPIRED -> Verify 0 execution frames" },
  { id: "SCENARIO_G", category: "Safety", name: "Emergency Stop Gate", desc: "Phase 17 EMERGENCY_STOP -> Verify 0 frames" },
  { id: "SCENARIO_H", category: "Reliability", name: "Duplicate Delivery", desc: "Retransmit with same ID -> Idempotent ACK" },
  { id: "SCENARIO_I", category: "Framing", name: "CRC-32 Corruption", desc: "Single-bit payload corruption -> CRC NACK" },
  { id: "SCENARIO_J", category: "Reliability", name: "Sequence Gap Detection", desc: "Inject sequence jump -> SEQUENCE_GAP NACK" },
  { id: "SCENARIO_K", category: "Reliability", name: "Dropped ACK & Retry", desc: "ACK dropped -> Retry with same ID & sequence" },
  { id: "SCENARIO_L", category: "Fault", name: "Device Disconnect", desc: "Disconnect link -> State degrades to DEGRADED/STALE" },
  { id: "SCENARIO_M", category: "Recovery", name: "Cold Reboot", desc: "Reboot endpoint -> Invalidate old session" },
  { id: "SCENARIO_N", category: "Recovery", name: "Reconnection & Heartbeat", desc: "Reconnect -> Renegotiate session & heartbeat" },
  { id: "SCENARIO_O", category: "Safety", name: "Stale Token Skew", desc: "Device clock skew -> EXPIRED_AUTHORIZATION NACK" },
  { id: "SCENARIO_P", category: "Connection", name: "Incompatible Version", desc: "Negotiate v99.0 -> Version rejection" },
  { id: "SCENARIO_Q", category: "Connection", name: "Capability Mismatch", desc: "Missing required capabilities -> Rejection" },
  { id: "SCENARIO_R", category: "Reliability", name: "Read Timeout Recovery", desc: "Simulated read latency -> Recovery" },
  { id: "SCENARIO_S", category: "Reliability", name: "Write Timeout Recovery", desc: "Simulated write latency -> Bounded retry" },
  { id: "SCENARIO_T", category: "Recovery", name: "Full E2E HIL Recovery", desc: "Fault -> Isolate -> Reconnect -> Fresh Auth -> Execute" },
];

export function HILExperimentLab({
  experiments,
  onRunScenario,
  onReplayExperiment,
  isLoading,
}: HILExperimentLabProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [scenarioResults, setScenarioResults] = useState<Record<string, HILScenarioResult>>({});
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [isRunningAll, setIsRunningAll] = useState<boolean>(false);

  const filteredScenarios = selectedCategory === "ALL"
    ? CANONICAL_SCENARIOS
    : CANONICAL_SCENARIOS.filter((s) => s.category === selectedCategory);

  const handleRunSingle = async (scenarioId: string) => {
    setRunningScenario(scenarioId);
    try {
      const res = await onRunScenario(scenarioId);
      setScenarioResults((prev) => ({ ...prev, [scenarioId]: res }));
    } finally {
      setRunningScenario(null);
    }
  };

  const handleRunAll = async () => {
    setIsRunningAll(true);
    try {
      for (const sc of CANONICAL_SCENARIOS) {
        setRunningScenario(sc.id);
        const res = await onRunScenario(sc.id);
        setScenarioResults((prev) => ({ ...prev, [sc.id]: res }));
      }
    } finally {
      setRunningScenario(null);
      setIsRunningAll(false);
    }
  };

  const categories = ["ALL", "Connection", "Command", "Safety", "Reliability", "Framing", "Fault", "Recovery"];

  const totalPassed = Object.values(scenarioResults).filter((r) => r.passed).length;
  const totalRan = Object.keys(scenarioResults).length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-2xs font-sans">
      <div className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>HIL Canonical Verification Matrix (A–T)</span>
              {totalRan > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  {totalPassed}/{totalRan} PASSED
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Deterministic scenario suite validating protocol invariants & fault handling
            </p>
          </div>
        </div>

        <button
          onClick={handleRunAll}
          disabled={isLoading || isRunningAll || runningScenario !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-2xs transition-colors"
        >
          {isRunningAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Run All 20 Scenarios
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Category Filters */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1" />
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 text-xs rounded-full font-bold transition-colors ${
                selectedCategory === cat
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Scenarios Table */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {filteredScenarios.map((sc) => {
              const res = scenarioResults[sc.id];
              const isRunning = runningScenario === sc.id;

              return (
                <div
                  key={sc.id}
                  className="p-3 hover:bg-slate-50/70 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-start space-x-3 min-w-0">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-mono font-bold border border-slate-200 bg-slate-50 text-slate-700 shrink-0 mt-0.5">
                      {sc.id}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <span>{sc.name}</span>
                        <span className="text-3xs font-bold text-slate-400 font-mono uppercase tracking-wider">
                          [{sc.category}]
                        </span>
                      </div>
                      <div className="text-3xs text-slate-500 mt-0.5 truncate">
                        {sc.desc}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    {res ? (
                      <div className="flex items-center space-x-2 text-xs font-mono">
                        {res.passed ? (
                          <span className="flex items-center gap-1 text-emerald-700 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            PASS
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-rose-700 font-bold">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            FAIL
                          </span>
                        )}
                        <span className="text-slate-400 text-3xs">
                          {res.latency_ms ? `${res.latency_ms.toFixed(1)}ms` : "0.0ms"}
                        </span>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => handleRunSingle(sc.id)}
                      disabled={isRunning || isRunningAll}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                      title={`Run ${sc.id}`}
                    >
                      {isRunning ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Historical Experiments List */}
        {experiments.length > 0 && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="text-xs font-bold text-slate-700">
              Recorded Experiment Runs ({experiments.length})
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 font-mono text-xs">
              <div className="max-h-[140px] overflow-y-auto divide-y divide-slate-200 p-2 space-y-1">
                {experiments.slice(0, 10).map((exp) => (
                  <div key={exp.experiment_id} className="p-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 truncate">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-bold ${
                        exp.passed ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                      }`}>
                        {exp.scenario_id}
                      </span>
                      <span className="text-slate-800 font-medium truncate text-2xs">{exp.name}</span>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-3xs text-slate-500">
                        {new Date(exp.completed_at).toLocaleTimeString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => onReplayExperiment(exp.experiment_id)}
                        disabled={isLoading}
                        className="px-2 py-0.5 rounded text-2xs font-bold bg-white text-purple-700 border border-purple-200 hover:bg-purple-50 transition shadow-2xs"
                        title="Replay experiment"
                      >
                        Replay
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
