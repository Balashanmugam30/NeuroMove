"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface ChannelSelectorProps {
  channels?: string[];
  selectedChannel?: string;
  onSelectChannel?: (channel: string) => void;
  className?: string;
}

export function ChannelSelector({
  channels = ["C3", "Cz", "C4"],
  selectedChannel = "ALL",
  onSelectChannel,
  className,
}: ChannelSelectorProps) {
  const options = ["ALL", ...channels];

  return (
    <div
      data-testid="channel-selector"
      className={cn(
        "inline-flex items-center p-1 rounded-xl bg-slate-100/80 border border-slate-200 shadow-2xs",
        className
      )}
    >
      <span className="text-3xs font-bold uppercase tracking-wider text-slate-400 px-2 select-none">
        Filter
      </span>
      {options.map((ch) => {
        const isSelected = selectedChannel === ch;
        return (
          <button
            key={ch}
            type="button"
            onClick={() => onSelectChannel?.(ch)}
            className={cn(
              "px-3 py-1 text-xs font-mono font-bold rounded-lg transition-all focus:outline-hidden focus:ring-2 focus:ring-blue-500",
              isSelected
                ? "bg-white text-blue-700 shadow-2xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent"
            )}
          >
            {ch}
          </button>
        );
      })}
    </div>
  );
}
