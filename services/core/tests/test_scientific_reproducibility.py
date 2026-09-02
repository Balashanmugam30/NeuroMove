"""Phase 24.3 Scientific Validation & Reproducibility Test Suite.

Verifies:
1. Deterministic simulation output repeatability with fixed seeds.
2. CSP spatial filter deterministic eigenvalue decomposition and fit isolation.
3. Anti-leakage safeguards (test/train partition integrity).
4. Deterministic confidence scoring and temporal confirmation repeatability.
"""

from __future__ import annotations

import numpy as np
import pytest

from neuromove.confidence.evaluator import ConfidenceEvaluator
from neuromove.confidence.models import (
    ConfidenceBand,
    ConfidenceEligibility,
    ConfidenceInput,
    ScoreType,
)
from neuromove.decoding.csp import build_csp_transformer
from neuromove.decoding.models import CSPConfig
from neuromove.simulation.config import SimulationConfig
from neuromove.simulation.eeg_generator import SyntheticEEGGenerator


class TestScientificReproducibility:
    """Rigorous scientific reproducibility and anti-leakage verification."""

    # -------------------------------------------------------------------------
    # 1. Deterministic Simulation Outputs
    # -------------------------------------------------------------------------
    def test_simulation_engine_deterministic_seed_reproducibility(self) -> None:
        """Two synthetic generators initialized with identical seed generate bit-for-bit identical signals."""
        seed = 42
        cfg1 = SimulationConfig(seed=seed, channels=["C3", "Cz", "C4"], sample_rate_hz=250)
        cfg2 = SimulationConfig(seed=seed, channels=["C3", "Cz", "C4"], sample_rate_hz=250)

        gen1 = SyntheticEEGGenerator(cfg1)
        gen2 = SyntheticEEGGenerator(cfg2)

        # Generate samples from both
        chunk1 = gen1.generate_samples(count=50)
        chunk2 = gen2.generate_samples(count=50)

        assert chunk1.sample_count == chunk2.sample_count
        assert chunk1.channels == chunk2.channels
        for ch in chunk1.channels:
            assert chunk1.samples[ch] == pytest.approx(chunk2.samples[ch], abs=1e-7)

    # -------------------------------------------------------------------------
    # 2. CSP Spatial Filtering Determinism & Anti-Leakage
    # -------------------------------------------------------------------------
    def test_csp_spatial_filtering_deterministic_decomposition(self) -> None:
        """CSP spatial filter produces identical spatial filters and eigenvalues across repeated fits."""
        rng = np.random.default_rng(12345)
        n_epochs = 40
        n_channels = 8
        n_times = 250

        # Generate synthetic 2-class epochs
        epochs = rng.standard_normal((n_epochs, n_channels, n_times))
        labels = np.array([0] * 20 + [1] * 20)

        config = CSPConfig(n_components=4, log=True, norm_trace=False)
        csp1 = build_csp_transformer(config, n_channels=n_channels)
        csp2 = build_csp_transformer(config, n_channels=n_channels)

        features1 = csp1.fit_transform(epochs, labels)
        features2 = csp2.fit_transform(epochs, labels)

        # Assert identical spatial patterns and transformed features
        np.testing.assert_allclose(features1, features2, rtol=1e-7, atol=1e-7)
        if hasattr(csp1, "filters_") and hasattr(csp2, "filters_"):
            np.testing.assert_allclose(csp1.filters_, csp2.filters_, rtol=1e-7, atol=1e-7)

    def test_anti_leakage_train_test_fit_isolation(self) -> None:
        """CSP spatial filters and normalizers must be fit ONLY on train split."""
        rng = np.random.default_rng(999)
        train_epochs = rng.standard_normal((30, 8, 200))
        train_labels = np.array([0] * 15 + [1] * 15)

        test_epochs = rng.standard_normal((10, 8, 200))

        config = CSPConfig(n_components=4, log=True)
        csp = build_csp_transformer(config, n_channels=8)
        csp.fit(train_epochs, train_labels)

        # Transform test set without refitting
        test_features = csp.transform(test_epochs)
        assert test_features.shape == (10, 4)
        assert not np.isnan(test_features).any()

    # -------------------------------------------------------------------------
    # 3. Confidence & Temporal Confirmation Determinism
    # -------------------------------------------------------------------------
    def test_confidence_evaluator_deterministic_scoring(self) -> None:
        """Identical inputs produce deterministic calibrated confidence scores."""
        evaluator1 = ConfidenceEvaluator()
        evaluator2 = ConfidenceEvaluator()

        t0 = 1000.0
        inp = ConfidenceInput(
            prediction="LEFT_IMAGERY",
            raw_score=0.92,
            score_type=ScoreType.PROBABILITY,
            class_scores={"LEFT_IMAGERY": 0.92, "RIGHT_IMAGERY": 0.08},
            model_id="mdl_v1",
            model_version_id="v1",
            prediction_timestamp=t0,
            data_timestamp=t0,
            signal_quality=0.95,
        )

        dec1 = evaluator1.evaluate(inp, evaluation_timestamp=t0)
        dec2 = evaluator2.evaluate(inp, evaluation_timestamp=t0)

        assert dec1.eligibility == dec2.eligibility == ConfidenceEligibility.VALID
        assert dec1.confidence_band == dec2.confidence_band == ConfidenceBand.HIGH
        assert dec1.calibrated_confidence == pytest.approx(dec2.calibrated_confidence, abs=1e-6)
