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
          bg: "bg-emerald-50 text-emerald-800 border-emerald-200 shadow-xs",
          icon: <ShieldAlert className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />,
          label: "LIVE",
        };
      case "REPLAY":
        return {
          bg: "bg-amber-50 text-amber-800 border-amber-200 shadow-xs",
          icon: <Play className="w-3.5 h-3.5 mr-1.5 text-amber-600" />,
          label: "REPLAY",
        };
      case "SIMULATION":
      default:
        return {
          bg: "bg-blue-50 text-blue-700 border-blue-200 shadow-xs",
          icon: <Cpu className="w-3.5 h-3.5 mr-1.5 text-blue-600" />,
          label: "SIMULATION",
        };
    }
  };

  const { bg, icon, label } = getBadgeStyle();

  return (
    <span
      data-testid="mode-badge"
      className={cn(
        "inline-flex items-center px-2.5 py-1 text-xs font-medium tracking-wide uppercase rounded-full border transition-all",
        bg,
        className,
      )}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}
