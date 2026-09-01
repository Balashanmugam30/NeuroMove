# NeuroMove

> **Research-Grade Motor-Imagery EEG Mobility & Safety Platform**  
> _From neural intent to safe mobility._

---

## 1. Executive Overview

**NeuroMove** is an advanced open neuro-robotics research platform designed to decode motor-imagery electroencephalographic (EEG) patterns in real-time and translate validated neural intent into deterministic, safety-arbitrated mobility commands.

### Scientific Scope & Honesty Boundary

- **Motor Imagery BCI**: NeuroMove targets sensorimotor rhythm modulation (Event-Related Desynchronization/Synchronization [ERD/ERS] in the $\mu$ [8–12 Hz] and $\beta$ [16–24 Hz] frequency bands over the motor cortex: $C_3$, $C_z$, $C_4$).
- **No Mind Reading**: NeuroMove **does not** read arbitrary natural language thoughts, emotional states, or inner speech. It decodes structured, trained motor-imagery execution paradigms (e.g., imagined hand/foot movement).
- **Research Prototype**: This software and hardware platform is strictly an exploratory research and competition engineering system. It does **not** claim clinical certification, medical device approval, or diagnostic readiness.

---

## 2. Real-Time Processing Pipeline

```
Raw EEG Stream (BioAmp / Synthetic)
  │
  ▼
Signal Quality & Impedance Verification
  │
  ▼
Preprocessing (Bandpass 8–30 Hz, Notch 50/60 Hz, CAR / Laplacian)
  │
  ▼
Sliding Window Epoching & Segmentation
  │
  ▼
Feature Extraction (CSP / FBCSP / Welch PSD)
  │
  ▼
BCI Classifier (Regularized LDA / SVM / EEGNet)
  │
  ▼
Neural Confidence & Bayesian Posterior Estimation
  │
  ▼
Temporal Confirmation & Debounce Window
  │
  ▼
Intent & State Engine
  │
  ▼
Multi-Tier Safety Arbitration Engine (Obstacle / Watchdog / Heartbeat)
  ├── APPROVE ──► Velocity Profiling ──► ESP32 Driver ──► Robot Mobility
  ├── BLOCK   ──► Safe Hold & Log Audit
  └── STOP    ──► Immediate Emergency Failsafe Halt
```

---

## 3. Two-Environment Architecture

NeuroMove enforces a strict separation between physical real-time operation and web command/analytics:

### Local Control Station (Laptop / Desktop)

- Houses local EEG acquisition, low-latency DSP, feature extraction, ML inference, deterministic safety arbitration, local SQLite database, and ESP32 serial protocol.
- **Physical Safety Loop Remains Local**: The physical mobility platform **never** relies on cloud connectivity (`Internet → Cloud → Robot` is strictly prohibited). The local control station operates fully air-gapped without internet access.

### Web Command Center & Research Platform (Next.js)

- Provides real-time telemetry observation, session configuration, calibration management, model diagnostics, safety state visualization, replay inspection, and research metrics.
- Connected locally over low-latency WebSocket/HTTP to the local Python FastAPI core.

---

## 4. Operating Modes

Every event, stream, and telemetry packet in NeuroMove carries an explicit `OperatingMode`:

| Mode             | Description                                                                     | Safety Gate                                                                            |
| :--------------- | :------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------- |
| **`SIMULATION`** | Synthetic signal generators, deterministic mock hardware, safe prototyping.     | Default mode. Hardware actuators disabled.                                             |
| **`REPLAY`**     | Playback of recorded historical BCI sessions for reproducible offline analysis. | Hardware actuators disabled. Read-only telemetry.                                      |
| **`LIVE`**       | Real BioAmp hardware stream and physical robot mobility interface.              | Requires valid signal quality, temporal confirmation, and safety arbitration approval. |

> [!IMPORTANT]
> NeuroMove never mislabels simulated or replay telemetry as live data.

---

## 5. Repository Structure

```
NeuroMove/
├── apps/
│   └── web/                   # Next.js 15+ App Router Command Center
├── packages/
│   ├── contracts/             # Universal Zod schemas & TypeScript types
│   ├── config/                # Shared ESLint, Tailwind, and TSConfigs
│   └── ui/                    # Reusable design system primitives
├── services/
│   └── core/                  # FastAPI local core & state machine
│       ├── neuromove/
│       │   ├── api/           # HTTP & WebSocket endpoints
│       │   ├── domain/        # Canonical enums & domain models
│       │   ├── events/        # Universal Canonical Event Envelope
│       │   ├── safety/        # Safety State Machine & Arbitrator
│       │   ├── database/      # SQLite lifecycle & persistence
│       │   └── logging/       # Structured JSON logging
│       └── tests/             # Python unit test suite
├── neuromove/                 # Root Python research package
├── data/                      # Raw, cleaned, processed, and export data
├── models/                    # Serialized LDA, SVM, and EEGNet models
├── firmware/                  # ESP32 mobility firmware
├── scripts/                   # Acquisition, training, and export utilities
├── tests/                     # Unit, integration, and replay tests
└── docs/                      # Architecture, safety, and research docs
```

