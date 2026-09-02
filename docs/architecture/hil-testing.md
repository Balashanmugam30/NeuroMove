# Hardware-in-the-Loop (HIL) Canonical Scenarios & Testing Matrix

## 1. Canonical HIL Scenarios (A through T)

| Scenario ID | Name | Objective | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **SCENARIO_A** | Device Discovery | Enumerate available ports safely without auto-opening | Discovered list returned |
| **SCENARIO_B** | Clean Connection Handshake | Connect $\to$ Negotiate $\to$ Transition to `READY` | State becomes `READY` |
| **SCENARIO_C** | Capability Negotiation | Verify advertised capabilities match HIL profile | `CAPABILITIES_MATCHED` |
| **SCENARIO_D** | Authorized Command Execution | Phase 17 `AUTHORIZED` $\to$ Frame $\to$ Virtual HIL | `COMMAND_ACCEPTED` |
| **SCENARIO_E** | Denied Safety Authorization | Phase 17 `DENIED` $\to$ Verify 0 frames transmitted | `COMMAND_REJECTED` (0 TX) |
| **SCENARIO_F** | Expired Safety Authorization | Phase 17 `EXPIRED` $\to$ Verify 0 frames transmitted | `COMMAND_REJECTED` (0 TX) |
| **SCENARIO_G** | Emergency Stop Safety Gate | Phase 17 `EMERGENCY_STOP` $\to$ Verify 0 frames | `COMMAND_REJECTED` (0 TX) |
| **SCENARIO_H** | Duplicate Command Delivery | Retransmit command with same ID $\to$ Idempotent ACK | `DUPLICATE_IGNORED` |
| **SCENARIO_I** | CRC-32 Checksum Corruption | Inject single-bit corruption into frame payload | `CHECKSUM_MISMATCH` NACK |
| **SCENARIO_J** | Sequence Gap Detection | Inject sequence gap (1 $\to$ 5) | `SEQUENCE_GAP` NACK |
| **SCENARIO_K** | Dropped ACK & Bounded Retry | ACK dropped $\to$ retry with same ID & sequence | Idempotent ACK on retry |
| **SCENARIO_L** | Device Disconnect | Disconnect hardware link | State becomes `DEGRADED`/`STALE` |
| **SCENARIO_M** | Device Cold Reboot | Trigger emulator reboot $\to$ new `boot_id` | Session invalidated |
| **SCENARIO_N** | Reconnection & Heartbeat | Reconnect $\to$ renegotiate session and heartbeat | New session established |
| **SCENARIO_O** | Stale Authorization Token | Device-side clock skew validates token expiry | `EXPIRED_AUTHORIZATION` NACK |
| **SCENARIO_P** | Incompatible Protocol Version | Negotiate with v99.0 | Version rejection |
| **SCENARIO_Q** | Capability Mismatch | Device missing required capabilities | Capability rejection |
| **SCENARIO_R** | Read Timeout & Recovery | Simulate read latency | `READ_TIMEOUT` recovery |
| **SCENARIO_S** | Write Timeout & Recovery | Simulate write latency | Bounded retry recovery |
| **SCENARIO_T** | Full End-to-End HIL Recovery | Fault $\to$ isolate $\to$ reconnect $\to$ fresh auth | Full recovery cycle |

---

## 2. Deterministic Manifest Hashes

Each scenario execution is sealed with a SHA-256 manifest hash:

$$\text{Manifest} = \text{SHA-256}(\text{scenario\_id} \mathbin{\Vert} \text{device\_mode} \mathbin{\Vert} \text{passed} \mathbin{\Vert} \text{ack\_status})$$
