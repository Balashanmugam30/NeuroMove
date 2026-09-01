"""Rigorous Scientific Unit and Integration Tests for Phase 12 AI Model Laboratory."""

from __future__ import annotations

import tempfile
from pathlib import Path

import mne
import numpy as np
import pytest
from fastapi.testclient import TestClient

from neuromove.api.router import api_router
from neuromove.decoding.models import CSPConfig, EvaluationMode, EvaluationProtocol
from neuromove.epoching.models import NormalizedLabel
from neuromove.epoching.storage import EpochStorage
from neuromove.experiments.adapters import get_model_adapter
from neuromove.experiments.error_analysis import OutOfFoldErrorAnalyzer
from neuromove.experiments.models import (
    ExperimentConfig,
    FeatureRepresentation,
    ModelFamily,
    OutOfFoldPredictionRecord,
    SearchConfig,
    SearchType,
)
from neuromove.experiments.search import NestedHyperparameterSearcher
from neuromove.experiments.service import AIModelLabService


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as tmp:
        yield Path(tmp)


@pytest.fixture
def synthetic_multisubject_epochs(temp_dir):
    """Generate deterministic synthetic multi-subject motor-imagery epochs fixture."""
    epoch_storage = EpochStorage(base_dir=temp_dir / "epochs")
    sfreq = 250.0
    n_times = 500  # 2.0 seconds
    ch_names = ["Fc5", "C3", "Cz", "C4"]

    rng = np.random.RandomState(42)
    subjects = ["sub_01", "sub_02", "sub_03"]
    sessions = ["session_01", "session_02"]

    n_epochs_per_subj = 20

    all_data = []
    all_labels = []
    subject_ids = []
    session_ids = []
    run_ids = []

    time_vec = np.linspace(0, 2.0, n_times)
    for subj in subjects:
        for i in range(n_epochs_per_subj):
            is_left = (i % 2) == 0
            lbl = NormalizedLabel.LEFT_IMAGERY if is_left else NormalizedLabel.RIGHT_IMAGERY
            sess = sessions[i % 2]

            # Signal: C3 desynchronizes on Right imagery, C4 desynchronizes on Left imagery
            sig = rng.randn(len(ch_names), n_times) * 0.5
            mu_wave = np.sin(2 * np.pi * 10.0 * time_vec)

            if is_left:
                sig[1, :] += 2.0 * mu_wave  # Left hand -> right hemisphere active, C3 synchronized
                sig[3, :] += 0.2 * mu_wave  # C4 desynchronized
            else:
                sig[1, :] += 0.2 * mu_wave  # C3 desynchronized
                sig[3, :] += 2.0 * mu_wave  # C4 synchronized

            all_data.append(sig)
            all_labels.append(lbl)
            subject_ids.append(subj)
            session_ids.append(sess)
            run_ids.append("run_01")

    data_arr = np.array(all_data)
    info = mne.create_info(ch_names=ch_names, sfreq=sfreq, ch_types="eeg")
    events = np.column_stack(
        [
            np.arange(0, len(all_labels) * 1000, 1000, dtype=int),
            np.zeros(len(all_labels), dtype=int),
            [1 if lbl == NormalizedLabel.LEFT_IMAGERY else 2 for lbl in all_labels],
        ]
    )
    event_id = {"LEFT_IMAGERY": 1, "RIGHT_IMAGERY": 2}
    raw_epochs = mne.EpochsArray(data_arr, info, events=events, event_id=event_id, tmin=-0.5)

    meta = {
        "epoch_set_id": "ep_test_lab_fixture_01",
        "dataset_id": "synthetic_sim_v1",
        "subject_ids": subject_ids,
        "session_ids": session_ids,
        "run_ids": run_ids,
        "label_distribution": {"LEFT_IMAGERY": 30, "RIGHT_IMAGERY": 30},
        "sampling_rate_hz": sfreq,
    }
    epoch_storage.save_epochs(raw_epochs, "ep_test_lab_fixture_01", meta)
    return epoch_storage, "ep_test_lab_fixture_01"


