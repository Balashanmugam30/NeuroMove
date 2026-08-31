"use client";

import React, { useState } from "react";
import { formatTimestamp } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { Clock, Filter, ShieldCheck, Activity, Bot, Zap, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimelineEventItem {
  id: string;
  timestamp: string;
  type: string;
  summary: string;
  status?: string;
  sequence?: number;
  source?: string;
  severity?: "info" | "warning" | "danger" | "success";
}

interface EventTimelineProps {
  events: TimelineEventItem[];
  maxEvents?: number;
  className?: string;
  showFilters?: boolean;
}

export function EventTimeline({
  events,
  maxEvents = 50,
  className,
  showFilters = false,
}: EventTimelineProps) {
  const [filterType, setFilterType] = useState<string>("ALL");

  const getEventIcon = (type: string) => {
    if (type.includes("SAFETY") || type.includes("EMERGENCY")) {
      return <ShieldCheck className="w-3.5 h-3.5 text-red-600" />;
    }
    if (type.includes("ROBOT")) {
      return <Bot className="w-3.5 h-3.5 text-blue-600" />;
    }
    if (type.includes("EEG") || type.includes("PREDICTION")) {
      return <Zap className="w-3.5 h-3.5 text-teal-600" />;
    }
    if (type.includes("SESSION") || type.includes("TRIAL")) {
      return <Activity className="w-3.5 h-3.5 text-purple-600" />;
    }
    return <Cpu className="w-3.5 h-3.5 text-slate-400" />;
  };

  const filtered = events
    .filter((e) => filterType === "ALL" || e.type.includes(filterType))
    .slice(0, maxEvents);

  return (
    <div className={cn("space-y-3 font-sans", className)}>
      {showFilters && (
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 text-2xs">
          <div className="flex items-center gap-1 text-slate-500 font-semibold uppercase tracking-wider">
            <Filter className="w-3 h-3" />
            Filter Stream:
          </div>
          <div className="flex gap-1">
            {["ALL", "SAFETY", "ROBOT", "EEG", "SESSION"].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilterType(f)}
                className={cn(
                  "px-2 py-0.5 rounded font-mono font-medium border transition-all",
                  filterType === f
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          No canonical event envelopes matching criteria.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((evt) => (
            <div
              key={evt.id}
              className="flex items-start justify-between p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50/70 text-xs transition-colors shadow-2xs font-sans"
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5">{getEventIcon(evt.type)}</div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 font-mono text-2xs">
                      {evt.type}
                    </span>
                    {evt.sequence !== undefined && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 text-slate-500 border border-slate-200">
                        seq:{evt.sequence}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-600 text-[11px] font-normal leading-normal">
                    {evt.summary}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-3">
                {evt.status && <StatusBadge status={evt.status} size="sm" />}
                <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimestamp(evt.timestamp)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
