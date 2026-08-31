import React from "react";
import { OperatingMode } from "@neuromove/contracts";
import { cn } from "@/lib/utils";
import { ShieldAlert, Play, Cpu } from "lucide-react";

interface ModeBadgeProps {
  mode: OperatingMode;
  className?: string;
}

export function ModeBadge({ mode, className }: ModeBadgeProps) {
  const getBadgeStyle = () => {
    switch (mode) {
      case "LIVE":
        return {
          bg: "bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-emerald-950/30",
          icon: (
            <ShieldAlert className="w-3.5 h-3.5 mr-1 text-emerald-400 animate-pulse" />
          ),
          label: "LIVE STREAM",
        };
      case "REPLAY":
        return {
          bg: "bg-amber-950/80 text-amber-300 border-amber-500/50 shadow-amber-950/30",
          icon: <Play className="w-3.5 h-3.5 mr-1 text-amber-400" />,
          label: "REPLAY PLAYBACK",
        };
      case "SIMULATION":
      default:
        return {
          bg: "bg-blue-950/80 text-blue-300 border-blue-500/50 shadow-blue-950/30",
          icon: <Cpu className="w-3.5 h-3.5 mr-1 text-blue-400" />,
          label: "SIMULATION",
        };
    }
  };

  const { bg, icon, label } = getBadgeStyle();

  return (
    <span
      data-testid="mode-badge"
      className={cn(
        "inline-flex items-center px-2.5 py-1 text-xs font-mono font-medium tracking-wide uppercase rounded-md border shadow-sm transition-all",
        bg,
        className,
      )}
    >
      {icon}
      {label}
    </span>
  );
}
