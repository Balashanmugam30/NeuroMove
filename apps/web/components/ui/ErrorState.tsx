import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Connection / Telemetry Error",
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "p-6 rounded-xl border border-red-200 bg-red-50/40 text-center flex flex-col items-center justify-center",
        className,
      )}
    >
      <div className="p-3 rounded-full bg-red-100/70 text-red-600 mb-3">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-semibold text-red-950 font-sans">{title}</h4>
      <p className="text-xs text-red-700 max-w-md mt-1 font-normal">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-50 text-xs font-semibold shadow-xs transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Local Connection</span>
        </button>
      )}
    </div>
  );
}
