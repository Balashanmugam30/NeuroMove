"""NeuroMove — Phase 22 Research Analytics Comprehensive Test Suite.

Validates manifests, immutability, deterministic replay, checkpoints, leakage-safe datasets,
metrics, statistics, bootstrap CIs, latency, confidence, intent, safety, HIL, ablations,
robustness sweeps, comparisons, reproducibility audits, artifact exports, 12 Golden Scenarios, and REST API.
"""

from __future__ import annotations

import copy
import json
from datetime import UTC, datetime

import numpy as np
import pytest
from fastapi.testclient import TestClient

from neuromove.api.app import app
from neuromove.database.connection import default_db_manager
from neuromove.research_analytics.ablation import AblationEngine
from neuromove.research_analytics.artifacts import ResearchArtifactGenerator
from neuromove.research_analytics.comparison import ComparisonEngine
from neuromove.research_analytics.confidence import ConfidenceAnalyticsEngine
from neuromove.research_analytics.dataset import ResearchDatasetManager
from neuromove.research_analytics.intent import IntentAnalyticsEngine
from neuromove.research_analytics.latency import LatencyAnalyticsEngine, SignalQualityAnalyticsEngine
from neuromove.research_analytics.manifest import ExperimentManifestManager
from neuromove.research_analytics.metrics import ScientificMetricsEngine
from neuromove.research_analytics.models import (
    AnalysisType,
    ArtifactType,
    GroupingStrategy,
    PipelineStage,
    ReplayCheckpoint,
    ReplayMode,
    ReproducibilityStatus,
    ResearchArtifact,
    ResearchDataset,
    ResearchExperiment,
    ResearchExperimentStatus,
)
from neuromove.research_analytics.replay import DeterministicReplayEngine
from neuromove.research_analytics.reproducibility import ReproducibilityChecker
from neuromove.research_analytics.robustness import RobustnessEngine
from neuromove.research_analytics.safety import SafetyAnalyticsEngine
from neuromove.research_analytics.hil import HilAnalyticsEngine
from neuromove.research_analytics.scenarios import ResearchGoldenScenarios
from neuromove.research_analytics.service import ResearchAnalyticsService
from neuromove.research_analytics.statistics import ResearchStatisticsEngine
from neuromove.research_analytics.storage import ResearchStorage


@pytest.fixture(autouse=True)
def setup_db():
    default_db_manager.initialize_db()


# ============================================================================
# 1. Manifest, Sealing & Provenance Hashing Tests
# ============================================================================


def test_manifest_creation_and_hash():
    man = ExperimentManifestManager.create_manifest(
        experiment_id="exp_test_01",
        seed=42,
    )
    assert man.experiment_id == "exp_test_01"
    assert man.manifest_hash != ""
    assert len(man.manifest_hash) == 64
    assert man.is_sealed is False


def test_manifest_canonicalization_deterministic():
    man1 = ExperimentManifestManager.create_manifest(experiment_id="exp_01", seed=42)
    man2 = ExperimentManifestManager.create_manifest(experiment_id="exp_01", seed=42)
    # Different manifest_id, but if id is stripped canonicalization is identical
    d1 = man1.model_dump()
    d2 = man2.model_dump()
    d1["manifest_id"] = "fixed_id"
    d2["manifest_id"] = "fixed_id"
    d1["created_at"] = "fixed_time"
    d2["created_at"] = "fixed_time"
    assert ExperimentManifestManager.canonicalize(d1) == ExperimentManifestManager.canonicalize(d2)


def test_manifest_sealing():
    man = ExperimentManifestManager.create_manifest(experiment_id="exp_test_02")
    sealed = ExperimentManifestManager.seal_manifest(man)
    assert sealed.is_sealed is True
    assert sealed.sealed_at is not None
    assert ExperimentManifestManager.verify_manifest_integrity(sealed) is True


