# NeuroMove System Overview

## 1. High-Level Architecture

NeuroMove is structured as a decoupled, safety-critical neuro-robotics platform:

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Command Center                       │
│             (Next.js 15+ / React / Tailwind)                │
│    - Real-Time Live Control Shell                           │
│    - Signal Quality & Spectral Power Displays               │
│    - Model Diagnostics & Calibration Management             │
│    - Product Mode vs Research Mode Presentation             │
└──────────────────────────────┬──────────────────────────────┘
                               │ Local HTTP / WebSockets (Port 8000)
┌──────────────────────────────▼──────────────────────────────┐
│                Local NeuroMove Core Station                 │
│              (FastAPI / Python 3.11+ / SQLite)              │
│  ┌────────────────────┐   ┌──────────────────────────────┐  │
│  │ BCI & DSP Engine   │   │ Safety State Machine         │  │
│  │ - 8-30 Hz Filtering│   │ - Fail-Closed IDLE Container │  │
│  │ - CSP / PSD Feats  │   │ - Multi-Tier Arbitration     │  │
│  │ - LDA/SVM Classify │   │ - Immediate E-Stop Override  │  │
│  └────────────────────┘   └──────────────────────────────┘  │
│  ┌────────────────────┐   ┌──────────────────────────────┐  │
│  │ Universal Event Bus│   │ Local SQLite Persistence     │  │
│  │ - Event Envelope   │   │ - Canonical Audit Logs       │  │
│  │ - Stream Broadcast │   │ - Session Replay Datasets    │  │
│  └────────────────────┘   └──────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Serial / USB Protocol (CRC16 + Watchdog)
┌──────────────────────────────▼──────────────────────────────┐
│                   ESP32 Hardware Adapter                    │
│    - Pulse Width Modulation (PWM) Motor Drivers             │
│    - Hardware Heartbeat Failsafe & Obstacle Cutoffs         │
└─────────────────────────────────────────────────────────────┘
```

## 2. Electrophysiological Signal Pipeline

1. **Acquisition**: BioAmp / Synthetic Stream over $C_3, C_z, C_4$ channels sampled at 250 Hz.
2. **Preprocessing**: 8–30 Hz 4th-order Butterworth bandpass filter, 50/60 Hz notch filter, Surface Laplacian spatial filter.
3. **Sliding Window Epoching**: 1.0s to 2.0s analysis epochs with 50% to 75% overlap.
4. **Feature Extraction**: Common Spatial Patterns (CSP) spatial filtering combined with Welch Power Spectral Density (PSD) in $\mu$ (8–12 Hz) and $\beta$ (16–24 Hz) bands.
5. **Classifier**: Regularized Linear Discriminant Analysis (Shrinkage LDA) and Support Vector Classifiers (SVC).
6. **Confidence & Confirmation**: Bayesian posterior smoothing across consecutive epochs to prevent false activation.
7. **Safety Arbitration**: Evaluates signal quality, obstacle risk, and state machine before dispatching velocity commands.
