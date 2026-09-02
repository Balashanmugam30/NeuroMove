"use client";

import React from "react";
import { CalibrationProtocol } from "@neuromove/contracts";
import { Sliders, Clock, ShieldCheck } from "lucide-react";
import { Select, Input } from "@/components/ui/FormControls";


interface ProtocolConfiguratorProps {
  protocol: CalibrationProtocol;
  onChange: (updated: CalibrationProtocol) => void;
  disabled?: boolean;
}

export function ProtocolConfigurator({
  protocol,
  onChange,
  disabled = false,
}: ProtocolConfiguratorProps) {
  const handleTrialsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const trials = parseInt(e.target.value, 10) || 10;
    onChange({ ...protocol, trials_per_class: trials });
  };


  const handleSeedChange = (val: string) => {
    const seed = parseInt(val, 10) || 42;
    onChange({ ...protocol, random_state: seed });
  };

  const totalTrials = protocol.trials_per_class * protocol.target_classes.length;
  const trialDuration =
    protocol.rest_duration_sec +
    protocol.fixation_duration_sec +
    protocol.cue_duration_sec +
    protocol.imagery_duration_sec +
    2.0; // average ITI

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Calibration Protocol Parameters</h3>
            <p className="text-xs text-slate-500">Standard Graz visual cue sequence and deterministic timing</p>
          </div>
        </div>

        <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 font-semibold">
          {protocol.protocol_version}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select
          label="Trials Per Target Class"
          value={protocol.trials_per_class.toString()}
          onChange={handleTrialsChange}
          disabled={disabled}
          helperText={`Total quota: ${totalTrials} balanced trials (50/50)`}
          options={[
            { value: "5", label: "5 Trials / Class (10 Total - Rapid Smoke)" },
            { value: "10", label: "10 Trials / Class (20 Total - Standard)" },
            { value: "20", label: "20 Trials / Class (40 Total - High Precision)" },
          ]}
        />

        <Input
          label="Random Seed (PRNG Reproducibility)"
          type="number"
          value={protocol.random_state.toString()}
          onChange={(e) => handleSeedChange(e.target.value)}
          disabled={disabled}
          helperText="Deterministic pseudo-random sequence order"
        />

        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-teal-600" /> Trial Phase Durations
            </span>
            <span className="font-mono text-teal-700">{trialDuration.toFixed(1)}s / trial</span>
          </div>
          <div className="text-2xs text-slate-500 grid grid-cols-2 gap-1 pt-1">
            <div>Rest: {protocol.rest_duration_sec}s</div>
            <div>Fixation: {protocol.fixation_duration_sec}s</div>
            <div>Cue: {protocol.cue_duration_sec}s</div>
            <div>Imagery: {protocol.imagery_duration_sec}s</div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Data Sufficiency Rule: Minimum {protocol.min_valid_trials_per_class} valid trials per class required for model adaptation.</span>
        </div>
        <div className="font-mono text-2xs text-slate-400">
          Hash: {protocol.timing_hash || "sha256"}
        </div>
      </div>
    </div>
  );
}
