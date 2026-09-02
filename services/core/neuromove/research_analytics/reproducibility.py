"""NeuroMove — Phase 22 Reproducibility Audit Engine."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from neuromove.research_analytics.models import (
    ReproducibilityResult,
    ReproducibilityStatus,
    ResearchExperiment,
)

logger = logging.getLogger(__name__)


class ReproducibilityChecker:
    """Verifies byte-for-byte and numerical reproducibility between baseline and reproduced experiment runs."""

    @classmethod
    def audit(
        cls,
        baseline: ResearchExperiment,
        reproduced: ResearchExperiment,
        abs_tol: float = 1e-4,
    ) -> ReproducibilityResult:
        """Execute a comprehensive reproducibility verification audit."""
        audit_id = f"aud_{uuid.uuid4().hex[:10]}"

        # Check 1: Source session checksum match
        b_sources = baseline.manifest.source_checksums
        r_sources = reproduced.manifest.source_checksums
        source_match = (b_sources == r_sources)
        tamper = not source_match

        # Check 2: Manifest configuration hash match
        manifest_match = (baseline.manifest.manifest_hash == reproduced.manifest.manifest_hash)

        # Check 3: Stage results checksums match
        b_stage_hashes = [s.stage_checksum for s in baseline.stages if s.stage_checksum]
        r_stage_hashes = [s.stage_checksum for s in reproduced.stages if s.stage_checksum]
        stage_match = (b_stage_hashes == r_stage_hashes) if (b_stage_hashes and r_stage_hashes) else True

        # Check 4: Metric values deviation check
        deviations: dict[str, float] = {}
        max_dev = 0.0

        if baseline.metrics and reproduced.metrics:
            if baseline.metrics.accuracy is not None and reproduced.metrics.accuracy is not None:
                acc_dev = abs(baseline.metrics.accuracy - reproduced.metrics.accuracy)
                deviations["accuracy_dev"] = round(acc_dev, 6)
                max_dev = max(max_dev, acc_dev)

            if baseline.metrics.f1_macro is not None and reproduced.metrics.f1_macro is not None:
                f1_dev = abs(baseline.metrics.f1_macro - reproduced.metrics.f1_macro)
                deviations["f1_macro_dev"] = round(f1_dev, 6)
                max_dev = max(max_dev, f1_dev)

        metrics_match = max_dev <= abs_tol

        # Check 5: Result hash match
        b_res_hash = baseline.result_hash or ""
        r_res_hash = reproduced.result_hash or ""
        result_match = (b_res_hash == r_res_hash) if (b_res_hash and r_res_hash) else metrics_match

        # Overall Status Determination
        if tamper:
            status = ReproducibilityStatus.FAIL
            explanation = "Reproducibility FAILED: Source dataset/session checksum mismatch detected (tamper/corruption)."
        elif not manifest_match:
            status = ReproducibilityStatus.FAIL
            explanation = "Reproducibility FAILED: Manifest configuration parameters changed without child provenance."
        elif max_dev > abs_tol:
            status = ReproducibilityStatus.FAIL
            explanation = f"Reproducibility FAILED: Metric deviation ({max_dev:.6f}) exceeds numerical tolerance ({abs_tol:.6f})."
        elif source_match and manifest_match and stage_match and (b_res_hash == r_res_hash and b_res_hash != ""):
            status = ReproducibilityStatus.PASS
            explanation = "Reproducibility PASSED: Exact byte-for-byte deterministic hash match across all stages."
        elif metrics_match:
            status = ReproducibilityStatus.APPROXIMATE
            explanation = f"Reproducibility APPROXIMATE: All metrics match within numerical tolerance ({abs_tol:.6f})."
        else:
            status = ReproducibilityStatus.FAIL
            explanation = "Reproducibility FAILED: Unexplained deviation in stage hashes or metrics."

        return ReproducibilityResult(
            audit_id=audit_id,
            baseline_experiment_id=baseline.experiment_id,
            reproduced_experiment_id=reproduced.experiment_id,
            status=status,
            source_hash_match=source_match,
            manifest_hash_match=manifest_match,
            stage_hashes_match=stage_match,
            metrics_match=metrics_match,
            result_hash_match=result_match,
            max_metric_deviation=round(max_dev, 6),
            deviations=deviations,
            tamper_detected=tamper,
            explanation=explanation,
            audited_at=datetime.now(UTC).isoformat(),
        )
