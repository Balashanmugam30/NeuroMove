"""API & WebSocket endpoint integration tests for Simulation Engine."""

import pytest
from fastapi.testclient import TestClient

from neuromove.api.app import create_app


@pytest.fixture
def client() -> TestClient:
    app = create_app()
    return TestClient(app)


def test_simulation_status_endpoint(client: TestClient) -> None:
    """Verify GET /api/simulation/status returns structured status."""
    res = client.get("/api/simulation/status")
    assert res.status_code == 200
    data = res.json()
    assert "mode" in data
    assert data["mode"] == "SIMULATION"
    assert "is_running" in data
    assert "speed" in data


def test_simulation_scenarios_endpoint(client: TestClient) -> None:
    """Verify GET /api/simulation/scenarios lists all 9 scenarios."""
    res = client.get("/api/simulation/scenarios")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 9
    scenario_ids = [s["scenario_id"] for s in data]
    assert "right-turn" in scenario_ids
    assert "full-demo" in scenario_ids


def test_simulation_control_lifecycle(client: TestClient) -> None:
    """Verify Start -> Pause -> Resume -> Speed -> Step -> Stop -> Reset lifecycle."""
    # 1. Start
    res_start = client.post(
        "/api/simulation/start", json={"scenario_id": "right-turn", "seed": 42, "speed": 2.0}
    )
    assert res_start.status_code == 200
    st = res_start.json()
    assert st["is_running"] is True
    assert st["scenario_id"] == "right-turn"
    assert st["speed"] == 2.0

    # 2. Pause
    res_pause = client.post("/api/simulation/pause")
    assert res_pause.status_code == 200
    assert res_pause.json()["is_paused"] is True

    # 3. Resume
    res_resume = client.post("/api/simulation/resume")
    assert res_resume.status_code == 200
    assert res_resume.json()["is_running"] is True

    # 4. Speed
    res_speed = client.post("/api/simulation/speed", json={"speed": 5.0})
    assert res_speed.status_code == 200
    assert res_speed.json()["speed"] == 5.0

    # 5. Step
    res_step = client.post("/api/simulation/step", json={"delta_seconds": 0.5})
    assert res_step.status_code == 200

    # 6. Stop
    res_stop = client.post("/api/simulation/stop")
    assert res_stop.status_code == 200
    assert res_stop.json()["is_running"] is False

    # 7. Reset
    res_reset = client.post("/api/simulation/reset")
    assert res_reset.status_code == 200
    assert res_reset.json()["elapsed_seconds"] == 0.0
