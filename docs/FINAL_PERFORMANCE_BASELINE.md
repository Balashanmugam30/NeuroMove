# NeuroMove Phase 24.3 — Final Performance Baseline Report

**Date**: 2026-09-02  
**Phase**: 24.3 — Final Release Gate  
**Verdict**: PASS

## Performance Benchmarks

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Safety Service Startup | 19.72 ms | < 500 ms | PASS |
| Transport Framing Rate | 47,936 fps | > 1,000 fps | PASS |
| Transport Framing Latency | 20.86 us/frame | < 1,000 us | PASS |
| Confidence Evaluation Rate | 92,483 eval/s | > 1,000 eval/s | PASS |
| Confidence Evaluation Latency | 10.81 us/eval | < 1,000 us | PASS |
| CSP Fit Latency (60 epochs, 8ch) | 24.12 ms | < 5,000 ms | PASS |
| Synthetic EEG Generation | 325,967 samples/s | > 10,000 samples/s | PASS |

## Evidence

Raw benchmark data: `docs/evidence/performance_baseline.json`

## Script

Benchmark collector: `scripts/benchmark_performance.py`

## Conclusion

All performance metrics exceed minimum thresholds by significant margins. The system is performant for real-time BCI research workloads.
