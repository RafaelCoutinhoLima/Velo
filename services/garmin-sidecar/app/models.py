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
    # DTO Garmin já montado pela API (fluxo atual). Opcional se `session` vier.
    workout: dict = Field(default_factory=dict)
    schedule_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    # Caminho alternativo: sidecar monta o DTO via converters.py (generation_spec §5)
    session: Optional[dict] = None
    zones: Optional[list[dict]] = None
    workout_name: Optional[str] = None
