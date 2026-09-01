"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface EEGChannelTopologyProps {
  selectedChannel?: string;
  onSelectChannel?: (channel: string) => void;
  className?: string;
}

export function EEGChannelTopology({
  selectedChannel = "ALL",
  onSelectChannel,
  className,
}: EEGChannelTopologyProps) {
  const electrodes = [
    {
      id: "C3",
      label: "C3",
      area: "Left Motor Cortex (Hand representation)",
      cx: 75,
      cy: 100,
      side: "LEFT",
    },
    {
      id: "Cz",
      label: "Cz",
      area: "Vertex / Central Midline (Leg/trunk)",
      cx: 120,
      cy: 100,
      side: "MIDLINE",
    },
    {
      id: "C4",
      label: "C4",
      area: "Right Motor Cortex (Hand representation)",
      cx: 165,
      cy: 100,
      side: "RIGHT",
    },
  ];

  return (
    <div
      data-testid="eeg-channel-topology"
      className={cn(
        "p-5 rounded-xl border border-slate-200 bg-white shadow-xs font-sans",
        className
      )}
    >
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
            10-20 Standard Montage
          </span>
          <h3 className="text-sm font-bold text-slate-900">
            Sensorimotor Strip (Central Sulcus)
          </h3>
        </div>
        <span className="text-3xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
          3 Electrodes
        </span>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row items-center gap-6">
        {/* Scalp Schematic SVG */}
        <div className="relative shrink-0 flex items-center justify-center">
          <svg
            width="240"
            height="200"
            viewBox="0 0 240 200"
            className="select-none"
            aria-label="10-20 EEG electrode topology schematic"
          >
            {/* Nose indicator */}
            <polygon
              points="120,8 110,25 130,25"
              fill="#E2E8F0"
              stroke="#94A3B8"
              strokeWidth="1.5"
            />

            {/* Left Ear */}
            <path
              d="M 35 90 C 25 90 25 110 35 110"
              fill="none"
              stroke="#94A3B8"
              strokeWidth="1.5"
            />

            {/* Right Ear */}
            <path
              d="M 205 90 C 215 90 215 110 205 110"
              fill="none"
              stroke="#94A3B8"
              strokeWidth="1.5"
            />

            {/* Head perimeter circle */}
            <circle
              cx="120"
              cy="100"
              r="85"
              fill="#F8FAFC"
              stroke="#CBD5E1"
              strokeWidth="2"
            />

            {/* Central sulcus guide line */}
            <line
              x1="45"
              y1="100"
              x2="195"
              y2="100"
              stroke="#E2E8F0"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />

            {/* Saggital midline guide line */}
            <line
              x1="120"
              y1="20"
              x2="120"
              y2="180"
              stroke="#E2E8F0"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />

            {/* Electrode circles */}
            {electrodes.map((el) => {
              const isSelected =
                selectedChannel === "ALL" || selectedChannel === el.id;
              const isDirectTarget = selectedChannel === el.id;

              return (
                <g
                  key={el.id}
                  className="cursor-pointer transition-transform duration-150 hover:scale-110"
                  onClick={() => onSelectChannel?.(el.id)}
                >
                  <circle
                    cx={el.cx}
                    cy={el.cy}
                    r={isDirectTarget ? 16 : 14}
                    fill={isSelected ? "#2563EB" : "#94A3B8"}
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                    className="shadow-sm"
                  />
                  <text
                    x={el.cx}
                    y={el.cy + 4}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="11"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {el.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Channel Details & Descriptions */}
        <div className="space-y-2 w-full">
          {electrodes.map((el) => {
            const isSelected =
              selectedChannel === "ALL" || selectedChannel === el.id;

            return (
              <div
                key={el.id}
                onClick={() => onSelectChannel?.(el.id)}
                className={cn(
                  "p-2.5 rounded-lg border text-left cursor-pointer transition-colors",
                  isSelected
                    ? "bg-blue-50/60 border-blue-200"
                    : "bg-slate-50/60 border-slate-200 hover:bg-slate-100"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-mono text-slate-900">
                    {el.label} ({el.side})
                  </span>
                  <span className="text-3xs font-mono font-medium text-slate-500">
                    10-20 Standard
                  </span>
                </div>
                <p className="text-2xs text-slate-600 mt-0.5">{el.area}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
