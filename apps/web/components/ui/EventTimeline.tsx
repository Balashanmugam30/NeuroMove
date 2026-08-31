import React from "react";
import { formatTimestamp } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { Clock } from "lucide-react";

export interface TimelineEventItem {
  id: string;
  timestamp: string;
  type: string;
  summary: string;
  status?: string;
}

interface EventTimelineProps {
  events: TimelineEventItem[];
  className?: string;
}

export function EventTimeline({ events, className }: EventTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="p-4 text-center text-xs font-mono text-slate-400">
        No recent canonical events recorded.
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className || ""}`}>
      {events.map((evt) => (
        <div
          key={evt.id}
          className="flex items-start justify-between p-2.5 rounded border border-slate-800/80 bg-slate-900/40 text-xs font-mono"
        >
          <div className="flex items-start gap-2.5">
            <Clock className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-200">{evt.type}</div>
              <div className="text-slate-400 text-[11px] mt-0.5">
                {evt.summary}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {evt.status && <StatusBadge status={evt.status} size="sm" />}
            <span className="text-[10px] text-slate-400">
              {formatTimestamp(evt.timestamp)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
