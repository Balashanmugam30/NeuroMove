# Common Spatial Patterns (CSP) & Classical Motor-Imagery Decoding

## Overview

Phase 11 introduces the first supervised machine-learning decoding architecture in NeuroMove. It translates preprocessed multi-channel EEG epochs into spatial filter representations optimized for discriminating motor-imagery intentions (e.g., Left-Hand vs. Right-Hand motor imagery).

$$\text{Preprocessed EEG} \to \text{Motor-Imagery Epochs} \to \text{CSP Spatial Filters} \to \text{Log-Power Features} \to \text{Classical Classifier} \to \text{Prediction}$$

```
                ┌────────────────────────────────────────┐
                │          Motor-Imagery Epochs          │
                │        (n_epochs, n_ch, n_times)       │
                └───────────────────┬────────────────────┘
                                    │
                                    ▼
                ┌────────────────────────────────────────┐
                │        CSP Spatial Decomposition       │
                │       W^T Σ_1 W = Λ,  W^T Σ_2 W = I    │
                └───────────────────┬────────────────────┘
                                    │
                                    ▼
                ┌────────────────────────────────────────┐
                │         Log-Power Feature Vector       │
                │       f_k = log(Var(w_k^T X))          │
                └───────────────────┬────────────────────┘
                                    │
                                    ▼
                ┌────────────────────────────────────────┐
                │         Linear Discriminant / SVM      │
                │          y_hat = sign(w^T f + b)       │
                └────────────────────────────────────────┘
```

---

## Mathematical Foundation of Common Spatial Patterns

Common Spatial Patterns (CSP) finds spatial filters $W \in \mathbb{R}^{C \times K}$ that maximize the variance (energy) of band-pass filtered EEG signals for one class while simultaneously minimizing the variance for the opposing class.

Given epoch covariance matrices $\Sigma_1$ for Class 1 (e.g. Left Imagery) and $\Sigma_2$ for Class 2 (e.g. Right Imagery):

1. **Composite Covariance Matrix**:
   $$\Sigma_c = \Sigma_1 + \Sigma_2$$

2. **Eigenvalue Decomposition of Composite Covariance**:
   $$\Sigma_c = U_c \Lambda_c U_c^T$$

3. **Whitening Transformation**:
   $$P = \Lambda_c^{-1/2} U_c^T$$
   which guarantees $P \Sigma_c P^T = I$.

4. **Transformed Class Covariance**:
   $$S_1 = P \Sigma_1 P^T, \quad S_2 = P \Sigma_2 P^T$$
   If $S_1 = B \Lambda B^T$, then $S_2 = B (I - \Lambda) B^T$. Thus, the eigenvectors with the largest eigenvalues for Class 1 correspond directly to the smallest eigenvalues for Class 2.

5. **Projection Matrix (Spatial Filters)**:
   $$W = B^T P$$

6. **Log-Power Feature Extraction**:
   For a single epoch $X \in \mathbb{R}^{C \times T}$, the spatially filtered signal is $Z = W X$. The $k$-th feature is the log-normalized signal variance:
   $$f_k = \log\left(\frac{\text{Var}(Z_k)}{\sum_{j=1}^K \text{Var}(Z_j)}\right) \approx \log\left(\frac{1}{T} \sum_{t=1}^T Z_k(t)^2\right)$$

---

## Supported Classical Classifiers

1. **Linear Discriminant Analysis (LDA)**:
   - Uses SVD or Ledoit-Wolf shrinkage to estimate the optimal separating hyperplane.
   - Fast, deterministic, and highly effective for binary sensorimotor rhythm classification.

2. **Support Vector Machines (Linear & RBF SVM)**:
   - Maximum-margin decision boundaries with soft-margin parameter $C$.
   - Supports linear and radial basis function (RBF) kernels.

3. **Dummy Baseline Classifier**:
   - Predicts class priors or uniform random distributions to mathematically confirm that CSP + Classifier models exceed trivial chance behavior.

---

## Operational Scope and Safeguards

> [!CAUTION]
> In Phase 11, all decoders operate strictly in **Offline Research / Replay Mode**. Decoder outputs are never routed to safety arbitration or robot mobility actuation.
