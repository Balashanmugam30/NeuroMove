"use client";

import React from "react";
import {
  Activity,
  CheckCircle2,
  Copy,
  RotateCcw,
  Clock,
} from "lucide-react";
import { TransportMetrics } from "@neuromove/contracts";

interface ReliabilityMetricsCardProps {
  metrics: TransportMetrics | null;
}

export function ReliabilityMetricsCard({ metrics }: ReliabilityMetricsCardProps) {
  const sent = metrics?.commands_sent || 0;
  const acked = metrics?.commands_acknowledged || 0;
  const rejected = metrics?.commands_rejected || 0;
  const duplicates = metrics?.commands_duplicated || 0;
  const retries = metrics?.retries_total || 0;
  const avgRtt = metrics?.average_rtt_ms || 0;
  const p95Rtt = metrics?.p95_rtt_ms || 0;

  const ackRate = sent > 0 ? Math.round((acked / sent) * 100) : 100;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5 font-sans">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Command Transport Reliability & Quality Metrics
            </h4>
            <p className="text-xs text-slate-500">
              Deterministic ACK ratios, bounded retries, and transport latency distributions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">ACK Success Rate:</span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            {ackRate}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
          <div
            style={{ width: `${ackRate}%` }}
            className="bg-emerald-500 transition-all duration-500"
          />
          <div
            style={{ width: `${100 - ackRate}%` }}
            className="bg-red-400 transition-all duration-500"
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>Acknowledged: {acked}</span>
          <span>Failed / Rejected: {rejected}</span>
        </div>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Activity className="w-3 h-3 text-slate-400" /> Total Sent
          </span>
          <p className="text-lg font-bold text-slate-900 font-mono mt-1">{sent}</p>
          <span className="text-[10px] text-slate-400">Logical commands</span>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Acknowledged
          </span>
          <p className="text-lg font-bold text-emerald-700 font-mono mt-1">{acked}</p>
          <span className="text-[10px] text-slate-400">COMMAND_ACCEPTED</span>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Copy className="w-3 h-3 text-blue-500" /> Duplicates
          </span>
          <p className="text-lg font-bold text-blue-700 font-mono mt-1">{duplicates}</p>
          <span className="text-[10px] text-slate-400">Idempotent ACKs</span>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <RotateCcw className="w-3 h-3 text-amber-500" /> Retries Total
          </span>
          <p className="text-lg font-bold text-amber-700 font-mono mt-1">{retries}</p>
          <span className="text-[10px] text-slate-400">Bounded (max 3)</span>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3 text-teal-500" /> Avg RTT
          </span>
          <p className="text-lg font-bold text-teal-700 font-mono mt-1">{avgRtt} ms</p>
          <span className="text-[10px] text-slate-400">Round-trip latency</span>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3 text-teal-500" /> P95 RTT
          </span>
          <p className="text-lg font-bold text-teal-700 font-mono mt-1">{p95Rtt} ms</p>
          <span className="text-[10px] text-slate-400">95th percentile</span>
        </div>
      </div>
    </div>
  );
}
