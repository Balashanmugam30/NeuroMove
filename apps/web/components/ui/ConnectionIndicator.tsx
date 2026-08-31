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
    | "unavailable"
    | "degraded"
    | "error";
  className?: string;
}

export function ConnectionIndicator({
  label,
  state,
  className,
}: ConnectionIndicatorProps) {
  const isOnline = ["CONNECTED", "healthy", "ready"].includes(state);
  const isDegraded = ["DEGRADED", "degraded"].includes(state);

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs font-sans font-medium",
        className,
      )}
    >
      <span
        className={cn(
          "w-2 h-2 rounded-full",
          isOnline
            ? "bg-emerald-600"
            : isDegraded
              ? "bg-amber-500"
              : "bg-slate-400",
        )}
      />
      <span className="text-slate-600 uppercase tracking-wide text-[11px]">
        {label}
      </span>
    </div>
  );
}
