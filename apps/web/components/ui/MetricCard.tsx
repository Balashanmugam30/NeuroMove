"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: "default" | "safe" | "warning" | "danger" | "brand" | "accent";
  timestamp?: string;
  source?: string;
  className?: string;
}

export function MetricCard({
  title,
  value,
  unit,
  subtitle,
  icon,
  variant = "default",
  timestamp,
  source,
  className,
}: MetricCardProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "safe":
        return "border-emerald-200 bg-emerald-50/20 text-emerald-950";
      case "warning":
        return "border-amber-200 bg-amber-50/20 text-amber-950";
      case "danger":
        return "border-red-200 bg-red-50/20 text-red-950";
      case "brand":
        return "border-blue-200 bg-blue-50/20 text-blue-950";
      case "accent":
        return "border-teal-200 bg-teal-50/20 text-teal-950";
      default:
        return "border-slate-200 bg-white text-slate-900";
    }
  };

  return (
    <div
      className={cn(
        "p-4 rounded-xl border shadow-xs transition-all hover:shadow-sm font-sans flex flex-col justify-between",
        getVariantStyles(),
        className
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 font-sans">
            {title}
          </span>
          {icon && <div className="text-slate-400 shrink-0">{icon}</div>}
        </div>
        <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </span>
          {unit && (
            <span className="text-xs font-semibold text-slate-500 font-sans">
              {unit}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="mt-1 text-xs text-slate-500 font-normal leading-normal">
            {subtitle}
          </p>
        )}
      </div>

      {(source || timestamp) && (
        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-2xs font-mono text-slate-400">
          {source ? (
            <span className="uppercase font-semibold tracking-wider text-slate-500">{source}</span>
          ) : (
            <span />
          )}
          {timestamp && <span>{timestamp}</span>}
        </div>
      )}
    </div>
  );
}
