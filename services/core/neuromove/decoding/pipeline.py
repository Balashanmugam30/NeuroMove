"""Pipeline factory for combining CSP spatial filtering with classical classifiers."""

from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.dummy import DummyClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from .csp import build_csp_transformer
from .models import ClassifierConfig, ClassifierType, DecoderPipelineConfig


def build_classifier(config: ClassifierConfig):
    """Instantiate a classical classifier estimator."""
    match config.classifier_type:
        case ClassifierType.LDA:
            solver = config.solver
            shrinkage = config.shrinkage
            # svd does not support shrinkage in scikit-learn
            if solver == "svd" and shrinkage is not None:
                shrinkage = None

            if shrinkage is not None and isinstance(shrinkage, str):
                if shrinkage.lower() == "auto":
                    shrinkage = "auto"
                else:
                    try:
                        shrinkage = float(shrinkage)
                    except ValueError:
                        shrinkage = None

            return LinearDiscriminantAnalysis(
                solver=solver,
                shrinkage=shrinkage,
            )

        case ClassifierType.SVM_LINEAR:
            return SVC(
                kernel="linear",
                C=config.c_param,
                random_state=config.random_state,
            )

        case ClassifierType.SVM_RBF:
            return SVC(
                kernel="rbf",
                C=config.c_param,
                gamma=config.gamma,
                random_state=config.random_state,
            )

        case ClassifierType.DUMMY:
            return DummyClassifier(
                strategy=config.dummy_strategy,
                random_state=config.random_state,
            )

        case _:
            raise ValueError(f"Unsupported classifier type: {config.classifier_type}")


def build_decoding_pipeline(
    pipeline_config: DecoderPipelineConfig,
    n_channels: int,
) -> Pipeline:
    """Construct an end-to-end scikit-learn decoding pipeline.

    Guarantees that CSP spatial decomposition and feature scaling are fitted
    strictly within the pipeline steps during cross-validation folds.

    Args:
        pipeline_config: Pipeline hyperparameters and configurations.
        n_channels: Number of spatial channels.

    Returns:
        Configured sklearn.pipeline.Pipeline instance.
    """
    steps = [
        ("csp", build_csp_transformer(pipeline_config.csp_config, n_channels)),
    ]

    if pipeline_config.scale_features:
        steps.append(("scaler", StandardScaler()))

    steps.append(("classifier", build_classifier(pipeline_config.classifier_config)))

    return Pipeline(steps=steps)
