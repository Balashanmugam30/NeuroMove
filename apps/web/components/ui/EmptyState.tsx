import React from "react";
import { AlertCircle, Terminal } from "lucide-react";
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
        "flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-slate-800 bg-slate-900/20",
        className,
      )}
    >
      <div className="p-3 rounded-full bg-slate-900 border border-slate-800 text-slate-400 mb-3">
        {icon || <Terminal className="w-5 h-5" />}
      </div>
      <h4 className="text-sm font-mono font-medium text-slate-200 uppercase tracking-wide">
        {title}
      </h4>
      <p className="text-xs text-slate-400 max-w-sm mt-1.5">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
