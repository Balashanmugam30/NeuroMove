import React from "react";
import { ConnectionState } from "@neuromove/contracts";
import { cn } from "@/lib/utils";

interface ConnectionIndicatorProps {
  label: string;
  state:
    | ConnectionState
    | "healthy"
    | "ready"
    | "not_connected"
    | "not_initialized"
    | "unavailable";
  className?: string;
}

export function ConnectionIndicator({
  label,
  state,
  className,
}: ConnectionIndicatorProps) {
  const isOnline = ["CONNECTED", "healthy", "ready"].includes(state);
  const isDegraded = ["DEGRADED"].includes(state);

  return (
    <div className={cn("flex items-center gap-2 text-xs font-mono", className)}>
      <span
        className={cn(
          "w-2 h-2 rounded-full",
          isOnline
            ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
            : isDegraded
              ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
              : "bg-slate-600",
        )}
      />
      <span className="text-slate-400 uppercase tracking-wider">{label}</span>
    </div>
  );
}
