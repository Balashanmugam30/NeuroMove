"use client";

import React from "react";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { Activity, Wifi, WifiOff, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function RealtimeStatusBadge({ className }: { className?: string }) {
  const { connectionState, latencyMs, freshness } = useRealtime();

  const isConnected =
    connectionState === "CONNECTED" || connectionState === "STREAMING";
  const isDegraded = connectionState === "DEGRADED";
  const isReconnecting = connectionState === "RECONNECTING";

  return (
    <div className={cn("flex items-center gap-2 font-sans select-none", className)}>
      {/* Realtime Transport Indicator */}
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all shadow-2xs",
          isConnected
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : isDegraded
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : isReconnecting
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : "bg-red-50 text-red-700 border-red-200"
        )}
      >
        {isConnected ? (
          <Wifi className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
        ) : isDegraded ? (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        ) : isReconnecting ? (
          <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
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
          <span className="font-mono text-2xs opacity-85">
            ({latencyMs.toFixed(0)}ms)
          </span>
        )}
      </div>

      {/* Freshness Badge */}
      {isConnected && (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-mono font-bold uppercase border shadow-2xs",
            freshness === "FRESH"
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
          )}
        >
          <Activity className="w-3 h-3 text-blue-600" />
          {freshness}
        </span>
      )}
    </div>
  );
}
