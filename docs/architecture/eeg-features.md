# Motor-Imagery EEG Feature Foundation (`EEG_FEATURES_V1`)

## Overview

The feature extraction layer converts trial-segmented EEG signals into reproducible, high-signal numerical representations without making classifier or intent claims.

`EEG_FEATURES_V1` implements spectral band power, log-power, relative power, and sensorimotor lateralization indices.

## Spectral Power Features

Spectral power is calculated using Welch's periodogram integration across specified physiological frequency bands:
- **Mu Band ($\mu$)**: $8.0\text{ Hz} - 13.0\text{ Hz}$ (Sensorimotor rhythm / Event-Related Desynchronization)
- **Beta Band ($\beta$)**: $13.0\text{ Hz} - 30.0\text{ Hz}$ (Motor cortex activation)

### 1. Absolute Band Power ($P_{\text{abs}}$)
$$P_{\text{abs}}(c, \text{band}) = \int_{f_{\min}}^{f_{\max}} S_{xx}(f) \, df \quad [\mu\text{V}^2]$$

### 2. Relative Band Power ($P_{\text{rel}}$)
$$P_{\text{rel}}(c, \text{band}) = \frac{P_{\text{abs}}(c, \text{band})}{\int_{0.5}^{40.0} S_{xx}(f) \, df + \epsilon}$$
where $\epsilon = 10^{-12}$ avoids numerical division by zero.

### 3. Log Band Power ($P_{\text{log}}$)
$$P_{\text{log}}(c, \text{band}) = \log(P_{\text{abs}}(c, \text{band}) + \epsilon)$$
Normalizes skewed power distributions and linearizes power dynamic range for linear models.

## Sensorimotor Lateralization Index ($\text{LI}$)

During unilateral motor imagery, contralateral sensorimotor cortex exhibits Event-Related Desynchronization (ERD, power drop) while ipsilateral cortex exhibits Event-Related Synchronization (ERS, power increase).

For contralateral pair $(C_3, C_4)$:
$$\text{LI}_{\mu}(C_3, C_4) = \frac{P_{\mu}(C_4) - P_{\mu}(C_3)}{P_{\mu}(C_4) + P_{\mu}(C_3) + \epsilon}$$

- $\text{LI} > 0$: $P_{\mu}(C_4) > P_{\mu}(C_3)$ $\implies$ Left hemisphere desynchronization $\implies$ Right Hand Imagery.
- $\text{LI} < 0$: $P_{\mu}(C_3) > P_{\mu}(C_4)$ $\implies$ Right hemisphere desynchronization $\implies$ Left Hand Imagery.

> [!NOTE]
> Lateralization indices are numerical representations only and do NOT claim intent decision or classification output.

## Storage Formats

1. **Compressed NPZ**: `data/features/feat_<hash>.npz` containing:
   - `features`: Dense float64 matrix $(N_{\text{trials}} \times N_{\text{features}})$
   - `covariances`: 3D tensor $(N_{\text{trials}} \times C \times C)$
   - `labels`, `epoch_ids`, `subject_ids`, `trial_ids`
2. **Tabular CSV**: `data/features/feat_<hash>.csv` for human inspection and external data science tools.
3. **JSON Manifest**: Full environment versions, parameters, and cryptographic SHA-256 hashes.
