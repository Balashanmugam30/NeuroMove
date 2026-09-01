# EEG Scientific Visualization & Performance Architecture

## 1. High-Performance Decoupled Waveform Architecture
The real-time EEG oscilloscope operates at $250\text{ Hz}$ with $25\text{ packets/s}$. To prevent UI freezes and memory leaks, the visualization pipeline decouples network ingestion from the React render cycle:

```
WebSocket Transport (/ws/eeg)
        ↓
High-Frequency Packet Ingestion (eeg_stream)
        ↓
EEGRingBuffer (Float32Array Circular Buffer, 1000 Samples)
        ↓
requestAnimationFrame Canvas Renderer (60 FPS Render Cadence)
```

### Key Performance Properties:
- **Bounded Memory Allocation**: Pre-allocated circular `Float32Array` buffers for C3, Cz, and C4 prevent garbage collection pressure.
- **Selective Rendering**: When an operator filters to an individual channel (e.g. `C3`), only that channel's baseline and traces are computed and rendered.
- **Pause & Inspect Mode**: Freezes the animation loop to enable the research cursor to inspect exact sample timestamps (ms) and amplitudes ($\mu\text{V}$) without blocking socket ingestion in the background.

---

## 2. Scientific Canvas Chart Design
- **PSD Plot**:
  - Direct canvas drawing with auto-scaling headroom.
  - Distinct channel color tokens: C3 (`#2563EB`), Cz (`#0D9488`), C4 (`#7C3AED`).
  - Shaded highlight for the sensorimotor Mu band ($8-13\text{ Hz}$).
  - Frequency (Hz) and Power Spectral Density ($\mu\text{V}^2/\text{Hz}$) dual-axis labels.
- **Time-Frequency Heatmap**:
  - 2D matrix rendering of Morlet wavelet power.
  - Viridis-like continuous perceptually uniform color gradient (from light blue `#E0F2FE` to deep indigo `#1E1B4B`).
  - Inverted Y-axis ensuring low frequencies ($4\text{ Hz}$) originate at the baseline and high frequencies ($40\text{ Hz}$) appear at the top.
  - Asynchronous background calculation so the page remains fluid during complex decompositions.

---

## 3. Product Mode vs Research Mode
- **Product Mode**: Simplified overview displaying source verification, overall signal quality score, continuous multi-channel oscilloscope, and key sensorimotor band power bars.
- **Research Mode**: Exposes full scientific depth, including Welch vs Multitaper parameter selection, Morlet wavelet spectrograms, DSP filtering configuration (bypass status), and raw JSON snapshot exports.
