"""Deterministic CRC-32 integrity algorithm for frame and payload verification."""

from __future__ import annotations

import binascii


def compute_crc32(data: bytes | str) -> str:
    """Compute 8-character uppercase hex CRC-32 checksum (IEEE 802.3)."""
    if isinstance(data, str):
        data = data.encode("utf-8")
    crc = binascii.crc32(data) & 0xFFFFFFFF
    return f"{crc:08X}"


def verify_crc32(data: bytes | str, expected_checksum: str) -> bool:
    """Verify that data matches the expected CRC-32 checksum."""
    if not expected_checksum:
        return False
    actual = compute_crc32(data)
    return actual.upper() == expected_checksum.strip().upper()
