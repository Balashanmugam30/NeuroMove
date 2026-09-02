"""Phase 24.3 Performance Baseline Collector.

Measures and records production timing baselines across:
1. Subsystem startup latency
2. Framing & CRC-32 integrity calculation throughput
3. Confidence evaluation rate
4. CSP spatial filter fitting execution latency
5. Synthetic EEG generation throughput

Output saved to docs/evidence/performance_baseline.json.
"""

from __future__ import annotations

import json
import time
from datetime import UTC, datetime
from pathlib import Path

import numpy as np

from neuromove.confidence.evaluator import ConfidenceEvaluator
from neuromove.confidence.models import ConfidenceInput, ScoreType
from neuromove.decoding.csp import build_csp_transformer
from neuromove.decoding.models import CSPConfig
from neuromove.domain.enums import SafetyDecision
from neuromove.safety.service import SafetyService
from neuromove.simulation.config import SimulationConfig
from neuromove.simulation.eeg_generator import SyntheticEEGGenerator
from neuromove.transport_protocol.commands import create_command_envelope
from neuromove.transport_protocol.framing import pack_frame, unpack_frame
from neuromove.transport_protocol.models import ExecutionAuthorization


def run_benchmarks() -> dict[str, any]:
    print("=== NeuroMove Phase 24.3 Performance Baseline Benchmark ===")
    results = {
        "timestamp": datetime.now(UTC).isoformat(),
        "benchmarks": {},
    }

    # 1. Startup Latency
    t0 = time.perf_counter()
    safety = SafetyService()
    t_safety = (time.perf_counter() - t0) * 1000.0
    print(f"[*] Safety Service Startup: {t_safety:.2f} ms")
    results["benchmarks"]["safety_service_startup_ms"] = round(t_safety, 2)

    # 2. Framing & CRC-32 Throughput
    auth = ExecutionAuthorization(
        authorization_id="auth_bench_01",
        intent_id="intent_001",
        intent_class="LEFT_HAND",
        decision=SafetyDecision.AUTHORIZED,
        policy_version="1.0.0",
        evaluation_id="eval_bench_01",
        model_version_id="csp_lda_v1",
        subject_id="sub-01",
        session_id="sess-01",
        issued_at=datetime.now(UTC).isoformat(),
        expires_at="2030-01-01T00:00:00Z",
        reason="Benchmark valid authorization",
    )

    envelope = create_command_envelope(
        auth=auth,
        device_id="esp32_dev_01",
        sequence_number=1,
    )

    n_frames = 2000
    t0 = time.perf_counter()
    for seq in range(n_frames):
        envelope.sequence_number = seq
        frame_bytes = pack_frame(envelope)
        unpacked_env, _ = unpack_frame(frame_bytes)
        assert unpacked_env.sequence_number == seq
    t_framing = time.perf_counter() - t0
    fps = n_frames / t_framing
    avg_frame_us = (t_framing / n_frames) * 1e6
    print(f"[*] Transport Framing & CRC-32: {fps:.0f} frames/sec ({avg_frame_us:.2f} us/frame)")
    results["benchmarks"]["framing_rate_fps"] = round(fps, 1)
    results["benchmarks"]["framing_latency_us"] = round(avg_frame_us, 2)

    # 3. Confidence Evaluator Rate
    evaluator = ConfidenceEvaluator()
    n_conf = 3000
    inp = ConfidenceInput(
        prediction="LEFT_IMAGERY",
        raw_score=0.92,
        score_type=ScoreType.PROBABILITY,
        class_scores={"LEFT_IMAGERY": 0.92, "RIGHT_IMAGERY": 0.08},
        model_id="mdl_v1",
        model_version_id="v1",
        prediction_timestamp=1000.0,
        data_timestamp=1000.0,
        signal_quality=0.95,
    )
    t0 = time.perf_counter()
    for _ in range(n_conf):
        dec = evaluator.evaluate(inp, evaluation_timestamp=1000.0)
    t_conf = time.perf_counter() - t0
    conf_eps = n_conf / t_conf
    avg_conf_us = (t_conf / n_conf) * 1e6
    print(f"[*] Confidence Evaluation Rate: {conf_eps:.0f} evaluations/sec ({avg_conf_us:.2f} us/eval)")
    results["benchmarks"]["confidence_rate_eps"] = round(conf_eps, 1)
    results["benchmarks"]["confidence_latency_us"] = round(avg_conf_us, 2)

    # 4. CSP Spatial Filter Fit Time
    rng = np.random.default_rng(42)
    epochs = rng.standard_normal((60, 8, 250))
    labels = np.array([0] * 30 + [1] * 30)
    config = CSPConfig(n_components=4, log=True)
    csp = build_csp_transformer(config, n_channels=8)

    t0 = time.perf_counter()
    csp.fit(epochs, labels)
    t_csp = (time.perf_counter() - t0) * 1000.0
    print(f"[*] CSP Fit Latency (60 epochs, 8 channels): {t_csp:.2f} ms")
    results["benchmarks"]["csp_fit_latency_ms"] = round(t_csp, 2)

    # 5. Synthetic Signal Generation Throughput
    cfg = SimulationConfig(seed=42, channels=["C3", "Cz", "C4"], sample_rate_hz=250)
    gen = SyntheticEEGGenerator(cfg)
    n_samples = 50000
    t0 = time.perf_counter()
    gen.generate_samples(count=n_samples)
    t_gen = time.perf_counter() - t0
    gen_sps = n_samples / t_gen
    print(f"[*] Synthetic EEG Generation: {gen_sps:.0f} samples/sec")
    results["benchmarks"]["synthetic_eeg_samples_per_sec"] = round(gen_sps, 0)

    # Save to docs/evidence/performance_baseline.json
    out_dir = Path(__file__).resolve().parent.parent / "docs" / "evidence"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "performance_baseline.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\n[+] Results saved to {out_file}")

    return results


if __name__ == "__main__":
    run_benchmarks()
