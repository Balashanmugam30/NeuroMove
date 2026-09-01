"""Scientific EEG Preprocessing and DSP Pipeline Engine.

Implements MNE-Python based zero-phase filtering, notch filtering,
referencing, resampling, ICA decomposition, and stage auditing.
Strictly non-destructive on raw inputs.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime
from typing import Any

import mne
import numpy as np

from neuromove.preprocessing.models import (
    ArtifactMethod,
    PreprocessingConfig,
    PreprocessingPreview,
    PreprocessingStage,
    PreprocessingStageAudit,
    ReferenceType,
    SignalIntegrityReport,
    StageStatus,
)


def compute_signal_integrity(raw: mne.io.BaseRaw) -> SignalIntegrityReport:
    """Compute computational signal integrity diagnostics on an MNE Raw object."""
    data = raw.get_data()  # shape: (n_channels, n_samples)
    n_channels, n_samples = data.shape

    nan_count = int(np.isnan(data).sum())
    inf_count = int(np.isinf(data).sum())

    # Amplitudes in microvolts (MNE stores EEG in Volts: 1 V = 1e6 uV)
    data_uv = data * 1e6
    min_amp = float(np.nanmin(data_uv)) if nan_count < data.size else 0.0
    max_amp = float(np.nanmax(data_uv)) if nan_count < data.size else 0.0

    # Detect flatline channels (std < 1e-12 V)
    flatline_channels = []
    channel_stds = np.nanstd(data, axis=1)
    for ch_idx, ch_name in enumerate(raw.ch_names):
        if channel_stds[ch_idx] < 1e-12:
            flatline_channels.append(ch_name)

    # Detect candidate amplitude outliers (|x| > 500 uV in non-flatline channels)
    outlier_count = int(np.sum(np.abs(data_uv) > 500.0))

    status = "HEALTHY"
    if nan_count > 0 or inf_count > 0:
        status = "CORRUPT"
    elif len(flatline_channels) > 0 or outlier_count > (n_samples * 0.1):
        status = "ANOMALOUS"

    return SignalIntegrityReport(
        sample_count=n_samples,
        channel_count=n_channels,
        nan_count=nan_count,
        inf_count=inf_count,
        min_amplitude_uv=round(min_amp, 2),
        max_amplitude_uv=round(max_amp, 2),
        flatline_channels=flatline_channels,
        amplitude_outlier_candidates=outlier_count,
        status=status,
    )


def generate_pipeline_preview(
    raw_info: mne.Info,
    config: PreprocessingConfig,
) -> PreprocessingPreview:
    """Validate preprocessing parameters and generate an execution plan."""
    warnings: list[str] = []
    errors: list[str] = []
    stage_plan: list[str] = ["VALIDATE"]

    sfreq = float(raw_info["sfreq"])
    nyquist = sfreq / 2.0
    ch_names = list(raw_info["ch_names"])

    # 1. Bandpass validation
    if config.highpass_hz >= config.lowpass_hz:
        errors.append(
            f"Invalid filter range: High-pass ({config.highpass_hz} Hz) must be strictly lower than Low-pass ({config.lowpass_hz} Hz)."
        )
    if config.lowpass_hz >= nyquist:
        errors.append(
            f"Low-pass cutoff ({config.lowpass_hz} Hz) must be strictly below Nyquist frequency ({nyquist:.1f} Hz for {sfreq:.1f} Hz sampling)."
        )

    # 2. Reference validation
    if config.reference_type == ReferenceType.AVERAGE:
        if len(ch_names) < 2:
            warnings.append(
                "Average reference requested with fewer than 2 channels; stage will fallback to no-op."
            )
        stage_plan.append("REFERENCE")
    elif config.reference_type == ReferenceType.CHANNEL:
        for ref_ch in config.reference_channels:
            if ref_ch not in ch_names:
                errors.append(
                    f"Specified reference channel '{ref_ch}' not found in source channels."
                )
        stage_plan.append("REFERENCE")
    else:
        stage_plan.append("REFERENCE (NONE)")

    stage_plan.append(f"FILTER (Band-pass {config.highpass_hz}-{config.lowpass_hz} Hz)")

    # 3. Notch validation
    if config.notch.enabled:
        for notch_f in config.notch.frequencies_hz:
            if notch_f >= nyquist:
                errors.append(
                    f"Notch frequency ({notch_f} Hz) exceeds Nyquist frequency ({nyquist:.1f} Hz)."
                )
            elif notch_f >= config.lowpass_hz:
                warnings.append(
                    f"Notch frequency ({notch_f} Hz) is outside retained passband (0.5-{config.lowpass_hz} Hz); stage will be skipped as redundant."
                )
        stage_plan.append("NOTCH")

    # 4. Resampling validation
    est_sfreq = sfreq
    if config.resample.enabled and config.resample.target_hz:
        target_hz = config.resample.target_hz
        if target_hz <= 0:
            errors.append(f"Target sample rate must be positive, got {target_hz} Hz.")
        elif abs(target_hz - sfreq) < 1e-3:
            warnings.append("Target sample rate equals source sample rate; resampling skipped.")
        else:
            est_sfreq = target_hz
            stage_plan.append(f"RESAMPLE ({sfreq:.1f} Hz -> {target_hz:.1f} Hz)")

    # 5. Bad channels validation
    for bad_ch in config.bad_channels:
        if bad_ch not in ch_names:
            warnings.append(f"Bad channel '{bad_ch}' is not present in recording channels.")

    # 6. Artifact validation
    if config.artifact_method == ArtifactMethod.ICA and config.ica_config.enabled:
        n_comp = config.ica_config.n_components
        if n_comp > len(ch_names):
            errors.append(
                f"ICA n_components ({n_comp}) cannot exceed available channel count ({len(ch_names)})."
            )
        stage_plan.append(f"ARTIFACT (ICA {n_comp} components)")

    stage_plan.append("FINAL_VALIDATE")

    return PreprocessingPreview(
        valid=len(errors) == 0,
        effective_config=config,
        input_sample_rate_hz=sfreq,
        estimated_output_sample_rate_hz=est_sfreq,
        input_channels=ch_names,
        estimated_output_channels=ch_names,
        stage_plan=stage_plan,
        warnings=warnings,
        errors=errors,
    )


def apply_preprocessing_pipeline(
    raw_source: mne.io.BaseRaw,
    config: PreprocessingConfig,
) -> tuple[mne.io.BaseRaw, list[PreprocessingStageAudit], list[str], SignalIntegrityReport]:
    """Execute the full preprocessing pipeline non-destructively on a clone of raw_source."""
    # Strict Invariant: clone raw input immediately
    raw = raw_source.copy()
    raw.load_data()

    audits: list[PreprocessingStageAudit] = []
    warnings: list[str] = []
    sfreq = float(raw.info["sfreq"])
    nyquist = sfreq / 2.0

    # Stage 1: VALIDATE
    t0 = time.perf_counter()
    start_iso = datetime.now(UTC).isoformat()
    # Mark bad channels if specified
    if config.bad_channels:
        valid_bads = [ch for ch in config.bad_channels if ch in raw.ch_names]
        raw.info["bads"] = valid_bads
    t1 = time.perf_counter()
    audits.append(
        PreprocessingStageAudit(
            stage=PreprocessingStage.VALIDATE,
            status=StageStatus.COMPLETED,
            started_at=start_iso,
            completed_at=datetime.now(UTC).isoformat(),
            duration_ms=round((t1 - t0) * 1000, 2),
            parameters={
                "input_channels": len(raw.ch_names),
                "sampling_rate_hz": sfreq,
                "bad_channels_marked": raw.info["bads"],
            },
            warnings=[],
        )
    )

    # Stage 2: REFERENCE
    t0 = time.perf_counter()
    start_iso = datetime.now(UTC).isoformat()
    if config.reference_type == ReferenceType.AVERAGE and len(raw.ch_names) >= 2:
        raw.set_eeg_reference(ref_channels="average", projection=False, verbose=False)
        ref_status = StageStatus.COMPLETED
        ref_params = {"reference": "average", "channel_count": len(raw.ch_names)}
    elif config.reference_type == ReferenceType.CHANNEL and config.reference_channels:
        valid_refs = [ch for ch in config.reference_channels if ch in raw.ch_names]
        if valid_refs:
            raw.set_eeg_reference(ref_channels=valid_refs, projection=False, verbose=False)
            ref_status = StageStatus.COMPLETED
            ref_params = {"reference": "channel", "channels": valid_refs}
        else:
            ref_status = StageStatus.SKIPPED
            ref_params = {"reference": "none", "reason": "no valid reference channels"}
    else:
        ref_status = StageStatus.SKIPPED
        ref_params = {"reference": "none"}
    t1 = time.perf_counter()
    audits.append(
        PreprocessingStageAudit(
            stage=PreprocessingStage.REFERENCE,
            status=ref_status,
            started_at=start_iso,
            completed_at=datetime.now(UTC).isoformat(),
            duration_ms=round((t1 - t0) * 1000, 2),
            parameters=ref_params,
            warnings=[],
        )
    )

    # Stage 3: FILTER (Band-pass)
    t0 = time.perf_counter()
    start_iso = datetime.now(UTC).isoformat()
    # Zero-phase FIR filtering using firwin
    raw.filter(
        l_freq=config.highpass_hz,
        h_freq=config.lowpass_hz,
        method="fir",
        phase="zero",
        fir_design="firwin",
        verbose=False,
    )
    t1 = time.perf_counter()
    audits.append(
        PreprocessingStageAudit(
            stage=PreprocessingStage.FILTER,
            status=StageStatus.COMPLETED,
            started_at=start_iso,
            completed_at=datetime.now(UTC).isoformat(),
            duration_ms=round((t1 - t0) * 1000, 2),
            parameters={
                "highpass_hz": config.highpass_hz,
                "lowpass_hz": config.lowpass_hz,
                "method": "fir",
                "phase": "zero-phase",
                "design": "firwin",
            },
            warnings=[],
        )
    )

    # Stage 4: NOTCH
    t0 = time.perf_counter()
    start_iso = datetime.now(UTC).isoformat()
    if config.notch.enabled:
        applicable_notches = [
            f for f in config.notch.frequencies_hz if f < config.lowpass_hz and f < nyquist
        ]
        redundant_notches = [f for f in config.notch.frequencies_hz if f >= config.lowpass_hz]
        if redundant_notches:
            w_msg = f"Notch frequencies {redundant_notches} Hz outside passband (0.5-{config.lowpass_hz} Hz); skipped as redundant."
            warnings.append(w_msg)

        if applicable_notches:
            raw.notch_filter(
                freqs=applicable_notches,
                notch_widths=config.notch.notch_width_hz,
                method="fir",
                phase="zero",
                fir_design="firwin",
                verbose=False,
            )
            notch_status = StageStatus.COMPLETED
            notch_params = {
                "applied_frequencies_hz": applicable_notches,
                "skipped_frequencies_hz": redundant_notches,
                "width_hz": config.notch.notch_width_hz,
            }
        else:
            notch_status = StageStatus.SKIPPED
            notch_params = {
                "reason": "all notch frequencies redundant or invalid",
                "frequencies_hz": config.notch.frequencies_hz,
            }
    else:
        notch_status = StageStatus.SKIPPED
        notch_params = {"reason": "notch disabled in configuration"}
    t1 = time.perf_counter()
    audits.append(
        PreprocessingStageAudit(
            stage=PreprocessingStage.NOTCH,
            status=notch_status,
            started_at=start_iso,
            completed_at=datetime.now(UTC).isoformat(),
            duration_ms=round((t1 - t0) * 1000, 2),
            parameters=notch_params,
            warnings=[w for w in warnings if "Notch" in w],
        )
    )

    # Stage 5: RESAMPLE
    t0 = time.perf_counter()
    start_iso = datetime.now(UTC).isoformat()
    if (
        config.resample.enabled
        and config.resample.target_hz
        and abs(config.resample.target_hz - raw.info["sfreq"]) > 1e-3
    ):
        target_sfreq = config.resample.target_hz
        raw.resample(sfreq=target_sfreq, npad="auto", verbose=False)
        resample_status = StageStatus.COMPLETED
        resample_params = {
            "source_sfreq_hz": sfreq,
            "target_sfreq_hz": target_sfreq,
            "anti_aliasing": config.resample.anti_aliasing,
        }
    else:
        resample_status = StageStatus.SKIPPED
        resample_params = {"source_sfreq_hz": sfreq, "resampling_enabled": config.resample.enabled}
    t1 = time.perf_counter()
    audits.append(
        PreprocessingStageAudit(
            stage=PreprocessingStage.RESAMPLE,
            status=resample_status,
            started_at=start_iso,
            completed_at=datetime.now(UTC).isoformat(),
            duration_ms=round((t1 - t0) * 1000, 2),
            parameters=resample_params,
            warnings=[],
        )
    )

    # Stage 6: ARTIFACT (Optional ICA)
    t0 = time.perf_counter()
    start_iso = datetime.now(UTC).isoformat()
    if (
        config.artifact_method == ArtifactMethod.ICA
        and config.ica_config.enabled
        and len(raw.ch_names) >= 2
    ):
        n_components = min(config.ica_config.n_components, len(raw.ch_names))
        ica = mne.preprocessing.ICA(
            n_components=n_components,
            method=config.ica_config.method,
            random_state=config.ica_config.random_state,
            max_iter="auto",
            verbose=False,
        )
        ica.fit(raw, verbose=False)
        if config.ica_config.excluded_components:
            ica.exclude = [
                c for c in config.ica_config.excluded_components if 0 <= c < n_components
            ]
            ica.apply(raw, verbose=False)
        artifact_status = StageStatus.COMPLETED
        artifact_params = {
            "method": "fastica",
            "n_components": n_components,
            "excluded_components": ica.exclude,
            "random_state": config.ica_config.random_state,
        }
    else:
        artifact_status = StageStatus.SKIPPED
        artifact_params = {"method": config.artifact_method.value}
    t1 = time.perf_counter()
    audits.append(
        PreprocessingStageAudit(
            stage=PreprocessingStage.ARTIFACT,
            status=artifact_status,
            started_at=start_iso,
            completed_at=datetime.now(UTC).isoformat(),
            duration_ms=round((t1 - t0) * 1000, 2),
            parameters=artifact_params,
            warnings=[],
        )
    )

    # Stage 7: FINAL_VALIDATE
    t0 = time.perf_counter()
    start_iso = datetime.now(UTC).isoformat()
    integrity = compute_signal_integrity(raw)
    t1 = time.perf_counter()
    audits.append(
        PreprocessingStageAudit(
            stage=PreprocessingStage.FINAL_VALIDATE,
            status=StageStatus.COMPLETED,
            started_at=start_iso,
            completed_at=datetime.now(UTC).isoformat(),
            duration_ms=round((t1 - t0) * 1000, 2),
            parameters={
                "status": integrity.status,
                "sample_count": integrity.sample_count,
                "channel_count": integrity.channel_count,
                "min_uv": integrity.min_amplitude_uv,
                "max_uv": integrity.max_amplitude_uv,
            },
            warnings=[],
        )
    )

    return raw, audits, warnings, integrity


def fit_ica_decomposition(
    raw: mne.io.BaseRaw,
    n_components: int = 15,
    random_state: int = 42,
) -> dict[str, Any]:
    """Fit ICA model on raw EEG and return component metadata."""
    n_comp = min(n_components, len(raw.ch_names))
    ica = mne.preprocessing.ICA(
        n_components=n_comp,
        method="fastica",
        random_state=random_state,
        max_iter="auto",
        verbose=False,
    )
    ica.fit(raw, verbose=False)

    components: list[dict[str, Any]] = []
    for idx in range(n_comp):
        components.append(
            {
                "component_index": idx,
                "name": f"ICA{idx:03d}",
                "explained_variance_ratio": float(1.0 / n_comp),  # baseline placeholder
                "status": "INCLUDED",
            }
        )

    return {
        "n_components": n_comp,
        "method": "fastica",
        "random_state": random_state,
        "components": components,
    }
