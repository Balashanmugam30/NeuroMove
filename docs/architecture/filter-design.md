# Architecture Document: Zero-Phase Digital Filter Design

## 1. Zero-Phase FIR Band-Pass Design
NeuroMove employs linear-phase finite impulse response (FIR) filter design using the windowed sinc method (`firwin` with a Hamming window).

### Filter Specifications:
- **Default Passband**: $0.5\text{ Hz}$ to $40.0\text{ Hz}$
- **Phase Response**: Zero-phase (forward-backward filtering) to prevent group delay and phase distortion across sensorimotor frequency bands ($\mu: 8-12\text{ Hz}$, $\beta: 16-24\text{ Hz}$).
- **High-Pass Cutoff ($f_{\text{hp}} = 0.5\text{ Hz}$)**: Suppresses electro-galvanic baseline drift and slow DC offsets without attenuating rhythmic neural oscillations.
- **Low-Pass Cutoff ($f_{\text{lp}} = 40.0\text{ Hz}$)**: Limits electromyographic (EMG) muscle activity, line noise, and high-frequency instrumentation noise.

---

## 2. Nyquist Boundary Invariant
Filter parameters are validated dynamically against the source sampling rate:
$$f_{\text{lp}} < f_{\text{Nyquist}} = \frac{f_s}{2}$$

- **Simulation Engine ($f_s = 250\text{ Hz}$)**: $f_{\text{Nyquist}} = 125.0\text{ Hz}$. Maximum configurable lowpass: $120.0\text{ Hz}$.
- **PhysioNet Dataset ($f_s = 160\text{ Hz}$)**: $f_{\text{Nyquist}} = 80.0\text{ Hz}$. Lowpass configurations $\ge 80.0\text{ Hz}$ are strictly rejected.

---

## 3. Line-Noise Notch Logic
Line-noise notch filters (50.0 Hz or 60.0 Hz) are applied conditionally:
1. **Passband Redundancy**: If the configured lowpass cutoff is below the notch frequency (e.g. $f_{\text{lp}} = 40.0\text{ Hz} < 50.0\text{ Hz}$), the notch stage is marked `SKIPPED` with an explicit diagnostic note, preventing unnecessary computational overhead and phase artifacts.
2. **Active Notch**: When $f_{\text{lp}} > f_{\text{notch}}$, zero-phase FIR notch filtering is executed with a configurable notch width (default $2.0\text{ Hz}$).

---

## 4. Offline Research vs Real-Time Causal DSP
- **Offline Research**: Uses non-causal zero-phase filtering (`phase='zero'`) on complete epochs or recordings.
- **Real-Time Control Pipeline**: Reserved for causal IIR/FIR filter topologies with bounded group delay to prevent look-ahead bias during real-time wheelchair mobility.
