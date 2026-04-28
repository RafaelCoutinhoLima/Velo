"""
US-08: conversão de TrainingDay → steps de workout Garmin.
Lógica pura — sem chamadas à API Garmin.
"""
import pytest
from app.services.workout_builder import build_workout, WorkoutBuildError


def _day(workout_type: str, duration_minutes: int = 40, target_zone: int | None = 2) -> dict:
    return {
        "workout_type": workout_type,
        "duration_minutes": duration_minutes,
        "target_zone": target_zone,
        "instruction": "teste",
    }


class TestBuildWorkout:
    def test_rest_day_returns_none(self):
        result = build_workout(_day("rest", 0, None), date="2026-04-25")
        assert result is None

    def test_easy_run_has_three_steps(self):
        w = build_workout(_day("easy_run"), date="2026-04-25")
        assert len(w["steps"]) == 3

    def test_easy_run_step_order_is_warmup_main_cooldown(self):
        w = build_workout(_day("easy_run"), date="2026-04-25")
        types = [s["step_type"] for s in w["steps"]]
        assert types == ["warmup", "interval", "cooldown"]

    def test_long_run_has_three_steps(self):
        w = build_workout(_day("long_run", 60), date="2026-04-25")
        assert len(w["steps"]) == 3

    def test_intervals_have_repeat_block(self):
        w = build_workout(_day("intervals", 45, 4), date="2026-04-25")
        types = [s["step_type"] for s in w["steps"]]
        assert "repeat" in types

    def test_main_step_duration_accounts_for_warmup_cooldown(self):
        """Aquecimento + desaquecimento = 10min; main = total - 10."""
        w = build_workout(_day("easy_run", duration_minutes=40), date="2026-04-25")
        main_step = next(s for s in w["steps"] if s["step_type"] == "interval")
        assert main_step["duration_seconds"] == 30 * 60  # 40 - 10 = 30min

    def test_warmup_is_always_5_minutes(self):
        w = build_workout(_day("easy_run"), date="2026-04-25")
        warmup = w["steps"][0]
        assert warmup["duration_seconds"] == 5 * 60

    def test_cooldown_is_always_5_minutes(self):
        w = build_workout(_day("easy_run"), date="2026-04-25")
        cooldown = w["steps"][-1]
        assert cooldown["duration_seconds"] == 5 * 60

    def test_workout_name_includes_date(self):
        w = build_workout(_day("easy_run"), date="2026-04-25")
        assert "2026-04-25" in w["name"]

    def test_workout_name_includes_type(self):
        w = build_workout(_day("long_run"), date="2026-04-25")
        assert "long_run" in w["name"].lower() or "longão" in w["name"].lower()

    def test_target_zone_is_preserved_in_main_step(self):
        w = build_workout(_day("easy_run", target_zone=3), date="2026-04-25")
        main_step = next(s for s in w["steps"] if s["step_type"] == "interval")
        assert main_step["target_zone"] == 3

    def test_duration_too_short_raises(self):
        """Treino < 15 min não faz sentido — aquecimento + desaquecimento = 10min."""
        with pytest.raises(WorkoutBuildError):
            build_workout(_day("easy_run", duration_minutes=8), date="2026-04-25")

    def test_workout_has_sport_type_running(self):
        w = build_workout(_day("easy_run"), date="2026-04-25")
        assert w["sport_type"] == "running"

    def test_recovery_run_target_is_zone1(self):
        w = build_workout(_day("recovery_run", 30, 1), date="2026-04-25")
        main_step = next(s for s in w["steps"] if s["step_type"] == "interval")
        assert main_step["target_zone"] == 1

    def test_tempo_run_has_three_steps(self):
        w = build_workout(_day("tempo_run", 50, 4), date="2026-04-25")
        assert len(w["steps"]) == 3


class TestBuildWorkoutSchema:
    """Verifica que o schema retornado tem todos os campos esperados."""

    def test_workout_has_required_top_level_keys(self):
        w = build_workout(_day("easy_run"), date="2026-04-25")
        assert "name" in w
        assert "sport_type" in w
        assert "scheduled_date" in w
        assert "steps" in w

    def test_each_step_has_required_keys(self):
        w = build_workout(_day("easy_run"), date="2026-04-25")
        for step in w["steps"]:
            assert "step_type" in step
            assert "duration_seconds" in step
