import React from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: "default" | "safe" | "warning" | "danger";
  className?: string;
}

export function MetricCard({
  title,
  value,
  unit,
  subtitle,
  icon,
  variant = "default",
  className,
}: MetricCardProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "safe":
        return "border-emerald-900/40 bg-emerald-950/10 text-emerald-300";
      case "warning":
        return "border-amber-900/40 bg-amber-950/10 text-amber-300";
      case "danger":
        return "border-rose-900/40 bg-rose-950/10 text-rose-300";
      default:
        return "border-slate-800 bg-slate-900/40 text-slate-100";
    }
  };

  return (
    <div
      className={cn(
        "p-4 rounded-lg border backdrop-blur-sm transition-all hover:border-slate-700",
        getVariantStyles(),
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
          {title}
        </span>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-mono font-semibold tracking-tight">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-mono text-slate-400">{unit}</span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-slate-400 font-sans">{subtitle}</p>
      )}
    </div>
  );
}
