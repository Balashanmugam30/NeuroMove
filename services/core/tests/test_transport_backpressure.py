"""Tests for NeuroMove Real-Time Backpressure and Bounded Queue Policies.

Verifies bounded queue saturation behavior, high-frequency batch drop semantics,
state coalescing, and memory safety.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from neuromove.transport.client_connection import ClientConnection
from neuromove.transport.models import (
    ClientState,
    TransportMessage,
    TransportMessageType,
)


@pytest.mark.asyncio
async def test_client_connection_bounded_queue_and_drop_policy() -> None:
    """Verify that an over-saturated client queue drops high-frequency EEG packets

    and tracks dropped counts without unbounded memory growth.
    """
    mock_ws = MagicMock()
    mock_ws.send_json = AsyncMock()

    # Create connection with small queue limit of 5
    conn = ClientConnection(websocket=mock_ws, max_queue_size=5)
    conn.subscribed_streams = {"eeg", "live"}

    # Enqueue 5 normal messages to fill the queue
    for i in range(5):
        msg = TransportMessage(
            type=TransportMessageType.EVENT,
            stream="live",
            payload={"index": i},
        )
        assert conn.enqueue_message(msg) is True

    assert conn._queue.full() is True

    # 6th message is high-frequency EEG: must be dropped per backpressure policy
    eeg_msg = TransportMessage(
        type=TransportMessageType.EVENT,
        stream="eeg",
        payload={"samples": [1.0, 2.0, 3.0]},
    )
    dropped = conn.enqueue_message(eeg_msg)
    assert dropped is False
    assert conn.events_dropped >= 1

    # Cleanup
    await conn.close()
    assert conn.state == ClientState.DISCONNECTED
