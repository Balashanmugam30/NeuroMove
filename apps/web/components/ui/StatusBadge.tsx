import React from "react";
import {
  RuntimeState,
  SafetyDecision,
  RiskLevel,
  ComponentStatus,
} from "@neuromove/contracts";
import { cn } from "@/lib/utils";

type StatusType =
  RuntimeState | SafetyDecision | RiskLevel | ComponentStatus | string;

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  size?: "sm" | "md";
}

export function StatusBadge({
  status,
  className,
  size = "md",
}: StatusBadgeProps) {
  const getStyle = (val: string) => {
    const upper = val.toUpperCase();
    if (["APPROVED", "READY", "HEALTHY", "SAFE", "OK"].includes(upper)) {
      return "bg-emerald-950/60 text-emerald-400 border-emerald-800/60";
    }
    if (
      ["WARNING", "CANDIDATE", "CONFIRMED", "CALIBRATING", "DEGRADED"].includes(
        upper,
      )
    ) {
      return "bg-amber-950/60 text-amber-400 border-amber-800/60";
    }
    if (
      ["EMERGENCY", "BLOCKED", "FAULT", "CRITICAL", "ERROR", "STOP"].includes(
        upper,
      )
    ) {
      return "bg-rose-950/60 text-rose-400 border-rose-800/60";
    }
    return "bg-slate-900/80 text-slate-400 border-slate-800";
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-mono font-medium rounded border uppercase tracking-wider",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        getStyle(String(status)),
        className,
      )}
    >
      {String(status)}
    </span>
  );
}