class TestExperimentConfigurationAndHashing:
    def test_deterministic_experiment_hashing(self):
        """Verify identical configurations yield identical hashes and IDs."""
        cfg1 = ExperimentConfig(
            dataset_id="physionet_motor_imagery",
            epoch_set_id="ep_001",
            task_id="LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
            model_family=ModelFamily.LDA,
            random_state=42,
        )
        cfg2 = ExperimentConfig(
            dataset_id="physionet_motor_imagery",
            epoch_set_id="ep_001",
            task_id="LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
            model_family=ModelFamily.LDA,
            random_state=42,
        )
        cfg_diff = ExperimentConfig(
            dataset_id="physionet_motor_imagery",
            epoch_set_id="ep_001",
            task_id="LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
            model_family=ModelFamily.SVM_LINEAR,  # altered
            random_state=42,
        )

        assert cfg1.compute_deterministic_hash() == cfg2.compute_deterministic_hash()
        assert cfg1.experiment_id == cfg2.experiment_id
        assert cfg1.experiment_id != cfg_diff.experiment_id


class TestModelAdapters:
    def test_model_adapters_build_and_fit(self):
        """Test instantiation and fitting of all supported model families."""
        families = [
            ModelFamily.DUMMY,
            ModelFamily.LDA,
            ModelFamily.SVM_LINEAR,
            ModelFamily.SVM_RBF,
            ModelFamily.LOGISTIC_REGRESSION,
            ModelFamily.RANDOM_FOREST,
        ]

        X_dummy = np.random.randn(20, 4)
        y_dummy = np.array([0, 1] * 10)

        for fam in families:
            adapter = get_model_adapter(fam)
            assert adapter.family == fam
            clf = adapter.build_estimator({}, random_state=42)
            clf.fit(X_dummy, y_dummy)
            preds = clf.predict(X_dummy)
            assert len(preds) == 20
            grid = adapter.get_default_param_grid()
            assert isinstance(grid, dict)


class TestNestedSearchAndLeakage:
    def test_nested_hyperparameter_search_selection(self):
        """Test inner cross-validation hyperparameter search."""
        search_cfg = SearchConfig(
            search_type=SearchType.GRID,
            param_grid={"c_param": [0.01, 1.0, 10.0]},
            inner_cv_splits=2,
        )
        searcher = NestedHyperparameterSearcher(
            search_config=search_cfg,
            model_family=ModelFamily.SVM_LINEAR,
            representation=FeatureRepresentation.CSP_LOG_POWER,
            base_csp_config=CSPConfig(n_components=2),
            random_state=42,
        )

        X_train = np.random.randn(24, 4, 100)
        y_train = np.array([0, 1] * 12)
        groups_train = np.array(["sub_01"] * 12 + ["sub_02"] * 12)

        res = searcher.search(X_train, y_train, groups_train=groups_train)
        assert res.total_candidates == 3
        assert len(res.candidates) == 3
        assert "c_param" in res.best_parameters
        assert res.candidates[0].rank == 1

    def test_inter_subject_zero_leakage_with_nested_search(self, synthetic_multisubject_epochs):
        """Test that outer test subjects never overlap with outer train subjects."""
        epoch_storage, ep_id = synthetic_multisubject_epochs
        config = ExperimentConfig(
            dataset_id="synthetic_sim_v1",
            epoch_set_id=ep_id,
            model_family=ModelFamily.SVM_LINEAR,
            evaluation_protocol=EvaluationProtocol.LEAVE_ONE_SUBJECT_OUT,
            evaluation_mode=EvaluationMode.INTER_SUBJECT,
            search_config=SearchConfig(
                search_type=SearchType.GRID,
                param_grid={"c_param": [0.1, 1.0]},
                inner_cv_splits=2,
            ),
            csp_config=CSPConfig(n_components=2),
        )

        service = AIModelLabService(epoch_storage=epoch_storage)
        detail = service.run_experiment(config)

        # Invariant: 3 subjects -> exactly 3 outer folds
        assert len(detail.folds) == 3
        for fold in detail.folds:
            leakage = set(fold.train_subjects).intersection(set(fold.test_subjects))
            assert len(leakage) == 0, f"Leakage detected in fold {fold.fold_id}: {leakage}"
            assert fold.inner_search_result is not None


