import json
from typing import Any

from fastapi import APIRouter, Header, HTTPException

from app.garmin.client import GarminClient, GarminSyncError
from app.models import WorkoutRequest

router = APIRouter(prefix="/workout", tags=["workout"])


@router.post("")
async def send_workout(
    body: WorkoutRequest,
    x_garmin_token: str = Header(...),
) -> dict[str, Any]:
    # Fonte única do conversor FitSync→Garmin: o DTO é montado na API
    # (apps/api/src/garmin/workoutBuilder.ts — o "adaptador Garmin"). O
    # sidecar só faz upload. Outros relógios (Apple/Coros) são Fase 2:
    # entram como novos adaptadores na API, não aqui.
    workout = body.workout
    if not workout:
        raise HTTPException(
            status_code=422,
            detail="Informe 'workout' (DTO Garmin montado pela API).",
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
