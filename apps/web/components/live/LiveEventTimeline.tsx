"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Activity,
  Shield,
  Bot,
  Brain,
} from "lucide-react";
import { cn, formatTimestamp } from "@/lib/utils";

export interface LiveTimelineEvent {
  id: string;
  timestamp: string;
  type: string;
  summary: string;
  status: string;
  sequence?: number;
  source?: string;
  mode?: string;
  correlationId?: string;
  schemaVersion?: string;
  payload?: any;
}

interface LiveEventTimelineProps {
  events: LiveTimelineEvent[];
  maxEvents?: number;
  className?: string;
}

export function LiveEventTimeline({
  events,
  maxEvents = 50,
  className,
}: LiveEventTimelineProps) {
  const [filter, setFilter] = useState<
    "ALL" | "NEURAL" | "SAFETY" | "ROBOT" | "SYSTEM"
  >("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getEventCategory = (type: string): "NEURAL" | "SAFETY" | "ROBOT" | "SYSTEM" => {
    const t = type.toUpperCase();
    if (t.includes("PREDICTION") || t.includes("INTENT") || t.includes("EEG") || t.includes("CUE")) {
      return "NEURAL";
    }
    if (t.includes("SAFETY") || t.includes("EMERGENCY") || t.includes("FAULT") || t.includes("RISK")) {
      return "SAFETY";
    }
    if (t.includes("ROBOT") || t.includes("COMMAND") || t.includes("ODOMETRY") || t.includes("OBSTACLE")) {
      return "ROBOT";
    }
    return "SYSTEM";
  };

  const getCategoryIcon = (category: "NEURAL" | "SAFETY" | "ROBOT" | "SYSTEM") => {
    switch (category) {
      case "NEURAL":
        return <Brain className="w-3.5 h-3.5 text-blue-600" />;
      case "SAFETY":
        return <Shield className="w-3.5 h-3.5 text-emerald-600" />;
      case "ROBOT":
        return <Bot className="w-3.5 h-3.5 text-amber-600" />;
      case "SYSTEM":
      default:
        return <Activity className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const filteredEvents = events.filter((evt) => {
    if (filter === "ALL") return true;
    return getEventCategory(evt.type) === filter;
  }).slice(0, maxEvents);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div
      data-testid="live-event-timeline"
      className={cn(
        "p-4 rounded-xl border border-slate-200 bg-white shadow-xs font-sans flex flex-col justify-between transition-all",
        className
      )}
    >
      <div>
        {/* Header & Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Canonical Event Stream
              </h3>
              <p className="text-2xs text-slate-400 font-normal">
                Monotonically sequenced event audit log
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-2xs font-semibold">
            {(["ALL", "NEURAL", "SAFETY", "ROBOT", "SYSTEM"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className={cn(
                  "px-2 py-1 rounded transition-colors",
                  filter === cat
                    ? "bg-white text-slate-900 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Event List */}
        <div className="mt-3 space-y-2 max-h-[440px] overflow-y-auto pr-1">
          {filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 font-medium">
              No canonical events recorded in this filter category.
            </div>
          ) : (
            filteredEvents.map((evt) => {
              const category = getEventCategory(evt.type);
              const isExpanded = expandedId === evt.id;

              return (
                <div
                  key={evt.id}
                  className="rounded-lg border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors overflow-hidden text-xs"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(evt.id)}
                    className="w-full text-left p-2.5 flex items-start gap-2.5"
                  >
                    <div className="mt-0.5 text-slate-400">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div className="p-1 rounded bg-white border border-slate-200 shadow-2xs shrink-0 mt-0.5">
                      {getCategoryIcon(category)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-mono text-2xs font-bold text-slate-800">
                            {evt.type}
                          </span>
                          {evt.sequence !== undefined && (
                            <span className="text-3xs font-mono text-slate-400">
                              #{evt.sequence}
                            </span>
                          )}
                        </div>
                        <span className="text-3xs font-mono text-slate-400 shrink-0">
                          {formatTimestamp(evt.timestamp)}
                        </span>
                      </div>
                      <p className="text-slate-600 text-2xs mt-0.5 truncate">
                        {evt.summary}
                      </p>
                    </div>
                  </button>

                  {/* Expanded Event Inspector Details */}
                  {isExpanded && (
                    <div className="p-3 bg-white border-t border-slate-200 text-2xs font-mono space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-slate-600 pb-2 border-b border-slate-100">
                        <div>
                          <span className="text-slate-400 block">EVENT ID:</span>
                          <span className="font-bold text-blue-700">{evt.id}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">SOURCE:</span>
                          <span>{evt.source || "neuromove.core"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">SCHEMA VERSION:</span>
                          <span>{evt.schemaVersion || "1.0.0"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">CORRELATION ID:</span>
                          <span>{evt.correlationId || "cor_000000000000"}</span>
                        </div>
                      </div>

                      {evt.payload && (
                        <div>
                          <span className="text-slate-400 block mb-1">
                            CANONICAL PAYLOAD:
                          </span>
                          <pre className="p-2 rounded bg-slate-50 border border-slate-200 overflow-x-auto text-3xs text-slate-800">
                            {JSON.stringify(evt.payload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Status */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-400 font-mono">
        <span>Total Buffered: {events.length}</span>
        <span>Ring Buffer: 50 slots</span>
      </div>
    </div>
  );
}