def test_child_manifest_preserves_parent_immutability():
    parent = ExperimentManifestManager.create_manifest(experiment_id="exp_parent")
    sealed_parent = ExperimentManifestManager.seal_manifest(parent)
    original_parent_hash = sealed_parent.manifest_hash

    child, delta = ExperimentManifestManager.create_child_manifest(
        parent_manifest=sealed_parent,
        child_experiment_id="exp_child",
        delta_config={"model_id": "svm_rbf_v2"},
    )

    assert child.experiment_id == "exp_child"
    assert child.model_id == "svm_rbf_v2"
    assert child.manifest_hash != original_parent_hash
    assert sealed_parent.model_id == "lda_csp_mi_v1"
    assert sealed_parent.manifest_hash == original_parent_hash


# ============================================================================
# 2. Replay Engine & Checkpointing Tests
# ============================================================================


def test_replay_engine_execution():
    engine = DeterministicReplayEngine()
    man = ExperimentManifestManager.create_manifest(experiment_id="exp_rep_01", seed=10)
    stages, preds, safety, hil, res_hash = engine.run_replay(
        manifest=man,
        replay_mode=ReplayMode.DETERMINISTIC_ACCELERATED,
        trial_count=10,
    )

    assert len(stages) == 15
    assert len(preds) == 10
    assert len(safety) == 10
    assert len(hil) == 10
    assert res_hash != ""


def test_replay_checkpoint_creation_and_resume():
    chk = DeterministicReplayEngine.create_checkpoint(
        experiment_id="exp_chk_01",
        stage=PipelineStage.EPOCH,
        source_offset=5,
        epoch_index=5,
        manifest_hash="hash123",
    )
    assert chk.experiment_id == "exp_chk_01"
    assert chk.intermediate_checksum != ""

    # Resume with incompatible manifest must raise ValueError
    engine = DeterministicReplayEngine()
    man_bad = ExperimentManifestManager.create_manifest(experiment_id="exp_chk_01", seed=999)
    with pytest.raises(ValueError, match="does not match"):
        engine.run_replay(manifest=man_bad, checkpoint=chk)


# ============================================================================
# 3. Leakage-Safe Dataset Grouping Tests
# ============================================================================


def test_dataset_creation_and_checksum():
    ds = ResearchDatasetManager.create_dataset(
        name="Test MI Dataset",
        description="Leakage-safe test dataset",
        session_ids=["sess_1", "sess_2"],
        subjects=["sub-01", "sub-02"],
    )
    assert ds.dataset_id.startswith("ds_")
    assert ds.dataset_checksum != ""


def test_leakage_safe_partitioning():
    items = [
        {"item_id": 1, "subject_id": "sub-01", "label": "LEFT"},
        {"item_id": 2, "subject_id": "sub-01", "label": "RIGHT"},
        {"item_id": 3, "subject_id": "sub-02", "label": "LEFT"},
        {"item_id": 4, "subject_id": "sub-02", "label": "RIGHT"},
        {"item_id": 5, "subject_id": "sub-03", "label": "FORWARD"},
    ]
    train, test = ResearchDatasetManager.partition_folds(items, group_key="subject_id", test_ratio=0.33)
    train_subs = {x["subject_id"] for x in train}
    test_subs = {x["subject_id"] for x in test}
    assert len(train_subs & test_subs) == 0


# ============================================================================
# 4. Scientific Metrics & Calibration Tests
# ============================================================================


def test_metrics_perfect_classification():
    y_true = ["LEFT", "RIGHT", "FORWARD", "STOP"] * 5
    y_pred = ["LEFT", "RIGHT", "FORWARD", "STOP"] * 5
    y_prob = [{c: (0.9 if c == t else 0.033) for c in ["LEFT", "RIGHT", "FORWARD", "STOP"]} for t in y_true]

    metrics = ScientificMetricsEngine.compute_metrics(
        experiment_id="exp_met_01",
        y_true=y_true,
        y_pred=y_pred,
        y_prob=y_prob,
        classes=["LEFT", "RIGHT", "FORWARD", "STOP"],
    )
    assert metrics.accuracy == 1.0
    assert metrics.balanced_accuracy == 1.0
    assert metrics.f1_macro == 1.0
    assert metrics.expected_calibration_error is not None
    assert metrics.expected_calibration_error < 0.2


