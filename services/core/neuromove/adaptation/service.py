"""High-level Adaptation Service Facade for Phase 14."""

from __future__ import annotations

import hashlib
from typing import Any

import numpy as np
from mne.decoding import CSP
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.pipeline import Pipeline

from neuromove.adaptation.batch_engine import AdaptationBatchEngine
from neuromove.adaptation.drift import DriftDiagnosticsEngine
from neuromove.adaptation.engine import AdaptationEngine
from neuromove.adaptation.models import (
    AdaptationDataBatch,
    AdaptationManifest,
    AdaptationPolicy,
    AdaptationPreview,
    AdaptationRun,
    AdaptationScope,
    CreateAdaptationPolicyRequest,
    DriftObservation,
    ModelLifecycleStatus,
    ModelVersion,
    PromotionDecision,
    RollbackEvent,
)
from neuromove.adaptation.policy import AdaptationPolicyEngine
from neuromove.adaptation.registry import ModelVersionRegistry
from neuromove.adaptation.storage import AdaptationStorage
from neuromove.experiments.models import FeatureRepresentation, ModelFamily


class AdaptationService:
    """Singleton service facade managing adaptive learning and model updates."""

    def __init__(
        self,
        storage: AdaptationStorage | None = None,
        registry: ModelVersionRegistry | None = None,
    ) -> None:
        self._storage = storage or AdaptationStorage()
        self._registry = registry or ModelVersionRegistry()

        # In-memory pipeline object storage for fast prototyping / evaluation
        self._pipelines: dict[str, Any] = {}
        # In-memory raw trial buffers keyed by model/batch ID
        self._data_buffers: dict[str, tuple[np.ndarray, np.ndarray, list[str]]] = {}

        self._initialize_defaults()

    def _initialize_defaults(self) -> None:
        """Seed default policies and baseline incumbent research models if empty."""
        # 1. Policies
        existing_policies = self._storage.list_policies()
        if not existing_policies:
            for pol in AdaptationPolicyEngine.get_default_policies():
                self._storage.save_policy(pol)

        # 2. Seed default base models if none registered
        if not self._registry.list_versions():
            self._seed_baseline_models()

    def _seed_baseline_models(self) -> None:
        """Register initial baseline research model v1 for simulation and sub-001/sub-002."""
        # Synthesize baseline data for sub-001 and sub-002
        for subj in ["sub-001", "sub-002"]:
            X_tr, y_tr, ids_tr = self.synthesize_eeg_trials(
                n_trials_per_class=8,
                subject_id=subj,
                seed=42,
                erd_snr=1.5,
            )
            X_val, y_val, ids_val = self.synthesize_eeg_trials(
                n_trials_per_class=4,
                subject_id=subj,
                seed=99,
                erd_snr=1.5,
            )

            # Fit base pipeline
            csp = CSP(n_components=4, cov_est="concat", log=True, transform_into="average_power")
            clf = LinearDiscriminantAnalysis(solver="svd")
            pipe = Pipeline([("csp", csp), ("clf", clf)])
            pipe.fit(X_tr, y_tr)

            model_id = f"mdl_baseline_{subj}_v1"
            self._pipelines[model_id] = pipe
            self._data_buffers[f"{model_id}_train"] = (X_tr, y_tr, ids_tr)
            self._data_buffers[f"{model_id}_val"] = (X_val, y_val, ids_val)

            # Evaluate baseline metrics
            preds = pipe.predict(X_val)
            from sklearn.metrics import accuracy_score, balanced_accuracy_score, f1_score

            metrics = {
                "accuracy": round(float(accuracy_score(y_val, preds)), 4),
                "balanced_accuracy": round(float(balanced_accuracy_score(y_val, preds)), 4),
                "f1": round(float(f1_score(y_val, preds, average="weighted", zero_division=0)), 4),
            }

            file_path, checksum = self._storage.save_pipeline_artifact(model_id, pipe)

            self._registry.register_version(
                model_id=model_id,
                scope=AdaptationScope.SUBJECT,
                model_family=ModelFamily.LDA,
                representation=FeatureRepresentation.CSP_LOG_POWER,
                task_id="LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
                metrics=metrics,
                artifact_checksum_sha256=checksum,
                subject_id=subj,
                status=ModelLifecycleStatus.ACTIVE_RESEARCH,
                is_active=True,
            )

    # --- Policies ---
    def list_policies(self) -> list[AdaptationPolicy]:
        return self._storage.list_policies()

    def get_policy(self, policy_id: str) -> AdaptationPolicy | None:
        return self._storage.get_policy(policy_id)

    def create_policy(self, req: CreateAdaptationPolicyRequest) -> AdaptationPolicy:
        digest = hashlib.sha256(f"{req.name}_{req.random_state}".encode()).hexdigest()[:8]
        policy_id = f"pol_{digest}"
        policy = AdaptationPolicy(
            policy_id=policy_id,
            name=req.name,
            description=req.description,
            mode=req.mode,
            scope=req.scope,
            min_new_trials=req.min_new_trials,
            min_trials_per_class=req.min_trials_per_class,
            max_rejection_ratio=req.max_rejection_ratio,
            retention_strategy=req.retention_strategy,
            imbalance_policy=req.imbalance_policy,
            max_allowed_regression=req.max_allowed_regression,
            min_promoted_balanced_accuracy=req.min_promoted_balanced_accuracy,
            min_validation_samples=req.min_validation_samples,
            random_state=req.random_state,
        )
        self._storage.save_policy(policy)
        return policy

    # --- Batches ---
    def list_batches(self, subject_id: str | None = None) -> list[AdaptationDataBatch]:
        return self._storage.list_batches(subject_id)

    def get_batch(self, batch_id: str) -> AdaptationDataBatch | None:
        return self._storage.get_batch(batch_id)

    def create_data_batch(
        self,
        name: str,
        epoch_ids: list[str],
        labels: list[str],
        subject_id: str | None = None,
        source_mode: str = "SIMULATION",
        signals: np.ndarray | None = None,
        rejected_count: int = 0,
        warn_count: int = 0,
    ) -> AdaptationDataBatch:
        batch = AdaptationBatchEngine.create_batch(
            name=name,
            epoch_ids=epoch_ids,
            labels=labels,
            subject_id=subject_id,
            source_mode=source_mode,
            rejected_count=rejected_count,
            warn_count=warn_count,
            signals=signals,
        )
        self._storage.save_batch(batch)
        if signals is not None:
            self._data_buffers[batch.batch_id] = (signals, np.array(labels), epoch_ids)
        return batch

    # --- Pre-flight Preview ---
    def compute_preview(
        self,
        base_model_id: str,
        data_batch_ids: list[str],
        policy_id: str,
        scope: AdaptationScope = AdaptationScope.SUBJECT,
        subject_id: str | None = None,
    ) -> AdaptationPreview:
        base_ver = self._registry.get_version(base_model_id)
        if not base_ver:
            raise ValueError(f"Base model '{base_model_id}' not found.")

        policy = self._storage.get_policy(policy_id)
        if not policy:
            raise ValueError(f"Policy '{policy_id}' not found.")

        batches = [self._storage.get_batch(bid) for bid in data_batch_ids]
        valid_batches = [b for b in batches if b is not None]

        base_meta = {
            "subject_id": base_ver.subject_id,
            "source_mode": "SIMULATION",
        }

        compat_status, issues = AdaptationBatchEngine.validate_compatibility(
            base_model_metadata=base_meta,
            candidate_batches=valid_batches,
            scope=str(scope),
            target_subject_id=subject_id,
        )

        # Get base train epoch IDs for duplicate detection
        base_buf = self._data_buffers.get(f"{base_model_id}_train")
        base_ids = base_buf[2] if base_buf else []

        new_ids: list[str] = []
        class_counts: dict[str, int] = {}
        for b in valid_batches:
            for cls_name, count in b.class_distribution.items():
                class_counts[cls_name] = class_counts.get(cls_name, 0) + count
            buf = self._data_buffers.get(b.batch_id)
            if buf:
                new_ids.extend(buf[2])

        dup_count, unique_ids = AdaptationBatchEngine.detect_duplicate_epochs(base_ids, new_ids)

        total_new_trials = sum(b.trial_count for b in valid_batches) - dup_count
        base_retained = len(base_ids)
        new_train_portion = (
            max(1, int(0.6 * total_new_trials)) if total_new_trials > 1 else total_new_trials
        )
        new_val_portion = total_new_trials - new_train_portion

        base_val_buf = self._data_buffers.get(f"{base_model_id}_val")
        base_val_count = len(base_val_buf[2]) if base_val_buf else 4

        total_training_trials = base_retained + new_train_portion
        total_val_trials = base_val_count + new_val_portion

        # Compute normalized class balance
        tot_classes = sum(class_counts.values()) or 1
        class_balance = {k: round(v / tot_classes, 4) for k, v in class_counts.items()}

        promotion_reqs = [
            f"Balanced Accuracy ≥ {round(policy.min_promoted_balanced_accuracy * 100, 1)}%",
            f"Regression ≤ {round(policy.max_allowed_regression * 100, 1)}% from incumbent ({round(base_ver.metrics['balanced_accuracy'] * 100, 1)}%)",
            f"Validation samples ≥ {policy.min_validation_samples} (Estimated: {total_val_trials})",
            "Zero train/validation overlap invariant",
        ]

        can_proceed = compat_status != "INCOMPATIBLE" and total_new_trials >= policy.min_new_trials

        return AdaptationPreview(
            base_model_id=base_model_id,
            base_model_version=base_ver.version_number,
            scope=scope,
            subject_id=subject_id or base_ver.subject_id,
            policy_id=policy.policy_id,
            policy_name=policy.name,
            compatibility_status=compat_status,
            compatibility_issues=issues,
            duplicate_epoch_count=dup_count,
            data_composition={
                "base_retained_trials": base_retained,
                "new_candidate_trials": total_new_trials,
                "total_training_trials": total_training_trials,
                "protected_validation_trials": total_val_trials,
            },
            class_balance=class_balance,
            promotion_requirements=promotion_reqs,
            can_proceed=can_proceed,
        )

    # --- Run Adaptation ---
    def run_adaptation(
        self,
        base_model_id: str,
        data_batch_ids: list[str],
        policy_id: str,
        scope: AdaptationScope = AdaptationScope.SUBJECT,
        subject_id: str | None = None,
        notes: str | None = None,
    ) -> AdaptationRun:
        base_ver = self._registry.get_version(base_model_id)
        if not base_ver:
            raise ValueError(f"Base model '{base_model_id}' not found.")

        policy = self._storage.get_policy(policy_id)
        if not policy:
            raise ValueError(f"Policy '{policy_id}' not found.")

        base_pipe = self._pipelines.get(base_model_id)
        if not base_pipe:
            # Fallback: re-synthesize or build base pipeline
            X_b_tr, y_b_tr, ids_b_tr = self.synthesize_eeg_trials(
                8, subject_id=base_ver.subject_id or "sub-001", seed=42
            )
            base_pipe = AdaptationEngine._build_and_fit_pipeline(
                X_b_tr, y_b_tr, model_family=base_ver.model_family
            )
            self._pipelines[base_model_id] = base_pipe
            self._data_buffers[f"{base_model_id}_train"] = (X_b_tr, y_b_tr, ids_b_tr)

        base_train_data = self._data_buffers.get(f"{base_model_id}_train")
        if not base_train_data:
            X_b_tr, y_b_tr, ids_b_tr = self.synthesize_eeg_trials(
                8, subject_id=base_ver.subject_id or "sub-001", seed=42
            )
            base_train_data = (X_b_tr, y_b_tr, ids_b_tr)
            self._data_buffers[f"{base_model_id}_train"] = base_train_data

        base_val_data = self._data_buffers.get(f"{base_model_id}_val")
        if not base_val_data:
            X_b_val, y_b_val, ids_b_val = self.synthesize_eeg_trials(
                4, subject_id=base_ver.subject_id or "sub-001", seed=99
            )
            base_val_data = (X_b_val, y_b_val, ids_b_val)
            self._data_buffers[f"{base_model_id}_val"] = base_val_data

        # Collect candidate data across batches
        batches = [self._storage.get_batch(bid) for bid in data_batch_ids]
        valid_batches = [b for b in batches if b is not None]

        X_new_list, y_new_list, ids_new_list = [], [], []
        for b in valid_batches:
            buf = self._data_buffers.get(b.batch_id)
            if buf:
                X_new_list.append(buf[0])
                y_new_list.append(buf[1])
                ids_new_list.extend(buf[2])
            else:
                # Synthesize on demand for registered batch
                X_synth, y_synth, ids_synth = self.synthesize_eeg_trials(
                    n_trials_per_class=max(3, b.trial_count // 2),
                    subject_id=b.subject_id or "sub-001",
                    seed=123,
                )
                X_new_list.append(X_synth)
                y_new_list.append(y_synth)
                ids_new_list.extend(ids_synth)

        X_new_all = np.concatenate(X_new_list, axis=0) if X_new_list else np.empty((0, 3, 500))
        y_new_all = np.concatenate(y_new_list, axis=0) if y_new_list else np.empty((0,))
        new_data = (X_new_all, y_new_all, ids_new_list)

        # Execute adaptation experiment
        run, cand_pipe, cand_model_id = AdaptationEngine.execute_adaptation_run(
            base_model_id=base_model_id,
            base_pipeline=base_pipe,
            policy=policy,
            data_batches=valid_batches,
            base_training_data=base_train_data,
            base_validation_data=base_val_data,
            new_candidate_data=new_data,
            model_family=base_ver.model_family,
            scope=str(scope),
            subject_id=subject_id or base_ver.subject_id,
        )

        # Store candidate pipeline & artifact
        self._pipelines[cand_model_id] = cand_pipe
        file_path, checksum = self._storage.save_pipeline_artifact(cand_model_id, cand_pipe)

        # Register candidate in version registry as CANDIDATE (non-active)
        cand_metrics = run.candidate_metrics or {
            "accuracy": 0.0,
            "balanced_accuracy": 0.0,
            "f1": 0.0,
        }
        self._registry.register_version(
            model_id=cand_model_id,
            scope=scope,
            model_family=base_ver.model_family,
            representation=base_ver.representation,
            task_id=base_ver.task_id,
            metrics=cand_metrics,
            artifact_checksum_sha256=checksum,
            parent_model_id=base_model_id,
            subject_id=subject_id or base_ver.subject_id,
            adaptation_id=run.adaptation_id,
            status=ModelLifecycleStatus.CANDIDATE,
            is_active=False,
        )

        self._storage.save_run(run)
        return run

    def get_run(self, adaptation_id: str) -> AdaptationRun | None:
        return self._storage.get_run(adaptation_id)

    def list_runs(self, subject_id: str | None = None) -> list[AdaptationRun]:
        return self._storage.list_runs(subject_id)

    def get_manifest(self, adaptation_id: str) -> AdaptationManifest | None:
        run = self._storage.get_run(adaptation_id)
        if not run:
            return None
        policy = self._storage.get_policy(run.policy_id)
        if not policy:
            return None

        decision = None
        if run.candidate_model_id:
            cand_ver = self._registry.get_version(run.candidate_model_id)
            if cand_ver and cand_ver.adaptation_id == adaptation_id:
                for dec in self._registry._decisions.values():
                    if dec.adaptation_id == adaptation_id:
                        decision = dec
                        break

        return AdaptationManifest(
            adaptation_id=run.adaptation_id,
            base_model_id=run.base_model_id,
            candidate_model_id=run.candidate_model_id,
            scope=run.scope,
            subject_id=run.subject_id,
            policy=policy,
            data_batch_ids=run.data_batch_ids,
            training_fingerprint=run.training_composition.get("fingerprint", ""),
            validation_fingerprint=run.validation_composition.get("fingerprint", ""),
            comparison_summary=run.comparison,
            promotion_decision=decision,
            software_versions={
                "python": "3.13",
                "mne": "1.9.0",
                "scikit-learn": "1.6.1",
                "neuromove": "0.1.0",
            },
        )

    # --- Promotion & Rejection ---
    def promote_candidate(
        self,
        adaptation_id: str,
        operator_notes: str | None = None,
    ) -> tuple[ModelVersion, PromotionDecision]:
        run = self._storage.get_run(adaptation_id)
        if not run:
            raise ValueError(f"Adaptation run '{adaptation_id}' not found.")
        if not run.candidate_model_id:
            raise ValueError(f"Adaptation run '{adaptation_id}' has no candidate model.")

        if run.promotion_eligibility and not run.promotion_eligibility.is_eligible:
            reasons = "; ".join(run.promotion_eligibility.failure_reasons)
            raise ValueError(f"Cannot promote candidate model: Policy compliance failed: {reasons}")

        promoted, decision = self._registry.promote_candidate(
            candidate_model_id=run.candidate_model_id,
            adaptation_id=adaptation_id,
            operator_notes=operator_notes,
        )

        # Update run status
        updated_run = run.model_copy(
            update={
                "status": "PROMOTED",
                "promotion_decision": {
                    "decision": "PROMOTED",
                    "operator_action": "MANUAL_APPROVAL",
                    "reasons": decision.reasons,
                    "timestamp": decision.timestamp,
                },
            }
        )
        self._storage.save_run(updated_run)

        return promoted, decision

    def reject_candidate(
        self,
        adaptation_id: str,
        rejection_reason: str,
    ) -> tuple[ModelVersion, PromotionDecision]:
        run = self._storage.get_run(adaptation_id)
        if not run:
            raise ValueError(f"Adaptation run '{adaptation_id}' not found.")
        if not run.candidate_model_id:
            raise ValueError(f"Adaptation run '{adaptation_id}' has no candidate model.")

        rejected, decision = self._registry.reject_candidate(
            candidate_model_id=run.candidate_model_id,
            adaptation_id=adaptation_id,
            rejection_reason=rejection_reason,
        )

        updated_run = run.model_copy(
            update={
                "status": "REJECTED",
                "promotion_decision": {
                    "decision": "REJECTED",
                    "operator_action": "MANUAL_REJECTION",
                    "reasons": [rejection_reason],
                    "timestamp": decision.timestamp,
                },
            }
        )
        self._storage.save_run(updated_run)

        return rejected, decision

    # --- Rollback ---
    def rollback(self, target_model_id: str, reason: str) -> tuple[ModelVersion, RollbackEvent]:
        return self._registry.rollback(target_model_id, reason)

    # --- Models & Lineage ---
    def list_models(
        self,
        scope: AdaptationScope | None = None,
        subject_id: str | None = None,
    ) -> list[ModelVersion]:
        return self._registry.list_versions(scope, subject_id)

    def get_model_versions(self, model_id: str) -> list[ModelVersion]:
        return self._registry.get_version_chain(model_id)

    # --- Drift Diagnostics ---
    def run_drift_diagnostics(
        self,
        subject_id: str | None = "sub-001",
        dataset_id: str | None = None,
        window_label: str = "Window_Recent",
        inject_shift: bool = False,
    ) -> DriftObservation:
        """Execute research distribution drift analysis."""
        # Generate baseline features
        rng = np.random.RandomState(42)
        baseline_feats = rng.randn(25, 4)
        baseline_classes = {"LEFT_IMAGERY": 12, "RIGHT_IMAGERY": 13}

        # Generate recent features
        if inject_shift:
            # Substantial distribution shift (mean +2.0, class imbalance)
            recent_feats = baseline_feats + 2.0 + rng.randn(25, 4) * 0.3
            recent_classes = {"LEFT_IMAGERY": 20, "RIGHT_IMAGERY": 5}  # 80/20 class shift
        else:
            # Stable distribution with minimal noise
            recent_feats = baseline_feats + rng.randn(25, 4) * 0.02
            recent_classes = {"LEFT_IMAGERY": 12, "RIGHT_IMAGERY": 13}

        drift_obs = DriftDiagnosticsEngine.evaluate_distribution_drift(
            baseline_features=baseline_feats,
            recent_features=recent_feats,
            baseline_classes=baseline_classes,
            recent_classes=recent_classes,
            signal_quality_score=0.95,
            subject_id=subject_id,
            dataset_id=dataset_id,
            window_label=window_label,
            feature_shift_threshold=0.35,
            class_shift_threshold=0.25,
        )

        self._storage.save_drift(drift_obs)
        return drift_obs

    def list_drift_observations(self, subject_id: str | None = None) -> list[DriftObservation]:
        return self._storage.list_drift_observations(subject_id)

    # --- Synthetic EEG Trial Generator ---
    @staticmethod
    def synthesize_eeg_trials(
        n_trials_per_class: int = 10,
        subject_id: str = "sub-001",
        seed: int = 42,
        erd_snr: float = 1.5,
    ) -> tuple[np.ndarray, np.ndarray, list[str]]:
        """
        Synthesize realistic multi-channel motor imagery trials with contralateral ERD dynamics.
        Channels: C3 (0), Cz (1), C4 (2). Sample Rate: 250 Hz, Duration: 2.0s (500 samples).
        """
        rng = np.random.RandomState(seed)
        n_samples = 500
        n_channels = 3
        time = np.linspace(0, 2.0, n_samples)

        X_list = []
        y_list = []
        ids_list = []

        classes = ["LEFT_IMAGERY"] * n_trials_per_class + ["RIGHT_IMAGERY"] * n_trials_per_class
        rng.shuffle(classes)

        for i, target_cls in enumerate(classes):
            # Baseline background 1/f noise + 10 Hz resting mu rhythm
            noise = rng.randn(n_channels, n_samples) * 5.0
            resting_mu = np.sin(2 * np.pi * 10.0 * time) * 15.0

            trial_sig = np.zeros((n_channels, n_samples))
            for ch in range(n_channels):
                trial_sig[ch] = noise[ch] + resting_mu

            # Apply Contralateral Event-Related Desynchronization (ERD)
            if target_cls == "LEFT_IMAGERY":
                # Left hand movement -> Right hemisphere C4 (channel 2) ERD (suppression)
                trial_sig[2] = noise[2] + (resting_mu / (erd_snr + 1.0))
                trial_sig[0] = noise[0] + resting_mu * 1.2  # C3 slight ERS
            else:
                # Right hand movement -> Left hemisphere C3 (channel 0) ERD (suppression)
                trial_sig[0] = noise[0] + (resting_mu / (erd_snr + 1.0))
                trial_sig[2] = noise[2] + resting_mu * 1.2  # C4 slight ERS

            X_list.append(trial_sig)
            y_list.append(target_cls)
            ids_list.append(f"ep_{subject_id}_{seed}_trl_{i + 1:03d}")

        return np.array(X_list), np.array(y_list), ids_list


# Singleton instance
_adaptation_service: AdaptationService | None = None


def get_adaptation_service() -> AdaptationService:
    global _adaptation_service
    if _adaptation_service is None:
        _adaptation_service = AdaptationService()
    return _adaptation_service
