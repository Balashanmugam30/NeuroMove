"""SQLite Storage and Audit Persistence for Phase 18 Resilience Laboratory.

Provides thread-safe transactional persistence for experiment manifests,
fault lifecycles, invariant verification reports, recovery checkpoints,
and operational reliability metrics.
"""

from __future__ import annotations

import json
import logging
import sqlite3

from neuromove.database.connection import default_db_manager
from neuromove.resilience.models import (
    FaultDefinition,
    FaultExperiment,
    FaultExperimentManifest,
    FaultParameters,
    InvariantResult,
    PipelineHealthSnapshot,
    RecoveryCheckpoint,
    ResilienceMetrics,
)

logger = logging.getLogger(__name__)


class ResilienceStorage:
    """Persistence repository for Phase 18 resilience entities."""

    def __init__(self, db_manager=None) -> None:
        self.db = db_manager or default_db_manager

    def save_experiment(self, exp: FaultExperiment) -> None:
        """Persist or update a completed or running experiment record."""
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path, timeout=5.0) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO resilience_experiments (
                    experiment_id, scenario_id, name, seed, status,
                    manifest_json, baseline_snapshot_json, final_snapshot_json,
                    invariants_json, recovery_status, data_loss_status,
                    authorization_before_failure, authorization_during_failure,
                    authorization_after_failure, steps_audit_json,
                    replay_hash, artifact_checksum, started_at, ended_at, duration_ms
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    exp.experiment_id,
                    exp.scenario_id,
                    exp.name,
                    exp.seed,
                    exp.status,
                    exp.manifest.model_dump_json(),
                    exp.baseline_snapshot.model_dump_json(),
                    exp.final_snapshot.model_dump_json(),
                    json.dumps([inv.model_dump() for inv in exp.invariants]),
                    exp.recovery_status.value,
                    exp.data_loss_status.value,
                    1 if exp.authorization_before_failure else 0,
                    1 if exp.authorization_during_failure else 0,
                    1 if exp.authorization_after_failure else 0,
                    json.dumps(exp.steps_audit),
                    exp.replay_hash,
                    exp.artifact_checksum,
                    exp.started_at,
                    exp.ended_at,
                    exp.duration_ms,
                ),
            )
            conn.commit()

    def get_experiment(self, experiment_id: str) -> FaultExperiment | None:
        """Fetch full experiment by identifier."""
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path, timeout=5.0) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT experiment_id, scenario_id, name, seed, status,
                       manifest_json, baseline_snapshot_json, final_snapshot_json,
                       invariants_json, recovery_status, data_loss_status,
                       authorization_before_failure, authorization_during_failure,
                       authorization_after_failure, steps_audit_json,
                       replay_hash, artifact_checksum, started_at, ended_at, duration_ms
                FROM resilience_experiments WHERE experiment_id = ?;
                """,
                (experiment_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None

            manifest = FaultExperimentManifest(**json.loads(row[5]))
            baseline = PipelineHealthSnapshot(**json.loads(row[6]))
            final_snap = PipelineHealthSnapshot(**json.loads(row[7]))
            invariants = [InvariantResult(**inv) for inv in json.loads(row[8])]
            steps = json.loads(row[14])

            return FaultExperiment(
                experiment_id=row[0],
                scenario_id=row[1],
                name=row[2],
                seed=row[3],
                status=row[4],
                manifest=manifest,
                baseline_snapshot=baseline,
                final_snapshot=final_snap,
                invariants=invariants,
                recovery_status=row[9],
                data_loss_status=row[10],
                authorization_before_failure=bool(row[11]),
                authorization_during_failure=bool(row[12]),
                authorization_after_failure=bool(row[13]),
                steps_audit=steps,
                replay_hash=row[15],
                artifact_checksum=row[16],
                started_at=row[17],
                ended_at=row[18],
                duration_ms=row[19],
            )

    def list_experiments(self, limit: int = 50) -> list[FaultExperiment]:
        """List historical experiments in reverse chronological order."""
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path, timeout=5.0) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT experiment_id, scenario_id, name, seed, status,
                       manifest_json, baseline_snapshot_json, final_snapshot_json,
                       invariants_json, recovery_status, data_loss_status,
                       authorization_before_failure, authorization_during_failure,
                       authorization_after_failure, steps_audit_json,
                       replay_hash, artifact_checksum, started_at, ended_at, duration_ms
                FROM resilience_experiments ORDER BY started_at DESC LIMIT ?;
                """,
                (limit,),
            )
            rows = cursor.fetchall()
            results: list[FaultExperiment] = []
            for row in rows:
                manifest = FaultExperimentManifest(**json.loads(row[5]))
                baseline = PipelineHealthSnapshot(**json.loads(row[6]))
                final_snap = PipelineHealthSnapshot(**json.loads(row[7]))
                invariants = [InvariantResult(**inv) for inv in json.loads(row[8])]
                steps = json.loads(row[14])

                results.append(
                    FaultExperiment(
                        experiment_id=row[0],
                        scenario_id=row[1],
                        name=row[2],
                        seed=row[3],
                        status=row[4],
                        manifest=manifest,
                        baseline_snapshot=baseline,
                        final_snapshot=final_snap,
                        invariants=invariants,
                        recovery_status=row[9],
                        data_loss_status=row[10],
                        authorization_before_failure=bool(row[11]),
                        authorization_during_failure=bool(row[12]),
                        authorization_after_failure=bool(row[13]),
                        steps_audit=steps,
                        replay_hash=row[15],
                        artifact_checksum=row[16],
                        started_at=row[17],
                        ended_at=row[18],
                        duration_ms=row[19],
                    )
                )
            return results

    def save_fault(self, fault: FaultDefinition, experiment_id: str | None = None) -> None:
        """Persist or update a fault record."""
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path, timeout=5.0) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO resilience_faults (
                    fault_id, experiment_id, fault_type, category, severity,
                    scope, status, target_service, target_stream, target_session,
                    trigger_type, trigger_value, parameters_json, created_at,
                    armed_at, activated_at, cleared_at, description
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    fault.fault_id,
                    experiment_id,
                    fault.fault_type.value,
                    fault.category.value,
                    fault.severity.value,
                    fault.scope.value,
                    fault.status.value,
                    fault.target_service,
                    fault.target_stream,
                    fault.target_session,
                    fault.trigger_type.value,
                    fault.trigger_value,
                    fault.parameters.model_dump_json(),
                    fault.created_at,
                    fault.armed_at,
                    fault.activated_at,
                    fault.cleared_at,
                    fault.description,
                ),
            )
            conn.commit()

    def get_fault(self, fault_id: str) -> FaultDefinition | None:
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path, timeout=5.0) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT fault_id, fault_type, category, severity, scope, status,
                       target_service, target_stream, target_session, trigger_type,
                       trigger_value, parameters_json, created_at, armed_at,
                       activated_at, cleared_at, description
                FROM resilience_faults WHERE fault_id = ?;
                """,
                (fault_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None

            return FaultDefinition(
                fault_id=row[0],
                fault_type=row[1],
                category=row[2],
                severity=row[3],
                scope=row[4],
                status=row[5],
                target_service=row[6],
                target_stream=row[7],
                target_session=row[8],
                trigger_type=row[9],
                trigger_value=row[10],
                parameters=FaultParameters(**json.loads(row[11])),
                created_at=row[12],
                armed_at=row[13],
                activated_at=row[14],
                cleared_at=row[15],
                description=row[16],
            )

    def save_checkpoint(self, checkpoint: RecoveryCheckpoint) -> None:
        """Persist a recovery checkpoint."""
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path, timeout=5.0) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO resilience_recovery_checkpoints (
                    checkpoint_id, experiment_id, component, last_known_safe_state,
                    sequence_number, snapshot_version, checksum, timestamp, details_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    checkpoint.checkpoint_id,
                    checkpoint.experiment_id,
                    checkpoint.component,
                    checkpoint.last_known_safe_state,
                    checkpoint.sequence_number,
                    checkpoint.snapshot_version,
                    checkpoint.checksum,
                    checkpoint.timestamp,
                    json.dumps(checkpoint.details),
                ),
            )
            conn.commit()

    def list_checkpoints(self, experiment_id: str | None = None, limit: int = 50) -> list[RecoveryCheckpoint]:
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path, timeout=5.0) as conn:
            cursor = conn.cursor()
            if experiment_id:
                cursor.execute(
                    """
                    SELECT checkpoint_id, experiment_id, component, last_known_safe_state,
                           sequence_number, snapshot_version, checksum, timestamp, details_json
                    FROM resilience_recovery_checkpoints WHERE experiment_id = ?
                    ORDER BY timestamp DESC LIMIT ?;
                    """,
                    (experiment_id, limit),
                )
            else:
                cursor.execute(
                    """
                    SELECT checkpoint_id, experiment_id, component, last_known_safe_state,
                           sequence_number, snapshot_version, checksum, timestamp, details_json
                    FROM resilience_recovery_checkpoints ORDER BY timestamp DESC LIMIT ?;
                    """,
                    (limit,),
                )
            rows = cursor.fetchall()
            return [
                RecoveryCheckpoint(
                    checkpoint_id=r[0],
                    experiment_id=r[1],
                    component=r[2],
                    last_known_safe_state=r[3],
                    sequence_number=r[4],
                    snapshot_version=r[5],
                    checksum=r[6],
                    timestamp=r[7],
                    details=json.loads(r[8] or "{}"),
                )
                for r in rows
            ]

    def get_metrics(self) -> ResilienceMetrics:
        """Compute aggregated operational resilience metrics."""
        db_path = self.db.get_db_path()
        with sqlite3.connect(db_path, timeout=5.0) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT status, COUNT(*) FROM resilience_experiments GROUP BY status;")
            status_counts = dict(cursor.fetchall())

            total = sum(status_counts.values())
            passed = status_counts.get("PASSED", 0)
            failed = status_counts.get("FAILED", 0)
            uncertain = status_counts.get("UNCERTAIN", 0)

            cursor.execute("SELECT COUNT(*) FROM resilience_invariant_results WHERE status = 'PASS';")
            inv_passed = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM resilience_invariant_results WHERE status = 'FAIL';")
            inv_failed = cursor.fetchone()[0]

            cursor.execute(
                """
                SELECT COUNT(*) FROM resilience_experiments
                WHERE authorization_during_failure = 1 OR (status = 'FAILED' AND authorization_after_failure = 1);
                """
            )
            accidental_auth = cursor.fetchone()[0]

            return ResilienceMetrics(
                total_experiments=total,
                passed_experiments=passed,
                failed_experiments=failed,
                uncertain_experiments=uncertain,
                total_invariants_checked=inv_passed + inv_failed,
                invariants_passed=inv_passed,
                invariants_failed=inv_failed,
                accidental_authorizations=accidental_auth,
                fail_closed_certifications=passed,
                replays_executed=0,
                replays_matched=0,
                active_faults_count=0,
            )
