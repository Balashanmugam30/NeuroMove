"""Comprehensive scientific and unit test suite for Phase 11 CSP & Classical Decoding."""

import json
import tempfile
from pathlib import Path

import mne
import numpy as np
import pytest
from fastapi.testclient import TestClient

from neuromove.api.app import create_app
from neuromove.database.connection import DatabaseManager
from neuromove.decoding.csp import build_csp_transformer, extract_csp_pattern_data
from neuromove.decoding.evaluation import evaluate_decoder_pipeline
from neuromove.decoding.models import (
    ClassifierConfig,
    ClassifierType,
    CSPConfig,
    DecoderPipelineConfig,
    EvaluationProtocol,
    PredictionRequest,
)
from neuromove.decoding.pipeline import build_classifier, build_decoding_pipeline
from neuromove.decoding.service import ClassicalDecodingService
from neuromove.decoding.storage import DecoderStorage
from neuromove.decoding.tasks import (
    TASK_LEFT_VS_RIGHT,
    filter_epochs_for_task,
)
from neuromove.epoching.models import (
    NormalizedLabel,
)
from neuromove.epoching.storage import EpochStorage
from neuromove.features.service import get_epoching_feature_service


@pytest.fixture
def temp_db():
    """Create a temporary SQLite database for test isolation."""
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp_dir:
        db_path = Path(tmp_dir) / "test_neuromove.db"
        manager = DatabaseManager(db_url=f"sqlite:///{db_path}")
        manager.initialize_db()
        yield manager


