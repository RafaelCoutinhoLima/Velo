from unittest.mock import MagicMock, patch
import pytest
from app.garmin.client import GarminClient, GarminAuthError, GarminSyncError


def _make_mock_api(is_authenticated=True, dumps_value='{"di_token": "tok"}'):
    mock_api = MagicMock()
    mock_api.client.is_authenticated = is_authenticated
    mock_api.client.dumps.return_value = dumps_value
    return mock_api


def test_login_success():
    with patch("app.garmin.client.Garmin") as MockGarmin:
        mock_api = _make_mock_api()
        MockGarmin.return_value = mock_api

        client = GarminClient()
        tokens = client.login("user@example.com", "pass")

        assert tokens["di_token"] == "tok"
        mock_api.login.assert_called_once()


def test_login_with_mfa_passes_prompt():
    with patch("app.garmin.client.Garmin") as MockGarmin:
        mock_api = _make_mock_api()
        MockGarmin.return_value = mock_api

        client = GarminClient()
        client.login("user@example.com", "pass", mfa_code="123456")

        _, kwargs = MockGarmin.call_args
        assert callable(kwargs.get("prompt_mfa"))
        assert kwargs["prompt_mfa"]() == "123456"


def test_login_without_mfa_passes_none_prompt():
    with patch("app.garmin.client.Garmin") as MockGarmin:
        mock_api = _make_mock_api()
        MockGarmin.return_value = mock_api

        client = GarminClient()
        client.login("user@example.com", "pass")

        _, kwargs = MockGarmin.call_args
        assert kwargs.get("prompt_mfa") is None


def test_login_not_authenticated_raises_auth_error():
    with patch("app.garmin.client.Garmin") as MockGarmin:
        mock_api = _make_mock_api(is_authenticated=False)
        MockGarmin.return_value = mock_api

        client = GarminClient()
        with pytest.raises(GarminAuthError, match="Login falhou"):
            client.login("user@example.com", "wrongpass")


def test_login_failure_raises_auth_error():
    with patch("app.garmin.client.Garmin") as MockGarmin:
        MockGarmin.return_value.login.side_effect = Exception("SSO failed")

        client = GarminClient()
        with pytest.raises(GarminAuthError):
            client.login("user@example.com", "wrongpass")


def test_login_too_many_requests_raises_friendly_message():
    from garminconnect.client import GarminConnectTooManyRequestsError
    with patch("app.garmin.client.Garmin") as MockGarmin:
        MockGarmin.return_value.login.side_effect = GarminConnectTooManyRequestsError("429")

        client = GarminClient()
        with pytest.raises(GarminAuthError, match="Muitas tentativas"):
            client.login("user@example.com", "pass")


def test_restore_session_calls_client_loads():
    with patch("app.garmin.client.Garmin") as MockGarmin:
        mock_api = MagicMock()
        MockGarmin.return_value = mock_api

        client = GarminClient()
        client.restore_session({"di_token": "tok", "di_refresh_token": None, "di_client_id": None})

        mock_api.client.loads.assert_called_once()
        arg = mock_api.client.loads.call_args[0][0]
        assert '"di_token"' in arg


def test_get_activities_without_session_raises():
    client = GarminClient()
    with pytest.raises(GarminSyncError):
        client.get_activities("2026-01-01")


def test_get_activities_uses_no_limit_param():
    with patch("app.garmin.client.Garmin") as MockGarmin:
        mock_api = MagicMock()
        mock_api.get_activities_by_date.return_value = []
        MockGarmin.return_value = mock_api

        client = GarminClient()
        client._api = mock_api
        client.get_activities("2026-01-01", days=30)

        mock_api.get_activities_by_date.assert_called_once_with("2026-01-01")


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
    assert not client._is_running({"activityType": {"typeKey": "cycling"}})
    assert client._is_running({"activityType": {"typeKey": "running"}})
    assert client._is_running({"activityType": {"typeKey": "trail_running"}})
