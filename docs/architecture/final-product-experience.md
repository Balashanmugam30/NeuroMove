# NeuroMove — Final Competition Product Experience & Information Architecture

## 1. Executive Summary

Phase 24.1 establishes the final unified product and release experience for **NeuroMove**, synthesizing the deep technical innovations of Phases 01–23 into a singular, competition-ready neurotechnology platform.

The top-level narrative is structured around the core operational chain:
$$\text{ACQUIRE} \longrightarrow \text{UNDERSTAND} \longrightarrow \text{DECODE} \longrightarrow \text{VALIDATE} \longrightarrow \text{PROTECT} \longrightarrow \text{EXECUTE SAFELY} \longrightarrow \text{RESEARCH}$$

---

## 2. Product Information Hierarchy

The user navigation and functional layout are reorganized into 6 high-level product domains:

1. **PRODUCT**:
   - `/overview`: Executive Dashboard, Unified System Health Matrix, Canonical Pipeline Architecture Diagram.
   - `/demo`: Guided End-to-End Demonstration and 6 Golden Verification Scenarios.
2. **ACQUIRE**:
   - `/eeg/live`: Real-Time EEG / BioAmp Acquisition Subsystem (Phase 21).
   - `/sensors`: Multimodal Sensors, Multi-Clock Synchronization, and Neurophysiology Context Engine (Phase 23).
3. **DECODE**:
   - `/eeg`: EEG Lab and Signal Inspection.
   - `/eeg/preprocessing`: Preprocessing & DSP (Phase 09).
   - `/eeg/features`: Epoching & Feature Extraction (Phase 10).
   - `/calibration`: Personalized Baseline Calibration (Phase 13).
   - `/models/lab`: AI Model Lab & Common Spatial Patterns (Phase 11 & 12).
   - `/adaptation`: Adaptive Updates & Transfer Learning (Phase 14).
   - `/confidence`: Temporal Evidence Accumulation & Confidence Gating (Phase 15).
4. **SAFETY & EXECUTION**:
   - `/intent`: Intent State Machine & Lifecycle (Phase 16).
   - `/safety`: Authoritative Safety Arbitration & 12 Fail-Closed Invariants (Phase 17).
   - `/resilience`: Fault Injection & Self-Healing Resilience Lab (Phase 18).
   - `/transport`: Command Transport & Framing Protocol (Phase 19).
   - `/hardware`: Hardware-in-the-Loop (HIL) Virtual Validation Lab (Phase 20).
   - `/live`: Live Control Station (Phase 06).
   - `/robot`: Robot Mobility Telemetry.
5. **RESEARCH & EVIDENCE**:
   - `/research/datasets`: Public Dataset Ingestion (Phase 08).
   - `/sessions`: Historical Session Audit Records.
   - `/research`: Deterministic Replay & Scientific Evaluation Laboratory (Phase 22).
   - `/results`: Provenance Analytics & Benchmark Evidence.
6. **SYSTEM**:
   - `/docs`: Architectural Documentation & Specifications.
   - `/system`: Platform Diagnostics and Service Telemetry.

---

## 3. Canonical 7-Stage Pipeline Architecture

```
[ 1. SENSORS & CONTEXT ]
  • Multimodal discovery & hardware-honest binding
  • Multi-clock normalization & drift tracking (ppm)
  • Modality-aware QC & physiological contradiction detection
       │
       ▼
[ 2. SIGNAL DSP ]
  • Real-time 8–30 Hz bandpass & notch filtering
  • Continuous sliding temporal epoching (1.0s window)
       │
       ▼
[ 3. FEATURE DECODING ]
  • Common Spatial Pattern (CSP) spatial filtering
  • LDA / Riemannian geometry motor imagery intent classification
       │
       ▼
[ 4. CONFIDENCE ENGINE ]
  • Temporal evidence window integration (4 consecutive epochs)
  • Hysteresis thresholding & SNR gating (> 0.70)
       │
       ▼
[ 5. INTENT LIFECYCLE ]
  • Finite State Machine: Candidate ──► Confirmed ──► Activated
       │
       ▼
[ 6. SAFETY ARBITRATION ]
  • Phase 17 authoritative fail-closed decision gate
  • 12 deterministic invariant checks & execution authorization
       │
       ▼
[ 7. HARDWARE HIL ]
  • Phase 19 framed transport packet construction
  • Phase 20 ESP32 Virtual Serial Emulator ACK validation
```

---

## 4. Visual Design System (Bright Mode)

All Phase 24.1 product interfaces strictly adhere to the established NeuroMove Bright Design System tokens:
- **Canvas / Background**: `#F8FAFC` (Slate-50)
- **Surface**: `#FFFFFF` (White)
- **Primary Action**: `#2563EB` (Blue-600)
- **Biomedical Accent**: `#0D9488` (Teal-600)
- **Safety Indicator**: `#059669` (Emerald-600)
- **Warning / Hold Indicator**: `#D97706` (Amber-600)
- **Primary Text**: `#0F172A` (Slate-900)
- **Secondary Text**: `#475569` (Slate-600)
- **Borders & Dividers**: `#E2E8F0` (Slate-200)
