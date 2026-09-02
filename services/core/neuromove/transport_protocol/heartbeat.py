"""Heartbeat monitoring and fail-closed link health tracking."""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from neuromove.transport_protocol.models import (
    HeartbeatStatus,
    TransportConnectionState,
)
from neuromove.transport_protocol.protocol import (
    MAX_MISSED_HEARTBEATS_DEGRADED,
    MAX_MISSED_HEARTBEATS_STALE,
)

logger = logging.getLogger(__name__)


class HeartbeatMonitor:
    """Monitors link health via periodic ping/pong telemetry."""

    def __init__(self) -> None:
        self._last_sent: datetime | None = None
        self._last_received: datetime | None = None
        self._last_rtt_ms: float | None = None
        self._missed_count: int = 0
        self._link_state: TransportConnectionState = TransportConnectionState.DISCONNECTED

    def record_ping_sent(self, sent_time: datetime | None = None) -> None:
        """Record when a HEARTBEAT_REQUEST is dispatched."""
        now = sent_time or datetime.now(UTC)
        self._last_sent = now

    def record_pong_received(self, received_time: datetime | None = None) -> float:
        """Record receipt of HEARTBEAT_RESPONSE and update RTT."""
        now = received_time or datetime.now(UTC)
        self._last_received = now
        self._missed_count = 0

        rtt_ms = 0.0
        if self._last_sent:
            delta = (now - self._last_sent).total_seconds() * 1000.0
            rtt_ms = max(0.0, delta)
        self._last_rtt_ms = rtt_ms

        if self._link_state in (
            TransportConnectionState.DEGRADED,
            TransportConnectionState.STALE,
        ):
            self._link_state = TransportConnectionState.CONNECTED
            logger.info("Heartbeat restored link state to CONNECTED (RTT: %.2fms)", rtt_ms)

        return rtt_ms

    def record_missed_heartbeat(self) -> TransportConnectionState:
        """Record a missed heartbeat and evaluate degradation transitions."""
        self._missed_count += 1

        if self._missed_count >= MAX_MISSED_HEARTBEATS_STALE:
            self._link_state = TransportConnectionState.STALE
            logger.warning(
                "Link transitioned to STALE after %d consecutive missed heartbeats",
                self._missed_count,
            )
        elif self._missed_count >= MAX_MISSED_HEARTBEATS_DEGRADED:
            self._link_state = TransportConnectionState.DEGRADED
            logger.warning(
                "Link transitioned to DEGRADED after %d consecutive missed heartbeats",
                self._missed_count,
            )

        return self._link_state

    def set_connection_state(self, state: TransportConnectionState) -> None:
        """Explicitly update connection state."""
        self._link_state = state
        if state == TransportConnectionState.CONNECTED:
            self._missed_count = 0

    def is_link_healthy(self) -> bool:
        """Check if link is currently authorized to transmit execution commands."""
        return self._link_state == TransportConnectionState.CONNECTED

    def get_status(self) -> HeartbeatStatus:
        """Return snapshot of heartbeat metrics and link state."""
        return HeartbeatStatus(
            last_sent=self._last_sent.isoformat() if self._last_sent else None,
            last_received=self._last_received.isoformat() if self._last_received else None,
            round_trip_time_ms=self._last_rtt_ms,
            missed_count=self._missed_count,
            link_state=self._link_state,
        )

    def reset(self) -> None:
        """Reset heartbeat monitor state."""
        self._last_sent = None
        self._last_received = None
        self._last_rtt_ms = None
        self._missed_count = 0
        self._link_state = TransportConnectionState.DISCONNECTED
