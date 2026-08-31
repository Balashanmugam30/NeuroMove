# NeuroMove Simulation Engine Architecture

## 1. Overview

The NeuroMove Simulation Engine is a deterministic, configurable software source adapter designed to simulate the entire neuro-robotics mobility platform prior to connecting live physical BioAmp amplifiers and ESP32 motor actuators.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SIMULATION ENGINE CORE                          │
│                                                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ Simulation Clock │  │  Scenario Engine │  │ Fault Injector       │  │
│  │ (1x/2x/5x/Pause) │  │  (9 Scenarios)   │  │ (Lead-off, Noise...) │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘  │
│           │                     │                       │              │
│           ▼                     ▼                       ▼              │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      Simulation Orchestrator                     │  │
│  │  ┌────────────────────┐ ┌──────────────────┐ ┌────────────────┐  │  │
│  │  │ Synthetic EEG (SMR)│ │ Decoder / Predict│ │ Robot & Obstacle│ │  │
│  │  │ (C3, Cz, C4 @250Hz)│ │ (Class Probs,Conf│ │ (2D Twin Tele) │ │  │
│  │  └─────────┬──────────┘ └────────┬─────────┘ └───────┬────────┘  │  │
│  └────────────┼─────────────────────┼───────────────────┼───────────┘  │
└───────────────┼─────────────────────┼───────────────────┼──────────────┘
                ▼                     ▼                   ▼
     ┌─────────────────────────────────────────────────────────┐
     │              CANONICAL EVENT DISPATCHER                 │
     │            (Monotonic sequence, EventEnvelope)          │
     └────────────────────────────┬────────────────────────────┘
                                  ▼
     ┌─────────────────────────────────────────────────────────┐
     │           FASTAPI REST & WEBSOCKET BROADCAST            │
     │      (/api/simulation/*, /ws/live, /ws/eeg, /ws/robot)  │
     └────────────────────────────┬────────────────────────────┘
                                  ▼
     ┌─────────────────────────────────────────────────────────┐
     │              NEXT.JS 15 WEB COMMAND CENTER              │
     │  - Operator Simulation Bar (Play/Pause/Speed/Scenario)  │
     │  - Live Oscilloscope & SMR Power (EEG Lab)              │
     │  - 2D Digital Twin & Obstacle Proximity Arena           │
     │  - Real-Time Event Audit Timeline                       │
     └─────────────────────────────────────────────────────────┘
```

---

## 2. Core Principles

1. **True Input Adapter**: Simulation is not a cosmetic frontend timer or CSS animation. It is a genuine backend event source that produces typed `EventEnvelope` structures adhering strictly to the project's canonical domain contracts.
2. **Deterministic Reproducibility**: Given a `scenario_id` and random integer `seed` (e.g. `42`), the simulation produces identical event sequences, payload values, timestamps, and monotonic sequence indices across multiple executions.
3. **Scientific Scope Transparency**: Synthetic electrophysiological signals are explicitly generated via mathematical oscillators for pipeline verification. All APIs and UIs visibly carry `SIMULATION` / `SYNTHETIC EEG` designations.
4. **Safety Isolation**: Simulated commands remain isolated from physical motor drivers.

---

## 3. Mathematical Signal Model

The continuous synthetic EEG signal $V_{ch}(t)$ for channel $ch \in \{C_3, C_z, C_4\}$ is synthesized as:

$$V_{ch}(t) = V_{\text{drift}}(t) + V_{\mu, ch}(t) + V_{\beta, ch}(t) + V_{\gamma}(t) + \eta(t)$$

Where:
- $V_{\text{drift}}(t) = A_{\text{drift}} \sin(2\pi f_{\text{drift}} t)$ (slow baseline drift at 0.2 Hz)
- $V_{\mu, ch}(t) = A_{\mu, ch} \sin(2\pi f_{\mu} t + \phi_{ch})$ ($\mu$-rhythm sensorimotor oscillation at 10.0 Hz)
- $V_{\beta, ch}(t) = A_{\beta, ch} \sin(2\pi f_{\beta} t + \theta_{ch})$ ($\beta$-rhythm motor oscillation at 20.0 Hz)
- $V_{\gamma}(t) = A_{\gamma} \sin(2\pi \cdot 40.0 \cdot t)$ (higher-frequency harmonic component)
- $\eta(t) \sim \mathcal{N}(0, \sigma_{\text{noise}}^2)$ (deterministic seeded Gaussian noise)

### SMR Event-Related Desynchronization (ERD)

During motor imagery, contralateral cortical power desynchronizes:
- **Right Turn Imagery**: Attenuates $C_3$ amplitude ($A_{\mu, C_3} \to 0.3 \times A_0$) while $C_4$ slightly synchronizes.
- **Left Turn Imagery**: Attenuates $C_4$ amplitude ($A_{\mu, C_4} \to 0.3 \times A_0$) while $C_3$ slightly synchronizes.
- **Forward Imagery**: Bilateral desynchronization across both hemispheres.

---

## 4. CLI Headless Execution

To run headless deterministic simulation verification:

```bash
uv run python -m neuromove.simulation.cli --scenario right-turn --seed 42
```
