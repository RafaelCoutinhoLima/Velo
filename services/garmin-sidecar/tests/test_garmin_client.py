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


def test_get_activities_returns_all_sports_not_just_running():
    # ANTES filtrava não-corrida. AGORA importa TODAS (coach precisa da carga
    # total). Cada uma vem com o campo `sport`.
    raw_activities = [
        {
            "activityId": 1,
            "startTimeLocal": "2026-05-23 07:00:00",
            "distance": 2040,
            "duration": 904,
            "averageSpeed": 2.26,
            "activityType": {"typeKey": "treadmill_running"},
        },
        {
            "activityId": 2,
            "startTimeLocal": "2026-05-23 18:00:00",
            "distance": 40510,
            "duration": 7209,
            "averageSpeed": 5.62,
            "activityType": {"typeKey": "virtual_ride"},
        },
        {
            "activityId": 3,
            "startTimeLocal": "2026-05-20 12:00:00",
            "distance": 1200,
            "duration": 2570,
            "averageSpeed": 0.47,
            "activityType": {"typeKey": "lap_swimming"},
        },
    ]
    with patch("app.garmin.client.Garmin") as MockGarmin:
        mock_api = MagicMock()
        mock_api.get_activities_by_date.return_value = raw_activities
        MockGarmin.return_value = mock_api

        client = GarminClient()
        client._api = mock_api
        result = client.get_activities("2026-05-01", days=30)

        # Todas as 3 importadas (antes só a corrida entraria)
        assert len(result) == 3
        sports = {r["garmin_id"]: r["sport"] for r in result}
        assert sports["1"] == "run"
        assert sports["2"] == "bike"
        assert sports["3"] == "swim"


def test_classify_sport_maps_garmin_type_keys():
    cases = {
        # corrida (todas as variações)
        "running": "run",
        "trail_running": "run",
        "treadmill_running": "run",
        "track_running": "run",
        "virtual_run": "run",
        "indoor_running": "run",
        # bike
        "cycling": "bike",
        "road_biking": "bike",
        "mountain_biking": "bike",
        "indoor_cycling": "bike",
        "virtual_ride": "bike",
        # natação
        "lap_swimming": "swim",
        "open_water_swimming": "swim",
        # força / outros estruturados
        "strength_training": "strength",
        # desconhecido
        "walking": "other",
        "hiking": "other",
    }
    for type_key, expected in cases.items():
        assert GarminClient._classify_sport(type_key) == expected, (
            f"{type_key} deveria virar {expected}"
        )
    # edge: type_key vazio/None
    assert GarminClient._classify_sport(None) == "other"
    assert GarminClient._classify_sport("") == "other"


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


def test_normalize_tags_sport_from_activity_type():
    base = {
        "activityId": 9,
        "startTimeLocal": "2026-05-23 18:00:00",
        "distance": 40000,
        "duration": 7200,
        "averageSpeed": 5.5,
        "activityType": {"typeKey": "virtual_ride"},
    }
    assert GarminClient._normalize(base)["sport"] == "bike"
    # corrida na esteira (o bug original) vira 'run'
    base["activityType"] = {"typeKey": "treadmill_running"}
    assert GarminClient._normalize(base)["sport"] == "run"
    # activityType ausente → 'other' (não quebra)
    assert GarminClient._normalize({**base, "activityType": None})["sport"] == "other"


def test_normalize_extracts_perceived_effort_from_alternative_fields():
    # Garmin grava RPE/feel em campos diferentes dependendo do dispositivo.
    # _normalize tem fallback de perceivedEffort → directSubjectiveFeel → subjectiveFeel.
    base = {
        "activityId": 1,
        "startTimeLocal": "2026-01-15 07:30:00",
        "distance": 5000,
        "duration": 1800,
        "averageSpeed": 2.78,
        "activityType": {"typeKey": "running"},
    }
    # Campo padrão
    assert GarminClient._normalize({**base, "perceivedEffort": 6})["perceived_effort"] == 6
    # Fallback 1: dispositivo grava em directSubjectiveFeel
    assert GarminClient._normalize({**base, "directSubjectiveFeel": 4})["perceived_effort"] == 4
    # Fallback 2: firmware antigo
    assert GarminClient._normalize({**base, "subjectiveFeel": 5})["perceived_effort"] == 5
    # Preferência: perceivedEffort vence sobre os outros
    assert (
        GarminClient._normalize(
            {**base, "perceivedEffort": 6, "directSubjectiveFeel": 4}
        )["perceived_effort"]
        == 6
    )
    # Nenhum dos três → None (não bloqueia, deixa UI pedir manual)
    assert GarminClient._normalize(base)["perceived_effort"] is None
