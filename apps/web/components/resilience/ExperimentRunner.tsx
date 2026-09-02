"use client";

import React, { useState } from "react";
import { Play, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { FailureScenarioResult } from "@neuromove/contracts";

interface ExperimentRunnerProps {
  onRunScenario: (scenarioId: string) => Promise<FailureScenarioResult>;
  isExecuting?: boolean;
}

const CANONICAL_SCENARIOS = [
  { id: "SCENARIO_A", name: "Stream Disconnect", category: "TRANSPORT", desc: "Realtime WebSocket drops connection; system denies authorization." },
  { id: "SCENARIO_B", name: "Delayed Stale Event", category: "TIMING", desc: "Candidate intent arrives with age > 250ms; rejected as stale." },
  { id: "SCENARIO_C", name: "Dropped Event & Sequence Gap", category: "TRANSPORT", desc: "Upstream event dropped creating sequence gap; fails closed." },
  { id: "SCENARIO_D", name: "Duplicate Event Delivery", category: "TRANSPORT", desc: "Duplicate event delivery processed idempotently without extra state changes." },
  { id: "SCENARIO_E", name: "Out-of-Order Delivery", category: "TRANSPORT", desc: "Out-of-order event sequence rejected without backward regression." },
  { id: "SCENARIO_F", name: "Malformed Payload Structure", category: "DATA", desc: "Malformed JSON or impossible fields rejected safely." },
  { id: "SCENARIO_G", name: "Stale Data / Clock Skew", category: "TIMING", desc: "Timestamp skew simulated; stale authorization strictly prohibited." },
  { id: "SCENARIO_H", name: "Model Unavailable / Rolled Back", category: "MODEL", desc: "Active model revoked or rolled back; intent denied." },
  { id: "SCENARIO_I", name: "Confidence Service Outage", category: "CONFIDENCE", desc: "Confidence estimation unavailable; cannot authorize new intent." },
  { id: "SCENARIO_J", name: "Intent Service Outage", category: "INTENT", desc: "Intent state machine offline; execution blocked." },
  { id: "SCENARIO_K", name: "Safety Service Outage", category: "SAFETY", desc: "Safety arbitration unreachable; fail closed to STOP/DENIED." },
  { id: "SCENARIO_L", name: "Database Write Failure", category: "PERSISTENCE", desc: "Audit persistence unavailable; execution held or denied." },
  { id: "SCENARIO_P", name: "Subject Context Switch", category: "CONTEXT", desc: "Subject changed during trial; invalidates previous session intent." },
  { id: "SCENARIO_Q", name: "Session Context Switch", category: "CONTEXT", desc: "Session switch rejects previous session intent payload." },
  { id: "SCENARIO_S", name: "E-Stop Persistence Across Restart", category: "SAFETY", desc: "E-stop active during reboot remains strictly locked in E-stop." },
  { id: "SCENARIO_T", name: "Lockout Persistence Across Restart", category: "SAFETY", desc: "Lockout active during reboot remains locked until administrative unlock." },
  { id: "SCENARIO_AA", name: "Cascading Realtime & Confidence Outage", category: "CONFIDENCE", desc: "Realtime drop plus confidence failure blocks new authorization." },
  { id: "SCENARIO_AB", name: "Cascading DB Failure & Safety Restart", category: "PERSISTENCE", desc: "DB failure during restart recovers restrictively into SAFE_IDLE." },
  { id: "SCENARIO_AF", name: "Cascading E-Stop & Service Reboot", category: "SAFETY", desc: "Crash during E-stop preserves E-stop across cold reboot." },
  { id: "SCENARIO_AG", name: "Cascading Lockout & Database Interruption", category: "SAFETY", desc: "Lockout remains active even if audit database is interrupted." },
];

export function ExperimentRunner({
  onRunScenario,
  isExecuting = false,
}: ExperimentRunnerProps) {
  const [selectedScenario, setSelectedScenario] = useState<string>("SCENARIO_A");
  const [lastResult, setLastResult] = useState<FailureScenarioResult | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>("ALL");

  const filteredScenarios = CANONICAL_SCENARIOS.filter((s) =>
    filterCat === "ALL" ? true : s.category === filterCat
  );

  const handleExecute = async (scenarioId: string) => {
    setRunningId(scenarioId);
    try {
      const res = await onRunScenario(scenarioId);
      setLastResult(res);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900">Failure Scenario Verification Laboratory</h3>
          <p className="text-xs text-slate-500">
            Execute canonical deterministic scenarios (A—Z & AA—AH) to certify fail-closed resilience
          </p>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {["ALL", "TRANSPORT", "DATA", "MODEL", "CONFIDENCE", "SAFETY", "PERSISTENCE"].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                filterCat === cat
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Scenarios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-4 max-h-[380px] overflow-y-auto pr-1">
        {filteredScenarios.map((scen) => {
          const isCurrentRunning = runningId === scen.id;
          const isSelected = selectedScenario === scen.id;
          return (
            <div
              key={scen.id}
              onClick={() => setSelectedScenario(scen.id)}
              className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                isSelected
                  ? "border-blue-500 bg-blue-50/40 ring-1 ring-blue-500"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-900">{scen.id}</span>
                    <span className="px-1.5 py-0.5 text-[10px] rounded font-semibold bg-slate-100 text-slate-700">
                      {scen.category}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-slate-800 mt-0.5">{scen.name}</div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{scen.desc}</p>
                </div>
                <button
                  disabled={isExecuting}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExecute(scen.id);
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors inline-flex items-center gap-1 shadow-xs disabled:opacity-50 shrink-0"
                >
                  {isCurrentRunning ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3 fill-current" />
                  )}
                  {isCurrentRunning ? "Running" : "Run"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scenario Execution Outcome Banner */}
      {lastResult && (
        <div className="mt-4 p-4 rounded-lg border bg-slate-50 border-slate-200">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              {lastResult.passed ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600" />
              )}
              <span className="text-xs font-bold text-slate-900">
                {lastResult.scenario_id}: {lastResult.name}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  lastResult.passed
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-rose-100 text-rose-800 border border-rose-300"
                }`}
              >
                {lastResult.passed ? "FAIL-CLOSED PASSED" : "FAILED"}
              </span>
            </div>
            <div className="font-mono text-[10px] text-slate-500">
              Replay Hash: {lastResult.replay_hash}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
            <div>
              <span className="text-slate-500">Observed Decision:</span>
              <div className="font-semibold text-slate-800">{lastResult.observed_safety_decision}</div>
            </div>
            <div>
              <span className="text-slate-500">Observed State:</span>
              <div className="font-semibold text-slate-800">{lastResult.observed_safety_state}</div>
            </div>
            <div>
              <span className="text-slate-500">Fail-Closed Certified:</span>
              <div className="font-semibold text-teal-700">
                {lastResult.fail_closed_certified ? "YES (Zero-Allow)" : "NO"}
              </div>
            </div>
            <div>
              <span className="text-slate-500">Recovery Status:</span>
              <div className="font-semibold text-slate-800">{lastResult.recovery_status}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
