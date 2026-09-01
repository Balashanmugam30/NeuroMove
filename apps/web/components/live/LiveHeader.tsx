"use client";

import React from "react";
import { OperatingMode, ClientLifecycleState, DataFreshness } from "@neuromove/contracts";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { RealtimeStatusBadge } from "@/components/ui/RealtimeStatusBadge";
import { Button } from "@/components/ui/Button";
import { Power, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveHeaderProps {
  mode?: OperatingMode;
  connectionState?: ClientLifecycleState;
  freshness?: DataFreshness | "UNKNOWN";
  latencyMs?: number;
  sessionId?: string;
  trialId?: string;
  scenarioName?: string;
  onSync?: () => void;
  onEStop?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function LiveHeader({
  mode = "SIMULATION",
  sessionId = "ses_sim_001",
  trialId = "trl_001",
  scenarioName = "Right Turn Motor Imagery",
  onSync,
  onEStop,
  isLoading = false,
  className,
}: LiveHeaderProps) {
  return (
    <div
      className={cn(
        "p-5 rounded-2xl border border-slate-200 bg-white shadow-xs font-sans",
        className
      )}
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Title & Operational Context */}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
              Control Station
            </span>
            <ModeBadge mode={mode} />
            <RealtimeStatusBadge />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Live Command Center
          </h1>
          <p className="text-xs text-slate-500">
            Realtime neural decoding, safety arbitration, and virtual mobility dispatch.
          </p>

          {/* Session & Trial Context Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-2xs font-mono text-slate-500">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-slate-700">SESSION:</span>
              <span className="text-blue-700 font-bold">{sessionId}</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-slate-700">TRIAL:</span>
              <span className="text-slate-800">{trialId}</span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-slate-700">SCENARIO:</span>
              <span className="text-slate-800 font-medium">{scenarioName}</span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            loading={isLoading}
            icon={<RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
          >
            Sync Telemetry
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={onEStop}
            icon={<Power className="w-3.5 h-3.5" />}
          >
            EMERGENCY STOP
          </Button>
        </div>
      </div>
    </div>
  );
}
