import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({
  message = "Connecting to NeuroMove Local Control Station...",
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "p-8 rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center text-center shadow-xs",
        className,
      )}
    >
      <Loader2 className="w-6 h-6 text-blue-600 animate-spin mb-3" />
      <p className="text-xs text-slate-600 font-medium">{message}</p>
    </div>
  );
}