def test_metrics_empty_trials_handled_gracefully():
    metrics = ScientificMetricsEngine.compute_metrics(
        experiment_id="exp_empty",
        y_true=[],
        y_pred=[],
        rejected_count=5,
    )
    assert metrics.accuracy is None
    assert metrics.total_trials == 5
    assert metrics.evaluated_trials == 0
    assert metrics.rejection_rate == 1.0


def test_metrics_brier_score_and_ece():
    y_true = ["LEFT", "RIGHT"] * 10
    y_pred = ["LEFT", "RIGHT"] * 10
    y_prob = [{"LEFT": 0.8, "RIGHT": 0.2} if t == "LEFT" else {"LEFT": 0.2, "RIGHT": 0.8} for t in y_true]

    metrics = ScientificMetricsEngine.compute_metrics(
        experiment_id="exp_brier",
        y_true=y_true,
        y_pred=y_pred,
        y_prob=y_prob,
        classes=["LEFT", "RIGHT"],
    )
    assert metrics.brier_score is not None
    assert metrics.brier_score < 0.1


# ============================================================================
# 5. Statistics & Seeded Bootstrap CI Tests
# ============================================================================


def test_statistics_summary_and_bootstrap():
    values = [0.82, 0.84, 0.85, 0.86, 0.88, 0.90, 0.85, 0.87]
    stats = ResearchStatisticsEngine.compute_summary("accuracy", values, bootstrap_iterations=500, seed=42)
    assert stats.sample_count == 8
    assert 0.80 < stats.mean < 0.90
    assert stats.ci_lower_95 is not None
    assert stats.ci_upper_95 is not None
    assert stats.ci_lower_95 <= stats.mean <= stats.ci_upper_95


def test_statistics_paired_comparison():
    b_vals = [0.80, 0.81, 0.82, 0.79, 0.80]
    c_vals = [0.88, 0.89, 0.87, 0.90, 0.88]
    comp = ResearchStatisticsEngine.compare_paired_series(
        comparison_id="cmp_01",
        comparison_type="MODEL_VS_MODEL",
        baseline_id="exp_b",
        candidate_id="exp_c",
        baseline_values=b_vals,
        candidate_values=c_vals,
    )
    assert comp.metric_deltas["accuracy_delta"] > 0.05
    assert comp.p_value is not None
    assert comp.is_statistically_significant is True


# ============================================================================
# 6. Latency & Signal Quality Analytics Tests
# ============================================================================


def test_latency_percentiles_calculation():
    samples = [10.0, 12.0, 14.0, 15.0, 16.0, 18.0, 20.0, 25.0, 30.0, 45.0]
    p = LatencyAnalyticsEngine.compute_percentiles(samples)
    assert p.min_ms == 10.0
    assert p.max_ms == 45.0
    assert p.p50_ms == 17.0
    assert p.p95_ms > 30.0


def test_signal_quality_aggregation():
    snaps = [
        {"channel_name": "C3", "is_healthy": True, "variance": 180.0},
        {"channel_name": "Cz", "is_healthy": True, "variance": 150.0},
        {"channel_name": "C4", "is_healthy": False, "variance": 0.0},
    ]
    qc = SignalQualityAnalyticsEngine.aggregate_qc_metrics(
        channel_health_snapshots=snaps,
        flatline_count=1,
    )
    assert qc.healthy_channel_proportion == round(2 / 3, 4)
    assert qc.flatline_events == 1
    assert "C3" in qc.per_channel_snr_db


# ============================================================================
# 7. Confidence, Intent, Safety & HIL Analytics Tests
# ============================================================================


def test_confidence_analytics():
    confs = [0.92, 0.88, 0.75, 0.60, 0.95, 0.89]
    preds = ["A", "B", "A", "B", "A", "B"]
    truth = ["A", "B", "B", "B", "A", "B"]
    ca = ConfidenceAnalyticsEngine.analyze(confs, preds, truth, threshold=0.80)
    assert ca.low_confidence_rate == round(2 / 6, 4)
    assert ca.mean_confidence > 0.80
    assert len(ca.confidence_vs_accuracy_bins) > 0


