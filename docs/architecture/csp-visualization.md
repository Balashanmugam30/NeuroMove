# CSP Spatial Filter & Pattern Visualization

## Mathematical Distinction: Spatial Filters vs. Spatial Patterns

1. **Spatial Filters ($W$)**:
   The columns of $W$ define spatial linear combinations of EEG channels designed to isolate source signals:
   $$Z_k(t) = w_k^T X(t)$$
   Filters may have non-intuitive spatial distributions due to cancellation of correlated noise.

2. **Spatial Patterns ($A = (W^{-1})^T$)**:
   The spatial patterns describe how individual source activations project across the scalp electrodes:
   $$X(t) \approx A Z(t)$$
   Patterns reflect the neurophysiological dipole topography (e.g., negative contralateral potential over C3/C4 during hand motor imagery).

---

## Visualizing Spatial Weights in NeuroMove

In the Classical Decoding Workspace (`/models`):
- **Component Breakdown**: Each CSP component displays normalized electrode weights across active channels (e.g. `Fc5`, `C3`, `Cz`, `C4`).
- **Eigenvalue Ranking**: Components are sorted by generalized eigenvalue $\lambda_k$, representing class variance ratios.
- **Directional Indication**: Positive weights (blue) and negative weights (amber) indicate reciprocal hemispheric modulation.
