import React from "react";
import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50",
        className,
      )}
    >
      <div className="p-3 rounded-full bg-white border border-slate-200 text-slate-500 mb-3 shadow-xs">
        {icon || <Terminal className="w-5 h-5" />}
      </div>
      <h4 className="text-sm font-semibold text-slate-900 font-sans tracking-tight">
        {title}
      </h4>
      <p className="text-xs text-slate-500 max-w-sm mt-1.5 font-normal">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
