"use client";

import React, { useState, useEffect } from "react";
import { useMode } from "@/components/providers/ModeProvider";
import { ModeBadge } from "@/components/ui/ModeBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { EEGOscilloscope } from "@/components/eeg/EEGOscilloscope";
import { fetchSimulationStatus } from "@/lib/api-client";
import { SimulationStatus } from "@neuromove/contracts";
import { Cpu, CheckCircle2 } from "lucide-react";

export default function EEGStreamPage() {
  const { operatingMode } = useMode();
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
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
              EEG Signal Stream & Spectral Power
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
              SIMULATION
            </span>
          </div>
          <p className="text-xs text-slate-500 font-sans mt-1">
            Deterministic multi-channel electrophysiological time series and sensorimotor rhythm analysis.
          </p>
        </div>
        <ModeBadge mode={operatingMode} />
      </div>

      {/* Real-Time Electrophysiology Oscilloscope */}
      <EEGOscilloscope
        channels={["C3", "Cz", "C4"]}
        sampleRateHz={250}
        activeIntent={simStatus.current_intent}
        signalQuality={simStatus.signal_quality}
        isRunning={simStatus.is_running}
      />

      {/* Multi-Channel Contact Impedance & Topography */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SectionCard
          title="Electrode C3"
          description="Left Sensorimotor Cortex (Right Hand)"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Impedance Contact</span>
              <span className="font-mono font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 4.2 kΩ (Optimal)
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Bandpass Filter</span>
              <span className="font-mono text-slate-700">8.0 - 30.0 Hz (Butterworth)</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">ERD Attenuation</span>
              <span className="font-mono text-blue-600 font-semibold">
                {simStatus.current_intent === "RIGHT" ? "-68% (Desync)" : "+4% (Idle)"}
              </span>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Electrode Cz"
          description="Vertex Motor Ground & Reference"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Impedance Contact</span>
              <span className="font-mono font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 3.8 kΩ (Optimal)
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Common Average Ref</span>
              <span className="font-mono text-slate-700">CAR Spatial Filter</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Artifact Rejection</span>
              <span className="font-mono text-slate-700">Blink & Muscle Cleared</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Electrode C4"
          description="Right Sensorimotor Cortex (Left Hand)"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Impedance Contact</span>
              <span className="font-mono font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 4.5 kΩ (Optimal)
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Bandpass Filter</span>
              <span className="font-mono text-slate-700">8.0 - 30.0 Hz (Butterworth)</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">ERD Attenuation</span>
              <span className="font-mono text-teal-600 font-semibold">
                {simStatus.current_intent === "LEFT" ? "-72% (Desync)" : "+2% (Idle)"}
              </span>
            </div>
          </div>
        </SectionCard>
      </div>


      {/* Pipeline Information */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center gap-3">
        <Cpu className="w-5 h-5 text-blue-600 shrink-0" />
        <p className="text-xs text-blue-900 leading-relaxed font-medium">
          <strong>Pipeline Source:</strong> Synthetic EEG Generator (Deterministic Seed 42, 250 Hz, 3-Channel 10-20 system). Emits continuous canonical EEGWindow segments into the core event bus for downstream decoder verification.
        </p>
      </div>
    </div>
  );
}
