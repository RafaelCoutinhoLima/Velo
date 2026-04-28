from typing import Literal
from pydantic import BaseModel, field_validator

WorkoutType = Literal[
    "easy_run", "long_run", "intervals", "tempo_run", "recovery_run", "rest"
]


class TrainingDay(BaseModel):
    day_of_week: int       # 1 = segunda, 7 = domingo
    workout_type: WorkoutType
    duration_minutes: int
    target_zone: int | None
    instruction: str

    @field_validator("day_of_week")
    @classmethod
    def valid_day(cls, v: int) -> int:
        if not 1 <= v <= 7:
            raise ValueError("day_of_week deve estar entre 1 e 7")
        return v

    @field_validator("target_zone")
    @classmethod
    def valid_zone(cls, v: int | None) -> int | None:
        if v is not None and not 1 <= v <= 5:
            raise ValueError("target_zone deve estar entre 1 e 5")
        return v


class TrainingWeek(BaseModel):
    week_number: int
    days: list[TrainingDay]
    total_km: float


class TrainingPlan(BaseModel):
    user_id: str
    goal_distance_km: float
    weeks: list[TrainingWeek]

    @field_validator("weeks")
    @classmethod
    def must_have_at_least_one_week(cls, v: list[TrainingWeek]) -> list[TrainingWeek]:
        if not v:
            raise ValueError("O plano precisa ter pelo menos uma semana")
        return v

    @field_validator("goal_distance_km")
    @classmethod
    def goal_must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("goal_distance_km deve ser positivo")
        return v
