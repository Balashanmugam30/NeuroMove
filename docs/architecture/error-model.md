# NeuroMove Standardized Error Model

## 1. Error Contract

All HTTP REST endpoints and internal validation failures conform to the standardized `ErrorResponse` schema:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid event payload or domain invariant violation",
  "request_id": "cor_78ef9012a456",
  "details": [
    {
      "field": "emergency_active",
      "issue": "Emergency stop active cannot coexist with APPROVED safety decision"
    }
  ]
}
```

---

## 2. Standard Error Codes

| Error Code                 | HTTP Status | Description                                                            |
| :------------------------- | :---------- | :--------------------------------------------------------------------- |
| `VALIDATION_ERROR`         | 422         | Schema validation or domain invariant failure.                         |
| `INVALID_STATE_TRANSITION` | 400         | Attempted illegal state transition in safety state machine.            |
| `COMMAND_BLOCKED`          | 403         | Safety arbitrator blocked candidate actuation command.                 |
| `HARDWARE_DISCONNECTED`    | 503         | Requested hardware interface (EEG / ESP32) is offline.                 |
| `INTERNAL_ERROR`           | 500         | Unhandled internal exception (sanitized, no raw stack traces exposed). |

---

## 3. Security & Traceability

1. **Correlation IDs**: Every error payload returns a `request_id` (`cor_...`) for distributed log correlation.
2. **No Stack Traces**: Internal exception details are logged securely to local files and redacted from client HTTP responses.
