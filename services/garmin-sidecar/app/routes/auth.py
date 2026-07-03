import logging
from fastapi import APIRouter, HTTPException
from app.models import AuthRequest, AuthResponse
from app.garmin.client import GarminClient, GarminAuthError

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger("sidecar.auth")


@router.post("", response_model=AuthResponse)
async def garmin_login(body: AuthRequest) -> AuthResponse:
    client = GarminClient()
    try:
        tokens = client.login(body.email, body.password, body.mfa_code)
    except GarminAuthError as exc:
        # As mensagens de GarminAuthError são CURADAS (client.py não interpola o
        # erro cru do Garmin), então são seguras e úteis para o usuário
        # ("credenciais inválidas", "muitas tentativas, aguarde"). A causa crua
        # fica só no log.
        logger.error("GarminAuthError: %s | causa: %s", exc, exc.__cause__)
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    return AuthResponse(session=tokens)
