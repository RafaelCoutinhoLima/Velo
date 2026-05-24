from typing import Any, Optional

from pydantic import BaseModel, Field


class AuthRequest(BaseModel):
    email: str
    password: str
    mfa_code: Optional[str] = None


class AuthResponse(BaseModel):
    session: dict[str, Any]  # client.dumps() serializado — necessário para restore_session


class MetricsResponse(BaseModel):
    activities: list[dict[str, Any]]


class WorkoutRequest(BaseModel):
    athlete_id: str
    # DTO Garmin montado pela API (workoutBuilder.ts) — fonte única.
    workout: dict[str, Any]
    schedule_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
