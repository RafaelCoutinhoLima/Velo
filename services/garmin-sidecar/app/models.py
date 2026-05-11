from pydantic import BaseModel, Field
from typing import Optional


class AuthRequest(BaseModel):
    email: str
    password: str
    mfa_code: Optional[str] = None


class AuthResponse(BaseModel):
    di_token: str
    refresh_token: str
    expires_at: str


class MetricsResponse(BaseModel):
    activities: list[dict]


class WorkoutStep(BaseModel):
    order: int
    step_type: str
    duration_type: Optional[str] = None
    duration_value: Optional[int] = None
    target_type: Optional[str] = None
    target_value_low: Optional[int] = None
    target_value_high: Optional[int] = None
    description: Optional[str] = None


class WorkoutRequest(BaseModel):
    athlete_id: str
    workout: dict
    schedule_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
