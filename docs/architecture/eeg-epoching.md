# Motor-Imagery EEG Epoching Architecture (`EEG_EPOCHING_V1`)

## Overview

Epoching is the segmentation of continuous multi-channel EEG recordings into discrete, trial-aligned time windows locked to motor-imagery cue onsets ($t=0\text{ s}$).

`EEG_EPOCHING_V1` enforces strict reproducibility, configurable baseline subtraction, amplitude-based rejection, and immutable content-addressed storage.

## Epoch Interval & Baseline Definition

- **Epoch Interval**: $[t_{\min}, t_{\max}]$ relative to cue onset (Default: $[-1.0\text{ s}, +4.0\text{ s}]$).
- **Baseline Interval**: $[b_{\text{start}}, b_{\text{end}}]$ (Default: $[-1.0\text{ s}, 0.0\text{ s}]$).
- **Baseline Modes**:
  - `APPLIED`: Subtracts the mean channel amplitude computed over $[b_{\text{start}}, b_{\text{end}}]$ from each sample:
    $$\tilde{x}_c(t) = x_c(t) - \frac{1}{N_{\text{baseline}}} \sum_{\tau \in \text{baseline}} x_c(\tau)$$
  - `NOT_APPLIED`: Preserves raw signal offsets without baseline correction.
- **Analysis Window**: $[t_{\text{analysis, start}}, t_{\text{analysis, end}}]$ (Default: $[0.5\text{ s}, 4.0\text{ s}]$). Discards initial visual-evoked potentials (VEP) during the first $500\text{ ms}$ after cue presentation.

## Quality Control (QC) & Rejection Strategy

Each candidate trial undergoes independent QC checks:

```mermaid
flowchart TD
    E[Normalized Event] --> B{Boundary Check<br/>t_onset + [tmin, tmax] in [0, T]?}
    B -- No --> REJ1[Flag: BOUNDARY_ERROR]
    B -- Yes --> M{Mapping Check<br/>Status == MAPPED?}
    M -- No --> REJ2[Flag: UNMAPPED_EVENT]
    M -- Yes --> A{Peak Amplitude<br/>|x_c(t)| <= Threshold?}
    A -- No --> REJ3[Flag: AMPLITUDE_OUTLIER]
    A -- Yes --> VAL[Flag: VALID Epoch]
```

## Storage Architecture & Content Addressing

- Epoch files are serialized as standard MNE `.fif` files:
  `data/epochs/ep_<config_hash>_<source_hash>_epo.fif`
- Metadata sidecars:
  `data/epochs/ep_<config_hash>_<source_hash>.meta.json`
- SQLite indexing:
  `epoch_sets`, `epoch_records`, `epoching_configs`
