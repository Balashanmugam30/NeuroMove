import React from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: "default" | "safe" | "warning" | "danger" | "brand";
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
        return "border-emerald-200 bg-emerald-50/30 text-emerald-950";
      case "warning":
        return "border-amber-200 bg-amber-50/30 text-amber-950";
      case "danger":
        return "border-red-200 bg-red-50/30 text-red-950";
      case "brand":
        return "border-blue-200 bg-blue-50/30 text-blue-950";
      default:
        return "border-slate-200 bg-white text-slate-900";
    }
  };

  return (
    <div
      className={cn(
        "p-4 rounded-xl border shadow-xs transition-all hover:shadow-sm",
        getVariantStyles(),
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-sans">
          {title}
        </span>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tracking-tight text-slate-900">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-medium text-slate-500 font-sans">
            {unit}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-slate-500 font-normal">{subtitle}</p>
      )}
    </div>
  );
}
