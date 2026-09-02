"""Comprehensive Unit and Integration Tests for Confidence Estimation & Temporal Confirmation Engine."""

import numpy as np
import pytest
from fastapi.testclient import TestClient

from neuromove.api.app import app
from neuromove.confidence.calibrator import ConfidenceCalibrator
from neuromove.confidence.evaluator import ConfidenceEvaluator
from neuromove.confidence.models import (
    CalibrationMethod,
    CalibrationScope,
    ConfidenceBand,
    ConfidenceConfig,
    ConfidenceEligibility,
    ConfidenceInput,
    FreshnessStatus,
    ModelValidityStatus,
    ScoreType,
    TemporalStatus,
)
from neuromove.confidence.normalizer import ModelScoreNormalizer
from neuromove.confidence.service import get_confidence_service
from neuromove.confidence.temporal_engine import TemporalConfirmationEngine


@pytest.fixture
def client():
    return TestClient(app)


# ============================================================================
# 1. Model Score Normalization & Margin Tests
# ============================================================================


class TestModelScoreNormalizer:
    def test_normalize_probabilities(self):
        assert ModelScoreNormalizer.normalize_score(0.85, ScoreType.PROBABILITY) == 0.85
        assert ModelScoreNormalizer.normalize_score(1.50, ScoreType.PROBABILITY) == 1.0
        assert ModelScoreNormalizer.normalize_score(-0.20, ScoreType.PROBABILITY) == 0.0

    def test_normalize_decision_margin(self):
        # 0.0 margin -> 0.50
        assert (
            abs(ModelScoreNormalizer.normalize_score(0.0, ScoreType.DECISION_MARGIN) - 0.5) < 1e-4
        )
        # Positive margin -> > 0.5
        assert ModelScoreNormalizer.normalize_score(2.0, ScoreType.DECISION_MARGIN) > 0.8
        # Negative margin -> < 0.5
        assert ModelScoreNormalizer.normalize_score(-2.0, ScoreType.DECISION_MARGIN) < 0.2

    def test_nan_inf_safety(self):
        assert ModelScoreNormalizer.normalize_score(float("nan"), ScoreType.PROBABILITY) == 0.0
        assert ModelScoreNormalizer.normalize_score(float("inf"), ScoreType.DECISION_MARGIN) == 0.0

    def test_class_margin_computation(self):
        scores = {"LEFT_IMAGERY": 0.85, "RIGHT_IMAGERY": 0.15}
        raw_margin, runner_up, norm_margin = ModelScoreNormalizer.compute_class_margin(scores)
        assert abs(raw_margin - 0.70) < 1e-4
        assert runner_up == "RIGHT_IMAGERY"
        assert abs(norm_margin - 0.70) < 1e-4

    def test_class_margin_tie(self):
        scores = {"LEFT": 0.50, "RIGHT": 0.50}
        raw_margin, runner_up, norm_margin = ModelScoreNormalizer.compute_class_margin(scores)
        assert abs(raw_margin - 0.0) < 1e-4
        assert runner_up in ("LEFT", "RIGHT")
        assert norm_margin == 0.0


# ============================================================================
# 2. Confidence Calibration & Zero Leakage Tests
# ============================================================================


