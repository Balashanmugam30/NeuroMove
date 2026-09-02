import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ProductHealthHeader } from "@/components/product/ProductHealthHeader";
import { SystemHealthPanel } from "@/components/product/SystemHealthPanel";
import { PipelineOverview } from "@/components/product/PipelineOverview";
import { DemoStepTimeline } from "@/components/product/DemoStepTimeline";
import { DemoScenarioSelector } from "@/components/product/DemoScenarioSelector";
import { SafetyExplanationCard } from "@/components/product/SafetyExplanationCard";
import { ProvenanceSummary } from "@/components/product/ProvenanceSummary";
import { DemoResultCard } from "@/components/product/DemoResultCard";
import { ProductSessionPanel } from "@/components/product/ProductSessionPanel";
import {
  SystemStatusSummary,
  SubsystemHealthCard,
  DemoStep,
  DemoScenario,
  DemoResult,
  ProductProvenance,
  ProductSession,
} from "@neuromove/contracts";

const mockSubsystems: Record<string, SubsystemHealthCard> = {
  acquisition: {
    subsystem_id: "acquisition",
    name: "EEG Acquisition & Ingestion",
    status: "HEALTHY",
    source_type: "SIMULATOR",
    summary: "Simulated EEG streaming active at 250 Hz",
    key_metrics: { channels: 8, rate_hz: 250 },
    last_updated: "2026-09-02T12:00:00Z",
    is_operational: true,
    route_href: "/eeg/live",
  },
  multimodal_sensors: {
    subsystem_id: "multimodal_sensors",
    name: "Multimodal Sensors & Fusion",
    status: "HEALTHY",
    source_type: "SIMULATOR",
    summary: "6 multimodal streams active with < 2.5ms synchronization",
    key_metrics: { active_modalities: ["EEG", "IMU"] },
    last_updated: "2026-09-02T12:00:00Z",
    is_operational: true,
    route_href: "/sensors",
  },
  decoding: {
    subsystem_id: "decoding",
    name: "DSP & AI Model Lab",
    status: "HEALTHY",
    source_type: "SIMULATOR",
    summary: "CSP spatial filter & LDA classifier calibrated",
    key_metrics: { model_version: "csp_lda_v2.4" },
    last_updated: "2026-09-02T12:00:00Z",
    is_operational: true,
    route_href: "/models/lab",
  },
  confidence_intent: {
    subsystem_id: "confidence_intent",
    name: "Confidence & Intent Engine",
    status: "HEALTHY",
    source_type: "SIMULATOR",
    summary: "Temporal evidence window confirmed over 4 epochs",
    key_metrics: { threshold: 0.7, intent_state: "ACTIVATED" },
    last_updated: "2026-09-02T12:00:00Z",
    is_operational: true,
    route_href: "/intent",
  },
  safety: {
    subsystem_id: "safety",
    name: "Safety Arbitration Core",
    status: "HEALTHY",
    source_type: "SIMULATOR",
    summary: "Phase 17 safety gate armed with 12 invariants",
    key_metrics: { invariants_active: 12 },
    last_updated: "2026-09-02T12:00:00Z",
    is_operational: true,
    route_href: "/safety",
  },
  hardware_hil: {
    subsystem_id: "hardware_hil",
    name: "Hardware HIL Virtual Lab",
    status: "HEALTHY",
    source_type: "SIMULATOR",
    summary: "ESP32 virtual emulator connected & responsive",
    key_metrics: { emulator: "ESP32_VIRTUAL" },
    last_updated: "2026-09-02T12:00:00Z",
    is_operational: true,
    route_href: "/hardware",
  },
  research: {
    subsystem_id: "research",
    name: "Research & Replay Platform",
    status: "HEALTHY",
    source_type: "SIMULATOR",
    summary: "Cryptographic lineage & dataset replay validated",
    key_metrics: { reproducibility: "100%" },
    last_updated: "2026-09-02T12:00:00Z",
    is_operational: true,
    route_href: "/research",
  },
};

