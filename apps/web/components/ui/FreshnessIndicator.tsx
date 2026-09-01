"use client";

import React, { useEffect, useState } from "react";
import { Activity, Clock, AlertTriangle, WifiOff } from "lucide-react";
import { DataFreshness } from "@neuromove/contracts";
import { cn } from "@/lib/utils";

export interface FreshnessIndicatorProps {
  lastUpdated?: string | Date | null;
  status?: DataFreshness | "UNKNOWN";
  className?: string;
  showAge?: boolean;
}

export function FreshnessIndicator({
  lastUpdated,
  status: explicitStatus,
  className,
  showAge = true,
}: FreshnessIndicatorProps) {
  const [ageSeconds, setAgeSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!lastUpdated) {
      setAgeSeconds(null);
      return;
    }

    const calcAge = () => {
      const dt = typeof lastUpdated === "string" ? new Date(lastUpdated) : lastUpdated;
      const diffMs = Date.now() - dt.getTime();
      setAgeSeconds(Math.max(0, diffMs / 1000));
    };

    calcAge();
    const interval = setInterval(calcAge, 500);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Determine freshness
  let freshness: DataFreshness | "UNKNOWN" = explicitStatus || "UNKNOWN";
  if (!explicitStatus) {
    if (ageSeconds === null) {
      freshness = "UNKNOWN";
    } else if (ageSeconds <= 2.0) {
      freshness = "FRESH";
    } else if (ageSeconds <= 5.0) {
      freshness = "STALE";
    } else {
      freshness = "DISCONNECTED";
    }
  }

  const badgeStyles = {
    FRESH: "bg-blue-50 text-blue-700 border-blue-200",
    STALE: "bg-amber-50 text-amber-700 border-amber-200",
    DISCONNECTED: "bg-red-50 text-red-700 border-red-200",
    UNKNOWN: "bg-slate-50 text-slate-500 border-slate-200",
  };

  const icons = {
    FRESH: <Activity className="w-3 h-3 text-blue-600 animate-pulse" />,
    STALE: <Clock className="w-3 h-3 text-amber-600" />,
    DISCONNECTED: <WifiOff className="w-3 h-3 text-red-600" />,
    UNKNOWN: <AlertTriangle className="w-3 h-3 text-slate-400" />,
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-2xs font-mono font-medium uppercase border select-none",
        badgeStyles[freshness],
        className
      )}
      title={lastUpdated ? `Last packet: ${typeof lastUpdated === "string" ? lastUpdated : lastUpdated.toISOString()}` : "No telemetry received"}
    >
      {icons[freshness]}
      <span>{freshness}</span>
      {showAge && ageSeconds !== null && (
        <span className="opacity-75 lowercase font-mono">
          ({ageSeconds < 60 ? `${ageSeconds.toFixed(1)}s` : `${Math.round(ageSeconds / 60)}m`})
        </span>
      )}
    </span>
  );
}
