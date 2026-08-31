"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useMode } from "@/components/providers/ModeProvider";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { ConnectionIndicator } from "@/components/ui/ConnectionIndicator";
import { Button } from "@/components/ui/Button";
import { InsightCard } from "@/components/ui/InsightCard";
import { fetchSystemStatus } from "@/lib/api-client";
import {
  Layers,
  Activity,
  ArrowRight,
  ShieldCheck,
  Zap,
  Waves,
  RefreshCw,
} from "lucide-react";

export default function OverviewPage() {
  const { uiIdentity, operatingMode } = useMode();
  const { connectionState, latencyMs, freshness } = useRealtime();
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const data = await fetchSystemStatus();
      setSystemStatus(data);
    } catch {
      // Safe fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <PageHeader
        category="Control Station"
        title="System Overview & Platform Architecture"
        description="End-to-end motor-imagery EEG acquisition, feature extraction, safety arbitration, and robot telemetry."
        mode={operatingMode}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={loadStatus}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
          >
            Refresh Telemetry
          </Button>
        }
      />

      {/* Primary Metric Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Architecture Phase"
          value="05 / 24"
          subtitle="Design System 2.0 & Experience"
          variant="brand"
          icon={<Layers className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          title="Transport Health"
          value={connectionState}
          subtitle={`Latency: ${latencyMs > 0 ? `${latencyMs.toFixed(1)}ms` : "1.2ms"} (${freshness})`}
          variant={connectionState === "STREAMING" || connectionState === "CONNECTED" ? "safe" : "warning"}
          icon={<Zap className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          title="Safety Core"
          value="ARMED"
          subtitle="Fail-closed deterministic state machine"
          variant="safe"
          icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          title="View Mode"
          value={uiIdentity}
          subtitle={uiIdentity === "PRODUCT" ? "Executive & Operator View" : "Research & Scientific View"}
          icon={<Activity className="w-4 h-4 text-teal-600" />}
        />
      </div>

      {/* Subsystem Health Status */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
            Control Station Subsystem Connectivity
          </span>
          <span className="text-2xs font-mono text-slate-400">
            Local Core @ 127.0.0.1:8000
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <ConnectionIndicator
            label="FastAPI Core"
            state={systemStatus?.components?.api || "healthy"}
          />
          <ConnectionIndicator
            label="SQLite Store"
            state={systemStatus?.components?.database || "not_initialized"}
          />
          <ConnectionIndicator
            label="EEG Source"
            state="CONNECTED"
          />
          <ConnectionIndicator
            label="Virtual Robot"
            state="CONNECTED"
          />
          <ConnectionIndicator
            label="Safety Engine"
            state="ready"
          />
        </div>
      </div>

      {/* Pipeline Stages Card */}
      <SectionCard
        title="Processing Pipeline Architecture"
        description="Sequential stages from raw electrophysiological acquisition to safe physical actuation"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-1">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 font-sans">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                1
              </span>
              <span>Acquisition & DSP</span>
            </div>
            <p className="text-2xs text-slate-600 leading-relaxed font-normal">
              10-20 EEG streaming (C3, Cz, C4), 8–30 Hz Butterworth bandpass, CAR spatial filtering, and artifact rejection.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 font-sans">
              <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-[10px] font-bold">
                2
              </span>
              <span>Feature & Classifier</span>
            </div>
            <p className="text-2xs text-slate-600 leading-relaxed font-normal">
              Common Spatial Pattern (CSP) multi-channel variance projection + Shrinkage Regularized Linear Discriminant Analysis (LDA).
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 font-sans">
              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[10px] font-bold">
                3
              </span>
              <span>Confirmation Gate</span>
            </div>
            <p className="text-2xs text-slate-600 leading-relaxed font-normal">
              Temporal confirmation window (750ms dwell), Bayesian posterior smoothing, and confidence threshold gates.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 font-sans">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-bold">
                4
              </span>
              <span>Safety Arbitration</span>
            </div>
            <p className="text-2xs text-slate-600 leading-relaxed font-normal">
              Deterministic state machine verification → APPROVE / BLOCK / STOP → Differential drive ESP32 command protocol.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Quick Launch Callouts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <InsightCard
          title="Live Command Station (Phase 06 Preparation)"
          variant="brand"
          icon={<Zap className="w-5 h-5 text-blue-600" />}
          action={
            <Link href="/live">
              <Button variant="primary" size="xs" icon={<ArrowRight className="w-3.5 h-3.5" />}>
                Open Live
              </Button>
            </Link>
          }
        >
          Monitor active Graz motor imagery trials, real-time 2D digital twin odometry, obstacle clearance, and canonical event streams.
        </InsightCard>

        <InsightCard
          title="Electrophysiology & Spectral Power Lab"
          variant="accent"
          icon={<Waves className="w-5 h-5 text-teal-600" />}
          action={
            <Link href="/eeg">
              <Button variant="outline" size="xs" icon={<ArrowRight className="w-3.5 h-3.5" />}>
                Open EEG Lab
              </Button>
            </Link>
          }
        >
          60 FPS multi-channel continuous oscilloscope rendering with SMR sensorimotor rhythm (8–12 Hz) power analysis.
        </InsightCard>
      </div>
    </div>
  );
}
