# EEG Scientific Analysis & Spectral Estimation

## 1. Mathematical Foundation
All scientific spectral calculations in NeuroMove are executed authoritatively by the Python scientific core using modern MNE APIs (`MNE-Python 1.12.1`, `scipy 1.15.2`, `numpy 2.2.3`).

### 1.1 Power Spectral Density (PSD)
PSD is estimated over continuous or windowed multi-channel EEG signals using either:
- **Welch's Average Periodogram**:
  Calculated using `raw.compute_psd(method='welch', fmin=fmin, fmax=fmax)`.
  Data is segmented into overlapping Hanning-windowed blocks to minimize variance.
- **Multitaper Method**:
  Calculated using `raw.compute_psd(method='multitaper', fmin=fmin, fmax=fmax)`.
  Utilizes orthogonal Discrete Prolate Spheroidal Sequences (DPSS / Slepian sequences) to optimize spectral leakage and resolution for transient motor rhythms.

### 1.2 Nyquist Limit Enforcement
For sample rate $f_s = 250\text{ Hz}$:
$$f_{\text{Nyquist}} = \frac{f_s}{2} = 125.0\text{ Hz}$$
Both Pydantic contracts and internal Python calculation algorithms enforce:
$$f_{\max} < 125.0\text{ Hz}$$
Requests specifying $f_{\max} \ge 125.0\text{ Hz}$ are strictly rejected with a `422 Unprocessable Entity` or `ValueError`.

---

## 2. Canonical Frequency Bands & Integration
Discrete band powers are integrated from the computed PSD using trapezoidal numerical integration:
$$P_{\text{band}} = \int_{f_{\min}}^{f_{\max}} S_{xx}(f) \, df \approx \sum_{i} \frac{S_{xx}(f_i) + S_{xx}(f_{i+1})}{2} \cdot \Delta f$$

| Band | Frequency Range | Physiological Significance |
| :--- | :--- | :--- |
| **Delta** | $1.0 - 4.0\text{ Hz}$ | Slow cortical oscillations & artifacts |
| **Theta** | $4.0 - 8.0\text{ Hz}$ | Frontal midline cognitive workload |
| **Mu (Alpha)** | $8.0 - 13.0\text{ Hz}$ | Primary sensorimotor rhythm (ERD/ERS) over BA 4 |
| **Beta** | $13.0 - 30.0\text{ Hz}$ | Active motor cortical activation & post-movement rebound |
| **Gamma** | $30.0 - 45.0\text{ Hz}$ | High-frequency sensorimotor binding |

---

## 3. Simulated Mu-Band ERD/ERS Lateralization Index
To quantify contralateral sensorimotor desynchronization during simulated motor imagery:
$$\text{LI} = \frac{P_{\mu}(C4) - P_{\mu}(C3)}{P_{\mu}(C4) + P_{\mu}(C3)}$$
- **$\text{LI} > +0.15$**: Right-hand motor imagery (contralateral C3 mu power attenuates $\implies P_{\mu}(C4) > P_{\mu}(C3)$).
- **$\text{LI} < -0.15$**: Left-hand motor imagery (contralateral C4 mu power attenuates $\implies P_{\mu}(C3) > P_{\mu}(C4)$).
- **$-0.15 \le \text{LI} \le +0.15$**: Bilateral equilibrium or resting state.

---

## 4. Morlet Wavelet Time-Frequency Analysis (TFR)
Time-frequency decomposition is performed using `mne.time_frequency.tfr_array_morlet`:
- Wavelet cycle count: $n_{\text{cycles}} = \frac{f}{2}$
- Frequency grid: 20 logarithmically or linearly spaced bins between $4.0\text{ Hz}$ and $40.0\text{ Hz}$.
- Output power matrix is downsampled along the time dimension to ensure responsive JSON transmission without blocking the browser thread.
