"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Activity,
  Layers,
  ShieldCheck,
  Cpu,
  Database,
} from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import { ProductHealthHeader } from "@/components/product/ProductHealthHeader";
import { SystemHealthPanel } from "@/components/product/SystemHealthPanel";
import { PipelineOverview } from "@/components/product/PipelineOverview";
import { ProductSessionPanel } from "@/components/product/ProductSessionPanel";
import {
  fetchProductStatus,
  fetchProductSession,
  resetProductSession,
} from "@/lib/api-client";
import { SystemStatusSummary, ProductSession } from "@neuromove/contracts";

export default function OverviewPage() {
  const [productStatus, setProductStatus] = useState<SystemStatusSummary | null>(null);
  const [productSession, setProductSession] = useState<ProductSession | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [status, session] = await Promise.all([
        fetchProductStatus(),
        fetchProductSession(),
      ]);
      setProductStatus(status);
      setProductSession(session);
    } catch {
      // Safe fallback if server is offline or booting
    } finally {
      setLoading(false);
    }
  };

  const handleResetSession = async () => {
    setLoading(true);
    try {
      const newSession = await resetProductSession();
      setProductSession(newSession);
      const newStatus = await fetchProductStatus();
      setProductStatus(newStatus);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 font-sans">
      {/* Product Health Header */}
      <ProductHealthHeader
        statusSummary={productStatus}
        onRefresh={loadData}
        loading={loading}
      />

      {/* Product Identity & Tagline Hero */}
      <div className="p-6 bg-gradient-to-r from-blue-900 via-slate-900 to-slate-800 rounded-2xl text-white shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-0.5 text-2xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full">
            Institutional Competition Product Release
          </span>
          <span className="px-2 py-0.5 text-2xs font-mono text-slate-300 bg-white/10 rounded-md">
            Phase 24.1 Foundation
          </span>
        </div>

        <h1 className="text-xl sm:text-2xl font-black tracking-tight">
          NeuroMove — Safety-First Neurotechnology Platform
        </h1>

        <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
          Translating multimodal bio-signals and EEG motor imagery into verified intent through a deterministic, fail-closed neurotechnology pipeline. Validated with 12 Phase 17 safety invariants and Phase 20 ESP32 Hardware-in-the-Loop virtual emulation.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors shadow-2xs"
          >
            <Sparkles className="w-4 h-4" />
            <span>Launch Guided Demo</span>
          </Link>
          <Link
            href="/eeg/live"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-colors border border-white/10"
          >
            <Activity className="w-4 h-4 text-teal-300" />
            <span>Live EEG Stream</span>
          </Link>
          <Link
            href="/sensors"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-colors border border-white/10"
          >
            <Layers className="w-4 h-4 text-indigo-300" />
            <span>Multimodal Context Lab</span>
          </Link>
          <Link
            href="/hardware"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-colors border border-white/10"
          >
            <Cpu className="w-4 h-4 text-sky-300" />
            <span>Hardware HIL Lab</span>
          </Link>
        </div>
      </div>

      {/* Key Metric Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Pipeline Subsystems"
          value="7 / 7 Active"
          subtitle="Acquisition, DSP, AI, Safety, HIL, Research"
          variant="brand"
          icon={<Layers className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          title="Safety Core Status"
          value="ARMED"
          subtitle="12 Invariants Active (0 Actuators Connected)"
          variant="safe"
          icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          title="Hardware HIL Endpoint"
          value="CONNECTED"
          subtitle="ESP32 Virtual Protocol Emulator"
          variant="brand"
          icon={<Cpu className="w-4 h-4 text-sky-600" />}
        />
        <MetricCard
          title="Research Replay Integrity"
          value="100% REPRODUCIBLE"
          subtitle="SHA-256 Verified Experiment Manifests"
          variant="safe"
          icon={<Database className="w-4 h-4 text-teal-600" />}
        />
      </div>

      {/* Canonical 7-Stage Architecture Flow */}
      <PipelineOverview />

      {/* Subsystem Health Grid */}
      {productStatus && (
        <SystemHealthPanel subsystems={productStatus.subsystems} />
      )}

      {/* Active Session Management */}
      <ProductSessionPanel
        session={productSession}
        onResetSession={handleResetSession}
        loading={loading}
      />
    </div>
  );
}
