from fastapi import APIRouter, HTTPException, Header
from app.models import WorkoutRequest
from app.garmin.client import GarminClient, GarminSyncError
import json

router = APIRouter(prefix="/workout", tags=["workout"])


@router.post("")
async def send_workout(
    body: WorkoutRequest,
    x_garmin_token: str = Header(...),
) -> dict:
    client = GarminClient()
    try:
        tokens = json.loads(x_garmin_token)
        client.restore_session(tokens)
        workout_id = client.upload_workout(body.workout)
        client.schedule_workout(workout_id, body.schedule_date)
    except GarminSyncError as exc:
        raise HTTPException(
            status_code=502,
            detail="Não consegui enviar para o relógio. Tente novamente.",
        ) from exc

    return {"ok": True, "workout_id": workout_id}
