"""NeuroMove Configuration System.

Environment-driven settings management backed by Pydantic Settings.
"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from ..domain.enums import OperatingMode


class Settings(BaseSettings):
    """Application settings for NeuroMove Control Station."""

    app_env: str = Field(default="development", alias="APP_ENV")
    neuromove_mode: OperatingMode = Field(default=OperatingMode.SIMULATION, alias="NEUROMOVE_MODE")

    api_host: str = Field(default="127.0.0.1", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")
    web_origin: str = Field(default="http://localhost:3000", alias="WEB_ORIGIN")

    database_url: str = Field(default="sqlite:///./data/neuromove.db", alias="DATABASE_URL")

    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    log_format: str = Field(default="json", alias="LOG_FORMAT")

    enable_hardware_interface: bool = Field(default=False, alias="ENABLE_HARDWARE_INTERFACE")
    require_explicit_safety_override: bool = Field(
        default=False, alias="REQUIRE_EXPLICIT_SAFETY_OVERRIDE"
    )

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )


@lru_cache
def get_settings() -> Settings:
    """Return cached singleton settings instance."""
    return Settings()
