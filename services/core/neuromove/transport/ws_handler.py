"""NeuroMove WebSocket Connection Lifecycle & Message Dispatch Handler.

Implements protocol handshakes, heartbeats, stream subscriptions, snapshot distribution,
and error handling.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime

from fastapi import WebSocket, WebSocketDisconnect

from neuromove.domain.enums import OperatingMode
from neuromove.transport.client_connection import ClientConnection
from neuromove.transport.connection_registry import connection_registry
from neuromove.transport.latest_value_cache import latest_value_cache
from neuromove.transport.models import (
    ClientState,
    HelloPayload,
    PingPayload,
    PongPayload,
    TransportErrorPayload,
    TransportMessage,
    TransportMessageType,
    WelcomePayload,
)

logger = logging.getLogger("neuromove.transport.handler")


async def handle_websocket_session(websocket: WebSocket, default_stream: str = "live") -> None:
    """Handle the complete lifecycle of a client WebSocket session."""
    await websocket.accept()

    conn = ClientConnection(websocket=websocket)
    conn.subscribed_streams = (
        {default_stream} if default_stream != "all" else {"live", "eeg", "robot", "safety"}
    )
    connection_registry.register(conn)

    # 1. Send WELCOME Handshake
    welcome_payload = WelcomePayload(
        protocol_version="1.0",
        schema_version="1.0.0",
        server_version="0.1.0",
        mode=OperatingMode.SIMULATION,
        connection_id=conn.connection_id,
        available_streams=["live", "eeg", "robot", "safety", "all"],
        heartbeat_interval_ms=5000,
        heartbeat_timeout_ms=3000,
    )
    conn.enqueue_message(
        TransportMessage(
            type=TransportMessageType.WELCOME,
            timestamp=datetime.now(UTC),
            payload=welcome_payload.model_dump(mode="json"),
        )
    )

    # 2. Send Initial State SNAPSHOT
    snapshot = latest_value_cache.get_snapshot()
    conn.enqueue_message(
        TransportMessage(
            type=TransportMessageType.SNAPSHOT,
            timestamp=datetime.now(UTC),
            payload=snapshot.model_dump(mode="json"),
        )
    )

    conn.state = ClientState.STREAMING

    # 3. Start Heartbeat Watchdog Task
    heartbeat_task = asyncio.create_task(_heartbeat_loop(conn), name=f"ws-hb-{conn.connection_id}")

    try:
        # 4. Message Receiver Loop
        while not conn._is_closed:
            raw_text = await websocket.receive_text()
            conn.bytes_received += len(raw_text)

            try:
                msg_dict = json.loads(raw_text)
            except Exception:
                connection_registry.invalid_messages += 1
                err = TransportErrorPayload(
                    code="INVALID_JSON", message="Malformed JSON text payload received."
                )
                conn.enqueue_message(
                    TransportMessage(
                        type=TransportMessageType.ERROR,
                        timestamp=datetime.now(UTC),
                        payload=err.model_dump(mode="json"),
                    )
                )
                continue

            msg_type_str = msg_dict.get("type", "").upper()

            # Handle HELLO
            if msg_type_str == TransportMessageType.HELLO.value:
                try:
                    hello = HelloPayload.model_validate(msg_dict.get("payload", msg_dict))
                    conn.client_id = hello.client_id
                    conn.client_name = hello.client_name
                    conn.client_version = hello.client_version
                    if hello.requested_streams:
                        conn.subscribed_streams.update(hello.requested_streams)
                except Exception as exc:
                    connection_registry.invalid_messages += 1
                    logger.warning("Invalid HELLO payload from %s: %s", conn.connection_id, exc)

            # Handle PING (Client Heartbeat)
            elif msg_type_str == TransportMessageType.PING.value:
                p = msg_dict.get("payload", msg_dict)
                client_dt_str = p.get("client_time") or datetime.now(UTC).isoformat()
                try:
                    client_dt = datetime.fromisoformat(client_dt_str)
                except Exception:
                    client_dt = datetime.now(UTC)

                pong = PongPayload(
                    client_time=client_dt,
                    server_time=datetime.now(UTC),
                    seq=p.get("seq", 0),
                )
                conn.enqueue_message(
                    TransportMessage(
                        type=TransportMessageType.PONG,
                        timestamp=datetime.now(UTC),
                        payload=pong.model_dump(mode="json"),
                    )
                )

            # Handle PONG (Server Heartbeat Response)
            elif msg_type_str == TransportMessageType.PONG.value:
                p = msg_dict.get("payload", msg_dict)
                client_dt_str = p.get("client_time") or datetime.now(UTC).isoformat()
                try:
                    client_dt = datetime.fromisoformat(client_dt_str)
                except Exception:
                    client_dt = datetime.now(UTC)
                conn.record_pong(client_dt)

            # Handle SUBSCRIBE
            elif msg_type_str == TransportMessageType.SUBSCRIBE.value:
                p = msg_dict.get("payload", msg_dict)
                streams_req = p.get("streams", ["live"])
                valid_streams = {"live", "eeg", "robot", "safety", "all"}
                unsupported = [s for s in streams_req if s not in valid_streams]

                if unsupported:
                    err = TransportErrorPayload(
                        code="UNSUPPORTED_STREAM",
                        message=f"Requested unknown streams: {unsupported}",
                    )
                    conn.enqueue_message(
                        TransportMessage(
                            type=TransportMessageType.ERROR,
                            timestamp=datetime.now(UTC),
                            payload=err.model_dump(mode="json"),
                        )
                    )
                else:
                    conn.subscribed_streams.update(streams_req)
                    conn.filter_session_id = p.get("filter_session_id")
                    logger.info(
                        "Connection %s subscribed to streams: %s",
                        conn.connection_id,
                        conn.subscribed_streams,
                    )

            # Handle UNSUBSCRIBE
            elif msg_type_str == TransportMessageType.UNSUBSCRIBE.value:
                p = msg_dict.get("payload", msg_dict)
                streams_unsub = p.get("streams", [])
                for s in streams_unsub:
                    conn.subscribed_streams.discard(s)

            # Handle SNAPSHOT request
            elif msg_type_str == TransportMessageType.SNAPSHOT.value:
                snap = latest_value_cache.get_snapshot()
                conn.enqueue_message(
                    TransportMessage(
                        type=TransportMessageType.SNAPSHOT,
                        timestamp=datetime.now(UTC),
                        payload=snap.model_dump(mode="json"),
                    )
                )

            else:
                connection_registry.invalid_messages += 1
                err = TransportErrorPayload(
                    code="UNKNOWN_MESSAGE_TYPE",
                    message=f"Unsupported message type '{msg_type_str}'.",
                )
                conn.enqueue_message(
                    TransportMessage(
                        type=TransportMessageType.ERROR,
                        timestamp=datetime.now(UTC),
                        payload=err.model_dump(mode="json"),
                    )
                )

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: %s", conn.connection_id)
    except Exception as exc:
        logger.error("Unexpected error in WebSocket session %s: %s", conn.connection_id, exc)
    finally:
        heartbeat_task.cancel()
        try:
            await heartbeat_task
        except asyncio.CancelledError:
            pass
        await connection_registry.unregister(conn.connection_id)


async def _heartbeat_loop(conn: ClientConnection, interval_seconds: float = 5.0) -> None:
    """Periodically issue PING messages and monitor connection health."""
    try:
        while not conn._is_closed:
            await asyncio.sleep(interval_seconds)
            if conn._is_closed:
                break

            conn.record_ping()
            ping = PingPayload(client_time=datetime.now(UTC), seq=conn._transport_seq)
            conn.enqueue_message(
                TransportMessage(
                    type=TransportMessageType.PING,
                    timestamp=datetime.now(UTC),
                    payload=ping.model_dump(mode="json"),
                )
            )
    except asyncio.CancelledError:
        pass
