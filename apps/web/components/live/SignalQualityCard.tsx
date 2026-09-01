"use client";

import React from "react";
import { SignalQualityMetrics } from "@neuromove/contracts";
import { Waves, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignalQualityCardProps {
  metrics?: SignalQualityMetrics | null;
  sampleRateHz?: number;
  isConnected?: boolean;
  className?: string;
}

export function SignalQualityCard({
  metrics,
  sampleRateHz = 250,
  isConnected = true,
  className,
}: SignalQualityCardProps) {
  const qualityScore = isConnected ? metrics?.overall_score ?? 0.94 : 0.0;
  const droppedSamples = metrics?.dropped_samples ?? 0;
  const channelSnr: Record<string, number> = (metrics?.channels as Record<string, number>) || {
    C3: 18.2,
    Cz: 19.5,
    C4: 17.8,
  };

  const getQualityTier = (score: number, connected: boolean) => {
    if (!connected || score === 0) {
      return {
        label: "DISCONNECTED",
        badge: "bg-red-50 text-red-700 border-red-200",
        icon: <XCircle className="w-3.5 h-3.5 text-red-600" />,
      };
    }
    if (score >= 0.8) {
      return {
        label: "GOOD (HIGH SNR)",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
      };
    }
    if (score >= 0.5) {
      return {
        label: "FAIR (MODERATE NOISE)",
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />,
      };
    }
    return {
      label: "POOR (LEAD-OFF / ARTIFACT)",
      badge: "bg-red-50 text-red-700 border-red-200",
      icon: <XCircle className="w-3.5 h-3.5 text-red-600" />,
    };
  };

  const tier = getQualityTier(qualityScore, isConnected);

  return (
    <div
      data-testid="signal-quality-card"
      className={cn(
        "p-4 rounded-xl border border-slate-200 bg-white shadow-xs font-sans flex flex-col justify-between transition-all",
        className
      )}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
              <Waves className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                EEG Signal Quality
              </h3>
              <p className="text-2xs text-slate-400 font-normal">
                Multi-channel SMR electrophysiology
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-2xs font-mono font-semibold uppercase bg-slate-100 text-slate-600 border border-slate-200">
            SYNTHETIC EEG
          </span>
        </div>

        {/* Quality Banner */}
        <div className="mt-3 flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200/80">
          <div>
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">
              Stream Health Status
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded border",
                  tier.badge
                )}
              >
                {tier.icon}
                {tier.label}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">
              Quality Score
            </span>
            <span className="text-lg font-bold font-mono text-slate-900">
              {(qualityScore * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Channel SNR Badges */}
        <div className="mt-3 space-y-1.5">
          <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 block">
            Channel Electrodes (10-20 Standard)
          </span>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
            {Object.entries(channelSnr).map(([ch, snr]) => (
              <div
                key={ch}
                className="p-2 rounded-lg bg-slate-50 border border-slate-200"
              >
                <span className="text-2xs font-bold text-slate-600 block">
                  {ch}
                </span>
                <span className="text-xs font-semibold text-teal-700">
                  {isConnected ? `${Number(snr).toFixed(1)} dB` : "OFFLINE"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-2xs text-slate-500 font-mono">
        <div>
          <span className="text-slate-400">Sampling Rate: </span>
          <span className="font-semibold text-slate-700">{sampleRateHz} Hz</span>
        </div>
        <div className="text-right">
          <span className="text-slate-400">Dropped: </span>
          <span
            className={cn(
              "font-semibold",
              droppedSamples > 0 ? "text-red-600" : "text-slate-700"
            )}
          >
            {droppedSamples} pkts
          </span>
        </div>
      </div>
    </div>
  );
}
