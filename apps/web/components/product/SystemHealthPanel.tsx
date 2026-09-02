"use client";

import React from "react";
import Link from "next/link";
import {
  Activity,
  Layers,
  FlaskConical,
  Gauge,
  ShieldCheck,
  Cpu,
  Database,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { SubsystemHealthCard } from "@neuromove/contracts";

interface SystemHealthPanelProps {
  subsystems: Record<string, SubsystemHealthCard>;
}

const SUBSYSTEM_ICONS: Record<string, React.ReactNode> = {
  acquisition: <Activity className="w-4 h-4 text-blue-600" />,
  multimodal_sensors: <Layers className="w-4 h-4 text-teal-600" />,
  decoding: <FlaskConical className="w-4 h-4 text-indigo-600" />,
  confidence_intent: <Gauge className="w-4 h-4 text-purple-600" />,
  safety: <ShieldCheck className="w-4 h-4 text-emerald-600" />,
  hardware_hil: <Cpu className="w-4 h-4 text-sky-600" />,
  research: <Database className="w-4 h-4 text-amber-600" />,
};

export function SystemHealthPanel({ subsystems }: SystemHealthPanelProps) {
  const cards = Object.values(subsystems);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "HEALTHY":
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        };
      case "READY":
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />,
          bg: "bg-blue-50 text-blue-700 border-blue-200",
        };
      case "DEGRADED":
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />,
          bg: "bg-amber-50 text-amber-700 border-amber-200",
        };
      default:
        return {
          icon: <XCircle className="w-3.5 h-3.5 text-rose-600" />,
          bg: "bg-rose-50 text-rose-700 border-rose-200",
        };
    }
  };

  return (
    <div className="space-y-3 font-sans">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 tracking-tight">
          Subsystem Health & Live Operational Matrix
        </h3>
        <span className="text-xs text-slate-500">7 Subsystems Active</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {cards.map((card) => {
          const badge = getStatusBadge(card.status);
          const icon = SUBSYSTEM_ICONS[card.subsystem_id] || (
            <Activity className="w-4 h-4 text-slate-600" />
          );

          return (
            <div
              key={card.subsystem_id}
              className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                      {icon}
                    </div>
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {card.name}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-bold rounded-full border ${badge.bg}`}
                  >
                    {badge.icon}
                    {card.status}
                  </span>
                </div>

                <p className="text-2xs text-slate-600 leading-relaxed line-clamp-2">
                  {card.summary}
                </p>

                {/* Key Metrics */}
                {card.key_metrics && Object.keys(card.key_metrics).length > 0 && (
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                    {Object.entries(card.key_metrics).map(([k, v]) => (
                      <div
                        key={k}
                        className="flex items-center justify-between text-2xs text-slate-500 font-mono"
                      >
                        <span className="text-slate-400 capitalize">{k.replace(/_/g, " ")}:</span>
                        <span className="font-semibold text-slate-700">
                          {Array.isArray(v) ? v.join(", ") : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-2xs text-slate-400 font-mono">
                  {card.source_type}
                </span>
                <Link
                  href={card.route_href}
                  className="inline-flex items-center gap-1 text-2xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <span>Open Lab</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
