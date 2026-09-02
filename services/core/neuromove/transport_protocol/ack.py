"""Acknowledgement (ACK/NACK) handling and retry classification."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from neuromove.transport_protocol.models import (
    CommandAck,
    CommandAckStatus,
    CommandNack,
)

NON_RETRYABLE_ERROR_CODES: set[str] = {
    "AUTHORIZATION_EXPIRED",
    "AUTHORIZATION_DENIED",
    "INVALID_PAYLOAD",
    "UNSUPPORTED_COMMAND",
    "CHECKSUM_MISMATCH",
    "SESSION_MISMATCH",
    "SUBJECT_MISMATCH",
    "PROTOCOL_VERSION_MISMATCH",
    "CAPABILITY_UNSUPPORTED",
    "PAYLOAD_TOO_LARGE",
}

RETRYABLE_ERROR_CODES: set[str] = {
    "TIMEOUT",
    "CONNECTION_RESET",
    "ENDPOINT_TEMPORARILY_BUSY",
    "TRANSPORT_DROP",
    "NETWORK_DEGRADED",
    "ACK_DROPPED",
}


def is_error_retryable(error_code: str) -> bool:
    """Determine if a transport or protocol failure is retryable."""
    if error_code in NON_RETRYABLE_ERROR_CODES:
        return False
    if error_code in RETRYABLE_ERROR_CODES:
        return True
    # Default fail-closed: unknown errors are non-retryable for execution safety
    return False


def create_ack(
    message_id: str,
    command_id: str,
    sequence_number: int,
    status: CommandAckStatus = CommandAckStatus.COMMAND_ACCEPTED,
    reason: str | None = None,
    round_trip_ms: float | None = None,
    current_time: datetime | None = None,
) -> CommandAck:
    """Construct a positive CommandAck."""
    now = current_time or datetime.now(UTC)
    return CommandAck(
        ack_id=f"ack_{uuid.uuid4().hex[:12]}",
        message_id=message_id,
        command_id=command_id,
        sequence_number=sequence_number,
        status=status,
        timestamp=now.isoformat(),
        reason=reason,
        round_trip_ms=round_trip_ms,
    )


def create_nack(
    message_id: str,
    error_code: str,
    reason: str,
    command_id: str | None = None,
    sequence_number: int | None = None,
    retryable: bool | None = None,
    current_time: datetime | None = None,
) -> CommandNack:
    """Construct a negative CommandNack."""
    now = current_time or datetime.now(UTC)
    can_retry = retryable if retryable is not None else is_error_retryable(error_code)

    return CommandNack(
        nack_id=f"nack_{uuid.uuid4().hex[:12]}",
        message_id=message_id,
        command_id=command_id,
        sequence_number=sequence_number,
        error_code=error_code,
        reason=reason,
        retryable=can_retry,
        timestamp=now.isoformat(),
    )
