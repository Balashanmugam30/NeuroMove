# Event Normalization & Mapping Architecture (`EVENT_MAPPING_V1`)

## Overview

In research EEG datasets (such as PhysioNet EEGBCI) and real-time simulation engines, event markers indicate experimental cues, visual prompts, and baseline periods. However, annotation formats vary widely:
- PhysioNet annotations: `T0` (Rest / Baseline), `T1` (Left Fist / Both Fists), `T2` (Right Fist / Both Feet).
- Graz BCI protocol: Integer event codes (e.g. `768` for start of trial, `769` for Left Cue, `770` for Right Cue).
- Synthetic simulation: Explicit strings (`REST`, `LEFT_IMAGERY`, `RIGHT_IMAGERY`).

`EVENT_MAPPING_V1` provides a deterministic, versioned translation layer that standardizes all input markers into canonical NeuroMove `NormalizedEvent` records.

## Canonical Labels

| Normalized Label | Description | PhysioNet Hands (R03, 04, 07, 08, 11, 12) | PhysioNet Feet (R05, 06, 09, 10, 13, 14) |
| :--- | :--- | :--- | :--- |
| `REST` | Resting baseline / pre-cue period | `T0` | `T0` |
| `LEFT_IMAGERY` | Left hand motor imagery | `T1` | — |
| `RIGHT_IMAGERY` | Right hand motor imagery | `T2` | — |
| `BOTH_FISTS_IMAGERY` | Bilateral fist clenching imagery | — | `T1` |
| `FEET_IMAGERY` | Bilateral feet movement imagery | — | `T2` |
| `TONGUE_IMAGERY` | Tongue motor imagery | — | — |
| `UNKNOWN` | Unmapped / unexpected event code | Any unmapped code | Any unmapped code |

## Timing Alignment & Resampling Invariant

When raw EEG signals undergo resampling in the Phase 09 Preprocessing pipeline (e.g. $160\text{ Hz} \to 250\text{ Hz}$ or $512\text{ Hz} \to 128\text{ Hz}$), sample indices shift.

To prevent temporal distortion:
1. Event timestamps are preserved strictly in continuous seconds: $t_{\text{onset}} \in [0, T_{\text{duration}}]$.
2. Processed sample indices are calculated deterministically:
   $$\text{sample}_{\text{processed}} = \text{round}(t_{\text{onset}} \times f_{s, \text{processed}})$$
3. Every `NormalizedEvent` tracks both `source_sample` and `processed_sample` for end-to-end lineage auditing.

## Event Validation Invariants

An event is flagged as `INVALID` if:
1. $t_{\text{onset}} < 0$ or $t_{\text{onset}} \ge T_{\text{duration}}$.
2. $\text{sample}_{\text{processed}} \ge N_{\text{samples}}$.
3. The event duration spans beyond the recording boundaries.
