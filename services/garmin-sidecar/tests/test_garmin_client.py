from unittest.mock import MagicMock, patch
import pytest
from app.garmin.client import GarminClient, GarminAuthError, GarminSyncError


def test_login_success():
    with patch("app.garmin.client.Garmin") as MockGarmin:
        mock_api = MagicMock()
        mock_api.garth.dump.return_value = {"oauth_token": "tok", "oauth_token_secret": "sec"}
        MockGarmin.return_value = mock_api

        client = GarminClient()
        tokens = client.login("user@example.com", "pass")

        assert tokens["oauth_token"] == "tok"
        mock_api.login.assert_called_once()


def test_login_failure_raises_auth_error():
    with patch("app.garmin.client.Garmin") as MockGarmin:
        MockGarmin.return_value.login.side_effect = Exception("SSO failed")

        client = GarminClient()
        with pytest.raises(GarminAuthError):
            client.login("user@example.com", "wrongpass")


def test_get_activities_without_session_raises():
    client = GarminClient()
    with pytest.raises(GarminSyncError):
        client.get_activities("2026-01-01")


def test_normalize_running_activity():
    raw = {
        "activityId": 12345,
        "startTimeLocal": "2026-01-15 07:30:00",
        "distance": 10000,
        "duration": 3600,
        "averageSpeed": 2.78,
        "averageHR": 148,
        "maxHR": 170,
        "activityType": {"typeKey": "running"},
    }
    normalized = GarminClient._normalize(raw)
    assert normalized["garmin_id"] == "12345"
    assert normalized["distance_m"] == 10000
    assert normalized["duration_s"] == 3600
    assert normalized["avg_hr"] == 148


def test_filter_non_running():
    client = GarminClient()
    non_running = {"activityType": {"typeKey": "cycling"}}
    assert not client._is_running(non_running)
    running = {"activityType": {"typeKey": "running"}}
    assert client._is_running(running)
