"use client";

import React from "react";
import { ClientLifecycleState, DataFreshness } from "@neuromove/contracts";
import { Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransportDiagnosticsCardProps {
  connectionState: ClientLifecycleState;
  latencyMs?: number;
  freshness?: DataFreshness | "UNKNOWN";
  streams?: string[];
  droppedPackets?: number;
  className?: string;
}

export function TransportDiagnosticsCard({
  connectionState,
  latencyMs = 1.8,
  freshness = "FRESH",
  streams = ["live", "eeg", "robot", "safety"],
  droppedPackets = 0,
  className,
}: TransportDiagnosticsCardProps) {
  const isConnected =
    connectionState === "STREAMING" || connectionState === "CONNECTED";

  return (
    <div
      data-testid="transport-diagnostics-card"
      className={cn(
        "p-4 rounded-xl border border-slate-200 bg-white shadow-xs font-sans flex flex-col justify-between transition-all",
        className
      )}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Transport Diagnostics
              </h3>
              <p className="text-2xs text-slate-400 font-normal">
                Local IPC WebSocket telemetry pipe
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-2xs font-mono font-semibold uppercase bg-slate-100 text-slate-600 border border-slate-200">
            WS://127.0.0.1:8000
          </span>
        </div>

        {/* Primary State Ribbon */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-mono">
          {/* Connection */}
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-2xs text-slate-500 block">STATUS</span>
            <span
              className={cn(
                "font-bold text-xs",
                isConnected ? "text-emerald-700" : "text-red-700"
              )}
            >
              {connectionState}
            </span>
          </div>

          {/* Latency */}
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-2xs text-slate-500 block">IPC LATENCY</span>
            <span
              className={cn(
                "font-bold text-xs",
                latencyMs < 10
                  ? "text-emerald-700"
                  : latencyMs < 50
                  ? "text-amber-700"
                  : "text-red-700"
              )}
            >
              {isConnected ? `${latencyMs.toFixed(1)} ms` : "OFFLINE"}
            </span>
          </div>

          {/* Freshness */}
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-2xs text-slate-500 block">FRESHNESS</span>
            <span
              className={cn(
                "font-bold text-xs",
                freshness === "FRESH"
                  ? "text-emerald-700"
                  : freshness === "STALE"
                  ? "text-amber-700"
                  : "text-red-700"
              )}
            >
              {freshness}
            </span>
          </div>
        </div>

        {/* Subscribed Streams */}
        <div className="mt-3 space-y-1">
          <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 block">
            Subscribed Topic Streams
          </span>
          <div className="flex flex-wrap gap-1.5">
            {streams.map((stream) => (
              <span
                key={stream}
                className="px-2 py-0.5 rounded text-2xs font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200"
              >
                /{stream}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-400 font-mono">
        <span>Dropped: {droppedPackets} pkts</span>
        <span>Heartbeat: 5000ms</span>
      </div>
    </div>
  );
}
