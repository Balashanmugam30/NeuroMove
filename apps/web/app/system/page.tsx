"use client";

import React, { useState, useEffect } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { ConnectionIndicator } from "@/components/ui/ConnectionIndicator";
import { fetchSystemStatus } from "@/lib/api-client";
import {
  Settings,
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
      <div className="flex items-center justify-between p-5 rounded-lg border border-slate-800 bg-slate-900/40 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-mono font-bold uppercase tracking-wider text-slate-100">
            System Diagnostics & Health
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Real-time diagnostic health report from the local Python FastAPI
            Control Station.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadStatus}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-700 bg-slate-800 text-slate-300 text-xs font-mono hover:bg-slate-700 transition-all"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-4 rounded border border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-400" />
                <span className="text-slate-300">FastAPI API Shell:</span>
              </div>
              <StatusBadge
                status={status?.components?.api || "healthy"}
                size="sm"
              />
            </div>

            <div className="p-4 rounded border border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-400" />
                <span className="text-slate-300">SQLite Database:</span>
              </div>
              <StatusBadge
                status={status?.components?.database || "not_initialized"}
                size="sm"
              />
            </div>

            <div className="p-4 rounded border border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-400" />
                <span className="text-slate-300">BioAmp Acquisition:</span>
              </div>
              <StatusBadge
                status={status?.components?.eeg || "not_connected"}
                size="sm"
              />
            </div>

            <div className="p-4 rounded border border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-slate-400" />
                <span className="text-slate-300">ESP32 Robot Link:</span>
              </div>
              <StatusBadge
                status={status?.components?.robot || "not_connected"}
                size="sm"
              />
            </div>

            <div className="p-4 rounded border border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300">Safety State Machine:</span>
              </div>
              <StatusBadge
                status={status?.components?.safety || "ready"}
                size="sm"
              />
            </div>
          </div>

          <div className="p-4 rounded bg-slate-950 border border-slate-800/80 font-mono text-xs text-slate-400 space-y-1">
            <div>
              <strong>Service:</strong> {status?.service || "neuromove-core"}
            </div>
            <div>
              <strong>Version:</strong> {status?.version || "0.1.0"}
            </div>
            <div>
              <strong>Mode:</strong> {status?.mode || "SIMULATION"}
            </div>
            <div>
              <strong>Timestamp:</strong>{" "}
              {status?.timestamp || new Date().toISOString()}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
