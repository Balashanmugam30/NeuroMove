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
  const getStyleAndIndicator = (val: string) => {
    const upper = val.toUpperCase();
    if (
      ["APPROVED", "READY", "HEALTHY", "SAFE", "OK", "VALID"].includes(upper)
    ) {
      return {
        style: "bg-emerald-50 text-emerald-800 border-emerald-200",
        indicator: "●",
        indicatorColor: "text-emerald-600",
      };
    }
    if (
      [
        "WARNING",
        "CANDIDATE",
        "CONFIRMED",
        "CALIBRATING",
        "DEGRADED",
        "UNCERTAIN",
      ].includes(upper)
    ) {
      return {
        style: "bg-amber-50 text-amber-800 border-amber-200",
        indicator: "▲",
        indicatorColor: "text-amber-600",
      };
    }
    if (
      [
        "EMERGENCY",
        "BLOCKED",
        "FAULT",
        "CRITICAL",
        "ERROR",
        "STOP",
        "REJECTED",
      ].includes(upper)
    ) {
      return {
        style: "bg-red-50 text-red-800 border-red-200",
        indicator: "■",
        indicatorColor: "text-red-600",
      };
    }
    return {
      style: "bg-slate-100 text-slate-700 border-slate-200",
      indicator: "○",
      indicatorColor: "text-slate-500",
    };
  };

  const { style, indicator, indicatorColor } = getStyleAndIndicator(
    String(status),
  );

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-full border uppercase tracking-wide",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        style,
        className,
      )}
    >
      <span className={cn("text-[8px]", indicatorColor)} aria-hidden="true">
        {indicator}
      </span>
      <span>{String(status)}</span>
    </span>
  );
}
