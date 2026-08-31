"use client";

import React, { ReactNode } from "react";
import { Lightbulb, Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InsightCardProps {
  title: string;
  children: ReactNode;
  variant?: "brand" | "accent" | "neutral";
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function InsightCard({
  title,
  children,
  variant = "brand",
  icon,
  action,
  className,
}: InsightCardProps) {
  const variantStyles = {
    brand: "bg-blue-50/60 border-blue-100 text-blue-950",
    accent: "bg-teal-50/60 border-teal-100 text-teal-950",
    neutral: "bg-slate-50/70 border-slate-200 text-slate-900",
  };

  const defaultIcons = {
    brand: <Lightbulb className="w-4 h-4 text-blue-600 shrink-0" />,
    accent: <Sparkles className="w-4 h-4 text-teal-600 shrink-0" />,
    neutral: <Info className="w-4 h-4 text-slate-500 shrink-0" />,
  };

  return (
    <div
      className={cn(
        "p-4 rounded-xl border flex items-start justify-between gap-3 shadow-2xs font-sans",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon || defaultIcons[variant]}</div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold tracking-tight">{title}</h4>
          <div className="text-2xs leading-relaxed text-slate-600">{children}</div>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
