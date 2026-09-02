# NeuroMove Architecture: Transport Framing, Serialization & Integrity (Phase 19)

## 1. Frame Wire Format

Every protocol message transmitted between NeuroMove and an embedded endpoint is encapsulated in a deterministic binary frame with unambiguous boundary delimiters, explicit length bounds, and CRC-32 integrity verification.

```
+-----------------------------------------------------------------------------------------+
|                                    NEUROMOVE FRAME                                      |
+-------------------+--------------------+--------------------+---------------+---------------+
| START DELIMITER   | LENGTH (BE uint32) | CHECKSUM (CRC-32)  | PAYLOAD       | END DELIMITER |
| 2 Bytes: 0xAA 0x55| 4 Bytes            | 8 Bytes (Hex ASCII)| N Bytes       | 2 Bytes: 0x55 0xAA |
+-------------------+--------------------+--------------------+---------------+---------------+
```

### Binary Specification:
- **START DELIMITER**: 2 bytes (`0xAA55`)
- **LENGTH**: 4 bytes, unsigned 32-bit integer, Big-Endian (max 1024 bytes)
- **CHECKSUM**: 8 bytes ASCII hexadecimal string representing CRC-32 (IEEE 802.3)
- **PAYLOAD**: Serialized canonical deterministic JSON bytes of `CommandEnvelope`
- **END DELIMITER**: 2 bytes (`0x55AA`)

## 2. Command Envelope Structure

```json
{
  "protocol_version": "1.0",
  "message_type": "COMMAND",
  "message_id": "msg_4b12c8a901ff",
  "command_id": "cmd_8a7d3c01e234",
  "sequence_number": 42,
  "device_id": "esp32_sim_01",
  "intent_id": "int_99e82100a7b4",
  "authorization_id": "auth_22fa1098de12",
  "subject_id": "sub-01",
  "session_id": "sess-01",
  "model_version_id": "model_v1",
  "issued_at": "2026-09-02T15:00:00.000000Z",
  "expires_at": "2026-09-02T15:00:10.000000Z",
  "payload": {
    "intent_class": "MOVE_FORWARD",
    "parameters": {},
    "metadata": { "policy_version": "1.0.0", "evaluation_id": "eval_77b4" }
  },
  "flags": { "authorized": true, "software_simulation": true },
  "checksum": "8F3A2B1C"
}
```

## 3. Framing Invariants

1. **Maximum Payload Bound**: Payloads $> 1024$ bytes are rejected prior to transmission, preventing buffer overflows on embedded microcontrollers.
2. **Deterministic Serialization**: JSON objects are strictly sorted by key with compact separators (`","`, `":"`), guaranteeing that identical command objects produce identical wire bytes.
3. **CRC-32 Verification**: If even a single bit in the header, payload, or length field is flipped, the computed CRC-32 does not match the frame checksum, triggering immediate frame rejection with a `CHECKSUM_MISMATCH` NACK.
