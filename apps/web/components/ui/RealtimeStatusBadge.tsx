"use client";

import React from "react";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { Activity, Wifi, WifiOff, AlertTriangle } from "lucide-react";

export function RealtimeStatusBadge() {
  const { connectionState, latencyMs, freshness } = useRealtime();


  const isConnected =
    connectionState === "CONNECTED" || connectionState === "STREAMING";
  const isDegraded = connectionState === "DEGRADED";
  const isReconnecting = connectionState === "RECONNECTING";

  return (
    <div className="flex items-center gap-2">
      {/* Realtime Transport Indicator */}
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
          isConnected
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : isDegraded
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : "bg-red-50 text-red-700 border-red-200"
        }`}
      >
        {isConnected ? (
          <Wifi className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
        ) : isDegraded ? (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-red-600" />
        )}
        <span>
          {connectionState === "STREAMING"
            ? "STREAMING"
            : connectionState === "CONNECTED"
            ? "CONNECTED"
            : isDegraded
            ? "DEGRADED"
            : isReconnecting
            ? "RECONNECTING"
            : "DISCONNECTED"}
        </span>
        {isConnected && latencyMs > 0 && (
          <span className="font-mono text-2xs opacity-80">
            ({latencyMs.toFixed(0)}ms)
          </span>
        )}
      </div>

      {/* Freshness Badge */}
      {isConnected && (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-mono font-medium uppercase ${
            freshness === "FRESH"
              ? "bg-blue-50 text-blue-700 border border-blue-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}
        >
          <Activity className="w-3 h-3" />
          {freshness}
        </span>
      )}
    </div>
  );
}
