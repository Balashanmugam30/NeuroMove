"""Scientific feature extraction, spectral calculations, and covariance matrix estimation."""

import logging
from typing import Any

import mne
import numpy as np
from scipy import signal

from neuromove.epoching.models import NormalizedLabel
from neuromove.features.models import (
    CovarianceMatrixRecord,
    CovarianceMethod,
    FeatureBand,
    FeatureConfig,
    FeaturePowerType,
    FeaturePreview,
    FeatureVector,
)

logger = logging.getLogger(__name__)


def compute_welch_band_powers(
    epoch_data: np.ndarray,  # (n_channels, n_times) in Volts
    sfreq: float,
    bands: list[FeatureBand],
    fmin_total: float = 0.5,
    fmax_total: float = 40.0,
) -> tuple[dict[str, np.ndarray], np.ndarray]:
    """Calculate absolute band power and total spectral power using Welch integration."""
    n_channels, n_times = epoch_data.shape
    nperseg = min(n_times, max(16, int(sfreq * 1.0)))

    # Compute Welch PSD: freqs (n_freqs,), psd (n_channels, n_freqs) in V^2 / Hz
    freqs, psd = signal.welch(
        epoch_data,
        fs=sfreq,
        nperseg=nperseg,
        noverlap=nperseg // 2,
        axis=-1,
    )

    # Total power across passband [fmin_total, fmax_total]
    total_mask = (freqs >= fmin_total) & (freqs <= fmax_total)
    if np.any(total_mask):
        total_power = np.trapezoid(psd[:, total_mask], freqs[total_mask], axis=-1)
    else:
        total_power = np.sum(psd, axis=-1)

    band_powers: dict[str, np.ndarray] = {}
    for band in bands:
        b_mask = (freqs >= band.fmin_hz) & (freqs <= band.fmax_hz)
        if np.any(b_mask):
            b_power = np.trapezoid(psd[:, b_mask], freqs[b_mask], axis=-1)
        else:
            b_power = np.zeros(n_channels)
        band_powers[band.name] = b_power

    return band_powers, total_power


def compute_covariance_representation(
    epoch_data: np.ndarray,  # (n_channels, n_times)
    method: CovarianceMethod = CovarianceMethod.NORMALIZED,
    shrinkage_factor: float = 0.1,
) -> tuple[np.ndarray, float]:
    """Calculate spatial covariance matrix with trace normalization and optional shrinkage."""
    # Center along temporal axis
    mean_centered = epoch_data - np.mean(epoch_data, axis=-1, keepdims=True)
    n_channels, n_samples = mean_centered.shape

    # Empirical sample covariance
    c_emp = np.dot(mean_centered, mean_centered.T) / max(1, n_samples - 1)
    trace_val = float(np.trace(c_emp))

    if method == CovarianceMethod.EMPIRICAL:
        cov = c_emp
    elif method == CovarianceMethod.NORMALIZED:
        cov = c_emp / max(1e-18, trace_val)
    elif method == CovarianceMethod.SHRINKAGE:
        cov_norm = c_emp / max(1e-18, trace_val)
        identity = np.eye(n_channels) / n_channels
        cov = (1.0 - shrinkage_factor) * cov_norm + shrinkage_factor * identity
    else:
        cov = c_emp

    return cov, trace_val


def validate_covariance_matrix(matrix: np.ndarray) -> tuple[bool, bool, bool]:
    """Validate covariance matrix properties: finite, symmetric, positive semi-definite."""
    is_finite = bool(np.all(np.isfinite(matrix)))
    if not is_finite:
        return False, False, False

    is_symmetric = bool(np.allclose(matrix, matrix.T, atol=1e-5))

    # Eigenvalue check for PSD
    try:
        eigenvals = np.linalg.eigvalsh(matrix)
        is_psd = bool(np.all(eigenvals >= -1e-6))
    except np.linalg.LinAlgError:
        is_psd = False

    return is_finite, is_symmetric, is_psd


