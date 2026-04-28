"""
US-06 / US-07 / US-08: geração e envio de planos de treino.
"""
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, field_validator

router = APIRouter()


class GeneratePlanRequest(BaseModel):
    goal_distance_km: float
    weeks: int
    days_per_week: int

    @field_validator("goal_distance_km")
    @classmethod
    def distance_must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("goal_distance_km deve ser positivo")
        return v


def get_athlete_profile(token: str) -> dict:
    """Stub — será substituído pela consulta real ao Supabase."""
    raise NotImplementedError


def generate_plan(profile: dict, goals: dict, recent: list) -> dict:
    """Stub — será substituído pelo PlanGenerator real."""
    raise NotImplementedError


@router.post("/plans/generate", status_code=201)
def create_plan(
    body: GeneratePlanRequest,
    authorization: str | None = Header(default=None),
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token ausente")
    token = authorization.removeprefix("Bearer ")
    profile = get_athlete_profile(token)
    plan = generate_plan(
        profile=profile,
        goals=body.model_dump(),
        recent=[],
    )
    return plan
