"use client";

import React from "react";
import { OperatingMode } from "@neuromove/contracts";
import { cn } from "@/lib/utils";
import { ShieldCheck, Play, Cpu } from "lucide-react";

export interface ModeBadgeProps {
  mode: OperatingMode;
  className?: string;
  size?: "sm" | "md";
}

export function ModeBadge({ mode, className, size = "md" }: ModeBadgeProps) {
  const getBadgeStyle = () => {
    switch (mode) {
      case "LIVE":
        return {
          bg: "bg-emerald-50 text-emerald-800 border-emerald-200 shadow-2xs",
          icon: <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />,
          symbol: "●",
          label: "LIVE HARDWARE",
        };
      case "REPLAY":
        return {
          bg: "bg-amber-50 text-amber-800 border-amber-200 shadow-2xs",
          icon: <Play className="w-3.5 h-3.5 mr-1 text-amber-600" />,
          symbol: "▶",
          label: "REPLAY",
        };
      case "SIMULATION":
      default:
        return {
          bg: "bg-blue-50 text-blue-700 border-blue-200 shadow-2xs",
          icon: <Cpu className="w-3.5 h-3.5 mr-1 text-blue-600" />,
          symbol: "▣",
          label: "SIMULATION",
        };
    }
  };

  const { bg, icon, label } = getBadgeStyle();

  return (
    <span
      data-testid="mode-badge"
      className={cn(
        "inline-flex items-center font-bold tracking-wide uppercase rounded-full border transition-all font-sans select-none",
        size === "sm" ? "px-2 py-0.5 text-2xs" : "px-2.5 py-1 text-xs",
        bg,
        className
      )}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}
