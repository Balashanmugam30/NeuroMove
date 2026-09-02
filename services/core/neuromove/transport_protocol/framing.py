"""Structured framing and parsing with CRC-32 integrity and boundary validation."""

from __future__ import annotations

import struct
from typing import NamedTuple

from neuromove.transport_protocol.checksum import compute_crc32, verify_crc32
from neuromove.transport_protocol.codec import decode_command, encode_command
from neuromove.transport_protocol.models import CommandEnvelope
from neuromove.transport_protocol.protocol import (
    FRAME_END_DELIMITER,
    FRAME_START_DELIMITER,
    MAX_FRAME_PAYLOAD_BYTES,
    MAX_FRAME_TOTAL_BYTES,
)


class FramingError(Exception):
    """Base exception for framing failures."""

    def __init__(self, message: str, code: str = "FRAMING_ERROR") -> None:
        super().__init__(message)
        self.code = code


class FrameTruncatedError(FramingError):
    def __init__(self, message: str = "Frame is truncated or incomplete") -> None:
        super().__init__(message, "FRAME_TRUNCATED")


class FrameDelimiterError(FramingError):
    def __init__(self, message: str = "Invalid start or end frame delimiter") -> None:
        super().__init__(message, "INVALID_DELIMITER")


class FramePayloadSizeError(FramingError):
    def __init__(self, message: str = "Frame payload size exceeds maximum limit") -> None:
        super().__init__(message, "PAYLOAD_TOO_LARGE")


class FrameChecksumMismatchError(FramingError):
    def __init__(self, message: str = "Frame CRC-32 integrity checksum mismatch") -> None:
        super().__init__(message, "CHECKSUM_MISMATCH")


class FrameDecodeError(FramingError):
    def __init__(self, message: str = "Failed to decode command envelope from payload") -> None:
        super().__init__(message, "DECODE_ERROR")


class RawFrame(NamedTuple):
    length: int
    checksum: str
    payload_bytes: bytes
    total_bytes: int


HEADER_FORMAT = ">2sI8s"  # Start (2s), Length (I: 4 bytes), Checksum (8s: 8 bytes)
HEADER_SIZE = struct.calcsize(HEADER_FORMAT)
TRAILER_SIZE = len(FRAME_END_DELIMITER)
MIN_FRAME_SIZE = HEADER_SIZE + TRAILER_SIZE


def pack_frame(envelope: CommandEnvelope) -> bytes:
    """Pack CommandEnvelope into a framed binary wire format.

    Format:
    [START: 2B (0xAA55)] [LENGTH: 4B big-endian] [CHECKSUM: 8B ASCII hex] [PAYLOAD: N bytes] [END: 2B (0x55AA)]
    """
    payload_bytes = encode_command(envelope)
    payload_len = len(payload_bytes)

    if payload_len > MAX_FRAME_PAYLOAD_BYTES:
        raise FramePayloadSizeError(
            f"Payload size {payload_len} bytes exceeds maximum allowed {MAX_FRAME_PAYLOAD_BYTES} bytes"
        )

    checksum = compute_crc32(payload_bytes)
    envelope.checksum = checksum

    header = struct.pack(
        HEADER_FORMAT, FRAME_START_DELIMITER, payload_len, checksum.encode("ascii")
    )
    return header + payload_bytes + FRAME_END_DELIMITER


def unpack_frame(frame_bytes: bytes) -> tuple[CommandEnvelope, RawFrame]:
    """Unpack framed bytes into a validated CommandEnvelope and RawFrame metadata."""
    total_len = len(frame_bytes)
    if total_len < MIN_FRAME_SIZE:
        raise FrameTruncatedError(
            f"Frame length {total_len} is smaller than minimum header size {MIN_FRAME_SIZE}"
        )

    if total_len > MAX_FRAME_TOTAL_BYTES:
        raise FramePayloadSizeError(
            f"Frame total length {total_len} exceeds maximum allowed {MAX_FRAME_TOTAL_BYTES}"
        )

    start_delim, declared_len, checksum_bytes = struct.unpack_from(HEADER_FORMAT, frame_bytes, 0)

    if start_delim != FRAME_START_DELIMITER:
        raise FrameDelimiterError(
            f"Invalid start delimiter: {start_delim!r}, expected {FRAME_START_DELIMITER!r}"
        )

    if declared_len > MAX_FRAME_PAYLOAD_BYTES:
        raise FramePayloadSizeError(
            f"Declared payload length {declared_len} exceeds limit {MAX_FRAME_PAYLOAD_BYTES}"
        )

    expected_total = HEADER_SIZE + declared_len + TRAILER_SIZE
    if total_len < expected_total:
        raise FrameTruncatedError(
            f"Frame truncated: expected {expected_total} bytes, received {total_len}"
        )

    end_delim = frame_bytes[HEADER_SIZE + declared_len : expected_total]
    if end_delim != FRAME_END_DELIMITER:
        raise FrameDelimiterError(
            f"Invalid end delimiter: {end_delim!r}, expected {FRAME_END_DELIMITER!r}"
        )

    payload_bytes = frame_bytes[HEADER_SIZE : HEADER_SIZE + declared_len]
    expected_checksum = checksum_bytes.decode("ascii")

    if not verify_crc32(payload_bytes, expected_checksum):
        actual_crc = compute_crc32(payload_bytes)
        raise FrameChecksumMismatchError(
            f"CRC-32 checksum mismatch: frame declared '{expected_checksum}', actual computed '{actual_crc}'"
        )

    try:
        envelope = decode_command(payload_bytes)
        envelope.checksum = expected_checksum
    except Exception as exc:
        raise FrameDecodeError(f"Failed to parse payload as CommandEnvelope: {exc}") from exc

    raw_frame = RawFrame(
        length=declared_len,
        checksum=expected_checksum,
        payload_bytes=payload_bytes,
        total_bytes=total_len,
    )
    return envelope, raw_frame
