"""High-Level Calibration & Subject-Specific Adaptation Service Facade (Phase 13)."""

import hashlib
import logging
from datetime import UTC, datetime

import numpy as np

from ..epoching.models import NormalizedLabel
from .models import (
    CalibrationHistoryItem,
    CalibrationProfile,
    CalibrationProfileState,
    CalibrationQCStatus,
    CalibrationReport,
    CalibrationSession,
    CalibrationSessionStatus,
    CalibrationTrial,
    CalibrationTrialStatus,
    CreateSubjectProfileRequest,
    PersonalizationConfig,
    PersonalizedExperimentResult,
    PersonalizedModel,
    StartCalibrationSessionRequest,
    SubjectProfile,
    SubjectProfileStatus,
)
from .personalizer import PersonalizationEngine
from .protocol import CalibrationProtocolEngine
from .qc import CalibrationQCEngine
from .session_runner import CalibrationSessionRunner
from .storage import CalibrationStorage

logger = logging.getLogger("neuromove.calibration")


class CalibrationService:
    """Orchestrates calibration lifecycle, trial sequencing, QC, and subject adaptation."""

    def __init__(self, storage: CalibrationStorage | None = None) -> None:
        self.storage = storage or CalibrationStorage()
        self._active_runners: dict[str, CalibrationSessionRunner] = {}

    # 1. Subject Profiles
    def create_subject_profile(self, request: CreateSubjectProfileRequest) -> SubjectProfile:
        """Create or register a pseudonymous subject profile."""
        now_iso = datetime.now(UTC).isoformat()
        profile_id = f"prof_{request.subject_id}_{hashlib.sha256(request.subject_id.encode()).hexdigest()[:8]}"

        profile = SubjectProfile(
            subject_id=request.subject_id,
            profile_id=profile_id,
            profile_version="SUBJECT_PROFILE_V1",
            status=SubjectProfileStatus.ACTIVE,
            preferred_hand=request.preferred_hand,
            display_name=request.display_name or f"Participant {request.subject_id}",
            notes=request.notes,
            created_at=now_iso,
            updated_at=now_iso,
        )
        self.storage.save_subject_profile(profile)

        # Ensure default calibration profile exists
        cal_prof = CalibrationProfile(
            profile_id=f"calprof_{profile_id}",
            subject_id=profile.subject_id,
            profile_version="CALIBRATION_PROFILE_V1",
            state=CalibrationProfileState.NOT_CALIBRATED,
            preferred_task="LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
            target_classes=[NormalizedLabel.LEFT_IMAGERY, NormalizedLabel.RIGHT_IMAGERY],
            channel_set=["C3", "Cz", "C4"],
            created_at=now_iso,
            updated_at=now_iso,
        )
        self.storage.save_calibration_profile(cal_prof)

        logger.info("Created subject profile '%s' (ID: %s)", profile.subject_id, profile.profile_id)
        return profile

    def get_subject_profile(self, subject_id: str) -> SubjectProfile | None:
        """Retrieve subject profile."""
        return self.storage.get_subject_profile(subject_id)

    def list_subject_profiles(self) -> list[SubjectProfile]:
        """List all registered subject profiles."""
        profiles = self.storage.list_subject_profiles()
        if not profiles:
            # Seed default demo profiles if empty
            p1 = self.create_subject_profile(
                CreateSubjectProfileRequest(
                    subject_id="sub-001", preferred_hand="RIGHT", display_name="Subject 001"
                )
            )
            p2 = self.create_subject_profile(
                CreateSubjectProfileRequest(
                    subject_id="sub-002", preferred_hand="LEFT", display_name="Subject 002"
                )
            )
            return [p1, p2]
        return profiles

    # 2. Calibration Sessions
    def start_session(
        self, request: StartCalibrationSessionRequest
    ) -> tuple[CalibrationSession, list[CalibrationTrial]]:
        """Initialize and arm a calibration session with deterministic trial schedule."""
        now_iso = datetime.now(UTC).isoformat()
        protocol = request.protocol or CalibrationProtocolEngine.get_default_protocol()

        # Compute next session number
        history = self.storage.get_subject_history(request.subject_id)
        session_num = len(history) + 1

        cal_id_raw = f"cal_{request.subject_id}_s{session_num}_{protocol.timing_hash}"
        calibration_id = f"cal_{hashlib.sha256(cal_id_raw.encode()).hexdigest()[:16]}"

        trials = CalibrationProtocolEngine.generate_trial_sequence(calibration_id, protocol)

        session = CalibrationSession(
            calibration_id=calibration_id,
            profile_id=request.profile_id,
            subject_id=request.subject_id,
            session_number=session_num,
            protocol_version=protocol.protocol_version,
            task_id="LEFT_VS_RIGHT_MOTOR_IMAGERY_V1",
            source_mode=request.source_mode,
            status=CalibrationSessionStatus.PLANNED,
            started_at=None,
            completed_at=None,
            trial_count=len(trials),
            valid_trial_count=0,
            rejected_trial_count=0,
            class_distribution={},
            quality_summary=None,
            pause_intervals=[],
            active_trial_index=0,
            config_hash=protocol.timing_hash,
            created_at=now_iso,
        )

        runner = CalibrationSessionRunner(session, protocol, trials)
        runner.start()
        self._active_runners[calibration_id] = runner

        self.storage.save_calibration_session(session, trials)
        return session, trials

    def pause_session(
        self, calibration_id: str, reason: str = "User requested pause"
    ) -> CalibrationSession:
        """Pause session progression."""
        runner = self._get_or_restore_runner(calibration_id)
        session = runner.pause(reason)
        self.storage.save_calibration_session(session, runner.trials)
        return session

    def resume_session(self, calibration_id: str) -> CalibrationSession:
        """Resume session progression."""
        runner = self._get_or_restore_runner(calibration_id)
        session = runner.resume()
        self.storage.save_calibration_session(session, runner.trials)
        return session

    def abort_session(
        self, calibration_id: str, reason: str = "Operator aborted calibration"
    ) -> CalibrationSession:
        """Abort session and preserve completed/rejected trials."""
        runner = self._get_or_restore_runner(calibration_id)
        session = runner.abort(reason)
        self.storage.save_calibration_session(session, runner.trials)
        return session

    def advance_simulation(
        self, calibration_id: str, qc_override: CalibrationQCStatus | None = None
    ) -> CalibrationSession:
        """Step forward one trial in simulation mode."""
        runner = self._get_or_restore_runner(calibration_id)
        session = runner.advance_simulation_step(qc_override)
        self.storage.save_calibration_session(session, runner.trials)
        return session

    def get_session(self, calibration_id: str) -> CalibrationSession | None:
        """Fetch session metadata."""
        if calibration_id in self._active_runners:
            return self._active_runners[calibration_id].session
        return self.storage.get_calibration_session(calibration_id)

    def get_trials(self, calibration_id: str) -> list[CalibrationTrial]:
        """Fetch trials for a session."""
        if calibration_id in self._active_runners:
            return self._active_runners[calibration_id].trials
        return self.storage.get_calibration_trials(calibration_id)

    # 3. Personalization Execution
    def run_personalization(
        self,
        config: PersonalizationConfig,
        epochs_data: np.ndarray | None = None,
        labels: list[str] | None = None,
    ) -> PersonalizedExperimentResult:
        """Run subject personalization with train/held-out split and generic benchmarking."""
        session = self.get_session(config.calibration_id)
        if not session:
            raise ValueError(f"Calibration session '{config.calibration_id}' not found.")

        trials = self.get_trials(config.calibration_id)
        valid_trials = [
            t
            for t in trials
            if t.quality_status != CalibrationQCStatus.REJECT
            and t.status == CalibrationTrialStatus.COMPLETED
        ]

        if len(valid_trials) < 4:
            raise ValueError(
                f"Insufficient valid calibration trials ({len(valid_trials)}) to personalize model (minimum 4)."
            )

        # If synthetic epochs not provided, generate realistic motor-imagery signals for each trial
        if epochs_data is None or labels is None:
            epochs_data, labels = self._generate_synthetic_trial_epochs(
                valid_trials, config.random_state
            )

        trial_ids = [t.trial_id for t in valid_trials]
        channel_names = ["C3", "Cz", "C4"]

        # Run Personalization Engine
        exp_result, model_artifact, pipeline = PersonalizationEngine.run_personalization(
            config=config,
            epochs_data=epochs_data,
            labels=labels,
            trial_ids=trial_ids,
            channel_names=channel_names,
            sampling_rate_hz=250.0,
        )

        # Persist model artifact and experiment record
        self.storage.save_personalized_model(exp_result, model_artifact, pipeline)

        # Update calibration profile state
        cal_prof = self.storage.get_calibration_profile(f"calprof_{config.profile_id}")
        if cal_prof:
            cal_prof.state = CalibrationProfileState.READY
            cal_prof.last_calibration_id = config.calibration_id
            self.storage.save_calibration_profile(cal_prof)

        logger.info(
            "Completed personalization '%s' for subject '%s': Held-Out Balanced Acc = %.2f%% (Delta = %+.2f%%)",
            model_artifact.model_id,
            config.subject_id,
            exp_result.heldout_metrics["balanced_accuracy"] * 100,
            (exp_result.comparison_with_generic.delta_balanced_accuracy * 100)
            if exp_result.comparison_with_generic
            else 0.0,
        )
        return exp_result

    def get_personalized_model(self, model_id: str) -> PersonalizedModel | None:
        """Retrieve personalized model artifact metadata."""
        return self.storage.get_personalized_model(model_id)

    def get_subject_history(self, subject_id: str) -> list[CalibrationHistoryItem]:
        """Fetch subject calibration history."""
        return self.storage.get_subject_history(subject_id)

    # 4. Reports & Manifests
    def generate_calibration_report(self, calibration_id: str) -> CalibrationReport:
        """Compile comprehensive calibration report and audit manifest."""
        session = self.get_session(calibration_id)
        if not session:
            raise ValueError(f"Session '{calibration_id}' not found.")

        trials = self.get_trials(calibration_id)
        qc_summary = session.quality_summary or CalibrationQCEngine.summarize_session_quality(
            trials
        )

        now_iso = datetime.now(UTC).isoformat()
        report_id = (
            f"rpt_{calibration_id}_{hashlib.sha256(calibration_id.encode()).hexdigest()[:8]}"
        )

        report = CalibrationReport(
            report_id=report_id,
            calibration_id=calibration_id,
            subject_id=session.subject_id,
            profile_id=session.profile_id,
            protocol_summary={
                "protocol_version": session.protocol_version,
                "task_id": session.task_id,
                "config_hash": session.config_hash,
            },
            source_mode=session.source_mode,
            quality_summary=qc_summary,
            split_summary={
                "train_trials": int(np.floor(qc_summary.valid_trials * 0.6)),
                "heldout_trials": int(
                    qc_summary.valid_trials - np.floor(qc_summary.valid_trials * 0.6)
                ),
                "strategy": "TEMPORAL_BLOCK_SPLIT",
            },
            personalized_model_summary=None,
            generic_comparison=None,
            known_limitations=[
                "Personalized model evaluated on held-out calibration trials; not certified for clinical diagnostic use.",
                "Motor-imagery sensorimotor rhythms may exhibit inter-session drift.",
            ],
            provenance_chain={
                "subject_id": session.subject_id,
                "session_number": session.session_number,
                "trial_count": len(trials),
                "timestamp": now_iso,
            },
            created_at=now_iso,
        )
        return report

    def _get_or_restore_runner(self, calibration_id: str) -> CalibrationSessionRunner:
        """Retrieve active in-memory runner or recover state from SQLite."""
        if calibration_id in self._active_runners:
            return self._active_runners[calibration_id]

        session = self.storage.get_calibration_session(calibration_id)
        if not session:
            raise ValueError(f"Calibration session '{calibration_id}' does not exist.")

        trials = self.storage.get_calibration_trials(calibration_id)
        protocol = CalibrationProtocolEngine.get_default_protocol()
        runner = CalibrationSessionRunner(session, protocol, trials)
        self._active_runners[calibration_id] = runner
        return runner

    @staticmethod
    def _generate_synthetic_trial_epochs(
        trials: list[CalibrationTrial],
        random_state: int = 42,
    ) -> tuple[np.ndarray, list[str]]:
        """Generate realistic synthetic sensorimotor mu/beta ERD oscillations for trials."""
        rng = np.random.default_rng(random_state)
        n_trials = len(trials)
        n_channels = 3  # C3, Cz, C4
        n_times = 1000  # 4 seconds at 250 Hz

        t = np.linspace(0, 4.0, n_times)
        epochs = np.zeros((n_trials, n_channels, n_times))
        labels = [t_item.target_label.value for t_item in trials]

        for i, t_item in enumerate(trials):
            # Baseline pink noise + 10 Hz mu rhythm
            noise = rng.normal(0, 5.0, (n_channels, n_times))
            mu = 15.0 * np.sin(2 * np.pi * 10.0 * t)

            if t_item.target_label == NormalizedLabel.LEFT_IMAGERY:
                # Left imagery -> Contralateral right hemisphere ERD (C4 mu suppressed, C3 mu elevated)
                epochs[i, 0, :] = 1.4 * mu + noise[0]  # C3
                epochs[i, 1, :] = mu + noise[1]  # Cz
                epochs[i, 2, :] = 0.5 * mu + noise[2]  # C4
            else:
                # Right imagery -> Contralateral left hemisphere ERD (C3 mu suppressed, C4 mu elevated)
                epochs[i, 0, :] = 0.5 * mu + noise[0]  # C3
                epochs[i, 1, :] = mu + noise[1]  # Cz
                epochs[i, 2, :] = 1.4 * mu + noise[2]  # C4

        return epochs, labels


_calibration_service: CalibrationService | None = None


def get_calibration_service() -> CalibrationService:
    """Singleton accessor for CalibrationService."""
    global _calibration_service
    if _calibration_service is None:
        _calibration_service = CalibrationService()
    return _calibration_service
