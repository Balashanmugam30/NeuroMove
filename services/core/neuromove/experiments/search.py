"""Nested Hyperparameter Search Engine for Phase 12 AI Model Laboratory."""

from __future__ import annotations

import itertools
import random
from typing import Any

import numpy as np
from sklearn.metrics import balanced_accuracy_score
from sklearn.model_selection import GroupKFold, StratifiedGroupKFold, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from neuromove.decoding.csp import build_csp_transformer
from neuromove.decoding.models import CSPConfig
from neuromove.experiments.adapters import get_model_adapter
from neuromove.experiments.models import (
    FeatureRepresentation,
    ModelFamily,
    SearchCandidateResult,
    SearchConfig,
    SearchResult,
    SearchType,
)


class NestedHyperparameterSearcher:
    """Executes leakage-free inner cross-validation for hyperparameter optimization."""

    def __init__(
        self,
        search_config: SearchConfig,
        model_family: ModelFamily,
        representation: FeatureRepresentation,
        base_csp_config: CSPConfig,
        scale_features: bool = False,
        random_state: int = 42,
    ):
        self.search_config = search_config
        self.model_family = model_family
        self.representation = representation
        self.base_csp_config = base_csp_config
        self.scale_features = scale_features
        self.random_state = random_state
        self.adapter = get_model_adapter(model_family)

    def _generate_candidate_param_dicts(self) -> list[dict[str, Any]]:
        """Generate parameter combinations based on search_type."""
        grid = self.search_config.param_grid
        if not grid:
            grid = self.adapter.get_default_param_grid()

        if not grid:
            return [{}]

        keys = list(grid.keys())
        values = list(grid.values())

        if self.search_config.search_type == SearchType.GRID:
            all_combos = list(itertools.product(*values))
            return [dict(zip(keys, combo, strict=False)) for combo in all_combos]
        elif self.search_config.search_type == SearchType.RANDOM:
            all_combos = list(itertools.product(*values))
            rng = random.Random(self.random_state)
            n_samples = min(self.search_config.n_iter, len(all_combos))
            sampled = rng.sample(all_combos, n_samples)
            return [dict(zip(keys, combo, strict=False)) for combo in sampled]

        else:
            return [{}]

    def search(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        groups_train: np.ndarray | None = None,
        channels: list[str] | None = None,
    ) -> SearchResult:
        """Execute inner CV search on training data strictly."""
        candidates = self._generate_candidate_param_dicts()

        if len(candidates) <= 1 or self.search_config.search_type == SearchType.NONE:
            best_params = candidates[0] if candidates else {}
            return SearchResult(
                search_type=self.search_config.search_type,
                total_candidates=len(candidates),
                best_parameters=best_params,
                best_inner_score=1.0,
                candidates=[
                    SearchCandidateResult(
                        candidate_id="cand_default",
                        parameters=best_params,
                        mean_inner_score=1.0,
                        std_inner_score=0.0,
                        rank=1,
                    )
                ],
            )

        # Setup inner CV splitter
        n_splits = self.search_config.inner_cv_splits
        unique_groups = np.unique(groups_train) if groups_train is not None else np.array([])

        if len(unique_groups) >= n_splits:
            try:
                inner_cv = StratifiedGroupKFold(n_splits=n_splits)
                splits = list(inner_cv.split(X_train, y_train, groups=groups_train))
            except Exception:
                inner_cv = GroupKFold(n_splits=n_splits)
                splits = list(inner_cv.split(X_train, y_train, groups=groups_train))
        else:
            inner_cv = StratifiedKFold(
                n_splits=min(n_splits, len(np.unique(y_train))),
                shuffle=True,
                random_state=self.random_state,
            )
            splits = list(inner_cv.split(X_train, y_train))

        candidate_results: list[SearchCandidateResult] = []

        for idx, param_dict in enumerate(candidates):
            fold_scores: list[float] = []

            for inner_train_idx, inner_test_idx in splits:
                X_inner_train = X_train[inner_train_idx]
                y_inner_train = y_train[inner_train_idx]
                X_inner_test = X_train[inner_test_idx]
                y_inner_test = y_train[inner_test_idx]

                # Extract CSP parameter overrides if any
                csp_n_comp = param_dict.get("n_components", self.base_csp_config.n_components)
                csp_cfg = self.base_csp_config.model_copy(update={"n_components": csp_n_comp})

                # Build inner pipeline
                steps: list[tuple[str, Any]] = []
                if self.representation == FeatureRepresentation.CSP_LOG_POWER:
                    steps.append(("csp", build_csp_transformer(csp_cfg, X_inner_train.shape[1])))

                if self.scale_features:
                    steps.append(("scaler", StandardScaler()))

                clf = self.adapter.build_estimator(param_dict, random_state=self.random_state)
                steps.append(("classifier", clf))

                pipeline = Pipeline(steps)

                # Fit inner pipeline on inner train
                pipeline.fit(X_inner_train, y_inner_train)

                # Predict on inner test
                preds = pipeline.predict(X_inner_test)
                score = float(balanced_accuracy_score(y_inner_test, preds))
                fold_scores.append(score)

            mean_score = float(np.mean(fold_scores))
            std_score = float(np.std(fold_scores))

            candidate_results.append(
                SearchCandidateResult(
                    candidate_id=f"cand_{idx + 1:03d}",
                    parameters=param_dict,
                    mean_inner_score=round(mean_score, 4),
                    std_inner_score=round(std_score, 4),
                    rank=1,  # updated below
                )
            )

        # Rank candidates by mean inner score descending
        candidate_results.sort(key=lambda c: c.mean_inner_score, reverse=True)
        for r_idx, c in enumerate(candidate_results):
            c.rank = r_idx + 1

        best_cand = candidate_results[0]

        return SearchResult(
            search_type=self.search_config.search_type,
            total_candidates=len(candidates),
            best_parameters=best_cand.parameters,
            best_inner_score=best_cand.mean_inner_score,
            candidates=candidate_results,
        )