---

## 6. Quick Start & Development Setup

### Prerequisites

- **Node.js**: `v20+` or `v22+`
- **pnpm**: `v9+` or `v10+`
- **Python**: `3.11+`
- **uv**: `0.5+` (recommended) or `pip`

### 1. Clone & Environment Configuration

```bash
git clone https://github.com/Balashanmugam30/NeuroMove.git
cd NeuroMove

# Copy environment configuration
cp .env.example .env
```

### 2. Install Dependencies

```bash
# Install Node.js monorepo workspace dependencies
pnpm install

# Sync Python environment dependencies
uv sync --all-extras
```

### 3. Launch Local Control Station & Web Dashboard

```bash
# Terminal 1: Launch Local FastAPI Core (Port 8000)
pnpm dev:core

# Terminal 2: Launch Next.js Web Command Center (Port 3000)
pnpm dev:web
```

Open [http://localhost:3000](http://localhost:3000) to view the NeuroMove Web Command Center.

---

## 7. Verification & Testing Commands

```bash
# Run deterministic simulation CLI
pnpm simulation:run -- --scenario right-turn --seed 42

# Run all Python unit tests & determinism checks
pnpm py:test

# Run Python code quality & lint checks
pnpm py:lint
pnpm py:format

# Run TypeScript typechecks across workspace
pnpm typecheck

# Run Frontend unit tests (Vitest)
pnpm test

# Build production artifacts
pnpm build
```

---

## 8. Development Roadmap (24 Phases)

- [x] **01 Foundation** — Monorepo, CI, and local core scaffolds
- [x] **02 Domain/Event Contracts** — Canonical domain model, event envelope, cross-language Zod/Pydantic parity, and light visual foundation
- [x] **04 Real-Time Streaming** — Dedicated real-time streaming core, WebSocket chunking, buffer pipelines, and synchronization
- [x] **05 Product UI Foundation** — High-fidelity design system 2.0, light visual language, and unified application information architecture
- [x] **06 Live Command Center** — Flagship real-time neuro-robotics control experience, 6-stage pipeline breadcrumb, dual-channel state synchronization, and emergency controls
- [x] **07 EEG Lab** — Research-grade signal visualization, MNE Welch/Multitaper PSD, band power decomposition, Morlet wavelet TFR, 10-20 topology, and provenance exports
- [ ] **08 Public Dataset** — Graz / BCI Competition dataset ingestion & benchmarking
- [ ] **09 Preprocessing** — Bandpass (8–30 Hz), notch (50/60 Hz), CAR, and Laplacian filtering
- [ ] **10 CSP + LDA** — Common Spatial Patterns spatial filter & Shrinkage Linear Discriminant Analysis
- [ ] **11 CSP + SVM** — Non-linear Support Vector Machine classifier & kernel optimization
- [ ] **12 Model Lab** — Model artifact inspection, ROC curves, and cross-validation matrix
- [ ] **13 Calibration** — Standardized Graz visual cue presentation engine & protocol
- [ ] **14 User Adaptation** — Subject-specific adaptation & online covariance shifting
- [ ] **15 Confidence / Temporal Confirmation** — Bayesian posterior estimation & temporal debounce windows
- [ ] **16 State Machine** — Full deterministic runtime lifecycle state transitions
- [ ] **17 Safety Arbitration** — Multi-tier gated safety arbitrator with sensor fusion
- [ ] **18 Failure Injection** — Chaos engineering, packet loss, electrode lead-off, and sensor faults
- [ ] **19 ESP32 Protocol** — Serial binary packet framing, CRC16 checksums, and heartbeat watchdogs
- [ ] **20 Hardware-in-the-Loop** — HIL mock mobility platform and hardware simulator
- [ ] **21 Real EEG** — BioAmp hardware acquisition integration and serial streaming
- [ ] **22 Replay / Analytics** — Session recording, synchronized replay, and ITR metrics
- [ ] **23 Sensors / Advanced Research** — Ultrasonic obstacle avoidance and ocular artifact removal
- [ ] **24 Competition Release** — Cybathlon race compliance, packaging, and formal release

---

## 9. License

Licensed under the [Apache License, Version 2.0](LICENSE).
