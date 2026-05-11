from fastapi import APIRouter, HTTPException, Header, Query
from app.garmin.client import GarminClient, GarminSyncError
import json

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("")
async def get_metrics(
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    days: int = Query(default=90, ge=1, le=365),
    x_garmin_token: str = Header(...),
) -> dict:
    client = GarminClient()
    try:
        tokens = json.loads(x_garmin_token)
        client.restore_session(tokens)
        activities = client.get_activities(start_date=date, days=days)
    except GarminSyncError as exc:
        raise HTTPException(status_code=502, detail="Falha ao buscar dados do Garmin") from exc

    return {"activities": activities}
