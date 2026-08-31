"use client";

import React, { ReactNode } from "react";
import { Info, AlertTriangle, AlertCircle, CheckCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type NoticeVariant =
  | "info"
  | "warning"
  | "danger"
  | "success"
  | "degraded";

export interface NoticeProps {
  variant?: NoticeVariant;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
}

export function Notice({
  variant = "info",
  title,
  children,
  action,
  className,
  icon,
}: NoticeProps) {
  const variantStyles = {
    info: "bg-blue-50/80 text-blue-900 border-blue-200/70",
    warning: "bg-amber-50/80 text-amber-900 border-amber-200/70",
    danger: "bg-red-50/80 text-red-900 border-red-200/70",
    success: "bg-emerald-50/80 text-emerald-900 border-emerald-200/70",
    degraded: "bg-slate-50 text-slate-800 border-slate-200",
  };

  const defaultIcons = {
    info: <Info className="w-4 h-4 text-blue-600 shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />,
    danger: <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />,
    success: <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />,
    degraded: <Zap className="w-4 h-4 text-amber-600 shrink-0" />,
  };

  return (
    <div
      role="alert"
      className={cn(
        "p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs leading-relaxed transition-all shadow-2xs font-sans",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5">{icon || defaultIcons[variant]}</span>
        <div className="space-y-0.5">
          {title && <h4 className="font-semibold">{title}</h4>}
          <div className="text-2xs opacity-90">{children}</div>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
