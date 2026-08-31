"use client";

import React, { useState, useEffect } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { fetchSystemStatus } from "@/lib/api-client";
import {
  RefreshCw,
  Cpu,
  Database,
  Activity,
  ShieldCheck,
  Bot,
} from "lucide-react";

export default function SystemDiagnosticsPage() {
  const { operatingMode } = useMode();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const data = await fetchSystemStatus();
      setStatus(data);
    } catch {
      // Keep fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
            System Diagnostics & Health
          </h1>
          <p className="text-xs text-slate-500 font-sans mt-1">
            Real-time diagnostic health report from the local Python FastAPI
            Control Station.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadStatus}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 shadow-xs transition-all"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            <span>Poll Health</span>
          </button>
          <ModeBadge mode={operatingMode} />
        </div>
      </div>

      <SectionCard
        title="Local Control Station Subsystems"
        description="GET /api/system/status diagnostic health telemetry"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-sans">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                <Cpu className="w-4 h-4 text-blue-600" />
                <span>FastAPI API Shell:</span>
              </div>
              <StatusBadge
                status={status?.components?.api || "healthy"}
                size="sm"
              />
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                <Database className="w-4 h-4 text-teal-600" />
                <span>SQLite Database:</span>
              </div>
              <StatusBadge
                status={status?.components?.database || "not_initialized"}
                size="sm"
              />
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                <Activity className="w-4 h-4 text-amber-600" />
                <span>BioAmp Acquisition:</span>
              </div>
              <StatusBadge
                status={status?.components?.eeg || "not_connected"}
                size="sm"
              />
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                <Bot className="w-4 h-4 text-slate-500" />
                <span>ESP32 Robot Link:</span>
              </div>
              <StatusBadge
                status={status?.components?.robot || "not_connected"}
                size="sm"
              />
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Safety State Machine:</span>
              </div>
              <StatusBadge
                status={status?.components?.safety || "ready"}
                size="sm"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-sans text-slate-600 space-y-1">
            <div>
              <strong className="text-slate-900">Service:</strong>{" "}
              {status?.service || "neuromove-core"}
            </div>
            <div>
              <strong className="text-slate-900">Version:</strong>{" "}
              {status?.version || "0.1.0"}
            </div>
            <div>
              <strong className="text-slate-900">Mode:</strong>{" "}
              {status?.mode || "SIMULATION"}
            </div>
            <div>
              <strong className="text-slate-900">Timestamp:</strong>{" "}
              {status?.timestamp || new Date().toISOString()}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
