from fastapi import APIRouter, HTTPException, Header
from app.models import WorkoutRequest
from app.garmin.client import GarminClient, GarminSyncError
from app.converters import session_to_garmin_workout
import json

router = APIRouter(prefix="/workout", tags=["workout"])


@router.post("")
async def send_workout(
    body: WorkoutRequest,
    x_garmin_token: str = Header(...),
) -> dict:
    # DTO pronto (fluxo atual) tem precedência; senão monta via converters (spec §5)
    workout = body.workout
    if not workout and body.session:
        workout = session_to_garmin_workout(
            body.session,
            body.workout_name or "FitSync — Treino",
            body.zones,
        )
    if not workout:
        raise HTTPException(
            status_code=422,
            detail="Informe 'workout' (DTO) ou 'session' para montar o treino.",
        )

    client = GarminClient()
    try:
        tokens = json.loads(x_garmin_token)
        client.restore_session(tokens)
        workout_id = client.upload_workout(workout)
        client.schedule_workout(workout_id, body.schedule_date)
    except GarminSyncError as exc:
        raise HTTPException(
            status_code=502,
            detail="Não consegui enviar para o relógio. Tente novamente.",
        ) from exc

    return {"ok": True, "workout_id": workout_id}