const mockStatusSummary: SystemStatusSummary = {
  overall_status: "HEALTHY",
  product_session_id: "prod_sess_test_123",
  active_source: "SIMULATOR",
  is_live_streaming: true,
  subsystems: mockSubsystems,
  current_stage: "SENSORS",
  safety_armed: true,
  hil_ready: true,
  last_check_time: "2026-09-02T12:00:00Z",
};

const mockScenarios: DemoScenario[] = [
  {
    id: "PRODUCT_A",
    name: "Guided Happy Path Baseline",
    tagline: "End-to-End Multimodal Acquisition to Virtual HIL Dispatch",
    description: "Nominal complete flow with high confidence and HIL ACK.",
    expected_outcome: "PASS",
    expected_safety: "AUTHORIZED",
    is_deterministic: true,
    source: "SIMULATOR",
  },
  {
    id: "PRODUCT_B",
    name: "Safety Protection & Confidence Gating",
    tagline: "Sub-Threshold Confidence Triggers Immediate Safety Hold",
    description: "Low confidence triggers safety hold with 0 transmissions.",
    expected_outcome: "BLOCKED",
    expected_safety: "HELD",
    is_deterministic: true,
    source: "SIMULATOR",
  },
];

const mockSteps: DemoStep[] = [
  {
    step_index: 1,
    step_key: "DATA_SOURCE",
    title: "Select Signal Source",
    description: "Initialize source provider",
    stage: "SENSORS",
    status: "COMPLETED",
    metrics: { channels: 8 },
    explanation: "Source initialized",
  },
  {
    step_index: 2,
    step_key: "ACQUISITION",
    title: "Bio-Signal Acquisition",
    description: "Ingest EEG channels",
    stage: "SIGNAL",
    status: "IN_PROGRESS",
    metrics: { packet_loss: 0 },
    explanation: "Acquiring samples",
  },
];

const mockResult: DemoResult = {
  result_id: "res_mock_01",
  run_id: "run_mock_01",
  scenario_id: "PRODUCT_A",
  status: "PASS",
  source_type: "SIMULATOR",
  candidate_intent: "FORWARD",
  confidence_score: 0.94,
  safety_verdict: "AUTHORIZED",
  hil_status: "ACKNOWLEDGED",
  latency_breakdown: { acquisition: 1.2, decoding: 2.4, safety: 0.8, hil: 1.2 },
  explanation_text: "Nominal end-to-end execution completed.",
  created_at: "2026-09-02T12:00:00Z",
};

const mockProvenance: ProductProvenance = {
  product_session_id: "prod_sess_test_123",
  acquisition_session_id: "acq_sess_01",
  sensor_session_id: "sensor_sess_01",
  experiment_id: "exp_01",
  model_version_id: "csp_lda_v2.4",
  confidence_policy: "STRICT_RESEARCH_FUSION",
  intent_id: "intent_01",
  safety_decision: "AUTHORIZED",
  hil_session_id: "hil_sess_01",
  source_checksum: "src_hash_123",
  manifest_hash: "mnf_hash_456",
  provenance_hash: "prv_hash_789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012",
};

const mockProductSession: ProductSession = {
  session_id: "prod_sess_test_123",
  title: "Test Product Session",
  subject_id: "SUBJ_PILOT_01",
  source_type: "SIMULATOR",
  status: "ACTIVE",
  model_version: "csp_lda_v2.4",
  confidence_policy: "STRICT_RESEARCH_FUSION",
  safety_decision: "AUTHORIZED",
  manifest_hash: "mnf_48a9f2",
  provenance_hash: "prv_b81c4e",
  created_at: "2026-09-02T12:00:00Z",
  updated_at: "2026-09-02T12:00:00Z",
};

