"""NeuroMove — Real-Time Motor-Imagery EEG Mobility Platform.

Research and Engineering Platform Canonical Package.
"""

from pathlib import Path

# Extend package search path to seamlessly include services/core/neuromove modules
_core_neuromove = Path(__file__).resolve().parent.parent / "services" / "core" / "neuromove"
if _core_neuromove.exists():
    __path__.append(str(_core_neuromove))

__version__ = "0.1.0"
