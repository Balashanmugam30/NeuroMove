import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({
  message = "Acquiring telemetry...",
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center",
        className,
      )}
    >
      <Loader2 className="w-5 h-5 text-blue-400 animate-spin mb-2" />
      <span className="text-xs font-mono text-slate-400 tracking-wider uppercase">
        {message}
      </span>
    </div>
  );
}
