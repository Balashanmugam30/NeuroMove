"""Ablation Studies Framework for Phase 12 AI Model Laboratory."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from neuromove.decoding.models import ClassificationMetrics
from neuromove.experiments.models import (
    AblationConfig,
    AblationStudyResult,
    AblationVariantConfig,
    AblationVariantResult,
    ExperimentConfig,
    ModelFamily,
)


class AblationStudyOrchestrator:
    """Manages controlled single-variable ablation experiments."""

    @staticmethod
    def generate_ablation_config(
        baseline_config: ExperimentConfig,
        ablation_variable: str,
    ) -> AblationConfig:
        """Generate structured ablation configurations for common research variables."""
        variants: list[AblationVariantConfig] = []

        if ablation_variable == "CSP_COMPONENTS":
            for n_comp in [2, 4, 6]:
                cfg = baseline_config.model_copy(deep=True)
                cfg.csp_config = cfg.csp_config.model_copy(update={"n_components": n_comp})
                variants.append(
                    AblationVariantConfig(
                        variant_name=f"CSP_{n_comp}_components",
                        param_value=n_comp,
                        config=cfg,
                    )
                )

        elif ablation_variable == "MODEL_FAMILY":
            families = [
                ModelFamily.LDA,
                ModelFamily.SVM_LINEAR,
                ModelFamily.SVM_RBF,
                ModelFamily.LOGISTIC_REGRESSION,
            ]
            for fam in families:
                cfg = baseline_config.model_copy(deep=True)
                cfg.model_family = fam
                cfg.model_params = {}
                variants.append(
                    AblationVariantConfig(
                        variant_name=f"Family_{fam.value}",
                        param_value=fam.value,
                        config=cfg,
                    )
                )

        elif ablation_variable == "FEATURE_SCALING":
            for scale in [False, True]:
                cfg = baseline_config.model_copy(deep=True)
                cfg.scale_features = scale
                variants.append(
                    AblationVariantConfig(
                        variant_name=f"Scaling_{scale}",
                        param_value=scale,
                        config=cfg,
                    )
                )

        else:
            raise ValueError(f"Unsupported ablation variable: {ablation_variable}")

        ablation_id = (
            f"abl_{ablation_variable.lower()}_{baseline_config.compute_deterministic_hash()[:8]}"
        )

        return AblationConfig(
            ablation_id=ablation_id,
            name=f"Ablation Study: {ablation_variable}",
            description=f"Controlled evaluation of {ablation_variable} variations holding dataset and folds constant.",
            baseline_experiment_config=baseline_config,
            ablation_variable=ablation_variable,
            variants=variants,
        )

    @staticmethod
    def compile_results(
        ablation_id: str,
        name: str,
        ablation_variable: str,
        baseline_experiment_id: str,
        baseline_metrics: ClassificationMetrics,
        variant_results: list[tuple[str, Any, ClassificationMetrics, str]],
    ) -> AblationStudyResult:
        """Calculate deltas and compile final ablation study report."""
        base_bal_acc = baseline_metrics.balanced_accuracy.mean
        base_f1 = baseline_metrics.f1.mean

        compiled_variants: list[AblationVariantResult] = []
        for var_name, p_val, v_metrics, exp_id in variant_results:
            delta_bal = round(v_metrics.balanced_accuracy.mean - base_bal_acc, 4)
            delta_f1 = round(v_metrics.f1.mean - base_f1, 4)
            compiled_variants.append(
                AblationVariantResult(
                    variant_name=var_name,
                    param_value=p_val,
                    metrics=v_metrics,
                    delta_balanced_accuracy=delta_bal,
                    delta_f1=delta_f1,
                    experiment_id=exp_id,
                )
            )

        return AblationStudyResult(
            ablation_id=ablation_id,
            name=name,
            ablation_variable=ablation_variable,
            baseline_experiment_id=baseline_experiment_id,
            baseline_metrics=baseline_metrics,
            variants=compiled_variants,
            created_at=datetime.now(UTC).isoformat(),
        )
