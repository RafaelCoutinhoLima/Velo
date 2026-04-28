"""
US-09 / US-10: registro de feedback e detecção de recalibração.
"""
from typing import Literal
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from app.services.feedback import check_recalibration_needed

router = APIRouter()

FeedbackRating = Literal["easy", "medium", "hard"]


class FeedbackRequest(BaseModel):
    workout_id: str
    rating: FeedbackRating


def save_feedback(token: str, workout_id: str, rating: str) -> None:
    """Stub — será substituído pela inserção real no Supabase."""
    raise NotImplementedError


def get_recent_feedbacks(token: str, limit: int = 3) -> list[str]:
    """Stub — retorna os últimos N ratings do usuário para checar recalibração."""
    raise NotImplementedError


@router.post("/feedback", status_code=201)
def post_feedback(
    body: FeedbackRequest,
    authorization: str | None = Header(default=None),
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token ausente")
    token = authorization.removeprefix("Bearer ")
    save_feedback(token, body.workout_id, body.rating)
    # Busca histórico atualizado (inclui o que acabamos de salvar) para checar recalibração
    recent = get_recent_feedbacks(token, limit=3)
    signal = check_recalibration_needed(recent)
    return {"saved": True, "recalibration_signal": signal}