@pytest.fixture
def synthetic_epoch_set(temp_db):
    """Create a multi-subject synthetic motor-imagery epoch set for testing."""
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp_dir:
        epoch_storage = EpochStorage(base_dir=Path(tmp_dir) / "epochs")
        service = get_epoching_feature_service()
        service.db = temp_db
        service.epoch_storage = epoch_storage

        # Create multi-trial simulation epochs with Left and Right motor imagery
        # Generate synthetic epochs with distinct mu-rhythm modulations
        sfreq = 250.0
        n_channels = 4
        ch_names = ["Fc5", "C3", "Cz", "C4"]
        tmin, tmax = -1.0, 4.0
        times = np.arange(tmin, tmax, 1.0 / sfreq)
        n_times = len(times)

        # 3 subjects, 4 trials each (2 Left, 2 Right)
        n_epochs = 12
        data = np.zeros((n_epochs, n_channels, n_times))
        labels = []
        subjects = []
        trial_ids = []

        sub_list = ["sub_01", "sub_02", "sub_03"]
        for e_idx in range(n_epochs):
            sub_id = sub_list[e_idx % 3]
            is_left = (e_idx // 3) % 2 == 0
            label = NormalizedLabel.LEFT_IMAGERY if is_left else NormalizedLabel.RIGHT_IMAGERY

            # Add background noise + class-specific frequency activation
            noise = np.random.RandomState(e_idx).randn(n_channels, n_times) * 5.0
            t_analysis = (times >= 0.5) & (times <= 3.5)

            if is_left:
                # Left imagery: C4 ERD (drop) & C3 ERS (increase)
                noise[1, t_analysis] += np.sin(2 * np.pi * 10.0 * times[t_analysis]) * 15.0  # C3
                noise[3, t_analysis] += np.sin(2 * np.pi * 10.0 * times[t_analysis]) * 2.0  # C4
            else:
                # Right imagery: C3 ERD (drop) & C4 ERS (increase)
                noise[1, t_analysis] += np.sin(2 * np.pi * 10.0 * times[t_analysis]) * 2.0  # C3
                noise[3, t_analysis] += np.sin(2 * np.pi * 10.0 * times[t_analysis]) * 15.0  # C4

            data[e_idx] = noise
            labels.append(label)
            subjects.append(sub_id)
            trial_ids.append(f"trial_{e_idx:03d}")

        info = mne.create_info(ch_names=ch_names, sfreq=sfreq, ch_types="eeg")
        events = np.column_stack(
            [
                np.arange(0, n_epochs * 1000, 1000, dtype=int),
                np.zeros(n_epochs, dtype=int),
                [1 if lbl == NormalizedLabel.LEFT_IMAGERY else 2 for lbl in labels],
            ]
        )
        event_id = {"LEFT_IMAGERY": 1, "RIGHT_IMAGERY": 2}
        mne_epochs = mne.EpochsArray(
            data=data,
            info=info,
            events=events,
            event_id=event_id,
            tmin=tmin,
            verbose=False,
        )

        epoch_set_id = "ep_test_multi_sub_01"
        now_iso = "2026-09-01T00:00:00Z"
        from neuromove.epoching.models import EpochRecord, EpochSummary

        summary = EpochSummary(
            epoch_set_id=epoch_set_id,
            epoching_version="EEG_EPOCHING_V1",
            config_hash="testhash123",
            source_kind="SYNTHETIC",
            sampling_rate_hz=sfreq,
            channel_names=ch_names,
            tmin=tmin,
            tmax=tmax,
            total_events=n_epochs,
            mapped_events=n_epochs,
            valid_epochs=n_epochs,
            rejected_epochs=0,
            rejection_counts={},
            label_distribution={"LEFT_IMAGERY": 6, "RIGHT_IMAGERY": 6},
            artifact_file_path="",
            artifact_checksum_sha256="",
            created_at=now_iso,
        )

        records = [
            EpochRecord(
                epoch_id=f"ep_rec_{i:03d}",
                epoch_set_id=epoch_set_id,
                trial_id=trial_ids[i],
                event_id=f"evt_{i:03d}",
                subject_id=subjects[i],
                label=labels[i],
                onset_seconds=float(i * 4.0),
                qc_status="VALID",
                created_at=now_iso,
            )
            for i in range(n_epochs)
        ]

        epoch_storage.save_epochs(mne_epochs, epoch_set_id, summary.model_dump())

        # Store in SQLite
        db_path = temp_db.get_db_path()
        with temp_db.get_connection(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO epoch_sets (
                    epoch_set_id, epoching_version, config_hash, source_kind, sampling_rate_hz,
                    channels_json, tmin, tmax, total_events, mapped_events, valid_epochs,
                    rejected_epochs, rejection_counts_json, label_distribution_json,
                    artifact_file_path, artifact_checksum_sha256, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    epoch_set_id,
                    summary.epoching_version,
                    summary.config_hash,
                    summary.source_kind.value,
                    summary.sampling_rate_hz,
                    json.dumps(summary.channel_names),
                    summary.tmin,
                    summary.tmax,
                    summary.total_events,
                    summary.mapped_events,
                    summary.valid_epochs,
                    summary.rejected_epochs,
                    json.dumps(summary.rejection_counts),
                    json.dumps(summary.label_distribution),
                    summary.artifact_file_path,
                    summary.artifact_checksum_sha256,
                    now_iso,
                ),
            )

            for r in records:
                cursor.execute(
                    """
                    INSERT INTO epoch_records (
                        epoch_id, epoch_set_id, trial_id, event_id, subject_id,
                        label, onset_seconds, qc_status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        r.epoch_id,
                        r.epoch_set_id,
                        r.trial_id,
                        r.event_id,
                        r.subject_id,
                        str(r.label),
                        r.onset_seconds,
                        r.qc_status.value,
                        now_iso,
                    ),
                )
            conn.commit()

        yield {
            "epoch_set_id": epoch_set_id,
            "epoch_storage": epoch_storage,
            "mne_epochs": mne_epochs,
            "records": records,
        }


class TestCSPSpatialFiltering:
    """Test MNE CSP spatial filtering instantiation, transformation, and pattern extraction."""

    def test_csp_instantiation_and_component_capping(self):
        config = CSPConfig(n_components=6)
        csp = build_csp_transformer(config, n_channels=4)
        assert csp.n_components == 4  # Capped at n_channels

    def test_csp_transform_shape(self):
        config = CSPConfig(n_components=2, log=True)
        csp = build_csp_transformer(config, n_channels=4)

        X = np.random.randn(10, 4, 100)
        y = np.array([0, 1] * 5)
        csp.fit(X, y)
        X_feat = csp.transform(X)
        assert X_feat.shape == (10, 2)

    def test_csp_pattern_extraction(self):
        config = CSPConfig(n_components=2)
        csp = build_csp_transformer(config, n_channels=4)
        channels = ["Fc5", "C3", "Cz", "C4"]

        X = np.random.randn(10, 4, 100)
        y = np.array([0, 1] * 5)
        csp.fit(X, y)

        patterns = extract_csp_pattern_data(csp, channels)
        assert patterns.n_components == 2
        assert len(patterns.channels) == 4
        assert len(patterns.patterns) == 2
        assert len(patterns.patterns[0]) == 4


class TestClassifiersAndPipeline:
    """Test classifier factory and end-to-end pipeline."""

    def test_classifier_factory(self):
        lda = build_classifier(
            ClassifierConfig(classifier_id="lda1", classifier_type=ClassifierType.LDA)
        )
        assert lda.solver == "svd"

        svm = build_classifier(
            ClassifierConfig(
                classifier_id="svm1", classifier_type=ClassifierType.SVM_LINEAR, c_param=2.0
            )
        )
        assert svm.kernel == "linear"
        assert svm.C == 2.0

        dummy = build_classifier(
            ClassifierConfig(
                classifier_id="dum1", classifier_type=ClassifierType.DUMMY, dummy_strategy="prior"
            )
        )
        assert dummy.strategy == "prior"

    def test_pipeline_construction_and_fit(self):
        pipe_config = DecoderPipelineConfig(
            task_id="LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
            epoch_set_id="ep_test",
            csp_config=CSPConfig(n_components=2),
            classifier_config=ClassifierConfig(
                classifier_id="lda1", classifier_type=ClassifierType.LDA
            ),
            scale_features=True,
        )
        pipeline = build_decoding_pipeline(pipe_config, n_channels=4)
        assert "csp" in pipeline.named_steps
        assert "scaler" in pipeline.named_steps
        assert "classifier" in pipeline.named_steps

        X = np.random.randn(10, 4, 100)
        y = np.array([0, 1] * 5)
        pipeline.fit(X, y)
        preds = pipeline.predict(X)
        assert len(preds) == 10


class TestDataLeakageAndEvaluation:
    """Crucial tests asserting zero data leakage in group-aware CV."""

    def test_inter_subject_zero_leakage_invariant(self, synthetic_epoch_set):
        epochs = synthetic_epoch_set["mne_epochs"]
        records = synthetic_epoch_set["records"]
        X = epochs.get_data()
        raw_labels = [r.label for r in records]
        subjects = [r.subject_id for r in records]
        trials = [r.trial_id for r in records]

        X_filt, y_filt, subjs_filt, _, _, _ = filter_epochs_for_task(
            X, raw_labels, subjects, trials, TASK_LEFT_VS_RIGHT
        )

        pipe_config = DecoderPipelineConfig(
            task_id=TASK_LEFT_VS_RIGHT.task_id,
            epoch_set_id=synthetic_epoch_set["epoch_set_id"],
            csp_config=CSPConfig(n_components=2),
            classifier_config=ClassifierConfig(
                classifier_id="lda1", classifier_type=ClassifierType.LDA
            ),
            evaluation_protocol=EvaluationProtocol.LEAVE_ONE_SUBJECT_OUT,
            evaluation_mode="INTER_SUBJECT",
        )

        metrics, _ = evaluate_decoder_pipeline(
            X_filt, y_filt, subjs_filt, pipe_config, TASK_LEFT_VS_RIGHT
        )

        # Verify that for every fold, train subjects and test subjects are strictly disjoint
        assert len(metrics.per_fold_results) == 3
        for fold in metrics.per_fold_results:
            train_set = set(fold.train_subjects)
            test_set = set(fold.test_subjects)
            assert len(train_set.intersection(test_set)) == 0, (
                f"Leakage found in fold {fold.fold_id}: {train_set.intersection(test_set)}"
            )

        # Verify statistical aggregation
        assert 0.0 <= metrics.accuracy.mean <= 1.0
        assert 0.0 <= metrics.balanced_accuracy.mean <= 1.0
        assert len(metrics.per_subject_metrics) == 3


class TestDecodingServiceAndStorage:
    """Test high-level ClassicalDecodingService, artifact persistence, and offline prediction."""

    def test_full_benchmark_and_model_round_trip(self, temp_db, synthetic_epoch_set):
        with tempfile.TemporaryDirectory() as dec_dir:
            dec_storage = DecoderStorage(base_dir=dec_dir)
            service = ClassicalDecodingService(
                db_manager=temp_db,
                epoch_storage=synthetic_epoch_set["epoch_storage"],
                decoder_storage=dec_storage,
            )

            pipe_config = DecoderPipelineConfig(
                task_id=TASK_LEFT_VS_RIGHT.task_id,
                epoch_set_id=synthetic_epoch_set["epoch_set_id"],
                csp_config=CSPConfig(n_components=2),
                classifier_config=ClassifierConfig(
                    classifier_id="lda1", classifier_type=ClassifierType.LDA
                ),
                evaluation_protocol=EvaluationProtocol.LEAVE_ONE_SUBJECT_OUT,
                evaluation_mode="INTER_SUBJECT",
            )

            # 1. Preview
            preview = service.preview_benchmark(pipe_config)
            assert preview.valid is True
            assert preview.eligible_epochs == 12
            assert preview.subject_count == 3

            # 2. Run benchmark
            manifest = service.run_benchmark(pipe_config)
            assert manifest.model_id.startswith("mdl_")
            assert manifest.metrics.accuracy.mean > 0.0
            assert manifest.artifact_checksum_sha256 != ""
            assert Path(manifest.artifact_file_path).exists()

            # 3. Model registry listing
            models = service.list_models()
            assert len(models) == 1
            assert models[0].model_id == manifest.model_id
            assert models[0].classifier_type == ClassifierType.LDA

            # 4. Manifest retrieval
            loaded_manifest = service.get_model_manifest(manifest.model_id)
            assert loaded_manifest.model_id == manifest.model_id
            assert loaded_manifest.csp_patterns is not None

            # 5. Offline replay prediction
            pred_req = PredictionRequest(
                model_id=manifest.model_id,
                epoch_set_id=synthetic_epoch_set["epoch_set_id"],
                epoch_id=synthetic_epoch_set["records"][0].epoch_id,
            )
            pred_res = service.predict_epoch(pred_req)
            assert pred_res.model_id == manifest.model_id
            assert pred_res.predicted_label in (
                NormalizedLabel.LEFT_IMAGERY,
                NormalizedLabel.RIGHT_IMAGERY,
            )
            assert pred_res.operating_mode == "RESEARCH"

    def test_model_tamper_checksum_protection(self, temp_db, synthetic_epoch_set):
        with tempfile.TemporaryDirectory() as dec_dir:
            dec_storage = DecoderStorage(base_dir=dec_dir)
            service = ClassicalDecodingService(
                db_manager=temp_db,
                epoch_storage=synthetic_epoch_set["epoch_storage"],
                decoder_storage=dec_storage,
            )

            pipe_config = DecoderPipelineConfig(
                task_id=TASK_LEFT_VS_RIGHT.task_id,
                epoch_set_id=synthetic_epoch_set["epoch_set_id"],
                csp_config=CSPConfig(n_components=2),
                classifier_config=ClassifierConfig(
                    classifier_id="svm1", classifier_type=ClassifierType.SVM_LINEAR
                ),
            )
            manifest = service.run_benchmark(pipe_config)

            # Corrupt the joblib file
            with open(manifest.artifact_file_path, "wb") as f:
                f.write(b"corrupted_binary_data")

            with pytest.raises(ValueError, match="Model integrity check failed"):
                dec_storage.load_model(manifest.model_id)


class TestClassicalDecodingAPI:
    """Test FastAPI REST endpoints for classical decoding."""

    def test_api_endpoints_flow(self, monkeypatch, temp_db, synthetic_epoch_set):
        with tempfile.TemporaryDirectory() as dec_dir:
            dec_storage = DecoderStorage(base_dir=dec_dir)
            service = ClassicalDecodingService(
                db_manager=temp_db,
                epoch_storage=synthetic_epoch_set["epoch_storage"],
                decoder_storage=dec_storage,
            )

            import neuromove.decoding.service as dec_svc_module

            monkeypatch.setattr(dec_svc_module, "_service_instance", service)

            app = create_app()
            client = TestClient(app)

            # GET tasks
            res = client.get("/api/models/classical/tasks")
            assert res.status_code == 200
            tasks = res.json()
            assert len(tasks) >= 2

            # POST preview
            pipe_payload = {
                "task_id": "LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
                "epoch_set_id": synthetic_epoch_set["epoch_set_id"],
                "csp_config": {"n_components": 2},
                "classifier_config": {
                    "classifier_id": "lda_test",
                    "classifier_type": "LDA",
                },
                "evaluation_protocol": "LEAVE_ONE_SUBJECT_OUT",
            }
            res_prev = client.post("/api/models/classical/preview", json=pipe_payload)
            assert res_prev.status_code == 200
            prev_data = res_prev.json()
            assert prev_data["valid"] is True

            # POST train
            res_train = client.post("/api/models/classical/train", json=pipe_payload)
            assert res_train.status_code == 200
            train_data = res_train.json()
            model_id = train_data["model_id"]
            assert model_id.startswith("mdl_")

            # GET models
            res_models = client.get("/api/models/classical/models")
            assert res_models.status_code == 200
            assert len(res_models.json()) >= 1

            # GET model manifest
            res_man = client.get(f"/api/models/classical/models/{model_id}/manifest")
            assert res_man.status_code == 200
            assert res_man.json()["model_id"] == model_id

            # GET CSV export
            res_csv = client.get(f"/api/models/classical/models/{model_id}/export/csv")
            assert res_csv.status_code == 200
            assert "text/csv" in res_csv.headers["content-type"]

            # POST predict
            pred_payload = {
                "model_id": model_id,
                "epoch_set_id": synthetic_epoch_set["epoch_set_id"],
                "epoch_id": synthetic_epoch_set["records"][0].epoch_id,
            }
            res_pred = client.post("/api/models/classical/predict", json=pred_payload)
            assert res_pred.status_code == 200
            assert res_pred.json()["operating_mode"] == "RESEARCH"
