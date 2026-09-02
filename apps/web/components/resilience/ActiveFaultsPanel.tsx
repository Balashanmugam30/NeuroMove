"use client";

import React, { useState } from "react";
import { PlusCircle, Trash2, ShieldAlert } from "lucide-react";
import { FaultDefinition } from "@neuromove/contracts";

interface ActiveFaultsPanelProps {
  faults: FaultDefinition[];
  onInject: (type: string, severity: string, scope: string, params: Record<string, unknown>) => void;
  onClear: (faultId: string) => void;
  isInjecting?: boolean;
}

const FAULT_OPTIONS = [
  { type: "STREAM_DISCONNECT", category: "TRANSPORT", label: "Stream Disconnect (Realtime loss)" },
  { type: "STREAM_DELAY", category: "TRANSPORT", label: "Stream Latency Delay (>250ms)" },
  { type: "STREAM_EVENT_DROP", category: "TRANSPORT", label: "Drop In-Flight Events" },
  { type: "STREAM_EVENT_DUPLICATE", category: "TRANSPORT", label: "Duplicate Event Injection" },
  { type: "STREAM_SEQUENCE_GAP", category: "TRANSPORT", label: "Simulate Sequence Gap (+10)" },
  { type: "MALFORMED_PAYLOAD", category: "DATA", label: "Malformed Payload / Corrupted Fields" },
  { type: "STALE_DATA", category: "DATA", label: "Stale Data / Old Timestamps" },
  { type: "MODEL_ROLLBACK", category: "MODEL", label: "Model Rollback / Revocation" },
  { type: "MODEL_UNAVAILABLE", category: "MODEL", label: "Active Model Offline" },
  { type: "CONFIDENCE_SERVICE_UNAVAILABLE", category: "CONFIDENCE", label: "Confidence Estimation Service Outage" },
  { type: "INTENT_SERVICE_UNAVAILABLE", category: "INTENT", label: "Intent State Machine Outage" },
  { type: "SAFETY_SERVICE_UNAVAILABLE", category: "SAFETY", label: "Safety Gate Unreachable" },
  { type: "DATABASE_WRITE_FAILURE", category: "PERSISTENCE", label: "Database Write Failure" },
  { type: "SUBJECT_SWITCH", category: "CONTEXT", label: "Unauthorized Subject Switch" },
  { type: "SESSION_SWITCH", category: "CONTEXT", label: "Session Boundary Mismatch" },
  { type: "CLOCK_SKEW_SIMULATED", category: "TIMING", label: "Simulate Clock Skew (+5s)" },
];

export function ActiveFaultsPanel({
  faults,
  onInject,
  onClear,
  isInjecting = false,
}: ActiveFaultsPanelProps) {
  const [selectedType, setSelectedType] = useState<string>("STREAM_DELAY");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("MEDIUM");
  const [selectedScope, setSelectedScope] = useState<string>("SINGLE_EVENT");
  const [delayMs, setDelayMs] = useState<number>(600);
  const [showForm, setShowForm] = useState<boolean>(false);

  const handleInjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params: Record<string, unknown> = {};
    if (selectedType === "STREAM_DELAY" || selectedType === "STREAM_DISCONNECT") {
      params.delay_ms = delayMs;
    }
    onInject(selectedType, selectedSeverity, selectedScope, params);
    setShowForm(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Active Fault Registry</h3>
            <p className="text-xs text-slate-500">Currently active software faults intercepting the pipeline</p>
          </div>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          {showForm ? "Cancel" : "Inject Controlled Fault"}
        </button>
      </div>

      {/* Inline Injection Form */}
      {showForm && (
        <form onSubmit={handleInjectSubmit} className="my-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Configure Parameterized Fault
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Fault Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 focus:ring-1 focus:ring-blue-500"
              >
                {FAULT_OPTIONS.map((opt) => (
                  <option key={opt.type} value={opt.type}>
                    [{opt.category}] {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Severity Level</label>
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 focus:ring-1 focus:ring-blue-500"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Scope</label>
              <select
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 focus:ring-1 focus:ring-blue-500"
              >
                <option value="SINGLE_EVENT">SINGLE_EVENT</option>
                <option value="WINDOW">WINDOW</option>
                <option value="SESSION">SESSION</option>
                <option value="SERVICE">SERVICE</option>
                <option value="GLOBAL_SIMULATION">GLOBAL_SIMULATION</option>
              </select>
            </div>
          </div>

          {(selectedType === "STREAM_DELAY" || selectedType === "STREAM_DISCONNECT") && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Delay / Latency Offset (ms): {delayMs}ms
              </label>
              <input
                type="range"
                min="50"
                max="5000"
                step="50"
                value={delayMs}
                onChange={(e) => setDelayMs(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isInjecting}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-md shadow-xs disabled:opacity-50"
            >
              {isInjecting ? "Injecting..." : "Arm & Inject Fault"}
            </button>
          </div>
        </form>
      )}

      {/* Faults List */}
      <div className="mt-4">
        {faults.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <div className="text-slate-400 text-xs font-medium">No faults currently active</div>
            <p className="text-[11px] text-slate-400 mt-1">
              All pipeline subsystems operating under nominal baseline conditions.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Fault ID & Type</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Scope</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {faults.map((f) => (
                  <tr key={f.fault_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{f.fault_type}</div>
                      <div className="font-mono text-[10px] text-slate-400">{f.fault_id}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                        {f.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <SeverityBadge severity={f.severity} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-mono text-[11px]">
                      {f.scope}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                        {f.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onClear(f.fault_id)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors inline-flex items-center gap-1 border border-slate-200"
                        title="Clear Fault"
                      >
                        <Trash2 className="w-3 h-3 text-rose-500" />
                        Clear
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    INFO: "bg-slate-100 text-slate-700 border-slate-200",
    LOW: "bg-blue-50 text-blue-700 border-blue-200",
    MEDIUM: "bg-amber-50 text-amber-800 border-amber-200",
    HIGH: "bg-orange-50 text-orange-800 border-orange-200",
    CRITICAL: "bg-rose-50 text-rose-800 border-rose-200 font-bold",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border ${map[severity] || map.MEDIUM}`}>
      {severity}
    </span>
  );
}
