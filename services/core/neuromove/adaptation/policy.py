"""Adaptation Policy Engine: Evaluates eligibility, regression guards, and promotion compliance."""

from __future__ import annotations

from neuromove.adaptation.models import (
    AdaptationMode,
    AdaptationPolicy,
    AdaptationScope,
    ClassImbalancePolicy,
    DataRetentionStrategy,
    PolicyCriterionResult,
    PromotionEligibility,
)


class AdaptationPolicyEngine:
    """Evaluates declarative policies and promotion rules."""

    @staticmethod
    def get_default_policies() -> list[AdaptationPolicy]:
        """Return standardized baseline research policies."""
        return [
            AdaptationPolicy(
                policy_id="pol_conservative_subject_v1",
                name="Conservative Subject Adaptation Policy",
                description="Strict regression guard (max 2% drop) and 60% minimum balanced accuracy for subject-specific updates.",
                mode=AdaptationMode.BATCH_ADAPTATION,
                scope=AdaptationScope.SUBJECT,
                min_new_trials=10,
                min_trials_per_class=4,
                max_rejection_ratio=0.4,
                retention_strategy=DataRetentionStrategy.BASELINE_PLUS_NEW,
                imbalance_policy=ClassImbalancePolicy.WARN,
                max_allowed_regression=0.02,
                min_promoted_balanced_accuracy=0.60,
                min_validation_samples=6,
                random_state=42,
            ),
            AdaptationPolicy(
                policy_id="pol_rapid_personalized_v1",
                name="Personalized Calibration Refresh Policy",
                description="Standard policy for incorporating newly acquired subject calibration sessions with 5% allowable regression.",
                mode=AdaptationMode.PERSONALIZED_REFRESH,
                scope=AdaptationScope.SUBJECT,
                min_new_trials=6,
                min_trials_per_class=3,
                max_rejection_ratio=0.5,
                retention_strategy=DataRetentionStrategy.BASELINE_PLUS_NEW,
                imbalance_policy=ClassImbalancePolicy.ALLOW,
                max_allowed_regression=0.05,
                min_promoted_balanced_accuracy=0.55,
                min_validation_samples=4,
                random_state=42,
            ),
            AdaptationPolicy(
                policy_id="pol_population_exploratory_v1",
                name="Population Exploratory Policy",
                description="Population-level model update policy requiring 20+ trials and zero regression tolerance.",
                mode=AdaptationMode.BATCH_ADAPTATION,
                scope=AdaptationScope.POPULATION,
                min_new_trials=20,
                min_trials_per_class=8,
                max_rejection_ratio=0.3,
                retention_strategy=DataRetentionStrategy.BASELINE_PLUS_NEW,
                imbalance_policy=ClassImbalancePolicy.REJECT,
                max_allowed_regression=0.00,
                min_promoted_balanced_accuracy=0.65,
                min_validation_samples=10,
                random_state=42,
            ),
        ]

    @classmethod
    def evaluate_promotion_eligibility(
        cls,
        policy: AdaptationPolicy,
        incumbent_balanced_accuracy: float,
        candidate_balanced_accuracy: float,
        validation_sample_count: int,
        validation_class_counts: dict[str, int],
        train_val_overlap_count: int,
    ) -> PromotionEligibility:
        """Evaluate candidate performance against policy rules."""
        criteria_results: list[PolicyCriterionResult] = []
        failure_reasons: list[str] = []

        # 1. Zero Data Leakage Invariant
        overlap_passed = train_val_overlap_count == 0
        criteria_results.append(
            PolicyCriterionResult(
                criterion_name="Zero Data Leakage Invariant",
                expected_rule="train_data ∩ val_data = ∅ (0 overlap)",
                observed_value=train_val_overlap_count,
                passed=overlap_passed,
            )
        )
        if not overlap_passed:
            failure_reasons.append(
                f"Data leakage detected: {train_val_overlap_count} overlapping epochs between training and validation."
            )

        # 2. Minimum Validation Samples
        sample_passed = validation_sample_count >= policy.min_validation_samples
        criteria_results.append(
            PolicyCriterionResult(
                criterion_name="Validation Sample Sufficiency",
                expected_rule=f"≥ {policy.min_validation_samples} samples",
                observed_value=validation_sample_count,
                passed=sample_passed,
            )
        )
        if not sample_passed:
            failure_reasons.append(
                f"Insufficient validation samples: {validation_sample_count} < required {policy.min_validation_samples}."
            )

        # 3. Class Representation in Validation
        classes_represented = len([cnt for cnt in validation_class_counts.values() if cnt > 0])
        class_cov_passed = classes_represented >= 2
        criteria_results.append(
            PolicyCriterionResult(
                criterion_name="Validation Class Coverage",
                expected_rule="At least 2 target classes present in validation set",
                observed_value=classes_represented,
                passed=class_cov_passed,
            )
        )
        if not class_cov_passed:
            failure_reasons.append(
                "Validation set does not contain at least 2 distinct target classes."
            )

        # 4. Minimum Absolute Balanced Accuracy
        min_acc_passed = candidate_balanced_accuracy >= policy.min_promoted_balanced_accuracy
        criteria_results.append(
            PolicyCriterionResult(
                criterion_name="Minimum Balanced Accuracy Threshold",
                expected_rule=f"≥ {round(policy.min_promoted_balanced_accuracy * 100, 1)}%",
                observed_value=f"{round(candidate_balanced_accuracy * 100, 1)}%",
                passed=min_acc_passed,
            )
        )
        if not min_acc_passed:
            failure_reasons.append(
                f"Candidate balanced accuracy ({round(candidate_balanced_accuracy * 100, 1)}%) "
                f"below required minimum ({round(policy.min_promoted_balanced_accuracy * 100, 1)}%)."
            )

        # 5. Regression Guard
        regression_amount = max(
            0.0, round(incumbent_balanced_accuracy - candidate_balanced_accuracy, 4)
        )
        regression_passed = regression_amount <= policy.max_allowed_regression
        criteria_results.append(
            PolicyCriterionResult(
                criterion_name="Performance Regression Guard",
                expected_rule=f"Regression ≤ {round(policy.max_allowed_regression * 100, 1)}% from incumbent",
                observed_value=f"Regression of {round(regression_amount * 100, 1)}%",
                passed=regression_passed,
            )
        )
        if not regression_passed:
            failure_reasons.append(
                f"Candidate performance regressed by {round(regression_amount * 100, 1)}%, "
                f"exceeding allowed limit of {round(policy.max_allowed_regression * 100, 1)}%."
            )

        is_eligible = len(failure_reasons) == 0

        return PromotionEligibility(
            is_eligible=is_eligible,
            criteria_results=criteria_results,
            failure_reasons=failure_reasons,
        )
