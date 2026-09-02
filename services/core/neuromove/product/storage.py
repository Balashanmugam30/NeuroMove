"""SQLite persistence repository for Product Layer entities."""

from __future__ import annotations

import json
import logging
import sqlite3

from neuromove.database.connection import DatabaseManager, default_db_manager
from neuromove.domain.enums import (
    DemoState,
    ProductDemoScenario,
    ProductExecutionOutcome,
    ProductSessionStatus,
    SafetyDecision,
    SensorSource,
)
from neuromove.product.models import (
    DemoResult,
    DemoRun,
    DemoStep,
    ProductProvenance,
    ProductSession,
)

logger = logging.getLogger(__name__)


class ProductStorage:
    """Repository handling SQLite CRUD operations for product entities."""

    def __init__(self, db_manager: DatabaseManager | None = None) -> None:
        self._db = db_manager or default_db_manager

    def save_product_session(self, session: ProductSession) -> None:
        """Insert or replace a product session."""
        db_path = self._db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO product_sessions (
                    session_id, title, subject_id, source_type, status,
                    acquisition_session_id, sensor_session_id, model_version,
                    confidence_policy, intent_id, safety_decision,
                    hil_session_id, experiment_id, manifest_hash,
                    provenance_hash, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    session.session_id,
                    session.title,
                    session.subject_id,
                    session.source_type.value if hasattr(session.source_type, "value") else str(session.source_type),
                    session.status.value if hasattr(session.status, "value") else str(session.status),
                    session.acquisition_session_id,
                    session.sensor_session_id,
                    session.model_version,
                    session.confidence_policy,
                    session.intent_id,
                    session.safety_decision.value if hasattr(session.safety_decision, "value") else str(session.safety_decision),
                    session.hil_session_id,
                    session.experiment_id,
                    session.manifest_hash,
                    session.provenance_hash,
                    session.created_at,
                    session.updated_at,
                ),
            )
            conn.commit()

    def get_product_session(self, session_id: str) -> ProductSession | None:
        """Fetch a product session by identifier."""
        db_path = self._db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT session_id, title, subject_id, source_type, status,
                       acquisition_session_id, sensor_session_id, model_version,
                       confidence_policy, intent_id, safety_decision,
                       hil_session_id, experiment_id, manifest_hash,
                       provenance_hash, created_at, updated_at
                FROM product_sessions WHERE session_id = ?;
                """,
                (session_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return ProductSession(
                session_id=row[0],
                title=row[1],
                subject_id=row[2],
                source_type=SensorSource(row[3]),
                status=ProductSessionStatus(row[4]),
                acquisition_session_id=row[5],
                sensor_session_id=row[6],
                model_version=row[7],
                confidence_policy=row[8],
                intent_id=row[9],
                safety_decision=SafetyDecision(row[10]),
                hil_session_id=row[11],
                experiment_id=row[12],
                manifest_hash=row[13],
                provenance_hash=row[14],
                created_at=row[15],
                updated_at=row[16],
            )

    def save_demo_run(self, run: DemoRun) -> None:
        """Insert or replace a demo run record."""
        db_path = self._db.get_db_path()
        steps_json = json.dumps([s.model_dump() for s in run.steps])
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO product_demo_runs (
                    run_id, scenario_id, product_session_id, state,
                    current_step, total_steps, source_type, steps_json,
                    candidate_intent, confidence_score, safety_verdict,
                    hil_ack, is_blocked, block_reason, error_message,
                    reproducibility_status, duration_ms, created_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    run.run_id,
                    run.scenario_id.value if hasattr(run.scenario_id, "value") else str(run.scenario_id),
                    run.product_session_id,
                    run.state.value if hasattr(run.state, "value") else str(run.state),
                    run.current_step,
                    run.total_steps,
                    run.source_type.value if hasattr(run.source_type, "value") else str(run.source_type),
                    steps_json,
                    run.candidate_intent,
                    run.confidence_score,
                    run.safety_verdict.value if hasattr(run.safety_verdict, "value") else str(run.safety_verdict),
                    1 if run.hil_ack else 0,
                    1 if run.is_blocked else 0,
                    run.block_reason,
                    run.error_message,
                    run.reproducibility_status,
                    run.duration_ms,
                    run.created_at,
                    run.completed_at,
                ),
            )
            conn.commit()

    def get_demo_run(self, run_id: str) -> DemoRun | None:
        """Retrieve a demo run by id."""
        db_path = self._db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT run_id, scenario_id, product_session_id, state,
                       current_step, total_steps, source_type, steps_json,
                       candidate_intent, confidence_score, safety_verdict,
                       hil_ack, is_blocked, block_reason, error_message,
                       reproducibility_status, duration_ms, created_at, completed_at
                FROM product_demo_runs WHERE run_id = ?;
                """,
                (run_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            steps_data = json.loads(row[7])
            steps = [DemoStep(**s) for s in steps_data]
            return DemoRun(
                run_id=row[0],
                scenario_id=ProductDemoScenario(row[1]),
                product_session_id=row[2],
                state=DemoState(row[3]),
                current_step=row[4],
                total_steps=row[5],
                source_type=SensorSource(row[6]),
                steps=steps,
                candidate_intent=row[8],
                confidence_score=row[9],
                safety_verdict=SafetyDecision(row[10]),
                hil_ack=bool(row[11]),
                is_blocked=bool(row[12]),
                block_reason=row[13],
                error_message=row[14],
                reproducibility_status=row[15],
                duration_ms=row[16],
                created_at=row[17],
                completed_at=row[18],
            )

    def save_demo_result(self, res: DemoResult) -> None:
        """Insert or replace a demo result."""
        db_path = self._db.get_db_path()
        latency_json = json.dumps(res.latency_breakdown)
        prov_json = json.dumps(res.provenance.model_dump() if res.provenance else {})
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO product_demo_results (
                    result_id, run_id, scenario_id, status, source_type,
                    candidate_intent, confidence_score, safety_verdict,
                    hil_status, latency_breakdown_json, provenance_json,
                    explanation_text, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    res.result_id,
                    res.run_id,
                    res.scenario_id.value if hasattr(res.scenario_id, "value") else str(res.scenario_id),
                    res.status.value if hasattr(res.status, "value") else str(res.status),
                    res.source_type.value if hasattr(res.source_type, "value") else str(res.source_type),
                    res.candidate_intent,
                    res.confidence_score,
                    res.safety_verdict.value if hasattr(res.safety_verdict, "value") else str(res.safety_verdict),
                    res.hil_status,
                    latency_json,
                    prov_json,
                    res.explanation_text,
                    res.created_at,
                ),
            )
            conn.commit()

    def get_demo_result_by_run_id(self, run_id: str) -> DemoResult | None:
        """Fetch demo result associated with a specific run."""
        db_path = self._db.get_db_path()
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT result_id, run_id, scenario_id, status, source_type,
                       candidate_intent, confidence_score, safety_verdict,
                       hil_status, latency_breakdown_json, provenance_json,
                       explanation_text, created_at
                FROM product_demo_results WHERE run_id = ?;
                """,
                (run_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            prov_data = json.loads(row[10])
            prov = ProductProvenance(**prov_data) if prov_data else None
            return DemoResult(
                result_id=row[0],
                run_id=row[1],
                scenario_id=ProductDemoScenario(row[2]),
                status=ProductExecutionOutcome(row[3]),
                source_type=SensorSource(row[4]),
                candidate_intent=row[5],
                confidence_score=row[6],
                safety_verdict=SafetyDecision(row[7]),
                hil_status=row[8],
                latency_breakdown=json.loads(row[9]),
                provenance=prov,
                explanation_text=row[11],
                created_at=row[12],
            )
