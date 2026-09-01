import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { EEGSourceSummaryCard } from "../components/eeg/EEGSourceSummaryCard";
import { EEGChannelTopology } from "../components/eeg/EEGChannelTopology";
import { ChannelSelector } from "../components/eeg/ChannelSelector";
import { EEGOscilloscope } from "../components/eeg/EEGOscilloscope";
import { SignalQualityPanel } from "../components/eeg/SignalQualityPanel";
import { PSDChart } from "../components/eeg/PSDChart";
import { BandPowerComparison } from "../components/eeg/BandPowerComparison";
import { TimeFrequencyHeatmap } from "../components/eeg/TimeFrequencyHeatmap";
import { PreprocessingOverview } from "../components/eeg/PreprocessingOverview";
import { AnalysisProvenanceFooter } from "../components/eeg/AnalysisProvenanceFooter";

describe("EEG Laboratory Components (Phase 07)", () => {
  describe("EEGSourceSummaryCard", () => {
    it("renders synthetic EEG source, 250 Hz, and simulation mode", () => {
      render(
        <EEGSourceSummaryCard
          sourceKind="SYNTHETIC"
          mode="SIMULATION"
          channels={["C3", "Cz", "C4"]}
          sampleRateHz={250}
          connectionState="CONNECTED"
        />
      );

      expect(screen.getByText("SYNTHETIC EEG")).toBeInTheDocument();
      expect(screen.getByText("SIMULATION")).toBeInTheDocument();
      expect(screen.getByText("250 Hz")).toBeInTheDocument();
      expect(screen.getByText("125 Hz")).toBeInTheDocument(); // Nyquist limit
      expect(screen.getByText(/scientific attribution/i)).toBeInTheDocument();
    });
  });

  describe("EEGChannelTopology", () => {
    it("renders 10-20 standard montage and triggers channel selection", () => {
      const handleSelect = vi.fn();
      render(
        <EEGChannelTopology
          selectedChannel="C3"
          onSelectChannel={handleSelect}
        />
      );

      expect(screen.getByText("10-20 Standard Montage")).toBeInTheDocument();
      expect(screen.getByText("Sensorimotor Strip (Central Sulcus)")).toBeInTheDocument();
      expect(screen.getByText("C3 (LEFT)")).toBeInTheDocument();
      expect(screen.getByText("Cz (MIDLINE)")).toBeInTheDocument();
      expect(screen.getByText("C4 (RIGHT)")).toBeInTheDocument();

      fireEvent.click(screen.getByText("C4 (RIGHT)"));
      expect(handleSelect).toHaveBeenCalledWith("C4");
    });
  });

  describe("ChannelSelector", () => {
    it("renders ALL, C3, Cz, C4 and triggers selection", () => {
      const handleSelect = vi.fn();
      render(
        <ChannelSelector
          channels={["C3", "Cz", "C4"]}
          selectedChannel="ALL"
          onSelectChannel={handleSelect}
        />
      );

      expect(screen.getByText("ALL")).toBeInTheDocument();
      expect(screen.getByText("C3")).toBeInTheDocument();
      expect(screen.getByText("Cz")).toBeInTheDocument();
      expect(screen.getByText("C4")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Cz"));
      expect(handleSelect).toHaveBeenCalledWith("Cz");
    });
  });

  describe("EEGOscilloscope", () => {
    it("renders canvas oscilloscope, calibration tag, and inspect toggle", () => {
      render(
        <EEGOscilloscope
          channels={["C3", "Cz", "C4"]}
          sampleRateHz={250}
          activeIntent="RIGHT"
          activeCue="ARROW_RIGHT"
        />
      );

      expect(
        screen.getByText("Multi-Channel Electrophysiology Oscilloscope")
      ).toBeInTheDocument();
      expect(screen.getByText("Vertical Scale: +-40 uV")).toBeInTheDocument();
      expect(screen.getByText("Inspect")).toBeInTheDocument();
      expect(screen.getByText(/active cue: arrow_right/i)).toBeInTheDocument();

      // Click inspect button to pause
      fireEvent.click(screen.getByText("Inspect"));
      expect(screen.getByText("Resume")).toBeInTheDocument();
    });
  });

  describe("SignalQualityPanel", () => {
    it("renders signal quality tier, SNR, and channel matrix", () => {
      render(
        <SignalQualityPanel
          metrics={{
            overall_score: 0.96,
            dropped_samples: 0,
            sampling_rate_hz: 250,
            channels: { C3: 18.4, Cz: 19.1, C4: 17.6 },
            artifact_flags: [],
            is_acceptable: true,
          }}
          isConnected={true}
          activeFaults={[]}
        />
      );

      expect(screen.getByText("Signal Quality & Diagnostics")).toBeInTheDocument();
      expect(screen.getByText("EXCELLENT")).toBeInTheDocument();
      expect(screen.getByText("(96%)")).toBeInTheDocument();
      expect(screen.getByText("18.4 dB")).toBeInTheDocument();
    });

    it("renders disconnected state when offline", () => {
      render(
        <SignalQualityPanel
          metrics={null}
          isConnected={false}
          activeFaults={["EEG_DISCONNECT"]}
        />
      );

      expect(screen.getByText("DISCONNECTED")).toBeInTheDocument();
      expect(screen.getByText("(0%)")).toBeInTheDocument();
      expect(screen.getByText(/active simulation fault:/i)).toBeInTheDocument();
    });
  });

  describe("PSDChart", () => {
    it("renders PSD chart, method switcher, and peak frequencies", () => {
      const handleMethod = vi.fn();
      const handleExport = vi.fn();

      render(
        <PSDChart
          psdData={{
            frequencies: [1, 5, 10, 15, 20, 25, 30, 35, 40],
            psd_by_channel: {
              C3: [2.1, 4.5, 18.2, 5.1, 8.4, 3.2, 2.0, 1.4, 0.8],
              Cz: [2.0, 4.0, 14.1, 4.8, 6.2, 2.8, 1.9, 1.2, 0.7],
              C4: [2.2, 4.6, 19.0, 5.3, 8.6, 3.4, 2.1, 1.5, 0.9],
            },
            units: "uV^2/Hz",
            peak_frequencies: { C3: 10.0, Cz: 10.0, C4: 10.0 },
            metadata: {
              analysis_id: "anl_psd_test",
              analysis_version: "EEG_ANALYSIS_V1",
              source_kind: "SYNTHETIC",
              mode: "SIMULATION",
              channels: ["C3", "Cz", "C4"],
              sampling_rate_hz: 250,
              method: "welch",
              frequency_range_hz: [1.0, 40.0],
              window_seconds: [0.0, 4.0],
              engine: "MNE-Python 1.12.1",
              created_at: new Date().toISOString(),
            },
          }}
          onMethodChange={handleMethod}
          onExport={handleExport}
        />
      );

      expect(screen.getByText("Power Spectral Density (PSD)")).toBeInTheDocument();
      expect(screen.getByText("Welch")).toBeInTheDocument();
      expect(screen.getByText("Multitaper")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Multitaper"));
      expect(handleMethod).toHaveBeenCalledWith("multitaper");

      fireEvent.click(screen.getByText("CSV"));
      expect(handleExport).toHaveBeenCalled();
    });
  });

  describe("BandPowerComparison", () => {
    it("renders band power items, lateralization index, and toggle", () => {
      render(
        <BandPowerComparison
          bandData={{
            bands_by_channel: {
              C3: {
                delta: { band: "delta", frequency_range: [1, 4], absolute_power: 12.0, relative_power: 0.15 },
                theta: { band: "theta", frequency_range: [4, 8], absolute_power: 15.0, relative_power: 0.18 },
                mu: { band: "mu", frequency_range: [8, 13], absolute_power: 28.0, relative_power: 0.35 },
                beta: { band: "beta", frequency_range: [13, 30], absolute_power: 20.0, relative_power: 0.25 },
                gamma: { band: "gamma", frequency_range: [30, 45], absolute_power: 5.0, relative_power: 0.07 },
              },
            },
            mu_erd_lateralization_index: 0.24,
            units: "uV^2",
            metadata: {
              analysis_id: "anl_bp_test",
              analysis_version: "EEG_ANALYSIS_V1",
              source_kind: "SYNTHETIC",
              mode: "SIMULATION",
              channels: ["C3"],
              sampling_rate_hz: 250,
              method: "welch",
              frequency_range_hz: [1.0, 45.0],
              window_seconds: [0.0, 4.0],
              engine: "MNE-Python 1.12.1",
              created_at: new Date().toISOString(),
            },
          }}
        />
      );

      expect(screen.getByText("Band Power Comparison")).toBeInTheDocument();
      expect(screen.getByText("+0.24")).toBeInTheDocument();
      expect(screen.getByText(/right motor intent/i)).toBeInTheDocument();

      // Switch to absolute power
      fireEvent.click(screen.getByText("Absolute (uV^2)"));
      expect(screen.getByText("28.0 uV^2")).toBeInTheDocument();
    });
  });

  describe("TimeFrequencyHeatmap", () => {
    it("renders spectrogram header and channel buttons", () => {
      render(
        <TimeFrequencyHeatmap
          tfrData={null}
          selectedChannel="C3"
        />
      );

      expect(screen.getByText("Morlet Wavelet Spectrogram")).toBeInTheDocument();
      expect(screen.getByText(/target channel:/i)).toBeInTheDocument();
    });
  });

  describe("PreprocessingOverview", () => {
    it("renders DSP filter settings and raw synthetic signal notice", () => {
      render(<PreprocessingOverview />);

      expect(screen.getByText("Signal Preprocessing & Filtering")).toBeInTheDocument();
      expect(screen.getByText("0.5 Hz (Bypass)")).toBeInTheDocument();
      expect(screen.getByText("40.0 Hz (Bypass)")).toBeInTheDocument();
      expect(screen.getByText(/pipeline invariant:/i)).toBeInTheDocument();
    });
  });

  describe("AnalysisProvenanceFooter", () => {
    it("renders analysis version and reproducibility metadata", () => {
      render(
        <AnalysisProvenanceFooter
          version="EEG_ANALYSIS_V1"
          sessionId="ses_001"
          trialId="trl_002"
          mode="SIMULATION"
          engine="MNE-Python 1.12.1"
        />
      );

      expect(screen.getByText("Provenance Spec: EEG_ANALYSIS_V1")).toBeInTheDocument();
      expect(screen.getByText("Engine: MNE-Python 1.12.1")).toBeInTheDocument();
      expect(screen.getByText("Session: ses_001")).toBeInTheDocument();
      expect(screen.getByText("Trial: trl_002")).toBeInTheDocument();
    });
  });
});
