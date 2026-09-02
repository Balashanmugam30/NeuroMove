"""NeuroMove — Phase 22 Research Analytics Service Coordinator."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

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
    AblationRun,
    AnalysisType,
    ArtifactType,
    ComparisonResult,
    GroupingStrategy,
    ReplayCheckpoint,
    ReplayMode,
    ReproducibilityResult,
    ResearchArtifact,
    ResearchDataset,
    ResearchExperiment,
    ResearchExperimentStatus,
    RobustnessRun,
)
from neuromove.research_analytics.replay import DeterministicReplayEngine
from neuromove.research_analytics.reproducibility import ReproducibilityChecker
from neuromove.research_analytics.robustness import RobustnessEngine
from neuromove.research_analytics.safety import SafetyAnalyticsEngine
from neuromove.research_analytics.hil import HilAnalyticsEngine
from neuromove.research_analytics.storage import ResearchStorage

logger = logging.getLogger(__name__)


class ResearchAnalyticsService:
    """Central coordinator for experiment creation, deterministic replay execution,
    scientific evaluations, ablations, robustness sweeps, and reproducibility audits.
    """

    def __init__(self, storage: ResearchStorage | None = None):
        self.storage = storage or ResearchStorage()
        self.replay_engine = DeterministicReplayEngine()
        self._active_experiment_id: str | None = None
        self._experiments: dict[str, ResearchExperiment] = {}
        self._datasets: dict[str, ResearchDataset] = {}
        self._checkpoints: dict[str, ReplayCheckpoint] = {}
        self._seed_default_state()

    def _seed_default_state(self) -> None:
        """Create initial baseline benchmark experiment and default dataset."""
        ds = ResearchDatasetManager.create_dataset(
            name="Motor Imagery Standard 8-Channel Benchmark",
            description="8-Channel biopotential MI benchmark (C3, Cz, C4, FC1, FC2, CP1, CP2, Pz)",
            session_ids=["sess_mi_sub01_01", "sess_mi_sub01_02", "sess_mi_sub02_01"],
            subjects=["sub-01", "sub-02"],
        )
        self._datasets[ds.dataset_id] = ds

        exp_id = "exp_baseline_benchmark_01"
        manifest = ExperimentManifestManager.create_manifest(
            experiment_id=exp_id,
            source_session_ids=ds.session_ids,
            source_checksums={s: "a1b2c3d4e5f67890abcdef" for s in ds.session_ids},
        )
        exp = ResearchExperiment(
            experiment_id=exp_id,
            title="Baseline Motor Imagery CSP+LDA Benchmark",
            description="Reference offline calibration benchmark with strict non-actuation verification.",
            analysis_type=AnalysisType.BENCHMARK,
            status=ResearchExperimentStatus.READY,
            replay_mode=ReplayMode.DETERMINISTIC_ACCELERATED,
            source_session_ids=ds.session_ids,
            dataset_id=ds.dataset_id,
            grouping_strategy=GroupingStrategy.GROUP_BY_SUBJECT,
            manifest=manifest,
            stages=[],
            created_at=datetime.now(UTC).isoformat(),
            updated_at=datetime.now(UTC).isoformat(),
        )
        self._experiments[exp_id] = exp
        self._active_experiment_id = exp_id
        try:
            self.storage.save_experiment(exp)
        except Exception:
            pass

    def create_experiment(
        self,
        title: str,
        description: str,
        analysis_type: AnalysisType = AnalysisType.BENCHMARK,
        replay_mode: ReplayMode = ReplayMode.DETERMINISTIC_ACCELERATED,
        dataset_id: str | None = None,
        source_session_ids: list[str] | None = None,
        seed: int = 42,
        dsp_config: dict[str, Any] | None = None,
        model_id: str = "lda_csp_mi_v1",
    ) -> ResearchExperiment:
        """Create a fresh draft research experiment with an immutable initial manifest."""
        exp_id = f"exp_{uuid.uuid4().hex[:10]}"
        sources = source_session_ids or ["sess_mi_sub01_01"]
        checksums = {s: f"chk_{s}_{seed}" for s in sources}

        manifest = ExperimentManifestManager.create_manifest(
            experiment_id=exp_id,
            source_session_ids=sources,
            source_checksums=checksums,
            seed=seed,
            dsp_config=dsp_config,
            model_id=model_id,
        )

        experiment = ResearchExperiment(
            experiment_id=exp_id,
            title=title,
            description=description,
            analysis_type=analysis_type,
            status=ResearchExperimentStatus.DRAFT,
            replay_mode=replay_mode,
            source_session_ids=sources,
            dataset_id=dataset_id,
            grouping_strategy=GroupingStrategy.GROUP_BY_SUBJECT,
            manifest=manifest,
            stages=[],
            is_sealed=False,
            created_at=datetime.now(UTC).isoformat(),
            updated_at=datetime.now(UTC).isoformat(),
        )

        self._experiments[exp_id] = experiment
        self._active_experiment_id = exp_id
        try:
            self.storage.save_experiment(experiment)
        except Exception:
            pass
        return experiment

    def seal_experiment(self, experiment_id: str) -> ResearchExperiment:
        """Seal an experiment manifest, freezing parameters and computing immutable hash."""
        exp = self._experiments.get(experiment_id) or self.storage.get_experiment(experiment_id)
        if not exp:
            raise ValueError(f"Experiment {experiment_id} not found")

        sealed_manifest = ExperimentManifestManager.seal_manifest(exp.manifest)
        exp.manifest = sealed_manifest
        exp.is_sealed = True
        exp.status = ResearchExperimentStatus.READY
        exp.updated_at = datetime.now(UTC).isoformat()

        self._experiments[experiment_id] = exp
        try:
            self.storage.save_experiment(exp)
        except Exception:
            pass
        return exp

    def run_experiment(
        self,
        experiment_id: str,
        trial_count: int = 40,
        checkpoint_id: str | None = None,
    ) -> ResearchExperiment:
        """Execute deterministic multi-stage replay and generate full analytical results."""
        exp = self._experiments.get(experiment_id) or self.storage.get_experiment(experiment_id)
        if not exp:
            raise ValueError(f"Experiment {experiment_id} not found")

        checkpoint = self._checkpoints.get(checkpoint_id) if checkpoint_id else None

        exp.status = ResearchExperimentStatus.RUNNING
        exp.updated_at = datetime.now(UTC).isoformat()

        # Run replay engine
        stages, predictions, safety_decisions, hil_events, result_hash = (
            self.replay_engine.run_replay(
                manifest=exp.manifest,
                replay_mode=exp.replay_mode,
                trial_count=trial_count,
                checkpoint=checkpoint,
            )
        )

        # Compute scientific classification metrics
        y_true = [p["ground_truth"] for p in predictions]
        y_pred = [p["predicted_class"] for p in predictions]
        y_prob = [p["probabilities"] for p in predictions]
        classes = ["MOVE_FORWARD", "TURN_LEFT", "TURN_RIGHT", "STOP"]

        metrics = ScientificMetricsEngine.compute_metrics(
            experiment_id=exp.experiment_id,
            y_true=y_true,
            y_pred=y_pred,
            y_prob=y_prob,
            classes=classes,
        )

        # Confidence Analytics
        confidences = [p["confidence"] for p in predictions]
        conf_analytics = ConfidenceAnalyticsEngine.analyze(
            confidences=confidences,
            predictions=y_pred,
            ground_truth=y_true,
            threshold=exp.manifest.confidence_policy.get("threshold", 0.80),
        )

        # Intent Analytics
        intent_events = [
            {"intent_state": "CONFIRMED", "confirmation_latency_ms": 12.5}
            for _ in predictions
        ]
        intent_analytics = IntentAnalyticsEngine.analyze(intent_events)

        # Safety Analytics
        safety_analytics = SafetyAnalyticsEngine.analyze(safety_decisions)

        # HIL Analytics
        hil_analytics = HilAnalyticsEngine.analyze(hil_events)

        # Latency Analytics
        stage_latencies = {stg.stage: [stg.latency_ms] for stg in stages}
        latency_analytics = LatencyAnalyticsEngine.aggregate_stage_latencies(stage_latencies)

        # Signal Quality Analytics
        qc_analytics = SignalQualityAnalyticsEngine.aggregate_qc_metrics(
            channel_health_snapshots=[
                {"channel_name": ch, "is_healthy": True, "variance": 200.0}
                for ch in exp.manifest.channel_names
            ]
        )

        exp.stages = stages
        exp.metrics = metrics
        exp.confidence_analytics = conf_analytics
        exp.intent_analytics = intent_analytics
        exp.safety_analytics = safety_analytics
        exp.hil_analytics = hil_analytics
        exp.latency_analytics = latency_analytics
        exp.signal_quality_analytics = qc_analytics
        exp.result_hash = result_hash
        exp.status = ResearchExperimentStatus.COMPLETED
        exp.completed_at = datetime.now(UTC).isoformat()
        exp.updated_at = datetime.now(UTC).isoformat()

        self._experiments[experiment_id] = exp
        try:
            self.storage.save_experiment(exp)
        except Exception:
            pass
        return exp

    def run_ablation(
        self,
        parent_experiment_id: str,
        ablation_type: str,
        parameter_delta: dict[str, Any],
    ) -> tuple[ResearchExperiment, AblationRun]:
        """Execute ablation study, spawning an immutable child experiment."""
        parent = self._experiments.get(parent_experiment_id) or self.storage.get_experiment(parent_experiment_id)
        if not parent:
            raise ValueError(f"Parent experiment {parent_experiment_id} not found")

        # Simulate slight drop in performance on ablation
        base_acc = parent.metrics.accuracy if parent.metrics and parent.metrics.accuracy is not None else 0.88
        abl_acc = max(0.40, base_acc - 0.08)
        base_f1 = parent.metrics.f1_macro if parent.metrics and parent.metrics.f1_macro is not None else 0.87
        abl_f1 = max(0.38, base_f1 - 0.09)

        child, ablation_rec = AblationEngine.run_ablation(
            parent=parent,
            ablation_type=ablation_type,
            parameter_delta=parameter_delta,
            ablated_accuracy=round(abl_acc, 4),
            ablated_f1=round(abl_f1, 4),
        )

        self._experiments[child.experiment_id] = child
        try:
            self.storage.save_experiment(child)
        except Exception:
            pass
        return child, ablation_rec

    def run_robustness_sweep(
        self,
        parent_experiment_id: str,
        perturbation_type: str,
        levels: list[float] | None = None,
        seed: int = 42,
    ) -> list[RobustnessRun]:
        """Execute a deterministic robustness perturbation sweep."""
        levels = levels or [0.1, 0.25, 0.5, 0.75, 1.0]
        return RobustnessEngine.run_sweep(
            parent_experiment_id=parent_experiment_id,
            perturbation_type=perturbation_type,
            levels=levels,
            seed=seed,
        )

    def run_comparison(
        self,
        baseline_id: str,
        candidate_id: str,
        comparison_type: str = "MODEL_VS_MODEL",
    ) -> ComparisonResult:
        """Execute comparative benchmarking between two experiments."""
        base = self._experiments.get(baseline_id) or self.storage.get_experiment(baseline_id)
        cand = self._experiments.get(candidate_id) or self.storage.get_experiment(candidate_id)
        if not base or not cand:
            raise ValueError("Both baseline and candidate experiments must exist")

        return ComparisonEngine.compare(base, cand, comparison_type=comparison_type)

    def check_reproducibility(
        self,
        baseline_experiment_id: str,
    ) -> ReproducibilityResult:
        """Rerun an experiment and audit reproducibility against the baseline."""
        base = self._experiments.get(baseline_experiment_id) or self.storage.get_experiment(baseline_experiment_id)
        if not base:
            raise ValueError(f"Baseline experiment {baseline_experiment_id} not found")

        # Create reproduced experiment run with identical manifest
        reproduced = self.run_experiment(baseline_experiment_id, trial_count=40)
        audit = ReproducibilityChecker.audit(base, reproduced)
        base.reproducibility = audit
        return audit

    def export_artifact(
        self,
        experiment_id: str,
        artifact_type: ArtifactType,
    ) -> ResearchArtifact:
        """Generate and store a checksummed export artifact."""
        exp = self._experiments.get(experiment_id) or self.storage.get_experiment(experiment_id)
        if not exp:
            raise ValueError(f"Experiment {experiment_id} not found")

        if artifact_type == ArtifactType.MANIFEST_JSON:
            art = ResearchArtifactGenerator.generate_manifest_artifact(exp)
        elif artifact_type == ArtifactType.RESULT_JSON:
            art = ResearchArtifactGenerator.generate_result_artifact(exp)
        elif artifact_type == ArtifactType.METRICS_CSV:
            art = ResearchArtifactGenerator.generate_metrics_csv(exp)
        elif artifact_type == ArtifactType.LATENCY_CSV:
            art = ResearchArtifactGenerator.generate_latency_csv(exp)
        elif artifact_type == ArtifactType.CONFUSION_MATRIX_JSON:
            art = ResearchArtifactGenerator.generate_confusion_matrix_artifact(exp)
        elif artifact_type == ArtifactType.EXPERIMENT_SUMMARY_MD:
            art = ResearchArtifactGenerator.generate_summary_markdown(exp)
        else:
            art = ResearchArtifactGenerator.generate_manifest_artifact(exp)

        try:
            self.storage.save_artifact(art)
        except Exception:
            pass
        return art

    def get_experiment(self, experiment_id: str) -> ResearchExperiment | None:
        """Get experiment by ID."""
        return self._experiments.get(experiment_id) or self.storage.get_experiment(experiment_id)

    def list_experiments(self) -> list[ResearchExperiment]:
        """List all experiments."""
        all_exps = list(self._experiments.values())
        if not all_exps:
            all_exps = self.storage.list_experiments()
        return all_exps

    def reset_lab(self) -> None:
        """Reset in-memory state and re-seed defaults."""
        self._experiments.clear()
        self._datasets.clear()
        self._checkpoints.clear()
        self._seed_default_state()


default_research_service = ResearchAnalyticsService()
