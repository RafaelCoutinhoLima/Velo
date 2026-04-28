"""
US-06: regras hard-coded de validação do plano de treino.
Progressão máx 10%, máx 1 treino intervalado/semana, descanso obrigatório.
"""
import pytest
from app.services.plan_rules import (
    validate_weekly_progression,
    count_interval_sessions,
    has_rest_day,
    validate_week,
)


class TestWeeklyProgression:
    def test_same_volume_is_valid(self):
        assert validate_weekly_progression(prev_km=30.0, new_km=30.0) is True

    def test_10_percent_increase_is_valid(self):
        assert validate_weekly_progression(prev_km=30.0, new_km=33.0) is True

    def test_just_above_10_percent_is_invalid(self):
        # 30 * 1.101 = 33.03
        assert validate_weekly_progression(prev_km=30.0, new_km=33.1) is False

    def test_decrease_is_always_valid(self):
        assert validate_weekly_progression(prev_km=30.0, new_km=20.0) is True

    def test_zero_prev_volume_accepts_any_new_volume(self):
        # primeira semana de treino — sem referência anterior
        assert validate_weekly_progression(prev_km=0.0, new_km=20.0) is True

    def test_negative_new_volume_raises(self):
        with pytest.raises(ValueError):
            validate_weekly_progression(prev_km=30.0, new_km=-5.0)


class TestIntervalSessions:
    def test_one_interval_session(self):
        week = [
            {"workout_type": "easy_run"},
            {"workout_type": "intervals"},
            {"workout_type": "rest"},
            {"workout_type": "long_run"},
        ]
        assert count_interval_sessions(week) == 1

    def test_two_interval_sessions(self):
        week = [
            {"workout_type": "intervals"},
            {"workout_type": "easy_run"},
            {"workout_type": "intervals"},
            {"workout_type": "rest"},
        ]
        assert count_interval_sessions(week) == 2

    def test_no_interval_sessions(self):
        week = [
            {"workout_type": "easy_run"},
            {"workout_type": "rest"},
            {"workout_type": "long_run"},
        ]
        assert count_interval_sessions(week) == 0

    def test_empty_week(self):
        assert count_interval_sessions([]) == 0


class TestRestDay:
    def test_week_with_rest_day(self):
        week = [
            {"workout_type": "easy_run"},
            {"workout_type": "rest"},
            {"workout_type": "long_run"},
        ]
        assert has_rest_day(week) is True

    def test_week_without_rest_day(self):
        week = [
            {"workout_type": "easy_run"},
            {"workout_type": "long_run"},
            {"workout_type": "intervals"},
        ]
        assert has_rest_day(week) is False

    def test_all_rest(self):
        week = [{"workout_type": "rest"}, {"workout_type": "rest"}]
        assert has_rest_day(week) is True


class TestValidateWeek:
    """Validação composta — agrega todas as regras numa só chamada."""

    def test_valid_week_passes(self):
        week_days = [
            {"workout_type": "easy_run"},
            {"workout_type": "intervals"},
            {"workout_type": "rest"},
            {"workout_type": "long_run"},
        ]
        errors = validate_week(days=week_days, prev_km=30.0, new_km=32.0)
        assert errors == []

    def test_too_many_intervals_returns_error(self):
        week_days = [
            {"workout_type": "intervals"},
            {"workout_type": "intervals"},
            {"workout_type": "rest"},
            {"workout_type": "easy_run"},
        ]
        errors = validate_week(days=week_days, prev_km=30.0, new_km=32.0)
        assert any("interval" in e.lower() for e in errors)

    def test_no_rest_day_returns_error(self):
        week_days = [
            {"workout_type": "easy_run"},
            {"workout_type": "long_run"},
            {"workout_type": "intervals"},
            {"workout_type": "easy_run"},
        ]
        errors = validate_week(days=week_days, prev_km=30.0, new_km=32.0)
        assert any("descanso" in e.lower() or "rest" in e.lower() for e in errors)

    def test_excess_progression_returns_error(self):
        week_days = [
            {"workout_type": "easy_run"},
            {"workout_type": "rest"},
            {"workout_type": "long_run"},
        ]
        errors = validate_week(days=week_days, prev_km=30.0, new_km=40.0)
        assert any("progress" in e.lower() or "volume" in e.lower() for e in errors)

    def test_multiple_violations_return_multiple_errors(self):
        week_days = [
            {"workout_type": "intervals"},
            {"workout_type": "intervals"},
            {"workout_type": "easy_run"},
        ]
        errors = validate_week(days=week_days, prev_km=30.0, new_km=40.0)
        assert len(errors) >= 2