class TestConfidenceCalibrator:
    def test_platt_scaling_fit_and_apply(self):
        y_true = np.array([1, 0, 1, 1, 0, 0, 1, 0, 1, 1])
        uncalibrated = np.array([0.9, 0.1, 0.8, 0.85, 0.2, 0.3, 0.75, 0.15, 0.95, 0.7])

        profile = ConfidenceCalibrator.fit_calibration_profile(
            model_version_id="mdl_test_v1",
            uncalibrated_scores=uncalibrated,
            y_true=y_true,
            method=CalibrationMethod.PLATT,
            scope=CalibrationScope.MODEL,
        )

        assert profile.method == CalibrationMethod.PLATT
        assert "coef" in profile.parameters
        assert "intercept" in profile.parameters
        assert profile.calibration_metrics.brier_score >= 0.0
        assert profile.calibration_metrics.expected_calibration_error >= 0.0

        calibrated = ConfidenceCalibrator.calibrate_score(0.85, profile)
        assert 0.0 <= calibrated <= 1.0

    def test_isotonic_calibration_fit(self):
        y_true = np.array([1, 0, 1, 1, 0, 0, 1, 0])
        uncalibrated = np.array([0.9, 0.1, 0.8, 0.85, 0.2, 0.3, 0.75, 0.15])

        profile = ConfidenceCalibrator.fit_calibration_profile(
            model_version_id="mdl_test_v1",
            uncalibrated_scores=uncalibrated,
            y_true=y_true,
            method=CalibrationMethod.ISOTONIC,
        )

        assert profile.method == CalibrationMethod.ISOTONIC
        calibrated = ConfidenceCalibrator.calibrate_score(0.80, profile)
        assert 0.0 <= calibrated <= 1.0

    def test_zero_data_leakage_protection(self):
        y_true = np.array([1, 0, 1, 0])
        scores = np.array([0.9, 0.1, 0.8, 0.2])

        fit_epochs = {"ep_001", "ep_002", "ep_003"}
        protected_eval = {"ep_003", "ep_004"}  # ep_003 overlaps!

        with pytest.raises(ValueError, match="Data leakage detected"):
            ConfidenceCalibrator.fit_calibration_profile(
                model_version_id="mdl_v1",
                uncalibrated_scores=scores,
                y_true=y_true,
                fit_epoch_ids=fit_epochs,
                protected_eval_epoch_ids=protected_eval,
            )


# ============================================================================
# 3. Multi-Factor Evaluation & Gating Tests
# ============================================================================


class TestConfidenceEvaluator:
    def test_valid_high_confidence_evaluation(self):
        evaluator = ConfidenceEvaluator()
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

        dec = evaluator.evaluate(inp, evaluation_timestamp=t0)
        assert dec.eligibility == ConfidenceEligibility.VALID
        assert dec.confidence_band == ConfidenceBand.HIGH
        assert dec.calibrated_confidence >= 0.75
        assert dec.freshness == FreshnessStatus.FRESH

    def test_low_signal_quality_rejection(self):
        evaluator = ConfidenceEvaluator(ConfidenceConfig(quality_floor=0.50))
        t0 = 1000.0

        inp = ConfidenceInput(
            prediction="LEFT_IMAGERY",
            raw_score=0.99,  # High raw score
            score_type=ScoreType.PROBABILITY,
            model_id="mdl_v1",
            model_version_id="v1",
            prediction_timestamp=t0,
            data_timestamp=t0,
            signal_quality=0.30,  # Below quality floor!
        )

        dec = evaluator.evaluate(inp, evaluation_timestamp=t0)
        assert dec.eligibility == ConfidenceEligibility.LOW_SIGNAL
        assert dec.confidence_band == ConfidenceBand.UNKNOWN
        assert "below configured quality floor" in dec.decision_reason

    def test_stale_data_rejection(self):
        evaluator = ConfidenceEvaluator(ConfidenceConfig(max_age_ms=400.0))
        t0 = 1000.0

        inp = ConfidenceInput(
            prediction="LEFT_IMAGERY",
            raw_score=0.95,
            score_type=ScoreType.PROBABILITY,
            model_id="mdl_v1",
            model_version_id="v1",
            prediction_timestamp=t0,
            data_timestamp=t0 - 0.60,  # 600ms old (> 400ms)
            signal_quality=0.95,
        )

        dec = evaluator.evaluate(inp, evaluation_timestamp=t0)
        assert dec.freshness == FreshnessStatus.STALE
        assert dec.eligibility == ConfidenceEligibility.STALE
        assert dec.confidence_band == ConfidenceBand.UNKNOWN

    def test_model_invalid_gating(self):
        evaluator = ConfidenceEvaluator()
        t0 = 1000.0

        inp = ConfidenceInput(
            prediction="LEFT_IMAGERY",
            raw_score=0.95,
            score_type=ScoreType.PROBABILITY,
            model_id="mdl_v1",
            model_version_id="v1",
            model_validity=ModelValidityStatus.ROLLED_BACK,  # Model rolled back
            prediction_timestamp=t0,
            data_timestamp=t0,
            signal_quality=0.95,
        )

        dec = evaluator.evaluate(inp, evaluation_timestamp=t0)
        assert dec.eligibility == ConfidenceEligibility.MODEL_INVALID
        assert dec.confidence_band == ConfidenceBand.UNKNOWN


