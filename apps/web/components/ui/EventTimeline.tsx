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
      <div className="p-6 text-center text-xs text-slate-500 font-sans">
        No recent canonical events recorded in local buffer.
      </div>
    );
  }

  return (
    <div className={`space-y-2.5 ${className || ""}`}>
      {events.map((evt) => (
        <div
          key={evt.id}
          className="flex items-start justify-between p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50/70 text-xs transition-colors shadow-xs"
        >
          <div className="flex items-start gap-2.5">
            <Clock className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-900 font-sans">
                {evt.type}
              </div>
              <div className="text-slate-600 text-[11px] mt-0.5 font-normal">
                {evt.summary}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {evt.status && <StatusBadge status={evt.status} size="sm" />}
            <span className="text-[11px] text-slate-400 font-medium">
              {formatTimestamp(evt.timestamp)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