def test_intent_analytics():
    events = [
        {"intent_state": "CANDIDATE"},
        {"intent_state": "CONFIRMED", "confirmation_latency_ms": 12.0},
        {"intent_state": "ACTIVE"},
    ]
    ia = IntentAnalyticsEngine.analyze(events)
    assert ia.confirmed_count == 1
    assert ia.active_count == 1
    assert ia.mean_confirmation_latency_ms == 12.0


def test_safety_analytics_zero_transmission():
    decisions = [
        {"safety_decision": "AUTHORIZED", "will_transmit": True},
        {"safety_decision": "DENIED", "will_transmit": False, "reason": "LOW_CONFIDENCE"},
        {"safety_decision": "HELD", "will_transmit": False, "reason": "UNCONFIRMED"},
    ]
    sa = SafetyAnalyticsEngine.analyze(decisions)
    assert sa.authorized_count == 1
    assert sa.denied_count == 1
    assert sa.held_count == 1
    assert sa.zero_transmission_proof_count == 2
    assert "LOW_CONFIDENCE" in sa.rule_violations


def test_hil_analytics():
    events = [
        {"is_authorized": True, "transmitted": True, "status": "COMMAND_ACCEPTED", "roundtrip_latency_ms": 2.1},
        {"is_authorized": True, "transmitted": True, "status": "COMMAND_ACCEPTED", "roundtrip_latency_ms": 2.3},
    ]
    ha = HilAnalyticsEngine.analyze(events)
    assert ha.candidates == 2
    assert ha.ack_count == 2
    assert ha.nack_count == 0


# ============================================================================
# 8. Ablation & Robustness Sweep Tests
# ============================================================================


def test_ablation_engine():
    man = ExperimentManifestManager.create_manifest("exp_base")
    parent = ResearchExperiment(
        experiment_id="exp_base",
        title="Base Exp",
        description="Base",
        manifest=man,
    )
    child, abl = AblationEngine.run_ablation(
        parent=parent,
        ablation_type="CHANNEL_DROPOUT",
        parameter_delta={"channel_names": ["C3", "Cz"]},
        ablated_accuracy=0.78,
        ablated_f1=0.77,
    )
    assert abl.ablation_type == "CHANNEL_DROPOUT"
    assert child.experiment_id != parent.experiment_id
    assert child.parent_experiment_id == parent.experiment_id


def test_robustness_engine_perturbation_and_sweep():
    data = np.ones((8, 250), dtype=np.float64) * 20.0
    perturbed = RobustnessEngine.apply_perturbation(data, "ADDITIVE_NOISE", level=0.5, seed=42)
    assert not np.array_equal(data, perturbed)

    sweep = RobustnessEngine.run_sweep("exp_base", "ADDITIVE_NOISE", levels=[0.1, 0.5, 1.0])
    assert len(sweep) == 3
    assert sweep[0].resulting_accuracy >= sweep[2].resulting_accuracy


# ============================================================================
# 9. Reproducibility Checker Tests
# ============================================================================


def test_reproducibility_audit_pass():
    man = ExperimentManifestManager.create_manifest("exp_audit_1", seed=42)
    exp1 = ResearchExperiment(
        experiment_id="exp_audit_1",
        title="Audit Run 1",
        description="Run 1",
        manifest=man,
        result_hash="res_hash_abc",
    )
    exp2 = copy.deepcopy(exp1)
    exp2.experiment_id = "exp_audit_2"

    audit = ReproducibilityChecker.audit(exp1, exp2)
    assert audit.status == ReproducibilityStatus.PASS
    assert audit.tamper_detected is False


def test_reproducibility_audit_tamper_detected():
    man = ExperimentManifestManager.create_manifest("exp_audit_1", seed=42)
    exp1 = ResearchExperiment(
        experiment_id="exp_audit_1",
        title="Audit Run 1",
        description="Run 1",
        manifest=man,
    )
    exp2 = copy.deepcopy(exp1)
    exp2.manifest.source_checksums["sess_tamper"] = "tampered_hash_999"

    audit = ReproducibilityChecker.audit(exp1, exp2)
    assert audit.status == ReproducibilityStatus.FAIL
    assert audit.tamper_detected is True