def generate_feature_names(config: FeatureConfig) -> list[str]:
    """Deterministic, sorted feature column names."""
    names: list[str] = []

    # Channel-wise spectral features
    for ch in sorted(config.channels):
        for band in sorted(config.bands, key=lambda b: b.name):
            if config.power_type in (FeaturePowerType.ABSOLUTE, FeaturePowerType.ALL):
                names.append(f"{ch}_{band.name}_abs")
            if config.power_type in (FeaturePowerType.RELATIVE, FeaturePowerType.ALL):
                names.append(f"{ch}_{band.name}_rel")
            if config.power_type in (FeaturePowerType.LOG, FeaturePowerType.ALL):
                names.append(f"{ch}_{band.name}_log")

    # Lateralization features
    if config.include_lateralization:
        for pair in sorted(config.lateralization_pairs):
            ch1, ch2 = pair
            for band in sorted(config.bands, key=lambda b: b.name):
                names.append(f"{band.name}_lateralization_{ch1.lower()}_{ch2.lower()}")

    return names


def extract_epoch_feature_vector(
    epoch_data: np.ndarray,  # (n_channels, n_times)
    ch_names: list[str],
    sfreq: float,
    config: FeatureConfig,
    epoch_id: str,
    trial_id: str,
    subject_id: str,
    label: NormalizedLabel,
    session_id: str | None = None,
    run_id: str | None = None,
    recording_id: str | None = None,
) -> FeatureVector:
    """Extract named feature dictionary from an individual epoch."""
    # Filter epoch data down to configured channels
    ch_indices = []
    active_chs = []
    for ch in config.channels:
        # Match case-insensitively / strip dots
        match = next(
            (
                idx
                for idx, c in enumerate(ch_names)
                if c.strip(".").upper() == ch.strip(".").upper()
            ),
            None,
        )
        if match is not None:
            ch_indices.append(match)
            active_chs.append(ch)

    if not ch_indices:
        # Fallback to first available channels
        ch_indices = list(range(min(len(ch_names), len(config.channels))))
        active_chs = [ch_names[i] for i in ch_indices]

    sliced_data = epoch_data[ch_indices, :]

    # 1. Compute spectral band power
    band_powers, total_power = compute_welch_band_powers(
        sliced_data, sfreq=sfreq, bands=config.bands
    )

    feature_dict: dict[str, float] = {}

    # 2. Extract channel-wise features
    ch_to_mu: dict[str, float] = {}
    for ch_idx, ch_name in enumerate(active_chs):
        t_pow = float(total_power[ch_idx])
        for band in config.bands:
            b_pow = float(band_powers[band.name][ch_idx])
            if band.name.lower() == "mu":
                ch_to_mu[ch_name.upper()] = b_pow

            # Absolute
            if config.power_type in (FeaturePowerType.ABSOLUTE, FeaturePowerType.ALL):
                feature_dict[f"{ch_name}_{band.name}_abs"] = float(b_pow)

            # Relative
            if config.power_type in (FeaturePowerType.RELATIVE, FeaturePowerType.ALL):
                rel_pow = float(b_pow / max(config.epsilon, t_pow))
                feature_dict[f"{ch_name}_{band.name}_rel"] = float(rel_pow)

            # Log
            if config.power_type in (FeaturePowerType.LOG, FeaturePowerType.ALL):
                log_pow = float(np.log(max(config.epsilon, b_pow)))
                feature_dict[f"{ch_name}_{band.name}_log"] = float(log_pow)

    # 3. Extract Lateralization features (e.g. C3 vs C4)
    if config.include_lateralization:
        for pair in config.lateralization_pairs:
            ch1_up = pair[0].upper()
            ch2_up = pair[1].upper()
            p1 = ch_to_mu.get(ch1_up, 1.0)
            p2 = ch_to_mu.get(ch2_up, 1.0)
            li = (p2 - p1) / (p2 + p1 + config.epsilon)
            feature_dict[f"mu_lateralization_{pair[0].lower()}_{pair[1].lower()}"] = float(li)

    return FeatureVector(
        epoch_id=epoch_id,
        trial_id=trial_id,
        subject_id=subject_id,
        session_id=session_id,
        run_id=run_id,
        recording_id=recording_id,
        label=label,
        values=feature_dict,
    )