class TestOutOfFoldPredictionsAndErrors:
    def test_out_of_fold_predictions_coverage(self, synthetic_multisubject_epochs):
        """Verify each eligible sample appears exactly once as an outer held-out prediction."""
        epoch_storage, ep_id = synthetic_multisubject_epochs
        config = ExperimentConfig(
            dataset_id="synthetic_sim_v1",
            epoch_set_id=ep_id,
            model_family=ModelFamily.LDA,
            csp_config=CSPConfig(n_components=2),
        )

        service = AIModelLabService(epoch_storage=epoch_storage)
        detail = service.run_experiment(config)

        oof_set = service.get_experiment_predictions(detail.experiment_id)
        assert oof_set.total_predictions == 60
        assert oof_set.coverage_percentage == 100.0

        # Ensure unique epoch IDs
        seen_epochs = [p.epoch_id for p in oof_set.predictions]
        assert len(seen_epochs) == len(set(seen_epochs))

    def test_error_analysis_difficult_subjects_and_confusions(self):
        """Verify error analysis correctly detects difficult subjects and confused pairs."""
        preds = [
            OutOfFoldPredictionRecord(
                epoch_id="ep_01",
                subject_id="sub_01",
                true_label="LEFT_IMAGERY",
                predicted_label="LEFT_IMAGERY",
                is_correct=True,
                fold_id=1,
                model_id="mdl_01",
                experiment_id="exp_01",
            ),
            OutOfFoldPredictionRecord(
                epoch_id="ep_02",
                subject_id="sub_02",
                true_label="LEFT_IMAGERY",
                predicted_label="RIGHT_IMAGERY",  # error
                is_correct=False,
                fold_id=2,
                model_id="mdl_01",
                experiment_id="exp_01",
            ),
            OutOfFoldPredictionRecord(
                epoch_id="ep_03",
                subject_id="sub_02",
                true_label="LEFT_IMAGERY",
                predicted_label="RIGHT_IMAGERY",  # error
                is_correct=False,
                fold_id=2,
                model_id="mdl_01",
                experiment_id="exp_01",
            ),
        ]

        err_res = OutOfFoldErrorAnalyzer.analyze(preds)
        assert err_res.total_errors == 2
        assert len(err_res.most_confused_pairs) == 1
        assert err_res.most_confused_pairs[0].count == 2
        assert err_res.difficult_subjects[0].subject_id == "sub_02"


class TestAblationsAndModelComparison:
    def test_controlled_ablation_study(self, synthetic_multisubject_epochs):
        """Verify ablation framework isolates single variable."""
        epoch_storage, ep_id = synthetic_multisubject_epochs
        base_cfg = ExperimentConfig(
            dataset_id="synthetic_sim_v1",
            epoch_set_id=ep_id,
            model_family=ModelFamily.LDA,
            csp_config=CSPConfig(n_components=2),
        )

        service = AIModelLabService(epoch_storage=epoch_storage)
        ablation_res = service.run_ablation_study(base_cfg, "CSP_COMPONENTS")

        assert ablation_res.ablation_variable == "CSP_COMPONENTS"
        assert len(ablation_res.variants) == 3
        for v in ablation_res.variants:
            assert isinstance(v.delta_balanced_accuracy, float)

    def test_multi_model_comparison(self, synthetic_multisubject_epochs):
        """Verify model comparison service aggregates multiple experiments."""
        epoch_storage, ep_id = synthetic_multisubject_epochs
        service = AIModelLabService(epoch_storage=epoch_storage)

        cfg1 = ExperimentConfig(
            dataset_id="synthetic_sim_v1",
            epoch_set_id=ep_id,
            model_family=ModelFamily.LDA,
            csp_config=CSPConfig(n_components=2),
        )
        cfg2 = ExperimentConfig(
            dataset_id="synthetic_sim_v1",
            epoch_set_id=ep_id,
            model_family=ModelFamily.SVM_LINEAR,
            csp_config=CSPConfig(n_components=2),
        )

        det1 = service.run_experiment(cfg1)
        det2 = service.run_experiment(cfg2)

        cmp_res = service.compare_experiments(
            "LDA vs Linear SVM", [det1.experiment_id, det2.experiment_id]
        )
        assert len(cmp_res.entries) == 2
        assert cmp_res.comparison_name == "LDA vs Linear SVM"


