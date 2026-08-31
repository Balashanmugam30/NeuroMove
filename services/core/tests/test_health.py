"""Tests for System Health and Status Endpoint."""

import pytest
from fastapi.testclient import TestClient

from neuromove.api.app import app
from neuromove.domain.enums import ComponentStatus, OperatingMode


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_system_status_endpoint_returns_valid_structure(client: TestClient) -> None:
    response = client.get("/api/system/status")
    assert response.status_code == 200
    data = response.json()

    assert data["service"] == "neuromove-core"
    assert data["status"] == "ok"
    assert data["version"] == "0.1.0"
    assert data["mode"] in [
        OperatingMode.SIMULATION.value,
        OperatingMode.LIVE.value,
        OperatingMode.REPLAY.value,
    ]
    assert "timestamp" in data

    components = data["components"]
    assert components["api"] == ComponentStatus.HEALTHY.value
    assert components["eeg"] == ComponentStatus.NOT_CONNECTED.value
    assert components["robot"] == ComponentStatus.NOT_CONNECTED.value
    assert components["safety"] == ComponentStatus.READY.value
