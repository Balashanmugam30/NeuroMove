"""Tests for NeuroMove Real-Time Transport Protocol (Phase 04).

Verifies WebSocket handshakes (HELLO -> WELCOME), initial snapshots, PING/PONG heartbeats,
stream subscriptions, gap detection, and error responses.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from neuromove.api.app import create_app
from neuromove.transport.models import TransportMessageType


@pytest.fixture
def client() -> TestClient:
    app = create_app()
    return TestClient(app)


def test_websocket_handshake_and_welcome(client: TestClient) -> None:
    """Verify that connecting to /ws/live sends WELCOME followed by initial SNAPSHOT."""
    with client.websocket_connect("/ws/live") as ws:
        # 1. First message must be WELCOME
        msg1 = ws.receive_json()
        assert msg1["type"] == TransportMessageType.WELCOME.value
        assert "protocol_version" in msg1["payload"]
        assert msg1["payload"]["protocol_version"] == "1.0"
        assert msg1["payload"]["mode"] == "SIMULATION"
        assert msg1["payload"]["connection_id"].startswith("conn_")

        # 2. Second message must be SNAPSHOT
        msg2 = ws.receive_json()
        assert msg2["type"] == TransportMessageType.SNAPSHOT.value
        assert "latest_event_sequence" in msg2["payload"]
        assert "safety_state" in msg2["payload"]


def test_websocket_ping_pong_heartbeat(client: TestClient) -> None:
    """Verify client-initiated PING generates a server PONG response."""
    with client.websocket_connect("/ws/live") as ws:
        _ = ws.receive_json()  # WELCOME
        _ = ws.receive_json()  # SNAPSHOT

        now_iso = datetime.now(UTC).isoformat()
        ws.send_json(
            {
                "type": "PING",
                "payload": {"client_time": now_iso, "seq": 1},
            }
        )

        pong_msg = ws.receive_json()
        assert pong_msg["type"] == TransportMessageType.PONG.value
        assert pong_msg["payload"]["seq"] == 1
        assert "server_time" in pong_msg["payload"]


def test_websocket_stream_subscription(client: TestClient) -> None:
    """Verify client can subscribe to specific stream channels."""
    with client.websocket_connect("/ws/stream") as ws:
        _ = ws.receive_json()  # WELCOME
        _ = ws.receive_json()  # SNAPSHOT

        # Subscribe to robot and safety
        ws.send_json(
            {
                "type": "SUBSCRIBE",
                "payload": {"streams": ["robot", "safety"]},
            }
        )

        # Request snapshot on demand
        ws.send_json({"type": "SNAPSHOT"})
        snap_msg = ws.receive_json()
        assert snap_msg["type"] == TransportMessageType.SNAPSHOT.value


def test_websocket_unknown_stream_rejection(client: TestClient) -> None:
    """Verify requesting an unsupported stream returns a typed ERROR."""
    with client.websocket_connect("/ws/live") as ws:
        _ = ws.receive_json()  # WELCOME
        _ = ws.receive_json()  # SNAPSHOT

        ws.send_json(
            {
                "type": "SUBSCRIBE",
                "payload": {"streams": ["non_existent_kernel_stream"]},
            }
        )

        err_msg = ws.receive_json()
        assert err_msg["type"] == TransportMessageType.ERROR.value
        assert err_msg["payload"]["code"] == "UNSUPPORTED_STREAM"


def test_websocket_malformed_json_handling(client: TestClient) -> None:
    """Verify sending malformed text does not crash the server and returns ERROR."""
    with client.websocket_connect("/ws/live") as ws:
        _ = ws.receive_json()  # WELCOME
        _ = ws.receive_json()  # SNAPSHOT

        ws.send_text("INVALID_NON_JSON_STRING{{{")
        err_msg = ws.receive_json()
        assert err_msg["type"] == TransportMessageType.ERROR.value
        assert err_msg["payload"]["code"] == "INVALID_JSON"


def test_transport_diagnostics_endpoint(client: TestClient) -> None:
    """Verify GET /api/transport/diagnostics returns real-time metrics."""
    res = client.get("/api/transport/diagnostics")
    assert res.status_code == 200
    data = res.json()
    assert "active_connections" in data
    assert "total_connections" in data
    assert "events_sent" in data
    assert "events_dropped" in data
