"""Common Spatial Patterns (CSP) spatial filtering engine based on MNE-Python."""

import logging
from typing import Any

from mne.decoding import CSP

from .models import CSPConfig, CSPPatternData

logger = logging.getLogger("neuromove.decoding.csp")


def build_csp_transformer(config: CSPConfig, n_channels: int) -> CSP:
    """Instantiate a validated MNE CSP spatial filter.

    Args:
        config: CSP configuration parameters.
        n_channels: Number of spatial EEG channels in the dataset.

    Returns:
        Configured mne.decoding.CSP estimator.
    """
    if n_channels < 2:
        raise ValueError(f"CSP requires at least 2 spatial channels, found {n_channels}.")

    # Constrain components to channel count
    n_comp = min(config.n_components, n_channels)
    if n_comp < config.n_components:
        logger.warning(
            "Capping CSP n_components from %d to available channels %d",
            config.n_components,
            n_channels,
        )

    # Parse regularization
    reg: Any = config.regularization
    if reg is not None and isinstance(reg, str):
        if reg.lower() in ("none", "null", ""):
            reg = None
        elif reg.lower() == "empirical":
            reg = "empirical"
        else:
            try:
                reg = float(reg)
            except ValueError:
                reg = None

    return CSP(
        n_components=n_comp,
        reg=reg,
        log=config.log,
        cov_est=config.cov_est,
        transform_into=config.transform_into,
        norm_trace=config.norm_trace,
        component_order=config.component_order,
    )


def extract_csp_pattern_data(
    csp: CSP,
    channels: list[str],
) -> CSPPatternData:
    """Extract spatial patterns and filters from a fitted CSP estimator for research visualization.

    Args:
        csp: Fitted mne.decoding.CSP instance.
        channels: Channel name labels corresponding to rows/columns.

    Returns:
        Structured CSPPatternData object.
    """
    if not hasattr(csp, "patterns_") or csp.patterns_ is None:
        raise ValueError("Cannot extract CSP patterns from an unfitted CSP estimator.")

    n_comp = csp.n_components
    # MNE patterns_: shape (n_channels, n_channels) or (n_channels, n_components)
    # filters_: shape (n_channels, n_channels)
    raw_patterns = csp.patterns_
    raw_filters = csp.filters_

    # Extract top n_components
    if raw_patterns.shape[0] == len(channels):
        # Shape (n_channels, n_components) -> transpose to (n_components, n_channels)
        patterns_list = raw_patterns[:, :n_comp].T.tolist()
    else:
        patterns_list = raw_patterns[:n_comp].tolist()

    if raw_filters.shape[0] >= n_comp:
        filters_list = raw_filters[:n_comp].tolist()
    else:
        filters_list = raw_filters.tolist()

    eigenvalues_list = None
    if hasattr(csp, "eigenvalues_") and csp.eigenvalues_ is not None:
        eigenvalues_list = [float(v) for v in csp.eigenvalues_[:n_comp]]

    return CSPPatternData(
        channels=channels,
        n_components=n_comp,
        patterns=[[float(x) for x in row] for row in patterns_list],
        filters=[[float(x) for x in row] for row in filters_list],
        eigenvalues=eigenvalues_list,
    )
