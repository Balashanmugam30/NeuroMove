"use client";

import React, { useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Square,
  FastForward,
  Activity,
  AlertTriangle,
} from "lucide-react";

import { SimulationScenario, SimulationStatus } from "@neuromove/contracts";
import {
  startSimulation,
  pauseSimulation,
  resumeSimulation,
  stopSimulation,
  resetSimulation,
  setSimulationSpeed,
} from "@/lib/api-client";

interface SimulationControlsProps {
  status: SimulationStatus;
  scenarios: SimulationScenario[];
  onStatusChange?: (newStatus: SimulationStatus) => void;
}

export function SimulationControls({
  status,
  scenarios,
  onStatusChange,
}: SimulationControlsProps) {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(
    status.scenario_id || "right-turn"
  );
  const [seed, setSeed] = useState<number>(status.seed || 42);
  const [isLoading, setIsLoading] = useState(false);

  const handleStart = async () => {
    try {
      setIsLoading(true);
      const res = await startSimulation(selectedScenarioId, seed, status.speed);
      onStatusChange?.(res);
    } catch (e) {
      console.error("Failed to start simulation", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePauseResume = async () => {
    try {
      setIsLoading(true);
      const res = status.is_paused
        ? await resumeSimulation()
        : await pauseSimulation();
      onStatusChange?.(res);
    } catch (e) {
      console.error("Failed to toggle pause/resume", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      setIsLoading(true);
      const res = await stopSimulation();
      onStatusChange?.(res);
    } catch (e) {
      console.error("Failed to stop simulation", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      setIsLoading(true);
      const res = await resetSimulation();
      onStatusChange?.(res);
    } catch (e) {
      console.error("Failed to reset simulation", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeed = async (newSpeed: number) => {
    try {
      const res = await setSimulationSpeed(newSpeed);
      onStatusChange?.(res);
    } catch (e) {
      console.error("Failed to change speed", e);
    }
  };

  const selectedScenario =
    scenarios.find((s) => s.scenario_id === selectedScenarioId) || scenarios[0];
  const progressPct =
    status.total_duration_seconds > 0
      ? Math.min(
          100,
          Math.round(
            (status.elapsed_seconds / status.total_duration_seconds) * 100
          )
        )
      : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                Simulation Engine Control Station
              </h2>
              <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                SIMULATION
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Deterministic scenario execution and synthetic source adapter
            </p>
          </div>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
          <span className="text-xs font-medium text-slate-500 px-1.5 flex items-center gap-1">
            <FastForward className="w-3.5 h-3.5" /> Speed:
          </span>
          {[1, 2, 5, 10].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSpeed(s)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                status.speed === s
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Main control fields */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 py-3 items-center">
        {/* Scenario selection */}
        <div className="md:col-span-5">
          <label
            htmlFor="scenario-select"
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            Scenario Protocol
          </label>
          <select
            id="scenario-select"
            value={selectedScenarioId}
            onChange={(e) => setSelectedScenarioId(e.target.value)}
            disabled={status.is_running}
            className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          >
            {scenarios.map((sc) => (
              <option key={sc.scenario_id} value={sc.scenario_id}>
                {sc.name} ({sc.duration_seconds}s)
              </option>
            ))}
          </select>
        </div>

        {/* Seed selection */}
        <div className="md:col-span-2">
          <label
            htmlFor="seed-input"
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            Seed
          </label>
          <div className="relative">
            <input
              id="seed-input"
              type="number"
              value={seed}
              onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
              disabled={status.is_running}
              className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="md:col-span-5 flex items-center justify-end gap-2 pt-4 md:pt-0">
          {!status.is_running ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Start Scenario
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handlePauseResume}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
              >
                {status.is_paused ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current text-blue-600" />{" "}
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current text-amber-600" />{" "}
                    Pause
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleStop}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold rounded-lg transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-current" /> Stop
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleReset}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium rounded-lg transition-colors"
            title="Reset Simulation State"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* Progress & Active Status */}
      <div className="mt-2 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">
              {status.scenario_name || selectedScenario?.name}
            </span>
            {status.active_faults && status.active_faults.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-semibold bg-red-50 text-red-700 border border-red-200 rounded">
                <AlertTriangle className="w-3 h-3" /> FAULT:{" "}
                {status.active_faults.join(", ")}
              </span>
            )}
          </div>
          <div className="font-mono">
            {status.elapsed_seconds.toFixed(1)}s /{" "}
            {status.total_duration_seconds.toFixed(1)}s ({progressPct}%)
          </div>
        </div>
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-200 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
