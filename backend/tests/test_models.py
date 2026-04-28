"""
Validação dos modelos Pydantic — garante que o schema da API é robusto.
"""
import pytest
from pydantic import ValidationError
from app.models.activity import Activity
from app.models.athlete_profile import AthleteProfile, HRZone, PaceZone
from app.models.training_plan import TrainingPlan, TrainingWeek, TrainingDay


class TestActivityModel:
    def test_valid_running_activity(self):
        a = Activity(
            garmin_id="abc123",
            date="2026-04-20",
            distance_km=5.2,
            duration_seconds=1800,
            avg_pace_sec=346,
            avg_hr=145,
            max_hr=168,
            activity_type="running",
        )
        assert a.distance_km == 5.2
        assert a.activity_type == "running"

    def test_negative_distance_raises(self):
        with pytest.raises(ValidationError):
            Activity(
                garmin_id="abc123",
                date="2026-04-20",
                distance_km=-1.0,
                duration_seconds=1800,
                avg_pace_sec=346,
                avg_hr=145,
                max_hr=168,
                activity_type="running",
            )

    def test_zero_duration_raises(self):
        with pytest.raises(ValidationError):
            Activity(
                garmin_id="abc123",
                date="2026-04-20",
                distance_km=5.0,
                duration_seconds=0,
                avg_pace_sec=346,
                avg_hr=145,
                max_hr=168,
                activity_type="running",
            )

    def test_max_hr_below_avg_hr_raises(self):
        with pytest.raises(ValidationError):
            Activity(
                garmin_id="abc123",
                date="2026-04-20",
                distance_km=5.0,
                duration_seconds=1800,
                avg_pace_sec=346,
                avg_hr=170,
                max_hr=160,
                activity_type="running",
            )

    def test_missing_required_field_raises(self):
        with pytest.raises(ValidationError):
            Activity(
                date="2026-04-20",
                distance_km=5.0,
                duration_seconds=1800,
            )


class TestAthleteProfile:
    def _valid_hr_zones(self):
        boundaries = [
            (60, 138), (139, 153), (154, 162), (163, 172), (173, 190)
        ]
        return [
            HRZone(zone=i + 1, min_bpm=lo, max_bpm=hi)
            for i, (lo, hi) in enumerate(boundaries)
        ]

    def _valid_pace_zones(self):
        return [
            PaceZone(zone=1, min_sec=420, max_sec=480),
            PaceZone(zone=2, min_sec=330, max_sec=420),
            PaceZone(zone=3, min_sec=270, max_sec=330),
        ]

    def test_valid_athlete_profile(self):
        profile = AthleteProfile(
            user_id="user-uuid",
            max_hr=190,
            resting_hr=55,
            threshold_pace_sec=360,
            hr_zones=self._valid_hr_zones(),
            pace_zones=self._valid_pace_zones(),
        )
        assert profile.max_hr == 190
        assert len(profile.hr_zones) == 5
        assert len(profile.pace_zones) == 3

    def test_max_hr_below_resting_raises(self):
        with pytest.raises(ValidationError):
            AthleteProfile(
                user_id="user-uuid",
                max_hr=50,
                resting_hr=55,
                threshold_pace_sec=360,
                hr_zones=self._valid_hr_zones(),
                pace_zones=self._valid_pace_zones(),
            )

    def test_wrong_number_of_hr_zones_raises(self):
        with pytest.raises(ValidationError):
            AthleteProfile(
                user_id="user-uuid",
                max_hr=190,
                resting_hr=55,
                threshold_pace_sec=360,
                hr_zones=self._valid_hr_zones()[:3],  # only 3 instead of 5
                pace_zones=self._valid_pace_zones(),
            )

    def test_wrong_number_of_pace_zones_raises(self):
        with pytest.raises(ValidationError):
            AthleteProfile(
                user_id="user-uuid",
                max_hr=190,
                resting_hr=55,
                threshold_pace_sec=360,
                hr_zones=self._valid_hr_zones(),
                pace_zones=self._valid_pace_zones()[:1],  # only 1 instead of 3
            )


class TestTrainingDayModel:
    def test_valid_training_day(self):
        day = TrainingDay(
            day_of_week=1,
            workout_type="easy_run",
            duration_minutes=45,
            target_zone=2,
            instruction="Corrida leve em Z2, mantenha conversa",
        )
        assert day.workout_type == "easy_run"

    def test_rest_day_has_no_zone(self):
        day = TrainingDay(
            day_of_week=3,
            workout_type="rest",
            duration_minutes=0,
            target_zone=None,
            instruction="Descanso",
        )
        assert day.target_zone is None

    def test_invalid_day_of_week_raises(self):
        with pytest.raises(ValidationError):
            TrainingDay(
                day_of_week=8,  # must be 1–7
                workout_type="easy_run",
                duration_minutes=45,
                target_zone=2,
                instruction="test",
            )

    def test_invalid_target_zone_raises(self):
        with pytest.raises(ValidationError):
            TrainingDay(
                day_of_week=1,
                workout_type="easy_run",
                duration_minutes=45,
                target_zone=6,  # must be 1–5
                instruction="test",
            )


class TestTrainingPlan:
    def _make_day(self, wtype="easy_run"):
        return TrainingDay(
            day_of_week=1,
            workout_type=wtype,
            duration_minutes=45,
            target_zone=2 if wtype != "rest" else None,
            instruction="test",
        )

    def test_valid_plan(self):
        week = TrainingWeek(
            week_number=1,
            days=[self._make_day(), self._make_day("rest"), self._make_day("long_run")],
            total_km=30.0,
        )
        plan = TrainingPlan(
            user_id="user-uuid",
            goal_distance_km=10.0,
            weeks=[week],
        )
        assert len(plan.weeks) == 1

    def test_empty_weeks_raises(self):
        with pytest.raises(ValidationError):
            TrainingPlan(
                user_id="user-uuid",
                goal_distance_km=10.0,
                weeks=[],
            )

    def test_negative_goal_distance_raises(self):
        week = TrainingWeek(
            week_number=1,
            days=[self._make_day()],
            total_km=30.0,
        )
        with pytest.raises(ValidationError):
            TrainingPlan(
                user_id="user-uuid",
                goal_distance_km=-5.0,
                weeks=[week],
            )
