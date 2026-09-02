"""Unit and Integration Tests for Phase 14 Adaptive Learning & Controlled Model Update Pipeline."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from neuromove.adaptation.batch_engine import AdaptationBatchEngine
from neuromove.adaptation.models import (
    AdaptationPolicy,
    AdaptationScope,
    DriftStatus,
    ModelLifecycleStatus,
)
from neuromove.adaptation.policy import AdaptationPolicyEngine
from neuromove.adaptation.registry import ModelVersionRegistry
from neuromove.adaptation.service import AdaptationService
from neuromove.adaptation.storage import AdaptationStorage
from neuromove.api.app import create_app
from neuromove.database.connection import DatabaseManager
from neuromove.experiments.models import FeatureRepresentation, ModelFamily


@pytest.fixture
def isolated_service(tmp_path: Path) -> AdaptationService:
    """Provide isolated AdaptationService with a temporary SQLite database."""
    db_file = tmp_path / "test_adaptation.db"
    db_mgr = DatabaseManager(db_url=f"sqlite:///{db_file}")
    db_mgr.initialize_db()

    storage = AdaptationStorage(db_manager=db_mgr)
    registry = ModelVersionRegistry()
    service = AdaptationService(storage=storage, registry=registry)
    return service


@pytest.fixture
def test_client(isolated_service: AdaptationService) -> TestClient:
    """Test client overriding the singleton adaptation service."""
    app = create_app()
    from neuromove.adaptation import service as s_mod

    s_mod._adaptation_service = isolated_service
    return TestClient(app)


def test_policy_validation_and_thresholds(isolated_service: AdaptationService):
    """Verify default policies and custom policy creation."""
    policies = isolated_service.list_policies()
    assert len(policies) >= 3

    conservative = next((p for p in policies if p.policy_id == "pol_conservative_subject_v1"), None)
    assert conservative is not None
    assert conservative.max_allowed_regression == 0.02
    assert conservative.min_promoted_balanced_accuracy == 0.60
    assert conservative.min_validation_samples == 6


def test_data_batch_creation_and_fingerprinting(isolated_service: AdaptationService):
    """Verify candidate batch creation, class distribution, and SHA-256 fingerprinting."""
    epoch_ids = [f"ep_test_{i:02d}" for i in range(12)]
    labels = ["LEFT_IMAGERY"] * 6 + ["RIGHT_IMAGERY"] * 6

    batch = isolated_service.create_data_batch(
        name="Batch Alpha",
        epoch_ids=epoch_ids,
        labels=labels,
        subject_id="sub-001",
        source_mode="SIMULATION",
    )

    assert batch.batch_id.startswith("adb_")
    assert batch.trial_count == 12
    assert batch.class_distribution == {"LEFT_IMAGERY": 6, "RIGHT_IMAGERY": 6}
    assert len(batch.source_fingerprint) == 64


def test_compatibility_validation_and_rejection(isolated_service: AdaptationService):
    """Verify pre-flight compatibility rejection on subject mismatch or excessive rejection."""
    batch_sub1 = isolated_service.create_data_batch(
        name="Sub1 Batch",
        epoch_ids=["ep_01", "ep_02"],
        labels=["LEFT_IMAGERY", "RIGHT_IMAGERY"],
        subject_id="sub-001",
    )
    batch_sub2 = isolated_service.create_data_batch(
        name="Sub2 Batch",
        epoch_ids=["ep_03", "ep_04"],
        labels=["LEFT_IMAGERY", "RIGHT_IMAGERY"],
        subject_id="sub-002",
    )

    # Subject mismatch check
    status, issues = AdaptationBatchEngine.validate_compatibility(
        base_model_metadata={"subject_id": "sub-001", "source_mode": "SIMULATION"},
        candidate_batches=[batch_sub2],
        scope="SUBJECT",
    )
    assert status == "INCOMPATIBLE"
    assert any("Subject mismatch" in iss for iss in issues)

    # Compatible check
    status_ok, issues_ok = AdaptationBatchEngine.validate_compatibility(
        base_model_metadata={"subject_id": "sub-001", "source_mode": "SIMULATION"},
        candidate_batches=[batch_sub1],
        scope="SUBJECT",
    )
    assert status_ok == "COMPATIBLE"
    assert len(issues_ok) == 0


def test_duplicate_epoch_detection():
    """Verify duplicate epoch identifiers are correctly detected and counted."""
    base_ids = ["ep_01", "ep_02", "ep_03", "ep_04"]
    new_ids = ["ep_03", "ep_04", "ep_05", "ep_06"]

    dup_count, unique_ids = AdaptationBatchEngine.detect_duplicate_epochs(base_ids, new_ids)
    assert dup_count == 2
    assert unique_ids == ["ep_05", "ep_06"]


def test_adaptation_execution_zero_leakage(isolated_service: AdaptationService):
    """Verify zero data leakage invariant (train_ids ∩ val_ids = ∅) and candidate generation."""
    models = isolated_service.list_models(scope=AdaptationScope.SUBJECT, subject_id="sub-001")
    assert len(models) >= 1
    base_model = models[0]

    # Create candidate data batch
    X_new, y_new, ids_new = isolated_service.synthesize_eeg_trials(
        n_trials_per_class=6,
        subject_id="sub-001",
        seed=202,
    )
    batch = isolated_service.create_data_batch(
        name="Subject 001 Candidate Batch",
        epoch_ids=ids_new,
        labels=y_new.tolist(),
        subject_id="sub-001",
        signals=X_new,
    )

    run = isolated_service.run_adaptation(
        base_model_id=base_model.model_id,
        data_batch_ids=[batch.batch_id],
        policy_id="pol_conservative_subject_v1",
        scope=AdaptationScope.SUBJECT,
        subject_id="sub-001",
    )

    assert run.status in ("APPROVAL_PENDING", "PROMOTED")
    assert run.leakage_check["is_leakage_safe"] is True
    assert run.leakage_check["overlap_count"] == 0
    assert run.candidate_model_id is not None
    assert run.candidate_model_id.startswith("pmdl_adapt_")
    assert run.comparison is not None


def test_regression_guard_blocks_degraded_candidate():
    """Verify policy evaluation blocks promotion when candidate regresses beyond policy limits."""
    policy = AdaptationPolicy(
        policy_id="pol_test_strict",
        name="Strict Policy",
        max_allowed_regression=0.02,
        min_promoted_balanced_accuracy=0.60,
        min_validation_samples=6,
    )

    # Candidate regressed by 10% (0.80 -> 0.70)
    eligibility = AdaptationPolicyEngine.evaluate_promotion_eligibility(
        policy=policy,
        incumbent_balanced_accuracy=0.80,
        candidate_balanced_accuracy=0.70,
        validation_sample_count=8,
        validation_class_counts={"LEFT_IMAGERY": 4, "RIGHT_IMAGERY": 4},
        train_val_overlap_count=0,
    )

    assert eligibility.is_eligible is False
    assert any("regressed by 10.0%" in r for r in eligibility.failure_reasons)


def test_explicit_candidate_promotion_and_decision_audit(isolated_service: AdaptationService):
    """Verify explicit candidate promotion updates active version and logs decision."""
    base_model = isolated_service.list_models(scope=AdaptationScope.SUBJECT, subject_id="sub-001")[
        0
    ]

    X_new, y_new, ids_new = isolated_service.synthesize_eeg_trials(
        6, subject_id="sub-001", seed=303
    )
    batch = isolated_service.create_data_batch(
        name="Candidate Batch High Quality",
        epoch_ids=ids_new,
        labels=y_new.tolist(),
        subject_id="sub-001",
        signals=X_new,
    )

    run = isolated_service.run_adaptation(
        base_model_id=base_model.model_id,
        data_batch_ids=[batch.batch_id],
        policy_id="pol_rapid_personalized_v1",
        scope=AdaptationScope.SUBJECT,
        subject_id="sub-001",
    )

    # Perform explicit promotion
    promoted, decision = isolated_service.promote_candidate(
        adaptation_id=run.adaptation_id,
        operator_notes="Approved after review.",
    )

    assert promoted.is_active is True
    assert promoted.status == ModelLifecycleStatus.ACTIVE_RESEARCH
    assert decision.decision == "PROMOTED"

    # Incumbent should now be deactivated
    incumbent_ver = isolated_service._registry.get_version(base_model.model_id)
    assert incumbent_ver is not None
    assert incumbent_ver.is_active is False
    assert incumbent_ver.status == ModelLifecycleStatus.VALIDATED


def test_explicit_candidate_rejection_and_decision_audit(isolated_service: AdaptationService):
    """Verify explicit rejection retains candidate in history and keeps incumbent active."""
    base_model = isolated_service.list_models(scope=AdaptationScope.SUBJECT, subject_id="sub-001")[
        0
    ]

    X_new, y_new, ids_new = isolated_service.synthesize_eeg_trials(
        6, subject_id="sub-001", seed=404
    )
    batch = isolated_service.create_data_batch(
        name="Candidate Batch Rejection Test",
        epoch_ids=ids_new,
        labels=y_new.tolist(),
        subject_id="sub-001",
        signals=X_new,
    )

    run = isolated_service.run_adaptation(
        base_model_id=base_model.model_id,
        data_batch_ids=[batch.batch_id],
        policy_id="pol_rapid_personalized_v1",
        scope=AdaptationScope.SUBJECT,
        subject_id="sub-001",
    )

    rejected, decision = isolated_service.reject_candidate(
        adaptation_id=run.adaptation_id,
        rejection_reason="Excessive variance in held-out validation.",
    )

    assert rejected.is_active is False
    assert rejected.status == ModelLifecycleStatus.REJECTED
    assert decision.decision == "REJECTED"

    # Incumbent remains active
    incumbent_ver = isolated_service._registry.get_version(base_model.model_id)
    assert incumbent_ver.is_active is True


def test_model_version_chain_and_parent_links(isolated_service: AdaptationService):
    """Verify version graph: v1 (parent=None) -> v2 (parent=v1) -> v3 (parent=v2)."""
    reg = isolated_service._registry
    v1 = reg.register_version(
        model_id="m1",
        scope=AdaptationScope.SUBJECT,
        model_family=ModelFamily.LDA,
        representation=FeatureRepresentation.CSP_LOG_POWER,
        task_id="T1",
        metrics={"accuracy": 0.8, "balanced_accuracy": 0.8, "f1": 0.8},
        artifact_checksum_sha256="hash1",
        parent_model_id=None,
    )
    v2 = reg.register_version(
        model_id="m2",
        scope=AdaptationScope.SUBJECT,
        model_family=ModelFamily.LDA,
        representation=FeatureRepresentation.CSP_LOG_POWER,
        task_id="T1",
        metrics={"accuracy": 0.85, "balanced_accuracy": 0.85, "f1": 0.85},
        artifact_checksum_sha256="hash2",
        parent_model_id="m1",
    )
    v3 = reg.register_version(
        model_id="m3",
        scope=AdaptationScope.SUBJECT,
        model_family=ModelFamily.LDA,
        representation=FeatureRepresentation.CSP_LOG_POWER,
        task_id="T1",
        metrics={"accuracy": 0.9, "balanced_accuracy": 0.9, "f1": 0.9},
        artifact_checksum_sha256="hash3",
        parent_model_id="m2",
    )

    assert v1.version_number == 1
    assert v2.version_number == 2
    assert v3.version_number == 3

    chain = reg.get_version_chain("m3")
    assert len(chain) == 3
    assert [c.model_id for c in chain] == ["m1", "m2", "m3"]


def test_model_rollback_lifecycle(isolated_service: AdaptationService):
    """Verify rollback from v2 back to v1 preserves v2 in history and reactivates v1."""
    reg = isolated_service._registry
    reg.register_version(
        model_id="rb_m1",
        scope=AdaptationScope.SUBJECT,
        model_family=ModelFamily.LDA,
        representation=FeatureRepresentation.CSP_LOG_POWER,
        task_id="T1",
        metrics={"accuracy": 0.8, "balanced_accuracy": 0.8, "f1": 0.8},
        artifact_checksum_sha256="hash1",
        subject_id="sub-test",
        is_active=True,
    )
    reg.register_version(
        model_id="rb_m2",
        scope=AdaptationScope.SUBJECT,
        model_family=ModelFamily.LDA,
        representation=FeatureRepresentation.CSP_LOG_POWER,
        task_id="T1",
        metrics={"accuracy": 0.85, "balanced_accuracy": 0.85, "f1": 0.85},
        artifact_checksum_sha256="hash2",
        parent_model_id="rb_m1",
        subject_id="sub-test",
        is_active=False,
    )

    # Promote v2
    promoted_v2, _ = reg.promote_candidate("rb_m2", adaptation_id="adapt_01")
    assert reg.get_active_version(AdaptationScope.SUBJECT, "sub-test").model_id == "rb_m2"

    # Roll back to v1
    reactivated_v1, rollback_event = reg.rollback(
        target_model_id="rb_m1", reason="Degradation in live sessions"
    )
    assert reactivated_v1.is_active is True
    assert reactivated_v1.model_id == "rb_m1"
    assert rollback_event.from_model_id == "rb_m2"
    assert rollback_event.to_model_id == "rb_m1"

    # Verify v2 is now marked ROLLED_BACK
    ver_v2 = reg.get_version("rb_m2")
    assert ver_v2.status == ModelLifecycleStatus.ROLLED_BACK
    assert ver_v2.is_active is False


def test_drift_diagnostics_evaluation(isolated_service: AdaptationService):
    """Verify research distribution shift diagnostics detect shifts."""
    # Stable evaluation
    obs_stable = isolated_service.run_drift_diagnostics(subject_id="sub-001", inject_shift=False)
    assert obs_stable.status == DriftStatus.STABLE
    assert obs_stable.feature_shift_score < 0.35

    # Shifted evaluation
    obs_shifted = isolated_service.run_drift_diagnostics(subject_id="sub-001", inject_shift=True)
    assert obs_shifted.status == DriftStatus.SHIFT_DETECTED
    assert obs_shifted.feature_shift_score >= 0.35


def test_adaptation_manifest_and_sha256_checksum(isolated_service: AdaptationService):
    """Verify complete reproducibility manifest and SHA-256 model checksum."""
    base_model = isolated_service.list_models(scope=AdaptationScope.SUBJECT, subject_id="sub-001")[
        0
    ]

    X_new, y_new, ids_new = isolated_service.synthesize_eeg_trials(
        6, subject_id="sub-001", seed=505
    )
    batch = isolated_service.create_data_batch(
        name="Candidate Manifest Batch",
        epoch_ids=ids_new,
        labels=y_new.tolist(),
        subject_id="sub-001",
        signals=X_new,
    )

    run = isolated_service.run_adaptation(
        base_model_id=base_model.model_id,
        data_batch_ids=[batch.batch_id],
        policy_id="pol_conservative_subject_v1",
        scope=AdaptationScope.SUBJECT,
        subject_id="sub-001",
    )

    manifest = isolated_service.get_manifest(run.adaptation_id)
    assert manifest is not None
    assert manifest.manifest_version == "ADAPTATION_MANIFEST_V1"
    assert len(manifest.training_fingerprint) == 64
    assert len(manifest.validation_fingerprint) == 64


def test_api_adaptation_lifecycle_endpoints(test_client: TestClient):
    """Verify full end-to-end REST API lifecycle for Phase 14."""
    # 1. List Policies
    resp = test_client.get("/api/adaptation/policies")
    assert resp.status_code == 200
    policies = resp.json()
    assert len(policies) >= 3

    # 2. List Models
    resp = test_client.get("/api/adaptation/models")
    assert resp.status_code == 200
    models = resp.json()
    assert len(models) >= 1
    base_model_id = models[0]["model_id"]

    # 3. Create Candidate Batch
    resp = test_client.post(
        "/api/adaptation/batches",
        json={"name": "API Candidate Batch", "subject_id": "sub-001", "trial_count": 12},
    )
    assert resp.status_code == 200
    batch = resp.json()
    batch_id = batch["batch_id"]

    # 4. Compute Preview
    resp = test_client.post(
        "/api/adaptation/preview",
        json={
            "base_model_id": base_model_id,
            "data_batch_ids": [batch_id],
            "policy_id": "pol_conservative_subject_v1",
            "scope": "SUBJECT",
            "subject_id": "sub-001",
        },
    )
    assert resp.status_code == 200
    preview = resp.json()
    assert "data_composition" in preview

    # 5. Run Adaptation
    resp = test_client.post(
        "/api/adaptation/run",
        json={
            "base_model_id": base_model_id,
            "data_batch_ids": [batch_id],
            "policy_id": "pol_rapid_personalized_v1",
            "scope": "SUBJECT",
            "subject_id": "sub-001",
        },
    )
    assert resp.status_code == 200
    run = resp.json()
    adaptation_id = run["adaptation_id"]

    # 6. Fetch Run Details & Manifest
    resp = test_client.get(f"/api/adaptation/runs/{adaptation_id}")
    assert resp.status_code == 200
    assert resp.json()["status"] in ("APPROVAL_PENDING", "PROMOTED")

    resp = test_client.get(f"/api/adaptation/runs/{adaptation_id}/manifest")
    assert resp.status_code == 200
    assert resp.json()["manifest_version"] == "ADAPTATION_MANIFEST_V1"

    # 7. Promote Candidate
    resp = test_client.post(
        "/api/adaptation/promote",
        json={"adaptation_id": adaptation_id, "operator_notes": "API test promotion"},
    )
    assert resp.status_code == 200
    promoted_res = resp.json()
    assert promoted_res["promoted_model"]["is_active"] is True

    # 8. Rollback
    resp = test_client.post(
        "/api/adaptation/rollback",
        json={"target_model_id": base_model_id, "reason": "API test rollback"},
    )
    assert resp.status_code == 200
    assert resp.json()["active_model"]["model_id"] == base_model_id

    # 9. Drift Diagnostics
    resp = test_client.get("/api/adaptation/drift?subject_id=sub-001")
    assert resp.status_code == 200
    assert resp.json()["status"] in ("STABLE", "MONITOR", "SHIFT_DETECTED", "INSUFFICIENT_DATA")
