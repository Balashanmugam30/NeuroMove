# NeuroMove Runtime Boundaries

## 1. Local Control Station vs Public Web Platform

NeuroMove enforces strict architectural boundaries to guarantee physical safety:

| Boundary Dimension    | Local Control Station (Laptop)                                                           | Public Web Platform (Vercel)                                                   |
| :-------------------- | :--------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------- |
| **Execution Context** | Localhost desktop runtime                                                                | Edge / Serverless cloud                                                        |
| **Safety Dependency** | **Primary safety loop**: Real-time signal DSP, safety arbitration, emergency interrupts. | **Non-safety critical**: Static docs, historical replay viewing, public demos. |
| **Connectivity**      | **Air-gapped capable**: Operates 100% offline without internet access.                   | Requires public internet connectivity.                                         |
| **Hardware Access**   | Direct serial/USB connection to BioAmp and ESP32.                                        | Zero hardware access; cannot send actuator commands.                           |
| **Latency SLA**       | Hard real-time ($\le 20\text{ ms}$ arbitration latency).                                 | Best-effort network latency.                                                   |

## 2. The Physical Safety Constraint

> [!CRITICAL]
> The physical mobility platform **never** routes through the public internet.  
> Flow: `Internet → Cloud Platform → Physical Robot` is an anti-pattern and strictly prohibited.

All motor commands are generated locally by the Python FastAPI / Safety Core on the operator laptop and transmitted directly to the ESP32 microcontroller via local serial protocol with hardware watchdogs.