# ============================================================================
# 4. Temporal Confirmation Engine & Boundary Isolation Tests
# ============================================================================


class TestTemporalConfirmationEngine:
    def test_consecutive_evidence_confirmation(self):
        config = ConfidenceConfig(min_consecutive_windows=3, min_duration_ms=500.0)
        engine = TemporalConfirmationEngine(config)
        t0 = 1000.0

        evaluator = ConfidenceEvaluator(config)

        for i in range(3):
            t = t0 + i * 0.25
            inp = ConfidenceInput(
                prediction="LEFT",
                raw_score=0.90,
                score_type=ScoreType.PROBABILITY,
                model_id="mdl_v1",
                model_version_id="v1",
                prediction_timestamp=t,
                data_timestamp=t,
                signal_quality=0.95,
            )
            dec = evaluator.evaluate(inp, evaluation_timestamp=t)
            temp_dec, handoff = engine.process_decision(dec, now_timestamp=t)

            if i < 2:
                assert not temp_dec.temporally_confirmed
                assert temp_dec.temporal_status == TemporalStatus.TRACKING
            else:
                assert temp_dec.temporally_confirmed
                assert temp_dec.temporal_status == TemporalStatus.CONFIRMED
                assert handoff.temporally_confirmed
                assert handoff.prediction == "LEFT"

    def test_threshold_hysteresis_behavior(self):
        config = ConfidenceConfig(hysteresis_enter=0.75, hysteresis_exit=0.60)
        engine = TemporalConfirmationEngine(config)
        evaluator = ConfidenceEvaluator(config)
        t0 = 1000.0

        # Step 1: Score 0.68 is below enter 0.75 -> IDLE
        inp1 = ConfidenceInput(
            prediction="LEFT",
            raw_score=0.68,
            score_type=ScoreType.PROBABILITY,
            model_id="mdl_v1",
            model_version_id="v1",
            prediction_timestamp=t0,
            data_timestamp=t0,
            signal_quality=0.95,
        )
        dec1 = evaluator.evaluate(inp1, evaluation_timestamp=t0)
        temp1, _ = engine.process_decision(dec1, now_timestamp=t0)
        assert temp1.temporal_status == TemporalStatus.IDLE

        # Step 2: Score 0.85 exceeds enter 0.75 -> TRACKING
        inp2 = ConfidenceInput(
            prediction="LEFT",
            raw_score=0.85,
            score_type=ScoreType.PROBABILITY,
            model_id="mdl_v1",
            model_version_id="v1",
            prediction_timestamp=t0 + 0.25,
            data_timestamp=t0 + 0.25,
            signal_quality=0.95,
        )
        dec2 = evaluator.evaluate(inp2, evaluation_timestamp=t0 + 0.25)
        temp2, _ = engine.process_decision(dec2, now_timestamp=t0 + 0.25)
        assert temp2.temporal_status == TemporalStatus.TRACKING

        # Step 3: Score drops to 0.76 (above exit 0.60, below enter 0.75) -> Stays TRACKING under hysteresis!
        inp3 = ConfidenceInput(
            prediction="LEFT",
            raw_score=0.76,
            score_type=ScoreType.PROBABILITY,
            model_id="mdl_v1",
            model_version_id="v1",
            prediction_timestamp=t0 + 0.50,
            data_timestamp=t0 + 0.50,
            signal_quality=0.95,
        )
        dec3 = evaluator.evaluate(inp3, evaluation_timestamp=t0 + 0.50)
        temp3, _ = engine.process_decision(dec3, now_timestamp=t0 + 0.50)
        assert temp3.temporal_status == TemporalStatus.TRACKING

    def test_model_version_boundary_reset(self):
        config = ConfidenceConfig(min_consecutive_windows=3)
        engine = TemporalConfirmationEngine(config)
        evaluator = ConfidenceEvaluator(config)
        t0 = 1000.0

        # Feed 2 windows of v1
        for i in range(2):
            t = t0 + i * 0.25
            inp = ConfidenceInput(
                prediction="LEFT",
                raw_score=0.90,
                score_type=ScoreType.PROBABILITY,
                model_id="mdl",
                model_version_id="v1",
                prediction_timestamp=t,
                data_timestamp=t,
                signal_quality=0.95,
            )
            dec = evaluator.evaluate(inp, evaluation_timestamp=t)
            temp, _ = engine.process_decision(dec, now_timestamp=t)
            assert temp.consecutive_count == i + 1

        # Feed 3rd window with model version v2 -> Resets to 1, does NOT inherit v1 evidence!
        t = t0 + 0.50
        inp_v2 = ConfidenceInput(
            prediction="LEFT",
            raw_score=0.90,
            score_type=ScoreType.PROBABILITY,
            model_id="mdl",
            model_version_id="v2",
            prediction_timestamp=t,
            data_timestamp=t,
            signal_quality=0.95,
        )
        dec_v2 = evaluator.evaluate(inp_v2, evaluation_timestamp=t)
        temp_v2, _ = engine.process_decision(dec_v2, now_timestamp=t)
        assert temp_v2.consecutive_count == 1
        assert not temp_v2.temporally_confirmed