# ============================================================================
# 10. Research Artifact Exports Tests
# ============================================================================


def test_artifact_generation_manifest_and_csv():
    man = ExperimentManifestManager.create_manifest("exp_art_01")
    exp = ResearchExperiment(
        experiment_id="exp_art_01",
        title="Artifact Test",
        description="Testing exports",
        manifest=man,
    )
    art_json = ResearchArtifactGenerator.generate_manifest_artifact(exp)
    assert art_json.artifact_type == ArtifactType.MANIFEST_JSON
    assert art_json.checksum != ""

    art_csv = ResearchArtifactGenerator.generate_metrics_csv(exp)
    assert art_csv.artifact_type == ArtifactType.METRICS_CSV
    assert "accuracy" in art_csv.content_json


# ============================================================================
# 11. Service Coordinator Tests
# ============================================================================


def test_service_lifecycle_and_run():
    svc = ResearchAnalyticsService()
    exp = svc.create_experiment("Service Test Exp", "Testing full coordinator", seed=42)
    assert exp.status == ResearchExperimentStatus.DRAFT

    sealed = svc.seal_experiment(exp.experiment_id)
    assert sealed.is_sealed is True

    completed = svc.run_experiment(exp.experiment_id, trial_count=10)
    assert completed.status == ResearchExperimentStatus.COMPLETED
    assert completed.metrics is not None
    assert completed.confidence_analytics is not None


def test_service_ablation_and_comparison():
    svc = ResearchAnalyticsService()
    exp1 = svc.create_experiment("Exp 1", "Base", seed=10)
    svc.seal_experiment(exp1.experiment_id)
    svc.run_experiment(exp1.experiment_id, trial_count=10)

    child, abl = svc.run_ablation(exp1.experiment_id, "CHANNEL_DROPOUT", {"channels": ["C3"]})
    assert child.parent_experiment_id == exp1.experiment_id

    comp = svc.run_comparison(exp1.experiment_id, child.experiment_id)
    assert comp.sample_size > 0


# ============================================================================
# 12. 12 Golden Verification Scenarios (A through L)
# ============================================================================


def test_scenario_a_deterministic_replay_twice():
    scenarios = ResearchGoldenScenarios()
    res = scenarios.run_scenario_a_deterministic_replay_twice()
    assert res["passed"] is True


def test_scenario_b_tampered_source():
    scenarios = ResearchGoldenScenarios()
    res = scenarios.run_scenario_b_tampered_source()
    assert res["passed"] is True


def test_scenario_c_changed_preprocessing():
    scenarios = ResearchGoldenScenarios()
    res = scenarios.run_scenario_c_changed_preprocessing_child_manifest()
    assert res["passed"] is True


def test_scenario_d_model_comparison():
    scenarios = ResearchGoldenScenarios()
    res = scenarios.run_scenario_d_model_comparison()
    assert res["passed"] is True


def test_scenario_e_personalized_vs_generic():
    scenarios = ResearchGoldenScenarios()
    res = scenarios.run_scenario_e_personalized_vs_generic_no_leakage()
    assert res["passed"] is True


def test_scenario_f_channel_ablation():
    scenarios = ResearchGoldenScenarios()
    res = scenarios.run_scenario_f_channel_ablation()
    assert res["passed"] is True


def test_scenario_g_robustness_sweep():
    scenarios = ResearchGoldenScenarios()
    res = scenarios.run_scenario_g_robustness_sweep()
    assert res["passed"] is True


def test_scenario_h_confidence_analysis():
    scenarios = ResearchGoldenScenarios()
    res = scenarios.run_scenario_h_confidence_analysis()
    assert res["passed"] is True


def test_scenario_i_safety_replay_non_transmission():
    scenarios = ResearchGoldenScenarios()
    res = scenarios.run_scenario_i_safety_replay_non_transmission()
    assert res["passed"] is True


