"use client";

import React, { useState } from "react";
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sliders,
} from "lucide-react";
import { TransportScenarioResult } from "@neuromove/contracts";

interface TransportSimulationLabProps {
  scenarios: any[];
  onRunScenario: (scenarioId: string) => Promise<TransportScenarioResult>;
  onInjectFaults: (faults: any) => Promise<any>;
  onResetSimulation: () => Promise<any>;
  isLoading?: boolean;
}

export function TransportSimulationLab({
  scenarios,
  onRunScenario,
  onInjectFaults,
  onResetSimulation: _onResetSimulation,
  isLoading = false,
}: TransportSimulationLabProps) {
  // Fault injection form state
  const [dropNext, setDropNext] = useState<boolean>(false);
  const [delayMs, setDelayMs] = useState<number>(0);
  const [corruptCrc, setCorruptCrc] = useState<boolean>(false);
  const [dropAck, setDropAck] = useState<boolean>(false);
  const [disconnect, setDisconnect] = useState<boolean>(false);
  const [skewSeconds, setSkewSeconds] = useState<number>(0);
  const [faultAppliedMessage, setFaultAppliedMessage] = useState<string | null>(null);

  // Scenario execution state
  const [runningScenarioId, setRunningScenarioId] = useState<string | null>(null);
  const [scenarioResults, setScenarioResults] = useState<Record<string, TransportScenarioResult>>({});

  const handleApplyFaults = async () => {
    try {
      await onInjectFaults({
        drop_next: dropNext,
        delay_ms: delayMs,
        corrupt_crc: corruptCrc,
        drop_ack: dropAck,
        disconnect: disconnect,
        skew_seconds: skewSeconds,
      });
      setFaultAppliedMessage("Simulation fault parameters applied successfully.");
      setTimeout(() => setFaultAppliedMessage(null), 3000);
    } catch (err: any) {
      setFaultAppliedMessage(`Error: ${err.message}`);
    }
  };

  const handleClearFaults = async () => {
    setDropNext(false);
    setDelayMs(0);
    setCorruptCrc(false);
    setDropAck(false);
    setDisconnect(false);
    setSkewSeconds(0);
    try {
      await onInjectFaults({
        drop_next: false,
        delay_ms: 0,
        corrupt_crc: false,
        drop_ack: false,
        disconnect: false,
        skew_seconds: 0,
      });
      setFaultAppliedMessage("Simulation faults cleared.");
      setTimeout(() => setFaultAppliedMessage(null), 3000);
    } catch (err: any) {
      setFaultAppliedMessage(`Error: ${err.message}`);
    }
  };

  const handleRunSingleScenario = async (scenarioId: string) => {
    setRunningScenarioId(scenarioId);
    try {
      const res = await onRunScenario(scenarioId);
      setScenarioResults((prev) => ({ ...prev, [scenarioId]: res }));
    } catch (err: any) {
      console.error("Scenario failed:", err);
    } finally {
      setRunningScenarioId(null);
    }
  };

  const handleRunAllScenarios = async () => {
    for (const sc of scenarios) {
      setRunningScenarioId(sc.scenario_id);
      try {
        const res = await onRunScenario(sc.scenario_id);
        setScenarioResults((prev) => ({ ...prev, [sc.scenario_id]: res }));
      } catch (err) {
        console.error("Scenario batch error:", err);
      }
    }
    setRunningScenarioId(null);
  };

  const passedCount = Object.values(scenarioResults).filter((r) => r.passed).length;
  const totalRun = Object.keys(scenarioResults).length;

  return (
    <div className="space-y-6 font-sans">
      {/* Upper Grid: Fault Injection Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Transport Fault Injection Laboratory
              </h4>
              <p className="text-xs text-slate-500">
                Inject deterministic simulated network impairments into the simulated ESP32 link
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearFaults}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear Faults
            </button>
            <button
              type="button"
              onClick={handleApplyFaults}
              className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
            >
              Apply Fault Parameters
            </button>
          </div>
        </div>

        {faultAppliedMessage && (
          <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg font-medium">
            {faultAppliedMessage}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dropNext}
              onChange={(e) => setDropNext(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-bold text-slate-800 block">Drop Next Outgoing Frame</span>
              <span className="text-[11px] text-slate-500">Simulate physical packet loss in transit</span>
            </div>
          </label>

          <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={corruptCrc}
              onChange={(e) => setCorruptCrc(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-bold text-slate-800 block">Corrupt Checksum (CRC-32)</span>
              <span className="text-[11px] text-slate-500">Inject 1-bit corruption into payload wire bytes</span>
            </div>
          </label>

          <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dropAck}
              onChange={(e) => setDropAck(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-bold text-slate-800 block">Drop Outgoing Simulator ACK</span>
              <span className="text-[11px] text-slate-500">Simulate return path loss; triggers client retry</span>
            </div>
          </label>

          <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={disconnect}
              onChange={(e) => setDisconnect(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-bold text-slate-800 block">Forcibly Drop Connection</span>
              <span className="text-[11px] text-slate-500">Cut transport link; transitions state to DISCONNECTED</span>
            </div>
          </label>

          <div className="p-3 rounded-lg border border-slate-200 space-y-1">
            <div className="flex justify-between font-bold text-slate-800">
              <span>Simulated Network Latency</span>
              <span className="font-mono text-blue-600">{delayMs} ms</span>
            </div>
            <input
              type="range"
              min="0"
              max="500"
              step="25"
              value={delayMs}
              onChange={(e) => setDelayMs(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <span className="text-[10px] text-slate-400 block">Artificial transmission delay</span>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 space-y-1">
            <div className="flex justify-between font-bold text-slate-800">
              <span>Simulated Clock Skew</span>
              <span className="font-mono text-blue-600">{skewSeconds} sec</span>
            </div>
            <input
              type="range"
              min="0"
              max="120"
              step="10"
              value={skewSeconds}
              onChange={(e) => setSkewSeconds(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <span className="text-[10px] text-slate-400 block">Forward time skew to test command expiry</span>
          </div>
        </div>
      </div>

      {/* Lower Section: Scenario Runner A through T */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-teal-600" />
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Canonical Deterministic Verification Scenarios (A through T)
              </h4>
              <p className="text-xs text-slate-500">
                20 formal verification benchmarks covering handshakes, authorizations, faults, retries & recoveries
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {totalRun > 0 && (
              <span className="text-xs font-bold font-mono px-2 py-1 rounded bg-slate-100 text-slate-700">
                Passed: {passedCount} / {totalRun}
              </span>
            )}
            <button
              type="button"
              onClick={handleRunAllScenarios}
              disabled={isLoading || runningScenarioId !== null}
              className="px-3 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              Run All 20 Scenarios
            </button>
          </div>
        </div>

        {/* Scenarios Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {scenarios.map((sc) => {
            const isRunning = runningScenarioId === sc.scenario_id;
            const res = scenarioResults[sc.scenario_id];

            return (
              <div
                key={sc.scenario_id}
                className={`p-3.5 rounded-lg border transition-all ${
                  res?.passed === true
                    ? "bg-emerald-50/40 border-emerald-200"
                    : res?.passed === false
                    ? "bg-red-50/40 border-red-200"
                    : "bg-slate-50/60 border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div>
                    <span className="font-mono text-[11px] font-bold text-blue-700 block">
                      {sc.scenario_id}
                    </span>
                    <h5 className="text-xs font-bold text-slate-900">{sc.name}</h5>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRunSingleScenario(sc.scenario_id)}
                    disabled={isRunning || isLoading}
                    className="px-2.5 py-1 text-[11px] font-bold rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 shadow-2xs flex items-center gap-1 disabled:opacity-50 transition-colors"
                  >
                    <Play className={`w-3 h-3 ${isRunning ? "animate-spin text-teal-600" : ""}`} />
                    {isRunning ? "Running..." : "Execute"}
                  </button>
                </div>

                <p className="text-[11px] text-slate-600 line-clamp-2">{sc.description}</p>

                {res && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-mono">
                    <span
                      className={`inline-flex items-center gap-1 font-bold ${
                        res.passed ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {res.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-600" />
                      )}
                      {res.passed ? "PASSED" : "FAILED"}
                    </span>
                    <span className="text-slate-500">
                      Observed: {res.observed_ack_status}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
