import React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Telemetry Error",
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-6 text-center rounded-lg border border-rose-900/50 bg-rose-950/20 text-rose-300",
        className,
      )}
    >
      <AlertTriangle className="w-6 h-6 text-rose-400 mb-2" />
      <h4 className="text-sm font-mono font-medium uppercase tracking-wide">
        {title}
      </h4>
      <p className="text-xs text-rose-400/80 max-w-sm mt-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 px-3 py-1 text-xs font-mono rounded bg-rose-900/40 border border-rose-700/60 hover:bg-rose-900/60 transition-colors"
        >
          Retry Connection
        </button>
      )}
    </div>
  );
}