def test_scenario_j_authorized_replay_hil_ack():
    scenarios = ResearchGoldenScenarios()
    res = scenarios.run_scenario_j_authorized_replay_hil_ack()
    assert res["passed"] is True


def test_scenario_k_restart_reproducibility():
    scenarios = ResearchGoldenScenarios()
    res = scenarios.run_scenario_k_restart_reproducibility()
    assert res["passed"] is True


def test_scenario_l_multiple_children_parent_unchanged():
    scenarios = ResearchGoldenScenarios()
    res = scenarios.run_scenario_l_multiple_children_parent_unchanged()
    assert res["passed"] is True


# ============================================================================
# 13. REST API Endpoint Tests
# ============================================================================

client = TestClient(app)


def test_api_get_research_experiments():
    resp = client.get("/api/research/experiments")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_api_create_seal_run_experiment():
    # 1. Create
    resp_create = client.post(
        "/api/research/experiments",
        json={"title": "API Experiment", "description": "Via REST", "seed": 42},
    )
    assert resp_create.status_code == 200
    exp = resp_create.json()
    exp_id = exp["experiment_id"]
    assert exp["status"] == "DRAFT"

    # 2. Seal
    resp_seal = client.post(f"/api/research/experiments/{exp_id}/seal")
    assert resp_seal.status_code == 200
    sealed = resp_seal.json()
    assert sealed["is_sealed"] is True

    # 3. Run
    resp_run = client.post(f"/api/research/experiments/{exp_id}/run", json={"trial_count": 10})
    assert resp_run.status_code == 200
    completed = resp_run.json()
    assert completed["status"] == "COMPLETED"
    assert "metrics" in completed


def test_api_get_stages_metrics_latency():
    # Get baseline experiment
    exps = client.get("/api/research/experiments").json()
    exp_id = exps[0]["experiment_id"]
    # Run to ensure stages exist
    client.post(f"/api/research/experiments/{exp_id}/run", json={"trial_count": 10})

    resp_stages = client.get(f"/api/research/experiments/{exp_id}/stages")
    assert resp_stages.status_code == 200
    assert len(resp_stages.json()) == 15

    resp_metrics = client.get(f"/api/research/experiments/{exp_id}/metrics")
    assert resp_metrics.status_code == 200
    assert "accuracy" in resp_metrics.json()

    resp_latency = client.get(f"/api/research/experiments/{exp_id}/latency")
    assert resp_latency.status_code == 200
    assert "total_pipeline" in resp_latency.json()


def test_api_post_ablation_and_robustness():
    exps = client.get("/api/research/experiments").json()
    exp_id = exps[0]["experiment_id"]

    resp_abl = client.post(
        f"/api/research/experiments/{exp_id}/ablation",
        json={"ablation_type": "CHANNEL_DROPOUT", "parameter_delta": {"channels": ["C3"]}},
    )
    assert resp_abl.status_code == 200
    assert "child_experiment" in resp_abl.json()

    resp_rob = client.post(
        f"/api/research/experiments/{exp_id}/robustness",
        json={"perturbation_type": "ADDITIVE_NOISE", "levels": [0.1, 0.5]},
    )
    assert resp_rob.status_code == 200
    assert len(resp_rob.json()) == 2


def test_api_reproducibility_check():
    exps = client.get("/api/research/experiments").json()
    exp_id = exps[0]["experiment_id"]
    client.post(f"/api/research/experiments/{exp_id}/run", json={"trial_count": 10})

    resp = client.post(
        "/api/research/reproducibility/check",
        json={"baseline_experiment_id": exp_id},
    )
    assert resp.status_code == 200
    assert "status" in resp.json()


def test_api_export_artifact():
    exps = client.get("/api/research/experiments").json()
    exp_id = exps[0]["experiment_id"]

    resp = client.post(
        "/api/research/export",
        json={"experiment_id": exp_id, "artifact_type": "MANIFEST_JSON"},
    )
    assert resp.status_code == 200
    assert "checksum" in resp.json()


