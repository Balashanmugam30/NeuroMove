"""Tests for Configuration Settings."""

from neuromove.config.settings import Settings
from neuromove.domain.enums import OperatingMode


def test_default_settings() -> None:
    settings = Settings()
    assert settings.app_env in ["development", "test", "staging", "production"]
    assert settings.neuromove_mode in [
        OperatingMode.SIMULATION,
        OperatingMode.LIVE,
        OperatingMode.REPLAY,
    ]
    assert settings.api_port == 8000
    assert settings.enable_hardware_interface is False
