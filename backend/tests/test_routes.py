"""
Testes de integração das rotas FastAPI.
Serviços externos (Garmin, Claude, Supabase) são mockados.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app

client = TestClient(app)


class TestActivitiesRoute:
    def test_get_activities_returns_200(self):
        mock_activities = [
            {
                "garmin_id": "1",
                "date": "2026-04-20",
                "distance_km": 5.2,
                "duration_seconds": 1800,
                "avg_pace_sec": 346,
                "avg_hr": 145,
                "max_hr": 168,
                "activity_type": "running",
            }
        ]
        with patch("app.routes.activities.get_activities_from_db", return_value=mock_activities):
            response = client.get("/activities", headers={"Authorization": "Bearer test-token"})
        assert response.status_code == 200

    def test_get_activities_returns_list(self):
        with patch("app.routes.activities.get_activities_from_db", return_value=[]):
            response = client.get("/activities", headers={"Authorization": "Bearer test-token"})
        assert isinstance(response.json(), list)

    def test_get_activities_without_auth_returns_401(self):
        response = client.get("/activities")
        assert response.status_code == 401


class TestPlansRoute:
    def _valid_payload(self):
        return {"goal_distance_km": 10.0, "weeks": 8, "days_per_week": 3}

    def test_generate_plan_returns_201(self):
        mock_plan = {
            "user_id": "user-1",
            "goal_distance_km": 10.0,
            "weeks": [
                {
                    "week_number": 1,
                    "total_km": 25.0,
                    "days": [
                        {
                            "day_of_week": 1,
                            "workout_type": "easy_run",
                            "duration_minutes": 40,
                            "target_zone": 2,
                            "instruction": "Corrida leve",
                        }
                    ],
                }
            ],
        }
        with patch("app.routes.plans.generate_plan", return_value=mock_plan), \
             patch("app.routes.plans.get_athlete_profile", return_value={"user_id": "u1"}):
            response = client.post(
                "/plans/generate",
                json=self._valid_payload(),
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 201  # valor exato, não intervalo

    def test_generate_plan_without_auth_returns_401(self):
        response = client.post("/plans/generate", json=self._valid_payload())
        assert response.status_code == 401

    def test_generate_plan_invalid_distance_returns_422(self):
        payload = {**self._valid_payload(), "goal_distance_km": -1.0}
        # sem patch: Pydantic rejeita antes de qualquer lógica de negócio
        response = client.post(
            "/plans/generate",
            json=payload,
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 422

    def test_generate_plan_zero_distance_returns_422(self):
        payload = {**self._valid_payload(), "goal_distance_km": 0.0}
        response = client.post(
            "/plans/generate",
            json=payload,
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 422


class TestFeedbackRoute:
    def test_post_feedback_returns_201(self):
        payload = {"workout_id": "w1", "rating": "hard"}
        with patch("app.routes.feedback.save_feedback", return_value=None), \
             patch("app.routes.feedback.get_recent_feedbacks", return_value=["easy", "medium", "hard"]):
            response = client.post(
                "/feedback",
                json=payload,
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 201

    def test_post_feedback_recalibration_signal_is_in_response(self):
        """Garante que o campo recalibration_signal existe na resposta."""
        payload = {"workout_id": "w1", "rating": "hard"}
        with patch("app.routes.feedback.save_feedback", return_value=None), \
             patch("app.routes.feedback.get_recent_feedbacks", return_value=["easy", "medium", "hard"]):
            response = client.post(
                "/feedback",
                json=payload,
                headers={"Authorization": "Bearer test-token"},
            )
        assert "recalibration_signal" in response.json()

    def test_post_feedback_three_hard_returns_reduce_signal(self):
        """US-10: 3 feedbacks 'difícil' consecutivos devem retornar sinal 'reduce'."""
        payload = {"workout_id": "w1", "rating": "hard"}
        with patch("app.routes.feedback.save_feedback", return_value=None), \
             patch("app.routes.feedback.get_recent_feedbacks", return_value=["hard", "hard", "hard"]):
            response = client.post(
                "/feedback",
                json=payload,
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 201
        assert response.json()["recalibration_signal"] == "reduce"

    def test_post_feedback_three_easy_returns_increase_signal(self):
        """US-10: 3 feedbacks 'fácil' consecutivos devem retornar sinal 'increase'."""
        payload = {"workout_id": "w1", "rating": "easy"}
        with patch("app.routes.feedback.save_feedback", return_value=None), \
             patch("app.routes.feedback.get_recent_feedbacks", return_value=["easy", "easy", "easy"]):
            response = client.post(
                "/feedback",
                json=payload,
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.json()["recalibration_signal"] == "increase"

    def test_post_feedback_mixed_ratings_returns_no_signal(self):
        payload = {"workout_id": "w1", "rating": "medium"}
        with patch("app.routes.feedback.save_feedback", return_value=None), \
             patch("app.routes.feedback.get_recent_feedbacks", return_value=["hard", "easy", "medium"]):
            response = client.post(
                "/feedback",
                json=payload,
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.json()["recalibration_signal"] is None

    def test_post_feedback_uses_historical_feedbacks_not_just_current(self):
        """Garante que a rota consulta o histórico e não apenas o rating atual."""
        payload = {"workout_id": "w1", "rating": "easy"}
        with patch("app.routes.feedback.save_feedback", return_value=None) as mock_save, \
             patch("app.routes.feedback.get_recent_feedbacks", return_value=["hard", "hard", "hard"]) as mock_history:
            response = client.post(
                "/feedback",
                json=payload,
                headers={"Authorization": "Bearer test-token"},
            )
        # get_recent_feedbacks deve ter sido chamado — prova que a rota consulta histórico
        mock_history.assert_called_once()
        # o sinal vem dos 3 "hard" históricos, não do "easy" atual
        assert response.json()["recalibration_signal"] == "reduce"

    def test_post_feedback_invalid_rating_returns_422(self):
        payload = {"workout_id": "w1", "rating": "super_hard"}
        response = client.post(
            "/feedback",
            json=payload,
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code == 422

    def test_post_feedback_without_auth_returns_401(self):
        response = client.post("/feedback", json={"workout_id": "w1", "rating": "easy"})
        assert response.status_code == 401