def test_api_run_scenarios():
    for sc in [
        "SCENARIO_A", "SCENARIO_B", "SCENARIO_C", "SCENARIO_D",
        "SCENARIO_E", "SCENARIO_F", "SCENARIO_G", "SCENARIO_H",
        "SCENARIO_I", "SCENARIO_J", "SCENARIO_K", "SCENARIO_L",
    ]:
        resp = client.post(f"/api/research/scenarios/{sc}")
        assert resp.status_code == 200
        assert resp.json()["passed"] is True


def test_api_reset():
    resp = client.post("/api/research/reset")
    assert resp.status_code == 200
    assert resp.json()["status"] == "RESET_SUCCESSFUL"


# ============================================================================
# 14. Invariant, Safety & Robustness Deep Verification Tests
# ============================================================================


def test_invariant_sealed_manifest_immutability():
    svc = ResearchAnalyticsService()
    exp = svc.create_experiment("Sealed Imm Test", "Desc")
    sealed = svc.seal_experiment(exp.experiment_id)
    original_hash = sealed.manifest.manifest_hash

    # Sealing again is idempotent
    sealed2 = svc.seal_experiment(exp.experiment_id)
    assert sealed2.manifest.manifest_hash == original_hash


def test_invariant_zero_physical_actuation_guaranteed():
    svc = ResearchAnalyticsService()
    exp = svc.create_experiment("Non-Actuation Invariant", "Zero PWM/motor execution")
    svc.seal_experiment(exp.experiment_id)
    res = svc.run_experiment(exp.experiment_id, trial_count=20)

    # In replay mode, downstream endpoint is strictly virtual HIL
    assert res.hil_analytics is not None
    assert res.manifest.hil_profile.get("target") == "ESP32_EMULATOR_VIRTUAL"


def test_robustness_all_perturbation_types():
    data = np.ones((8, 250), dtype=np.float64) * 25.0
    for p_type in [
        "ADDITIVE_NOISE",
        "AMPLITUDE_SCALING",
        "CHANNEL_DROPOUT",
        "PACKET_LOSS",
        "AMPLITUDE_CLIPPING",
        "VARIANCE_PERTURBATION",
    ]:
        out = RobustnessEngine.apply_perturbation(data, p_type, level=0.3, seed=42)
        assert out.shape == data.shape


def test_all_artifact_export_formats():
    svc = ResearchAnalyticsService()
    exp = svc.create_experiment("Artifact Format Test", "Testing all exports")
    svc.seal_experiment(exp.experiment_id)
    completed = svc.run_experiment(exp.experiment_id, trial_count=10)

    for art_type in [
        ArtifactType.MANIFEST_JSON,
        ArtifactType.RESULT_JSON,
        ArtifactType.METRICS_CSV,
        ArtifactType.LATENCY_CSV,
        ArtifactType.CONFUSION_MATRIX_JSON,
        ArtifactType.EXPERIMENT_SUMMARY_MD,
    ]:
        art = svc.export_artifact(completed.experiment_id, art_type)
        assert art.artifact_type == art_type
        assert art.checksum != ""
        assert len(art.content_json) > 0


def test_api_404_on_invalid_experiment_and_scenario():
    resp1 = client.get("/api/research/experiments/exp_non_existent")
    assert resp1.status_code == 404

    resp2 = client.post("/api/research/scenarios/SCENARIO_UNKNOWN_999")
    assert resp2.status_code == 404


def test_storage_checkpoint_and_artifact_roundtrip():
    storage = ResearchStorage()
    chk = DeterministicReplayEngine.create_checkpoint(
        experiment_id="exp_storage_test",
        stage=PipelineStage.FEATURES,
        source_offset=10,
        epoch_index=10,
        manifest_hash="hash_chk_123",
    )
    storage.save_checkpoint(chk)

    art = ResearchArtifact(
        artifact_id="art_rnd_01",
        experiment_id="exp_storage_test",
        artifact_type=ArtifactType.METRICS_CSV,
        checksum="chk123",
        file_name="metrics.csv",
        content_json="col1,col2\n1,2",
    )
    storage.save_artifact(art)
    listed = storage.list_artifacts("exp_storage_test")
    assert len(listed) >= 1
    assert listed[0].artifact_id == "art_rnd_01"

