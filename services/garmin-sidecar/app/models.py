from pydantic import BaseModel, Field
from typing import Optional


class AuthRequest(BaseModel):
    email: str
    password: str
    mfa_code: Optional[str] = None


class AuthResponse(BaseModel):
    session: dict  # client.dumps() serializado — necessário para restore_session


class MetricsResponse(BaseModel):
    activities: list[dict]


class WorkoutRequest(BaseModel):
    athlete_id: str
    # DTO Garmin montado pela API (workoutBuilder.ts) — fonte única.
    workout: dict
    schedule_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
