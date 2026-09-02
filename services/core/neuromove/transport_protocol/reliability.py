"""Retry management, backoff calculations, and idempotency preservation."""

from __future__ import annotations

import logging

from neuromove.transport_protocol.ack import is_error_retryable
from neuromove.transport_protocol.models import CommandEnvelope, RetryPolicy

logger = logging.getLogger(__name__)


class RetryManager:
    """Manages bounded retry attempts and backoff scheduling for command transmissions."""

    def __init__(self, policy: RetryPolicy | None = None) -> None:
        self.policy = policy or RetryPolicy()

    def should_retry(
        self,
        envelope: CommandEnvelope,
        attempt_count: int,
        error_code: str,
    ) -> bool:
        """Evaluate whether a failed command transmission should be retried."""
        # 1. Non-retryable error codes cannot be retried under any circumstances
        if not is_error_retryable(error_code):
            return False

        # 2. Check maximum attempts
        if attempt_count >= self.policy.max_attempts:
            return False

        return True

    def calculate_delay_ms(self, attempt_count: int) -> float:
        """Calculate exponential backoff delay in milliseconds."""
        factor = self.policy.backoff_multiplier ** max(0, attempt_count - 1)
        delay = self.policy.initial_delay_ms * factor
        return min(delay, self.policy.max_delay_ms)

    def prepare_retry_envelope(
        self,
        envelope: CommandEnvelope,
        new_message_id: str,
        new_sequence_number: int | None = None,
    ) -> CommandEnvelope:
        """Create a new transmission envelope for retry, preserving the original command_id."""
        # Clone envelope but assign fresh message_id
        envelope_dict = envelope.model_dump()
        envelope_dict["message_id"] = new_message_id
        if new_sequence_number is not None:
            envelope_dict["sequence_number"] = new_sequence_number
        # command_id and sequence_number are preserved!
        flags = dict(envelope_dict.get("flags", {}))
        flags["retry"] = True
        envelope_dict["flags"] = flags
        return CommandEnvelope.model_validate(envelope_dict)