def extract_feature_set(
    epochs: mne.Epochs,
    epoch_records: list[Any],
    config: FeatureConfig,
) -> tuple[list[FeatureVector], list[CovarianceMatrixRecord], list[str], dict[str, int]]:
    """Extract complete feature matrix and covariance records across all valid epochs."""
    data = epochs.get_data()  # Shape: (n_epochs, n_channels, n_times)
    sfreq = float(epochs.info["sfreq"])
    ch_names = list(epochs.ch_names)

    feature_names = generate_feature_names(config)
    vectors: list[FeatureVector] = []
    covariances: list[CovarianceMatrixRecord] = []
    label_dist: dict[str, int] = {}

    for idx, rec in enumerate(epoch_records):
        if rec.qc_status != "VALID":
            continue
        if idx >= len(data):
            break

        ep_data = data[idx]
        lbl = rec.label
        label_dist[lbl.value] = label_dist.get(lbl.value, 0) + 1

        # Feature vector
        vec = extract_epoch_feature_vector(
            epoch_data=ep_data,
            ch_names=ch_names,
            sfreq=sfreq,
            config=config,
            epoch_id=rec.epoch_id,
            trial_id=rec.trial_id,
            subject_id=rec.subject_id,
            session_id=rec.session_id,
            run_id=rec.run_id,
            label=lbl,
        )
        vectors.append(vec)

        # Covariance matrix for configured channels
        ch_indices = [
            i
            for i, c in enumerate(ch_names)
            if any(c.strip(".").upper() == target.upper() for target in config.channels)
        ]
        if not ch_indices:
            ch_indices = list(range(min(len(ch_names), len(config.channels))))

        cov_slice = ep_data[ch_indices, :]
        cov_mat, trace_val = compute_covariance_representation(
            cov_slice, method=config.covariance_method
        )
        is_finite, is_sym, is_psd = validate_covariance_matrix(cov_mat)

        covariances.append(
            CovarianceMatrixRecord(
                epoch_id=rec.epoch_id,
                label=lbl,
                channels=[ch_names[i] for i in ch_indices],
                matrix=cov_mat.tolist(),
                trace=trace_val,
                is_symmetric=is_sym,
                is_positive_semi_definite=is_psd,
            )
        )

    return vectors, covariances, feature_names, label_dist


def generate_feature_preview(
    epoch_count: int,
    available_channels: list[str],
    sampling_rate_hz: float,
    config: FeatureConfig,
) -> FeaturePreview:
    """Validate feature configuration and calculate output dimensions."""
    warnings: list[str] = []
    errors: list[str] = []

    nyquist = sampling_rate_hz / 2.0

    for band in config.bands:
        if band.fmin_hz >= band.fmax_hz:
            errors.append(
                f"Invalid band '{band.name}': fmin ({band.fmin_hz} Hz) must be < fmax ({band.fmax_hz} Hz)."
            )
        if band.fmax_hz > nyquist:
            errors.append(
                f"Band '{band.name}' upper frequency ({band.fmax_hz} Hz) exceeds Nyquist frequency ({nyquist:.1f} Hz)."
            )

    matched_chs = [
        ch
        for ch in config.channels
        if any(c.strip(".").upper() == ch.strip(".").upper() for c in available_channels)
    ]
    if len(matched_chs) < len(config.channels):
        missing = set(config.channels) - set(matched_chs)
        warnings.append(f"Channels {list(missing)} not found in epoch channels.")

    feature_names = generate_feature_names(config)
    expected_shape = (epoch_count, len(feature_names))

    return FeaturePreview(
        valid=len(errors) == 0,
        epoch_count=epoch_count,
        channels=config.channels,
        bands=config.bands,
        feature_names=feature_names,
        expected_matrix_shape=expected_shape,
        warnings=warnings,
        errors=errors,
    )
