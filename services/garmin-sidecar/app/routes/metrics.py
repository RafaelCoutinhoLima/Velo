import json
import logging
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query

from app.garmin.client import GarminClient, GarminSessionExpiredError, GarminSyncError

router = APIRouter(prefix="/metrics", tags=["metrics"])
logger = logging.getLogger("sidecar.metrics")


@router.get("")
async def get_metrics(
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    days: int = Query(default=90, ge=1, le=365),
    x_garmin_token: str = Header(...),
) -> dict[str, Any]:
    client = GarminClient()
    try:
        tokens = json.loads(x_garmin_token)
    except json.JSONDecodeError as exc:
        # Token do Vault malformado — não é erro do Garmin.
        logger.error("x-garmin-token não é JSON válido: %s", exc)
        raise HTTPException(status_code=400, detail="Token Garmin inválido") from exc

    try:
        client.restore_session(tokens)
        activities = client.get_activities(start_date=date, days=days)
    except GarminSessionExpiredError as exc:
        # 401 distinto → a API traduz para "reconecte o Garmin" (não é erro
        # genérico de sync).
        logger.warning("Sessão Garmin expirada: %s", exc)
        raise HTTPException(status_code=401, detail="Sessão Garmin expirada") from exc
    except GarminSyncError as exc:
        # Loga a causa real (o RedactingFilter scrub-a credenciais) para
        # diagnóstico — antes o 502 saía sem nenhuma pista do motivo.
        logger.error("Sync Garmin falhou: %s | causa: %s", exc, exc.__cause__)
        raise HTTPException(status_code=502, detail="Falha ao buscar dados do Garmin") from exc
    except Exception as exc:
        logger.error("Erro inesperado no sync Garmin: %s: %s", type(exc).__name__, exc)
        raise HTTPException(status_code=502, detail="Falha ao buscar dados do Garmin") from exc

    return {"activities": activities}
