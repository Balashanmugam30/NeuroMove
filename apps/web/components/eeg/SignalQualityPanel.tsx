"use client";

import React from "react";
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from "lucide-react";
import { SignalQualityMetrics } from "@neuromove/contracts";
import { cn } from "@/lib/utils";

interface SignalQualityPanelProps {
  metrics?: SignalQualityMetrics | null;
  isConnected?: boolean;
  activeFaults?: string[];
  className?: string;
}

export function SignalQualityPanel({
  metrics,
  isConnected = true,
  activeFaults = [],
  className,
}: SignalQualityPanelProps) {
  const overallScore = isConnected ? metrics?.overall_score ?? 0.95 : 0.0;
  const droppedSamples = metrics?.dropped_samples ?? 0;
  const channelSnrs = (metrics?.channels as Record<string, number>) || {
    C3: 18.4,
    Cz: 19.1,
    C4: 17.6,
  };

  const getTier = (score: number, connected: boolean) => {
    if (!connected || score === 0) {
      return {
        label: "DISCONNECTED",
        color: "text-red-700 bg-red-50 border-red-200",
        icon: XCircle,
      };
    }
    if (score >= 0.85) {
      return {
        label: "EXCELLENT",
        color: "text-emerald-700 bg-emerald-50 border-emerald-200",
        icon: CheckCircle2,
      };
    }
    if (score >= 0.7) {
      return {
        label: "ACCEPTABLE",
        color: "text-amber-700 bg-amber-50 border-amber-200",
        icon: AlertTriangle,
      };
    }
    return {
      label: "DEGRADED",
      color: "text-rose-700 bg-rose-50 border-rose-200",
      icon: XCircle,
    };
  };

  const tier = getTier(overallScore, isConnected);
  const TierIcon = tier.icon;

  const channelMetadata: Record<string, { area: string }> = {
    C3: { area: "Left Motor Cortex" },
    Cz: { area: "Central Midline" },
    C4: { area: "Right Motor Cortex" },
  };

  return (
    <div
      data-testid="signal-quality-panel"
      className={cn(
        "p-5 rounded-xl border border-slate-200 bg-white shadow-xs font-sans",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-teal-50 border border-teal-200">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 block">
              Electrode Integrity
            </span>
            <h3 className="text-base font-bold text-slate-900">
              Signal Quality & Diagnostics
            </h3>
          </div>
        </div>

        {/* Status Tier Badge */}
        <div
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold font-mono",
            tier.color
          )}
        >
          <TierIcon className="w-3.5 h-3.5" />
          <span>{tier.label}</span>
          <span>({Math.round(overallScore * 100)}%)</span>
        </div>
      </div>

      {/* Active Fault Alerts */}
      {activeFaults.length > 0 && (
        <div className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-2xs text-red-700 font-mono">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
          <span className="font-bold">Active Simulation Fault:</span>
          <span>{activeFaults.join(", ")}</span>
        </div>
      )}

      {/* Channel Quality Matrix Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-2xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/50">
              <th className="py-2 px-3">Channel</th>
              <th className="py-2 px-3">Cortical Area</th>
              <th className="py-2 px-3">SNR (dB)</th>
              <th className="py-2 px-3">Continuity</th>
              <th className="py-2 px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-2xs">
            {Object.entries(channelSnrs).map(([ch, snr]) => {
              const meta = channelMetadata[ch] || { area: "Cerebral Cortex" };
              const isChOk = isConnected && snr >= 12.0;

              return (
                <tr key={ch} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-slate-900">
                    {ch}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-slate-600">
                    {meta.area}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-teal-700">
                    {isConnected ? `${Number(snr).toFixed(1)} dB` : "OFFLINE"}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">
                    {droppedSamples === 0 ? "100% OK" : `${droppedSamples} Drops`}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded font-bold text-3xs",
                        isChOk
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      )}
                    >
                      {isChOk ? "NOMINAL" : "FAULT / LEAD-OFF"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Metrics */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-400 font-mono">
        <span>Artifact Flags: {metrics?.artifact_flags?.length || 0} active</span>
        <span>Dropped Samples: {droppedSamples}</span>
      </div>
    </div>
  );
}
