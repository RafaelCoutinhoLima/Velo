"""
Endpoint POST /zones/calculate — sem dependências externas.
"""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

VALID_PAYLOAD = {"max_hr": 190, "resting_hr": 60, "threshold_pace_sec": 360}


def test_calculate_zones_returns_200():
    response = client.post("/zones/calculate", json=VALID_PAYLOAD)
    assert response.status_code == 200


def test_calculate_zones_returns_five_hr_zones():
    response = client.post("/zones/calculate", json=VALID_PAYLOAD)
    assert len(response.json()["hr_zones"]) == 5


def test_calculate_zones_returns_three_pace_zones():
    response = client.post("/zones/calculate", json=VALID_PAYLOAD)
    assert len(response.json()["pace_zones"]) == 3


def test_hr_zones_are_ordered():
    response = client.post("/zones/calculate", json=VALID_PAYLOAD)
    zones = response.json()["hr_zones"]
    for i in range(len(zones) - 1):
        assert zones[i]["max_bpm"] < zones[i + 1]["max_bpm"]


def test_zone5_max_equals_max_hr():
    response = client.post("/zones/calculate", json=VALID_PAYLOAD)
    zones = response.json()["hr_zones"]
    assert zones[-1]["max_bpm"] == VALID_PAYLOAD["max_hr"]


def test_resting_hr_above_max_returns_422():
    response = client.post(
        "/zones/calculate",
        json={"max_hr": 100, "resting_hr": 110, "threshold_pace_sec": 360},
    )
    assert response.status_code == 422


def test_zero_max_hr_returns_422():
    response = client.post(
        "/zones/calculate",
        json={"max_hr": 0, "resting_hr": 60, "threshold_pace_sec": 360},
    )
    assert response.status_code == 422


def test_zero_threshold_pace_returns_422():
    response = client.post(
        "/zones/calculate",
        json={"max_hr": 190, "resting_hr": 60, "threshold_pace_sec": 0},
    )
    assert response.status_code == 422


def test_response_includes_pace_zone_labels():
    response = client.post("/zones/calculate", json=VALID_PAYLOAD)
    zones = response.json()["pace_zones"]
    for z in zones:
        assert "zone" in z
        assert "min_sec" in z
        assert "max_sec" in z
