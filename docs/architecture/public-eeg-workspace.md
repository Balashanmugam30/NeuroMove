# NeuroMove Public EEG Dataset Workspace & EEG Lab Replay

## 1. Research Dataset Workspace (`/research/datasets`)
The dedicated workspace enables researchers to:
1. **Inspect Catalog**: Browse registered public benchmarks (`physionet-eegbci`), view official citation, licensing, channel montage (64 ch 10-10), and sampling rate (160 Hz).
2. **Subject & Run Explorer**: Filter by participant subject (S001–S109) and experimental task (Motor Imagery Fists, Motor Imagery Feet, Motor Execution, Baseline Rest).
3. **Cache Verification**: Run SHA-256 integrity audits against local raw files.
4. **Reproducibility Manifest**: Inspect and export full JSON manifest containing file hashes, loader versions, and experimental event code mappings.
5. **Open in EEG Lab**: Single-click transition into the EEG Laboratory workspace in `REPLAY` mode for deep multi-channel signal inspection.

---

## 2. EEG Laboratory Replay Integration (`/eeg?mode=REPLAY`)
When operating in `REPLAY` mode:
- **Header & Source Badge**: Displays `MODE: REPLAY`, `SOURCE: RECORDED EEG`, `DATASET: PhysioNet EEGBCI`, `SUBJECT: S001`, `RUN: R04`.
- **Sampling Frequency**: Updates oscilloscope and Nyquist bound dynamically to `160 Hz` ($f_{\text{Nyquist}} = 80\text{ Hz}$).
- **Replay Controls**: Play/Pause, Seek slider ($0.0\text{s} - 125.0\text{s}$), Playback speed ($1\times, 2\times, 5\times, 10\times$), Run switcher dropdown.
- **Event Annotations**: Real-time display of PhysioNet experimental cue markers (`T0` Rest, `T1` Left Fist, `T2` Right Fist).
- **MNE Spectral Analysis**: PSD (Welch & Multitaper) and Band Power analyses execute on the recorded time series snippet, providing empirical power spectral density curves.
- **Mode Switcher**: Allows toggling back to `SIMULATION` / `SYNTHETIC STREAM (250 Hz)` seamlessly.
