"use client";

import React from "react";
import {
  Intent,
  RuntimeState,
  SafetyDecision,
} from "@neuromove/contracts";
import {
  Brain,
  Gauge,
  Activity,
  Radar,
  ShieldCheck,
  Bot,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PipelineFlowStripProps {
  intent: Intent;
  confidence: number;
  runtimeState: RuntimeState;
  obstaclePresent: boolean;
  decision: SafetyDecision;
  robotMotion: string;
  className?: string;
}

export function PipelineFlowStrip({
  intent,
  confidence,
  runtimeState,
  obstaclePresent,
  decision,
  robotMotion,
  className,
}: PipelineFlowStripProps) {
  const isIntentActive = intent !== "NONE" && intent !== "UNCERTAIN";
  const isConfidenceHigh = confidence >= 0.7;
  const isStateExecuting =
    runtimeState === "EXECUTING" || runtimeState === "CONFIRMED";
  const isSafetyApproved = decision === "APPROVED";
  const isRobotMoving = robotMotion !== "STOPPED" && robotMotion !== "IDLE";

  const stages = [
    {
      id: "intent",
      label: "1. Intent",
      value: intent,
      icon: <Brain className="w-3.5 h-3.5" />,
      active: isIntentActive,
      statusColor: isIntentActive ? "text-blue-700 bg-blue-50 border-blue-200" : "text-slate-500 bg-slate-50 border-slate-200",
    },
    {
      id: "confidence",
      label: "2. Confidence",
      value: `${(confidence * 100).toFixed(0)}%`,
      icon: <Gauge className="w-3.5 h-3.5" />,
      active: isConfidenceHigh,
      statusColor: isConfidenceHigh ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-amber-700 bg-amber-50 border-amber-200",
    },
    {
      id: "state",
      label: "3. Runtime State",
      value: runtimeState,
      icon: <Activity className="w-3.5 h-3.5" />,
      active: isStateExecuting,
      statusColor: runtimeState === "EMERGENCY" ? "text-red-700 bg-red-50 border-red-200" : isStateExecuting ? "text-blue-700 bg-blue-50 border-blue-200" : "text-slate-600 bg-slate-50 border-slate-200",
    },
    {
      id: "environment",
      label: "4. Environment",
      value: obstaclePresent ? "HAZARD" : "CLEAR",
      icon: <Radar className="w-3.5 h-3.5" />,
      active: !obstaclePresent,
      statusColor: obstaclePresent ? "text-amber-700 bg-amber-50 border-amber-200" : "text-emerald-700 bg-emerald-50 border-emerald-200",
    },
    {
      id: "safety",
      label: "5. Arbitration",
      value: decision,
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      active: isSafetyApproved,
      statusColor: isSafetyApproved ? "text-emerald-700 bg-emerald-50 border-emerald-200" : decision === "BLOCKED" ? "text-amber-700 bg-amber-50 border-amber-200" : "text-red-700 bg-red-50 border-red-200",
    },
    {
      id: "robot",
      label: "6. Mobility",
      value: robotMotion,
      icon: <Bot className="w-3.5 h-3.5" />,
      active: isRobotMoving,
      statusColor: isRobotMoving ? "text-blue-700 bg-blue-50 border-blue-200" : "text-slate-600 bg-slate-50 border-slate-200",
    },
  ];

  return (
    <div
      className={cn(
        "p-3 rounded-xl border border-slate-200 bg-white shadow-xs font-sans select-none overflow-x-auto",
        className
      )}
    >
      <div className="flex items-center justify-between min-w-[720px] gap-2">
        {stages.map((st, idx) => (
          <React.Fragment key={st.id}>
            <div
              className={cn(
                "flex-1 p-2 rounded-lg border flex flex-col justify-between transition-all",
                st.statusColor
              )}
            >
              <div className="flex items-center justify-between text-2xs font-semibold uppercase tracking-wider opacity-80 mb-0.5">
                <span className="flex items-center gap-1">
                  {st.icon}
                  {st.label}
                </span>
                {st.active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                )}
              </div>
              <div className="text-xs font-bold font-mono truncate">
                {st.value}
              </div>
            </div>

            {idx < stages.length - 1 && (
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
