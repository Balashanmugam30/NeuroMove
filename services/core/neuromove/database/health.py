"""Database health check utilities."""

from ..domain.enums import ComponentStatus
from .connection import default_db_manager


def get_database_status() -> ComponentStatus:
    """Return component status for database subsystem."""
    if default_db_manager.check_health():
        return ComponentStatus.HEALTHY
    return ComponentStatus.NOT_INITIALIZED
