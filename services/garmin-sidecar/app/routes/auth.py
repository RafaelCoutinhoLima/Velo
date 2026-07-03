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
        # Detalhe do Garmin (pode ecoar e-mail/motivo) fica só no log do sidecar;
        # ao chamador vai mensagem genérica.
        logger.error("GarminAuthError: %s | causa: %s", exc, exc.__cause__)
        raise HTTPException(
            status_code=401, detail="Falha na autenticação com o Garmin"
        ) from exc

    return AuthResponse(session=tokens)
