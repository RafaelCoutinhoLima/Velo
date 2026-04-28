"""
US-06: wrapper da Claude API para geração de plano de treino.
Testes com mock — sem chamadas reais à Anthropic.
"""
import json
import pytest
from unittest.mock import MagicMock, patch
from app.ai import PlanGenerator, AIGenerationError
from app.models.training_plan import TrainingPlan


def _make_valid_plan_json() -> str:
    return json.dumps({
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
                        "instruction": "Corrida leve Z2",
                    },
                    {
                        "day_of_week": 3,
                        "workout_type": "rest",
                        "duration_minutes": 0,
                        "target_zone": None,
                        "instruction": "Descanso",
                    },
                    {
                        "day_of_week": 6,
                        "workout_type": "long_run",
                        "duration_minutes": 60,
                        "target_zone": 2,
                        "instruction": "Longão tranquilo",
                    },
                ],
            }
        ],
    })


class TestPlanGenerator:
    def _make_generator(self):
        # Mocka tanto o cliente Anthropic quanto a leitura do arquivo de prompt,
        # para que os testes não dependam do filesystem.
        with patch("app.ai.anthropic.Anthropic"), \
             patch("app.ai._PROMPT_PATH") as mock_path:
            mock_path.read_text.return_value = "system prompt de teste"
            gen = PlanGenerator(api_key="sk-test")
            gen._client = MagicMock()
            return gen

    def test_generate_returns_training_plan(self):
        gen = self._make_generator()
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text=_make_valid_plan_json())]
        gen._client.messages.create.return_value = mock_message

        profile = {"user_id": "user-1", "max_hr": 190, "threshold_pace_sec": 360}
        goals = {"goal_distance_km": 10.0, "weeks": 8, "days_per_week": 3}
        recent = []

        plan = gen.generate(profile=profile, goals=goals, recent_activities=recent)

        assert isinstance(plan, TrainingPlan)
        assert plan.goal_distance_km == 10.0

    def test_generate_calls_claude_with_system_prompt(self):
        gen = self._make_generator()
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text=_make_valid_plan_json())]
        gen._client.messages.create.return_value = mock_message

        gen.generate(
            profile={"user_id": "u1", "max_hr": 185, "threshold_pace_sec": 350},
            goals={"goal_distance_km": 5.0, "weeks": 4, "days_per_week": 3},
            recent_activities=[],
        )

        call_kwargs = gen._client.messages.create.call_args.kwargs
        assert "system" in call_kwargs
        assert len(call_kwargs["system"]) > 0

    def test_generate_raises_on_invalid_json(self):
        gen = self._make_generator()
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text="texto livre sem JSON")]
        gen._client.messages.create.return_value = mock_message

        with pytest.raises(AIGenerationError):
            gen.generate(
                profile={"user_id": "u1", "max_hr": 185, "threshold_pace_sec": 350},
                goals={"goal_distance_km": 5.0, "weeks": 4, "days_per_week": 3},
                recent_activities=[],
            )

    def test_generate_raises_on_api_error(self):
        gen = self._make_generator()
        gen._client.messages.create.side_effect = Exception("API timeout")

        with pytest.raises(AIGenerationError):
            gen.generate(
                profile={"user_id": "u1", "max_hr": 185, "threshold_pace_sec": 350},
                goals={"goal_distance_km": 5.0, "weeks": 4, "days_per_week": 3},
                recent_activities=[],
            )

    def test_generate_validates_plan_rules(self):
        """Plano com progressão > 10% deve ser rejeitado mesmo que o JSON seja válido."""
        gen = self._make_generator()
        bad_plan = json.dumps({
            "user_id": "user-1",
            "goal_distance_km": 10.0,
            "weeks": [
                {
                    "week_number": 1,
                    "total_km": 20.0,
                    "days": [
                        {"day_of_week": 1, "workout_type": "easy_run",
                         "duration_minutes": 40, "target_zone": 2, "instruction": "ok"},
                        {"day_of_week": 3, "workout_type": "rest",
                         "duration_minutes": 0, "target_zone": None, "instruction": "ok"},
                    ],
                },
                {
                    "week_number": 2,
                    "total_km": 40.0,   # salto de 100% — inválido
                    "days": [
                        {"day_of_week": 1, "workout_type": "easy_run",
                         "duration_minutes": 60, "target_zone": 2, "instruction": "ok"},
                        {"day_of_week": 3, "workout_type": "rest",
                         "duration_minutes": 0, "target_zone": None, "instruction": "ok"},
                    ],
                },
            ],
        })
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text=bad_plan)]
        gen._client.messages.create.return_value = mock_message

        with pytest.raises(AIGenerationError, match="progress"):
            gen.generate(
                profile={"user_id": "user-1", "max_hr": 185, "threshold_pace_sec": 350},
                goals={"goal_distance_km": 10.0, "weeks": 4, "days_per_week": 3},
                recent_activities=[],
            )
