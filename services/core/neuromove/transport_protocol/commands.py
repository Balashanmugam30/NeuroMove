"""Upstream Phase 17 Authorization validation and Command construction."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from neuromove.domain.enums import SafetyDecision
from neuromove.transport_protocol.models import (
    CommandEnvelope,
    CommandPayload,
    ExecutionAuthorization,
    MessageType,
)
from neuromove.transport_protocol.protocol import PROTOCOL_VERSION


class CommandRejectionError(Exception):
    """Exception raised when an execution command is rejected at the authorization boundary."""

    def __init__(self, reason_code: str, message: str) -> None:
        super().__init__(message)
        self.reason_code = reason_code
        self.message = message


def validate_authorization(
    auth: ExecutionAuthorization,
    current_time: datetime | None = None,
) -> tuple[bool, str, str]:
    """Validate Phase 17 ExecutionAuthorization.

    Returns:
        (is_valid, reason_code, message)
    """
    now = current_time or datetime.now(UTC)

    # 1. Decision must be strictly AUTHORIZED
    if auth.decision != SafetyDecision.AUTHORIZED:
        return (
            False,
            "UNAUTHORIZED_DECISION",
            f"Cannot create command for non-authorized decision: {auth.decision.value}",
        )

    # 2. Required provenance fields cannot be empty or missing
    if not auth.authorization_id or not auth.authorization_id.strip():
        return False, "MISSING_AUTHORIZATION_ID", "Authorization ID is required"

    if not auth.intent_id or not auth.intent_id.strip():
        return False, "MISSING_INTENT_ID", "Intent ID is required"

    if not auth.intent_class or not auth.intent_class.strip():
        return False, "MISSING_INTENT_CLASS", "Intent class is required"

    if not auth.subject_id or not auth.subject_id.strip():
        return False, "MISSING_SUBJECT_ID", "Subject provenance is required"

    if not auth.session_id or not auth.session_id.strip():
        return False, "MISSING_SESSION_ID", "Session provenance is required"

    if not auth.model_version_id or not auth.model_version_id.strip():
        return False, "MISSING_MODEL_VERSION", "Model version provenance is required"

    if not auth.policy_version or not auth.policy_version.strip():
        return False, "MISSING_POLICY_VERSION", "Policy version provenance is required"

    # 3. Expiration boundary validation
    try:
        expires_dt = datetime.fromisoformat(auth.expires_at)
        if expires_dt.tzinfo is None:
            expires_dt = expires_dt.replace(tzinfo=UTC)
    except Exception as exc:
        return False, "MALFORMED_EXPIRY_TIMESTAMP", f"Cannot parse expires_at timestamp: {exc}"

    if now >= expires_dt:
        return (
            False,
            "AUTHORIZATION_EXPIRED",
            f"Authorization expired at {auth.expires_at} (current time: {now.isoformat()})",
        )

    # 4. Issued at sanity check
    try:
        issued_dt = datetime.fromisoformat(auth.issued_at)
        if issued_dt.tzinfo is None:
            issued_dt = issued_dt.replace(tzinfo=UTC)
        if issued_dt > expires_dt:
            return False, "INVALID_TIMESTAMP_ORDER", "issued_at is after expires_at"
    except Exception as exc:
        return False, "MALFORMED_ISSUED_TIMESTAMP", f"Cannot parse issued_at timestamp: {exc}"

    return True, "AUTHORIZED", "Execution authorization is valid"


def create_command_envelope(
    auth: ExecutionAuthorization,
    device_id: str,
    sequence_number: int,
    command_id: str | None = None,
    parameters: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
    current_time: datetime | None = None,
) -> CommandEnvelope:
    """Create a validated CommandEnvelope from upstream ExecutionAuthorization.

    Raises:
        CommandRejectionError: If authorization is invalid, expired, or unauthorized.
    """
    now = current_time or datetime.now(UTC)
    is_valid, reason_code, message = validate_authorization(auth, current_time=now)
    if not is_valid:
        raise CommandRejectionError(reason_code, message)

    msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    cmd_id = command_id or f"cmd_{uuid.uuid4().hex[:12]}"

    payload = CommandPayload(
        intent_class=auth.intent_class,
        parameters=parameters or {},
        metadata=metadata
        or {"policy_version": auth.policy_version, "evaluation_id": auth.evaluation_id},
    )

    return CommandEnvelope(
        protocol_version=PROTOCOL_VERSION,
        message_type=MessageType.COMMAND,
        message_id=msg_id,
        command_id=cmd_id,
        sequence_number=sequence_number,
        device_id=device_id,
        intent_id=auth.intent_id,
        authorization_id=auth.authorization_id,
        subject_id=auth.subject_id,
        session_id=auth.session_id,
        model_version_id=auth.model_version_id,
        issued_at=auth.issued_at,
        expires_at=auth.expires_at,
        payload=payload,
        flags={"authorized": True, "software_simulation": True},
        checksum="",
    )


def create_stop_command(
    device_id: str,
    sequence_number: int,
    reason: str = "Operator Stop",
    session_id: str | None = None,
    subject_id: str | None = None,
    current_time: datetime | None = None,
) -> CommandEnvelope:
    """Create an abstract software STOP protocol command envelope.

    Note: In Phase 19 this causes software simulation acknowledgement only (no physical braking).
    """
    now = current_time or datetime.now(UTC)
    now_iso = now.isoformat()
    expires_iso = datetime.fromtimestamp(now.timestamp() + 5.0, tz=UTC).isoformat()

    msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    cmd_id = f"cmd_stop_{uuid.uuid4().hex[:8]}"

    payload = CommandPayload(
        intent_class="STOP",
        parameters={"reason": reason},
        metadata={"software_simulation": True, "phase": 19},
    )

    return CommandEnvelope(
        protocol_version=PROTOCOL_VERSION,
        message_type=MessageType.COMMAND,
        message_id=msg_id,
        command_id=cmd_id,
        sequence_number=sequence_number,
        device_id=device_id,
        session_id=session_id or "sess_system",
        subject_id=subject_id or "sub_operator",
        issued_at=now_iso,
        expires_at=expires_iso,
        payload=payload,
        flags={"emergency_stop": True, "software_simulation": True},
        checksum="",
    )


def create_cancel_command(
    device_id: str,
    sequence_number: int,
    target_command_id: str,
    target_intent_id: str,
    session_id: str | None = None,
    subject_id: str | None = None,
    current_time: datetime | None = None,
) -> CommandEnvelope:
    """Create a CANCEL_INTENT command envelope referencing an in-flight command."""
    now = current_time or datetime.now(UTC)
    now_iso = now.isoformat()
    expires_iso = datetime.fromtimestamp(now.timestamp() + 5.0, tz=UTC).isoformat()

    msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    cmd_id = f"cmd_cancel_{uuid.uuid4().hex[:8]}"

    payload = CommandPayload(
        intent_class="CANCEL",
        parameters={"target_command_id": target_command_id, "target_intent_id": target_intent_id},
        metadata={"software_simulation": True},
    )

    return CommandEnvelope(
        protocol_version=PROTOCOL_VERSION,
        message_type=MessageType.COMMAND,
        message_id=msg_id,
        command_id=cmd_id,
        sequence_number=sequence_number,
        device_id=device_id,
        session_id=session_id or "sess_system",
        subject_id=subject_id or "sub_operator",
        issued_at=now_iso,
        expires_at=expires_iso,
        payload=payload,
        flags={"cancel": True, "software_simulation": True},
        checksum="",
    )
