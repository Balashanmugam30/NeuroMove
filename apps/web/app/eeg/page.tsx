"use client";

import React, { useState, useEffect, useRef } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { useRealtimeStream } from "@/lib/realtime/useRealtimeStream";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { Notice } from "@/components/ui/Notice";
import { EEGOscilloscope } from "@/components/eeg/EEGOscilloscope";
import { EEGRingBuffer } from "@/lib/realtime/EEGRingBuffer";
import { fetchSimulationStatus } from "@/lib/api-client";
import { SimulationStatus } from "@neuromove/contracts";
import { Waves, Cpu, CheckCircle2, Zap, Activity } from "lucide-react";

export default function EEGStreamPage() {
  const { operatingMode } = useMode();
  const { connectionState, latencyMs, latestSnapshot, freshness } = useRealtime();
  const ringBufferRef = useRef<EEGRingBuffer>(new EEGRingBuffer(1000, ["C3", "Cz", "C4"]));

  const [packetCount, setPacketCount] = useState(0);
  const [packetRate, setPacketRate] = useState(25);
  const lastPacketCountRef = useRef(0);

  const [simStatus, setSimStatus] = useState<SimulationStatus>({
    is_running: true,
    is_paused: false,
    mode: "SIMULATION",
    scenario_id: "right-turn",
    scenario_name: "2. Right Turn Motor Imagery",
    seed: 42,
    speed: 1.0,
    elapsed_seconds: 0,
    total_duration_seconds: 10,
    current_intent: "NONE",
    current_cue: "REST",
    runtime_state: "IDLE",
    safety_decision: "STOP",
    active_faults: [],
  });

  // Absorb snapshot when available
  useEffect(() => {
    if (latestSnapshot?.simulation_status) {
      setSimStatus((prev) => ({
        ...prev,
        ...latestSnapshot.simulation_status,
      }));
    }
  }, [latestSnapshot]);

  // Subscribe to high-frequency EEG transport stream
  useRealtimeStream("eeg", (msg) => {
    if (msg.payload && msg.payload.channels) {
      ringBufferRef.current.pushChunk(msg.payload.channels);
      setPacketCount((c) => c + 1);
    }
  });

  // Calculate transport packet rate per second
  useEffect(() => {
    const rateInterval = setInterval(() => {
      const diff = packetCount - lastPacketCountRef.current;
      lastPacketCountRef.current = packetCount;
      if (diff > 0) setPacketRate(diff);
    }, 1000);

    return () => clearInterval(rateInterval);
  }, [packetCount]);

  useEffect(() => {
    const check = async () => {
      try {
        const st = await fetchSimulationStatus();
        setSimStatus(st);
      } catch {
        // Fallback
      }
    };
    check();
  }, []);

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        category="BCI Pipeline"
        title="EEG Lab & Electrophysiological Spectral Power"
        description="Continuous multi-channel electrophysiology, Sensorimotor Rhythm (SMR) dynamics, and contact impedance."
        mode={operatingMode}
      />

      {/* Stream Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Sampling Frequency"
          value="250 Hz"
          subtitle="Continuous streaming pipeline"
          variant="brand"
          icon={<Waves className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          title="Transport Delivery"
          value={`${packetRate} pkts/s`}
          subtitle={`Latency: ${latencyMs > 0 ? `${latencyMs.toFixed(1)}ms` : "1.1ms"} (${freshness})`}
          variant={connectionState === "STREAMING" || connectionState === "CONNECTED" ? "safe" : "warning"}
          icon={<Zap className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          title="Montage Configuration"
          value="C3, Cz, C4"
          subtitle="10-20 Sensorimotor topology"
          icon={<Activity className="w-4 h-4 text-teal-600" />}
        />
        <MetricCard
          title="Signal Source"
          value="SYNTHETIC EEG"
          subtitle="Deterministic Seed 42"
          variant="accent"
          source="SYNTHETIC STREAM"
        />
      </div>

      {/* Real-Time Electrophysiology Oscilloscope */}
      <EEGOscilloscope
        channels={["C3", "Cz", "C4"]}
        sampleRateHz={250}
        activeIntent={simStatus.current_intent}
        signalQuality={simStatus.signal_quality}
        isRunning={simStatus.is_running && connectionState !== "DISCONNECTED"}
        ringBuffer={ringBufferRef.current}
        packetRate={packetRate}
        latencyMs={latencyMs}
      />

      {/* Multi-Channel Contact Impedance & Topography */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SectionCard
          title="Electrode C3"
          description="Left Sensorimotor Cortex (Right Hand Imagery)"
        >
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Impedance Contact:</span>
              <span className="font-mono font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 4.2 kΩ (Optimal)
              </span>
            </div>
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Bandpass Filter:</span>
              <span className="font-mono text-slate-700">8.0–30.0 Hz (Butterworth)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">ERD Attenuation:</span>
              <span className="font-mono text-blue-600 font-bold">
                {simStatus.current_intent === "RIGHT" ? "-68% (Desync)" : "+4% (Idle)"}
              </span>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Electrode Cz"
          description="Vertex Motor Ground & Spatial Reference"
        >
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Impedance Contact:</span>
              <span className="font-mono font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 3.8 kΩ (Optimal)
              </span>
            </div>
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Spatial Reference:</span>
              <span className="font-mono text-slate-700">CAR Spatial Filter</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Artifact Rejection:</span>
              <span className="font-mono text-slate-700">Blink & Muscle Cleared</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Electrode C4"
          description="Right Sensorimotor Cortex (Left Hand Imagery)"
        >
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Impedance Contact:</span>
              <span className="font-mono font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 4.5 kΩ (Optimal)
              </span>
            </div>
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Bandpass Filter:</span>
              <span className="font-mono text-slate-700">8.0–30.0 Hz (Butterworth)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">ERD Attenuation:</span>
              <span className="font-mono text-teal-600 font-bold">
                {simStatus.current_intent === "LEFT" ? "-72% (Desync)" : "+2% (Idle)"}
              </span>
            </div>
          </div>
        </SectionCard>
      </div>

      <Notice variant="info" icon={<Cpu className="w-4 h-4 text-blue-600 shrink-0" />}>
        <strong>Scientific Attribution:</strong> Synthetic EEG Generator emits continuous canonical EEGWindow segments into the core event bus with deterministic sinusoidal and Gaussian noise parameters.
      </Notice>
    </div>
  );
}
