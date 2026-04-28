from pydantic import BaseModel, field_validator, model_validator


class Activity(BaseModel):
    garmin_id: str
    date: str
    distance_km: float
    duration_seconds: int
    avg_pace_sec: int
    avg_hr: int
    max_hr: int
    activity_type: str

    @field_validator("distance_km")
    @classmethod
    def distance_must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("distance_km deve ser positivo")
        return v

    @field_validator("duration_seconds")
    @classmethod
    def duration_must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("duration_seconds deve ser positivo")
        return v

    @model_validator(mode="after")
    def max_hr_above_avg_hr(self) -> "Activity":
        if self.max_hr < self.avg_hr:
            raise ValueError("max_hr não pode ser menor que avg_hr")
        return self