describe("Phase 24.1 Competition Product Frontend Components", () => {
  // 1. ProductHealthHeader
  describe("ProductHealthHeader Component", () => {
    it("renders product title, overall status, and session ID", () => {
      render(<ProductHealthHeader statusSummary={mockStatusSummary} />);
      expect(screen.getByText(/NeuroMove Platform/i)).toBeDefined();
      expect(screen.getByText("HEALTHY")).toBeDefined();
      expect(screen.getByText("prod_sess_test_123")).toBeDefined();
    });

    it("renders safety and HIL status badges", () => {
      render(<ProductHealthHeader statusSummary={mockStatusSummary} />);
      expect(screen.getByText(/Safety: Armed/i)).toBeDefined();
      expect(screen.getByText(/HIL: ESP32 Virtual Emulator/i)).toBeDefined();
    });

    it("triggers refresh callback when refresh button clicked", () => {
      const onRefresh = vi.fn();
      render(<ProductHealthHeader statusSummary={mockStatusSummary} onRefresh={onRefresh} />);
      const btn = screen.getByRole("button", { name: /Refresh/i });
      fireEvent.click(btn);
      expect(onRefresh).toHaveBeenCalledOnce();
    });
  });

  // 2. SystemHealthPanel
  describe("SystemHealthPanel Component", () => {
    it("renders all 7 subsystem health cards", () => {
      render(<SystemHealthPanel subsystems={mockSubsystems} />);
      expect(screen.getByText("EEG Acquisition & Ingestion")).toBeDefined();
      expect(screen.getByText("Multimodal Sensors & Fusion")).toBeDefined();
      expect(screen.getByText("DSP & AI Model Lab")).toBeDefined();
      expect(screen.getByText("Confidence & Intent Engine")).toBeDefined();
      expect(screen.getByText("Safety Arbitration Core")).toBeDefined();
      expect(screen.getByText("Hardware HIL Virtual Lab")).toBeDefined();
      expect(screen.getByText("Research & Replay Platform")).toBeDefined();
    });

    it("renders route links for each subsystem", () => {
      render(<SystemHealthPanel subsystems={mockSubsystems} />);
      const links = screen.getAllByRole("link", { name: /Open Lab/i });
      expect(links.length).toBe(7);
      expect(links[0].getAttribute("href")).toBe("/eeg/live");
    });
  });

  // 3. PipelineOverview
  describe("PipelineOverview Component", () => {
    it("renders 7 canonical architecture stages", () => {
      render(<PipelineOverview />);
      expect(screen.getByText("Sensors & Context")).toBeDefined();
      expect(screen.getByText("Signal DSP")).toBeDefined();
      expect(screen.getByText("Feature Decoding")).toBeDefined();
      expect(screen.getByText("Confidence Engine")).toBeDefined();
      expect(screen.getByText("Intent Lifecycle")).toBeDefined();
      expect(screen.getByText("Safety Arbitration")).toBeDefined();
      expect(screen.getByText("Hardware HIL")).toBeDefined();
    });

    it("changes selected stage details when stage button is clicked", () => {
      render(<PipelineOverview />);
      const dspBtn = screen.getByText("Signal DSP");
      fireEvent.click(dspBtn);
      expect(screen.getByText(/Real-time 8-30 Hz bandpass filtering/i)).toBeDefined();
    });
  });

  // 4. DemoStepTimeline
  describe("DemoStepTimeline Component", () => {
    it("renders all provided demo steps with progress numbers", () => {
      render(<DemoStepTimeline steps={mockSteps} currentStep={2} />);
      expect(screen.getByText("Select Signal Source")).toBeDefined();
      expect(screen.getByText("Bio-Signal Acquisition")).toBeDefined();
      expect(screen.getByText("COMPLETED")).toBeDefined();
    });

    it("displays safety held badge when isBlocked is true", () => {
      render(<DemoStepTimeline steps={mockSteps} currentStep={2} isBlocked={true} />);
      expect(screen.getByText("Safety Held")).toBeDefined();
    });
  });

  // 5. DemoScenarioSelector
  describe("DemoScenarioSelector Component", () => {
    it("renders available scenarios and highlights active scenario", () => {
      render(
        <DemoScenarioSelector
          scenarios={mockScenarios}
          selectedScenarioId="PRODUCT_A"
          onSelectScenario={() => {}}
          onRunFull={() => {}}
          onStartStepByStep={() => {}}
          onAdvanceStep={() => {}}
          onReset={() => {}}
          isRunActive={false}
          loading={false}
        />
      );
      expect(screen.getByText("Guided Happy Path Baseline")).toBeDefined();
      expect(screen.getByText("Safety Protection & Confidence Gating")).toBeDefined();
    });

    it("invokes onRunFull callback when Run Full Demo clicked", () => {
      const onRunFull = vi.fn();
      render(
        <DemoScenarioSelector
          scenarios={mockScenarios}
          selectedScenarioId="PRODUCT_A"
          onSelectScenario={() => {}}
          onRunFull={onRunFull}
          onStartStepByStep={() => {}}
          onAdvanceStep={() => {}}
          onReset={() => {}}
          isRunActive={false}
          loading={false}
        />
      );
      const btn = screen.getByRole("button", { name: /Run Full Demo/i });
      fireEvent.click(btn);
      expect(onRunFull).toHaveBeenCalledWith("PRODUCT_A");
    });
  });

  // 6. SafetyExplanationCard
  describe("SafetyExplanationCard Component", () => {
    it("renders authorized flow trace when verdict is AUTHORIZED", () => {
      render(
        <SafetyExplanationCard
          safetyVerdict="AUTHORIZED"
          candidateIntent="FORWARD"
          confidenceScore={0.92}
        />
      );
      expect(screen.getByText("EXECUTION AUTHORIZED")).toBeDefined();
      expect(screen.getByText("Intent: FORWARD")).toBeDefined();
      expect(screen.getByText("Confidence: 92.0%")).toBeDefined();
      expect(screen.getByText("HIL: ACKNOWLEDGED")).toBeDefined();
    });

    it("renders held trace when blocked", () => {
      render(
        <SafetyExplanationCard
          safetyVerdict="HELD"
          isBlocked={true}
          blockReason="Low confidence score"
          candidateIntent="FORWARD"
          confidenceScore={0.42}
        />
      );
      expect(screen.getByText("EXECUTION HELD / BLOCKED")).toBeDefined();
      expect(screen.getByText("HIL: 0 TRANSMISSIONS")).toBeDefined();
      expect(screen.getByText(/Low confidence score/i)).toBeDefined();
    });
  });

  // 7. ProvenanceSummary
  describe("ProvenanceSummary Component", () => {
    it("renders cryptographic hashes and session IDs", () => {
      render(<ProvenanceSummary provenance={mockProvenance} />);
      expect(screen.getByText("Scientific Lineage & Cryptographic Provenance")).toBeDefined();
      expect(screen.getByText("prod_sess_test_123")).toBeDefined();
      expect(screen.getByText("csp_lda_v2.4")).toBeDefined();
    });

    it("renders copy lineage button and triggers clipboard copy", () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockImplementation(() => Promise.resolve()),
        },
      });
      render(<ProvenanceSummary provenance={mockProvenance} />);
      const copyBtn = screen.getByRole("button", { name: /Copy Lineage/i });
      fireEvent.click(copyBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  // 8. DemoResultCard
  describe("DemoResultCard Component", () => {
    it("renders result outcome badge, decoded intent, and latency metrics", () => {
      render(<DemoResultCard result={mockResult} />);
      expect(screen.getByText("DEMONSTRATION PASSED")).toBeDefined();
      expect(screen.getByText("FORWARD")).toBeDefined();
      expect(screen.getByText("94.0%")).toBeDefined();
      expect(screen.getByText("ACKNOWLEDGED")).toBeDefined();
      expect(screen.getByText(/Nominal end-to-end execution completed/i)).toBeDefined();
    });

    it("renders blocked state badge when status is BLOCKED", () => {
      const blockedRes: DemoResult = {
        ...mockResult,
        status: "BLOCKED",
        safety_verdict: "HELD",
        hil_status: "NOT_TRANSMITTED",
        confidence_score: 0.42,
      };
      render(<DemoResultCard result={blockedRes} />);
      expect(screen.getByText("SAFETY INTERLOCKED")).toBeDefined();
      expect(screen.getByText("NOT_TRANSMITTED")).toBeDefined();
    });

    it("renders failed state badge when status is FAILED", () => {
      const failedRes: DemoResult = {
        ...mockResult,
        status: "FAILED",
      };
      render(<DemoResultCard result={failedRes} />);
      expect(screen.getByText("DEMONSTRATION FAILED")).toBeDefined();
    });

    it("renders individual stage latencies in breakdown", () => {
      render(<DemoResultCard result={mockResult} />);
      expect(screen.getAllByText(/1.2ms/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/2.4ms/)).toBeDefined();
      expect(screen.getByText(/0.8ms/)).toBeDefined();
    });
  });

  // 9. ProductSessionPanel
  describe("ProductSessionPanel Component", () => {
    it("renders session metadata and handles reset click", () => {
      const onReset = vi.fn();
      render(
        <ProductSessionPanel session={mockProductSession} onResetSession={onReset} />
      );
      expect(screen.getByText("prod_sess_test_123")).toBeDefined();
      expect(screen.getByText("SUBJ_PILOT_01")).toBeDefined();

      const btn = screen.getByRole("button", { name: /Reset Session/i });
      fireEvent.click(btn);
      expect(onReset).toHaveBeenCalledOnce();
    });

    it("renders null gracefully when session is null", () => {
      const { container } = render(
        <ProductSessionPanel session={null} onResetSession={() => {}} />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  // 10. Scenario Controls & Actions
  describe("DemoScenarioSelector Action Controls", () => {
    it("invokes onStartStepByStep callback when Start Step-by-Step clicked", () => {
      const onStart = vi.fn();
      render(
        <DemoScenarioSelector
          scenarios={mockScenarios}
          selectedScenarioId="PRODUCT_A"
          onSelectScenario={() => {}}
          onRunFull={() => {}}
          onStartStepByStep={onStart}
          onAdvanceStep={() => {}}
          onReset={() => {}}
          isRunActive={false}
          loading={false}
        />
      );
      const btn = screen.getByRole("button", { name: /Start Step-by-Step/i });
      fireEvent.click(btn);
      expect(onStart).toHaveBeenCalledWith("PRODUCT_A");
    });

    it("invokes onAdvanceStep callback when Advance Next Step clicked during active run", () => {
      const onAdvance = vi.fn();
      render(
        <DemoScenarioSelector
          scenarios={mockScenarios}
          selectedScenarioId="PRODUCT_A"
          onSelectScenario={() => {}}
          onRunFull={() => {}}
          onStartStepByStep={() => {}}
          onAdvanceStep={onAdvance}
          onReset={() => {}}
          isRunActive={true}
          loading={false}
        />
      );
      const btn = screen.getByRole("button", { name: /Advance Next Step/i });
      fireEvent.click(btn);
      expect(onAdvance).toHaveBeenCalledOnce();
    });

    it("invokes onSelectScenario when clicking a scenario card", () => {
      const onSelect = vi.fn();
      render(
        <DemoScenarioSelector
          scenarios={mockScenarios}
          selectedScenarioId="PRODUCT_A"
          onSelectScenario={onSelect}
          onRunFull={() => {}}
          onStartStepByStep={() => {}}
          onAdvanceStep={() => {}}
          onReset={() => {}}
          isRunActive={false}
          loading={false}
        />
      );
      const card = screen.getByText("Safety Protection & Confidence Gating");
      fireEvent.click(card);
      expect(onSelect).toHaveBeenCalledWith("PRODUCT_B");
    });

    it("invokes onReset callback when Reset Demo clicked", () => {
      const onReset = vi.fn();
      render(
        <DemoScenarioSelector
          scenarios={mockScenarios}
          selectedScenarioId="PRODUCT_A"
          onSelectScenario={() => {}}
          onRunFull={() => {}}
          onStartStepByStep={() => {}}
          onAdvanceStep={() => {}}
          onReset={onReset}
          isRunActive={false}
          loading={false}
        />
      );
      const btn = screen.getByRole("button", { name: /Reset Demo/i });
      fireEvent.click(btn);
      expect(onReset).toHaveBeenCalledOnce();
    });
  });

  // 11. Pipeline Selection Details
  describe("PipelineOverview Stage Switching", () => {
    it("updates drawer content when switching from Sensors to Safety Arbitration", () => {
      render(<PipelineOverview />);
      const safetyBtn = screen.getByText("Safety Arbitration");
      fireEvent.click(safetyBtn);
      expect(screen.getByText(/Deterministic fail-closed safety gate/i)).toBeDefined();
    });
  });
});