class TestModelCardAndArtifactIntegrity:
    def test_model_card_and_lineage(self, synthetic_multisubject_epochs):
        """Verify model card generates complete provenance and markdown content."""
        epoch_storage, ep_id = synthetic_multisubject_epochs
        service = AIModelLabService(epoch_storage=epoch_storage)
        cfg = ExperimentConfig(
            dataset_id="synthetic_sim_v1",
            epoch_set_id=ep_id,
            model_family=ModelFamily.LDA,
            csp_config=CSPConfig(n_components=2),
        )
        det = service.run_experiment(cfg)

        card = service.get_model_card(det.model_id)
        assert card.model_id == det.model_id
        assert "Model Card" in card.markdown_content
        assert card.artifact_checksum_sha256 == det.artifact_checksum_sha256

    def test_batch_prediction_and_serialization_integrity(self, synthetic_multisubject_epochs):
        """Verify model artifact load, SHA-256 verification, and batch prediction round-trip."""
        epoch_storage, ep_id = synthetic_multisubject_epochs
        service = AIModelLabService(epoch_storage=epoch_storage)
        cfg = ExperimentConfig(
            dataset_id="synthetic_sim_v1",
            epoch_set_id=ep_id,
            model_family=ModelFamily.LDA,
            csp_config=CSPConfig(n_components=2),
        )
        det = service.run_experiment(cfg)

        batch_res = service.predict_batch(det.model_id, ep_id)
        assert batch_res["total_epochs"] == 60
        assert len(batch_res["predictions"]) == 60


class TestAIModelLabFastAPIEndpoints:
    def test_rest_api_experiment_lifecycle(self, synthetic_multisubject_epochs, monkeypatch):
        """Test full FastAPI endpoint integration for AI Model Lab."""
        epoch_storage, ep_id = synthetic_multisubject_epochs
        service = AIModelLabService(epoch_storage=epoch_storage)

        from fastapi import FastAPI

        from neuromove.api import router as router_mod

        monkeypatch.setattr(router_mod, "get_ai_model_lab_service", lambda: service)

        app = FastAPI()
        app.include_router(api_router)
        client = TestClient(app)

        # 1. Preview
        prev_res = client.post(
            "/api/ai/experiments/preview",
            json={
                "dataset_id": "synthetic_sim_v1",
                "epoch_set_id": ep_id,
                "task_id": "LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
                "model_family": "LDA",
                "csp_config": {"n_components": 2},
            },
        )
        assert prev_res.status_code == 200
        prev_data = prev_res.json()
        assert prev_data["valid"] is True
        assert prev_data["eligible_epochs"] == 60

        # 2. Run Experiment
        run_res = client.post(
            "/api/ai/experiments/run",
            json={
                "dataset_id": "synthetic_sim_v1",
                "epoch_set_id": ep_id,
                "task_id": "LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
                "model_family": "LDA",
                "csp_config": {"n_components": 2},
            },
        )
        assert run_res.status_code == 200
        run_data = run_res.json()
        exp_id = run_data["experiment_id"]
        model_id = run_data["model_id"]

        # 3. List Experiments
        list_res = client.get("/api/ai/experiments")
        assert list_res.status_code == 200
        assert len(list_res.json()) >= 1

        # 4. Get Predictions
        pred_res = client.get(f"/api/ai/experiments/{exp_id}/predictions")
        assert pred_res.status_code == 200
        assert pred_res.json()["total_predictions"] == 60

        # 5. Get Errors
        err_res = client.get(f"/api/ai/experiments/{exp_id}/errors")
        assert err_res.status_code == 200

        # 6. Get Model Card
        card_res = client.get(f"/api/ai/models/{model_id}/card")
        assert card_res.status_code == 200
        assert "markdown_content" in card_res.json()