# ============================================================================
# 5. Service & Scenarios Integration Tests
# ============================================================================


class TestConfidenceServiceAndScenarios:
    def test_scenario_a_stable_high_confidence(self):
        svc = get_confidence_service()
        res = svc.run_deterministic_scenario("SCENARIO_A_STABLE_HIGH_CONFIDENCE")
        assert res["scenario_id"] == "SCENARIO_A_STABLE_HIGH_CONFIDENCE"
        results = res["results"]
        assert len(results) == 4
        # Confirmation reached during sequence
        assert any(step["confirmed"] is True for step in results)

    def test_scenario_b_prediction_flicker(self):
        svc = get_confidence_service()
        res = svc.run_deterministic_scenario("SCENARIO_B_PREDICTION_FLICKER")
        for step in res["results"]:
            assert step["confirmed"] is False

    def test_scenario_c_poor_signal_quality(self):
        svc = get_confidence_service()
        res = svc.run_deterministic_scenario("SCENARIO_C_POOR_SIGNAL_QUALITY")
        step1 = res["results"][0]
        assert step1["eligibility"] == "LOW_SIGNAL"
        assert step1["confirmed"] is False

    def test_scenario_d_stale_data(self):
        svc = get_confidence_service()
        res = svc.run_deterministic_scenario("SCENARIO_D_STALE_DATA")
        step1 = res["results"][0]
        assert step1["freshness"] == "STALE"
        assert step1["confirmed"] is False


# ============================================================================
# 6. REST API Endpoints Integration Tests
# ============================================================================


class TestConfidenceAPI:
    def test_get_and_update_config(self, client):
        r = client.get("/api/confidence/config")
        assert r.status_code == 200
        cfg = r.json()
        assert "high_threshold" in cfg

        # Update config
        cfg["high_threshold"] = 0.80
        r_up = client.put("/api/confidence/config", json=cfg)
        assert r_up.status_code == 200
        assert r_up.json()["high_threshold"] == 0.80

    def test_evaluate_endpoint(self, client):
        payload = {
            "prediction": "LEFT_IMAGERY",
            "raw_score": 0.92,
            "score_type": "PROBABILITY",
            "model_id": "mdl_v1",
            "model_version_id": "v1",
            "prediction_timestamp": 1000.0,
            "data_timestamp": 1000.0,
            "signal_quality": 0.95,
        }
        r = client.post("/api/confidence/evaluate", json=payload)
        assert r.status_code == 200
        body = r.json()
        assert "decision" in body
        assert "temporal" in body
        assert "handoff" in body
        assert body["decision"]["prediction"] == "LEFT_IMAGERY"

    def test_reset_endpoint(self, client):
        r = client.post("/api/confidence/reset", json={"reason": "MANUAL_RESET"})
        assert r.status_code == 200
        assert r.json()["status"] == "RESET"

    def test_state_and_history_endpoints(self, client):
        r_state = client.get("/api/confidence/state")
        assert r_state.status_code == 200

        r_hist = client.get("/api/confidence/history?limit=10")
        assert r_hist.status_code == 200
        assert isinstance(r_hist.json(), list)

    def test_calibration_and_metrics_endpoints(self, client):
        r_calib = client.get("/api/confidence/calibration?model_version_id=v1")
        assert r_calib.status_code == 200

        r_metrics = client.get("/api/confidence/metrics?model_version_id=v1")
        assert r_metrics.status_code == 200
        assert "brier_score" in r_metrics.json()
