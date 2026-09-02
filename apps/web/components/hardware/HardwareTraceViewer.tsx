"use client";

import React, { useState } from "react";
import { CommandTrace } from "@neuromove/contracts";
import {
  ListFilter,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
} from "lucide-react";

interface HardwareTraceViewerProps {
  traces: CommandTrace[];
  onClearTraces?: () => void;
}

export function HardwareTraceViewer({
  traces,
  onClearTraces,
}: HardwareTraceViewerProps) {
  const [filterDirection, setFilterDirection] = useState<"ALL" | "TX" | "RX">("ALL");

  const filteredTraces = filterDirection === "ALL"
    ? traces
    : traces.filter((t) => t.direction === filterDirection);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-2xs font-sans">
      <div className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-sky-50 text-sky-600 border border-sky-100">
            <ListFilter className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Real-Time Hardware Protocol Trace</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-mono font-bold border border-slate-200 bg-slate-50 text-slate-700">
                {traces.length} frames
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live byte-level transaction stream on TransportStream.HARDWARE
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center rounded-lg border border-slate-200 p-0.5 text-xs bg-slate-50">
            {(["ALL", "TX", "RX"] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => setFilterDirection(dir)}
                className={`px-2.5 py-1 rounded text-2xs font-bold transition-colors ${
                  filterDirection === dir
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {dir}
              </button>
            ))}
          </div>

          {onClearTraces && (
            <button
              onClick={onClearTraces}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
              title="Clear traces"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-2">
        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950 font-mono text-xs text-slate-300 shadow-inner">
          <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-800/80 p-2 space-y-1">
            {filteredTraces.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs italic">
                No serial frames captured yet. Transmit commands or run HIL scenarios to inspect live traffic.
              </div>
            ) : (
              filteredTraces.map((tr) => {
                const isTx = tr.direction === "TX";
                return (
                  <div
                    key={tr.trace_id}
                    className="p-1.5 rounded hover:bg-slate-900 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-bold ${
                          isTx
                            ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                            : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        }`}
                      >
                        {isTx ? <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" /> : <ArrowDownLeft className="w-2.5 h-2.5 mr-0.5" />}
                        {tr.direction}
                      </span>

                      <span className="text-3xs text-slate-400">
                        {tr.timestamp ? new Date(tr.timestamp).toLocaleTimeString() : "--:--:--"}
                      </span>

                      <span className="font-bold text-slate-100">{tr.message_type}</span>

                      {tr.command_id && (
                        <span className="text-slate-400 truncate">
                          id:{tr.command_id.substring(0, 12)}
                        </span>
                      )}

                      {tr.sequence_number !== undefined && (
                        <span className="text-blue-400">
                          seq:#{tr.sequence_number}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 text-2xs shrink-0">
                      {tr.latency_ms !== undefined && (
                        <span className="text-slate-400">{tr.latency_ms.toFixed(1)}ms</span>
                      )}

                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-bold border ${
                          tr.decode_status === "VALID"
                            ? "border-emerald-500/40 text-emerald-400"
                            : "border-rose-500/40 text-rose-400"
                        }`}
                      >
                        {tr.decode_status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
