# NeuroMove UI Information Architecture

## 1. Top-Level Route Taxonomy

The NeuroMove application experience is organized into 5 logical clusters:

```
┌────────────────────────────────────────────────────────┐
│                        TOPBAR                          │
│ NeuroMove Control Station | Mode | Realtime | E-STOP   │
├───────────────────┬────────────────────────────────────┤
│ 1. CONTROL        │ Overview (/overview)               │
│                   │ Live Control (/live)               │
│                   │ Robot Mobility (/robot)            │
├───────────────────┼────────────────────────────────────┤
│ 2. BCI PIPELINE   │ EEG Lab (/eeg)                     │
│                   │ Calibration (/calibration)         │
│                   │ AI Models (/models)                │
├───────────────────┼────────────────────────────────────┤
│ 3. SAFETY         │ Safety Engine (/safety)            │
├───────────────────┼────────────────────────────────────┤
│ 4. RESEARCH       │ Sessions (/sessions)               │
│                   │ Research Lab (/research)           │
│                   │ Evidence & Results (/results)      │
├───────────────────┼────────────────────────────────────┤
│ 5. SYSTEM         │ Documentation (/docs)              │
│                   │ System Diagnostics (/system)       │
└───────────────────┴────────────────────────────────────┘
```

---

## 2. Product Mode vs. Research Mode

NeuroMove supports dual visual identities toggled in the TopBar:

### Product Mode (Demonstrations & Clinical Operators)
- Prioritizes system status, intent decisions, 2D digital twin, and simple metrics.
- Masks low-level covariance matrices and raw sample buffers.
- Uses straightforward terminology (Intent, Velocity, Safety Verdict).

### Research Mode (BCI Scientists & Engineers)
- Displays full filter bank configurations, CAR reference parameters, shrinkage regularization values ($\lambda$), and raw bandpass attenuation dB values.
- Denser information display while preserving light-first contrast and clarity.

---

## 3. Standard Page Layout Pattern
Every route conforms to a standardized vertical flow:
1. `PageHeader`: Title, category tag, operating mode badge, description, and action slot.
2. `MetricCard` Ribbon: 3–4 high-level telemetry and status cards.
3. Primary Interactive Canvas / Table / Visualizer.
4. Secondary Evidence / Parameters.
5. Canonical Audit Stream / Details.
