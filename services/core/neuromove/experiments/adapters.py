"""Model Adapter Architecture for Phase 12 AI Model Laboratory."""

from __future__ import annotations

import abc
from typing import Any

from sklearn.base import BaseEstimator
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC

from neuromove.experiments.models import ModelFamily


class ModelAdapter(abc.ABC):
    """Unified abstract base adapter for classical and statistical machine learning estimators."""

    @property
    @abc.abstractmethod
    def family(self) -> ModelFamily:
        """Return the canonical ModelFamily enum value."""

    @abc.abstractmethod
    def build_estimator(self, config: dict[str, Any], random_state: int = 42) -> BaseEstimator:
        """Instantiate and configure the scikit-learn estimator."""

    @abc.abstractmethod
    def get_default_param_grid(self) -> dict[str, list[Any]]:
        """Return a compatible default hyperparameter grid for inner CV search."""


class DummyModelAdapter(ModelAdapter):
    @property
    def family(self) -> ModelFamily:
        return ModelFamily.DUMMY

    def build_estimator(self, config: dict[str, Any], random_state: int = 42) -> BaseEstimator:
        strategy = config.get("strategy", "prior")
        if strategy not in ["prior", "stratified", "uniform", "most_frequent"]:
            strategy = "prior"
        return DummyClassifier(strategy=strategy, random_state=random_state)

    def get_default_param_grid(self) -> dict[str, list[Any]]:
        return {"strategy": ["prior", "uniform"]}


class LDAModelAdapter(ModelAdapter):
    @property
    def family(self) -> ModelFamily:
        return ModelFamily.LDA

    def build_estimator(self, config: dict[str, Any], random_state: int = 42) -> BaseEstimator:
        solver = config.get("solver", "svd")
        shrinkage = config.get("shrinkage", None)

        if solver == "svd":
            shrinkage = None
        elif solver in ["lsqr", "eigen"] and shrinkage is None:
            shrinkage = "auto"

        return LinearDiscriminantAnalysis(
            solver=solver,
            shrinkage=shrinkage,
        )

    def get_default_param_grid(self) -> dict[str, list[Any]]:
        return {
            "solver": ["svd", "lsqr"],
        }


class LinearSVMModelAdapter(ModelAdapter):
    @property
    def family(self) -> ModelFamily:
        return ModelFamily.SVM_LINEAR

    def build_estimator(self, config: dict[str, Any], random_state: int = 42) -> BaseEstimator:
        c_param = float(config.get("c_param", config.get("C", 1.0)))
        return SVC(
            kernel="linear",
            C=c_param,
            probability=True,
            random_state=random_state,
        )

    def get_default_param_grid(self) -> dict[str, list[Any]]:
        return {
            "c_param": [0.01, 0.1, 1.0, 10.0],
        }


class RBFSVMModelAdapter(ModelAdapter):
    @property
    def family(self) -> ModelFamily:
        return ModelFamily.SVM_RBF

    def build_estimator(self, config: dict[str, Any], random_state: int = 42) -> BaseEstimator:
        c_param = float(config.get("c_param", config.get("C", 1.0)))
        gamma = config.get("gamma", "scale")
        return SVC(
            kernel="rbf",
            C=c_param,
            gamma=gamma,
            probability=True,
            random_state=random_state,
        )

    def get_default_param_grid(self) -> dict[str, list[Any]]:
        return {
            "c_param": [0.1, 1.0, 10.0],
            "gamma": ["scale", "auto"],
        }


class LogisticRegressionModelAdapter(ModelAdapter):
    @property
    def family(self) -> ModelFamily:
        return ModelFamily.LOGISTIC_REGRESSION

    def build_estimator(self, config: dict[str, Any], random_state: int = 42) -> BaseEstimator:
        c_param = float(config.get("c_param", config.get("C", 1.0)))
        penalty = config.get("penalty", "l2")
        return LogisticRegression(
            C=c_param,
            penalty=penalty,
            solver="lbfgs",
            max_iter=1000,
            random_state=random_state,
        )

    def get_default_param_grid(self) -> dict[str, list[Any]]:
        return {
            "c_param": [0.01, 0.1, 1.0, 10.0],
        }


class RandomForestModelAdapter(ModelAdapter):
    @property
    def family(self) -> ModelFamily:
        return ModelFamily.RANDOM_FOREST

    def build_estimator(self, config: dict[str, Any], random_state: int = 42) -> BaseEstimator:
        n_estimators = int(config.get("n_estimators", 50))
        max_depth = config.get("max_depth", 5)
        if max_depth is not None:
            max_depth = int(max_depth)
        return RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=random_state,
        )

    def get_default_param_grid(self) -> dict[str, list[Any]]:
        return {
            "n_estimators": [25, 50, 100],
            "max_depth": [3, 5, 8],
        }


_ADAPTER_REGISTRY: dict[ModelFamily, ModelAdapter] = {
    ModelFamily.DUMMY: DummyModelAdapter(),
    ModelFamily.LDA: LDAModelAdapter(),
    ModelFamily.SVM_LINEAR: LinearSVMModelAdapter(),
    ModelFamily.SVM_RBF: RBFSVMModelAdapter(),
    ModelFamily.LOGISTIC_REGRESSION: LogisticRegressionModelAdapter(),
    ModelFamily.RANDOM_FOREST: RandomForestModelAdapter(),
}


def get_model_adapter(family: ModelFamily) -> ModelAdapter:
    """Retrieve the registered ModelAdapter for a given ModelFamily."""
    if family not in _ADAPTER_REGISTRY:
        raise ValueError(f"Unsupported model family: {family}")
    return _ADAPTER_REGISTRY[family]
