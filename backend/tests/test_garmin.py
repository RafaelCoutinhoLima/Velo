"""
US-02 / US-03: wrapper do python-garminconnect.
Testa a lógica do wrapper sem fazer chamadas reais à API Garmin.
"""
import pytest
from unittest.mock import MagicMock, patch, create_autospec
from app.garmin import GarminClient, GarminAuthError, GarminSyncError


def _make_mock_api() -> MagicMock:
    """Retorna um MagicMock que imita a interface da classe Garmin."""
    mock = MagicMock()
    mock.garth = MagicMock()
    return mock


class TestGarminClientConnect:
    def test_connect_returns_tokens_on_success(self):
        mock_api = _make_mock_api()
        mock_api.garth.dump.return_value = {"tokens": "abc"}

        with patch("app.garmin.Garmin", return_value=mock_api):
            client = GarminClient()
            tokens = client.connect(email="a@b.com", password="pass")

        assert tokens == {"tokens": "abc"}
        mock_api.login.assert_called_once()

    def test_connect_raises_auth_error_on_login_failure(self):
        mock_api = _make_mock_api()
        mock_api.login.side_effect = Exception("Invalid credentials")

        with patch("app.garmin.Garmin", return_value=mock_api):
            client = GarminClient()
            with pytest.raises(GarminAuthError):
                client.connect(email="bad@b.com", password="wrong")

    def test_restore_from_tokens(self):
        mock_api = _make_mock_api()

        with patch("app.garmin.Garmin", return_value=mock_api):
            client = GarminClient()
            client.restore({"tokens": "abc"})

        mock_api.garth.loads.assert_called_once_with({"tokens": "abc"})


class TestGarminClientActivities:
    def _client_with_api(self) -> tuple[GarminClient, MagicMock]:
        """Cria um GarminClient já autenticado com um mock de _api."""
        mock_api = _make_mock_api()
        client = GarminClient()
        client._api = mock_api
        return client, mock_api

    def test_get_running_activities_filters_only_running(self):
        client, mock_api = self._client_with_api()
        mock_api.get_activities.return_value = [
            {
                "activityId": "1",
                "activityType": {"typeKey": "running"},
                "startTimeLocal": "2026-04-20 08:00:00",
                "distance": 5200.0,
                "duration": 1800.0,
                "averageSpeed": 2.89,
                "averageHR": 145.0,
                "maxHR": 168.0,
            },
            {
                "activityId": "2",
                "activityType": {"typeKey": "cycling"},
                "startTimeLocal": "2026-04-19 07:00:00",
                "distance": 20000.0,
                "duration": 3600.0,
                "averageSpeed": 5.5,
                "averageHR": 130.0,
                "maxHR": 155.0,
            },
        ]

        activities = client.get_running_activities(limit=20)

        assert len(activities) == 1
        assert activities[0]["garmin_id"] == "1"
        assert activities[0]["activity_type"] == "running"

    def test_get_running_activities_maps_fields_correctly(self):
        client, mock_api = self._client_with_api()
        mock_api.get_activities.return_value = [
            {
                "activityId": "99",
                "activityType": {"typeKey": "running"},
                "startTimeLocal": "2026-04-20 08:00:00",
                "distance": 3000.0,
                "duration": 900.0,
                "averageSpeed": 3.33,
                "averageHR": 155.0,
                "maxHR": 175.0,
            }
        ]

        activities = client.get_running_activities(limit=20)
        a = activities[0]

        assert a["garmin_id"] == "99"
        assert a["distance_km"] == pytest.approx(3.0, abs=0.01)
        assert a["duration_seconds"] == 900
        assert a["avg_hr"] == 155
        assert a["max_hr"] == 175

    def test_get_running_activities_raises_on_api_error(self):
        client, mock_api = self._client_with_api()
        mock_api.get_activities.side_effect = Exception("API down")

        with pytest.raises(GarminSyncError):
            client.get_running_activities(limit=20)

    def test_get_running_activities_respects_limit(self):
        client, mock_api = self._client_with_api()
        mock_api.get_activities.return_value = []

        client.get_running_activities(limit=20)

        mock_api.get_activities.assert_called_once_with(0, 20)

    def test_activity_with_missing_hr_fields_uses_zero(self):
        """Garmin às vezes omite HR em atividades sem sensor cardíaco."""
        client, mock_api = self._client_with_api()
        mock_api.get_activities.return_value = [
            {
                "activityId": "77",
                "activityType": {"typeKey": "running"},
                "startTimeLocal": "2026-04-20 08:00:00",
                "distance": 5000.0,
                "duration": 1500.0,
                "averageSpeed": 3.33,
                # averageHR e maxHR ausentes intencionalmente
            }
        ]

        activities = client.get_running_activities(limit=20)

        assert activities[0]["avg_hr"] == 0
        assert activities[0]["max_hr"] == 0


class TestGarminWorkout:
    def _client_with_api(self) -> tuple[GarminClient, MagicMock]:
        mock_api = _make_mock_api()
        client = GarminClient()
        client._api = mock_api
        return client, mock_api

    def test_schedule_workout_calls_api(self):
        client, mock_api = self._client_with_api()

        client.schedule_workout(workout_id="w123", date="2026-04-25")

        mock_api.schedule_workout.assert_called_once_with("w123", "2026-04-25")

    def test_schedule_workout_raises_on_failure(self):
        client, mock_api = self._client_with_api()
        mock_api.schedule_workout.side_effect = Exception("Garmin error")

        with pytest.raises(GarminSyncError):
            client.schedule_workout(workout_id="w123", date="2026-04-25")
