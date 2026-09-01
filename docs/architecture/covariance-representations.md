# Spatial Covariance Matrix Representations for CSP

## Overview

Common Spatial Pattern (CSP) and Riemannian geometry-based BCI decoders operate directly on spatial covariance matrices estimated from multi-channel trial segments.

`EEG_FEATURES_V1` constructs CSP-ready covariance representations with strict trace normalization and shrinkage regularization.

## Mathematical Formulation

Let $X \in \mathbb{R}^{C \times N}$ denote the mean-centered EEG signal for an individual trial ($C$ channels, $N$ temporal samples):
$$\bar{X} = X - \frac{1}{N} \sum_{t=1}^N x(t)$$

### 1. Empirical Sample Covariance
$$C_{\text{emp}} = \frac{1}{N - 1} \bar{X} \bar{X}^T \in \mathbb{R}^{C \times C}$$

### 2. Trace Normalization
To prevent trials with high overall amplitude (e.g. baseline drift) from dominating spatial filtering:
$$C_{\text{norm}} = \frac{C_{\text{emp}}}{\text{trace}(C_{\text{emp}})}$$
where $\text{trace}(C_{\text{norm}}) = 1.0$.

### 3. Diagonal Shrinkage Regularization (Ledoit-Wolf / Oracle Approximation)
When $N$ is small relative to $C$, empirical covariance estimates can be ill-conditioned. Shrinkage linearly interpolates between $C_{\text{norm}}$ and a spherical identity target:
$$C_{\text{shrink}} = (1 - \lambda) C_{\text{norm}} + \lambda \left(\frac{\text{trace}(C_{\text{norm}})}{C}\right) I_C$$
where $\lambda \in [0, 1]$ (default $\lambda = 0.1$).

## Matrix Invariants & Verification

Every covariance matrix stored in NeuroMove must pass three linear algebraic tests:
1. **Finiteness**: $\forall i, j \quad |C_{ij}| < \infty$ and $\text{isnan}(C_{ij}) = \text{False}$.
2. **Symmetry**: $\|C - C^T\|_{\infty} < 10^{-5}$.
3. **Positive Semi-Definiteness (PSD)**: $\min(\text{eig}(C)) \ge -10^{-6}$.
