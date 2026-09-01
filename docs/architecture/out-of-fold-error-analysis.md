# Out-of-Fold Error Analysis & Anomaly Diagnostics

## 1. Motivation

Aggregate classification metrics (mean accuracy, macro F1) often mask significant failure modes, such as **BCI illiteracy** (participants unable to modulate sensorimotor mu-rhythms), electrode impedance shifts between sessions, or asymmetric class confusion.

The Out-of-Fold (OOF) Error Analysis engine captures every held-out prediction produced across outer cross-validation folds and decomposes errors along clinical and statistical dimensions.

---

## 2. Error Analysis Analytics

### 1. Confused Class Pairs
Identifies directed error transitions:
$$\text{Count}(y_{\text{true}} = c_i, \hat{y}_{\text{pred}} = c_j) \quad \text{for } i \neq j$$
Enables targeted spatial filter inspection (e.g. distinguishing Left vs Right hand vs Feet/Fists confusion).

### 2. Difficult Subject Anomaly Detection ($z$-Score)
For each subject $s$, error rate $e_s = \frac{\text{errors}_s}{\text{trials}_s}$ is computed alongside the cohort mean $\mu_e$ and standard deviation $\sigma_e$:
$$z_s = \frac{e_s - \mu_e}{\sigma_e}$$
Subjects with $z_s > 1.0$ are flagged as anomalous, indicating potential atypical sensorimotor dynamics, altered channel montages, or high myographic artifact contamination.

### 3. Session-Level Difficulty
Decomposes performance across session recordings $(s, \text{sess}_k)$ to identify longitudinal drift or habituation effects.
