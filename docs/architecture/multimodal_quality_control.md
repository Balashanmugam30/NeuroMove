# NeuroMove — Phase 23: Multimodal Quality Control (QC) Engine

## 1. Overview

The `MultimodalQcEngine` enforces signal integrity across multiple distinct physical modalities before samples enter downstream DSP, feature extraction, or fusion.

---

## 2. Modality-Aware Physiological Bounds

Each sensor modality is bounded by distinct physical and physiological thresholds:

| Modality | Nominal Unit | Saturation Limit | Flatline Threshold ($\sigma^2$) | Dropout Value | Expected Bandwidth |
|---|---|---|---|---|---|
| **EEG** | $\mu\text{V}$ | $|v| > 500\text{ }\mu\text{V}$ | $\sigma^2 < 10^{-4}$ | $v = 0.0$ | $0.5\text{--}45\text{ Hz}$ |
| **IMU** | $m/s^2, ^\circ/s$ | $|a| > 80\text{ }m/s^2, |\omega| > 1000^\circ/s$ | $\sigma^2 < 10^{-6}$ | $v = 0.0$ | $0\text{--}50\text{ Hz}$ |
| **EMG** | $\mu\text{V}$ | $|v| > 5000\text{ }\mu\text{V}$ | $\sigma^2 < 10^{-4}$ | $v = 0.0$ | $20\text{--}450\text{ Hz}$ |
| **EOG** | $\mu\text{V}$ | $|v| > 1500\text{ }\mu\text{V}$ | $\sigma^2 < 10^{-4}$ | $v = 0.0$ | $0.1\text{--}30\text{ Hz}$ |
| **PPG** | $\text{mV}$ | $v < 0 \text{ or } v > 3300\text{ mV}$ | $\sigma^2 < 10^{-5}$ | $v = 0.0$ | $0.5\text{--}10\text{ Hz}$ |
| **PRESSURE** | $\text{kPa}$ | $P > 200\text{ kPa}$ | $\sigma^2 < 10^{-5}$ | $P = 0.0$ | $0\text{--}20\text{ Hz}$ |

---

## 3. QC Metric Formulas

1. **Signal-to-Noise Ratio (SNR)**:
   $$\text{SNR}_{\text{dB}} = 10 \log_{10}\left( \frac{\text{Var}(x_{\text{clean}})}{\text{Var}(x_{\text{noise}}) + \epsilon} \right)$$
2. **Packet Loss Rate**:
   $$\text{Loss Rate} = \frac{\Delta \text{Sequence} - \text{Packets Received}}{\Delta \text{Sequence}}$$
3. **Channel Usability Verdict**:
   $$\text{Usable} = (\text{Flatline Rate} < 0.10) \land (\text{Saturation Rate} < 0.10) \land (\text{Dropout Rate} < 0.10) \land (\text{Finite Samples} > 0.90)$$
