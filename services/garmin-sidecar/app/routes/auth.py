from fastapi import APIRouter, HTTPException
from app.models import AuthRequest, AuthResponse
from app.garmin.client import GarminClient, GarminAuthError

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("", response_model=AuthResponse)
async def garmin_login(body: AuthRequest) -> AuthResponse:
    client = GarminClient()
    try:
        tokens = client.login(body.email, body.password, body.mfa_code)
    except GarminAuthError as exc:
        raise HTTPException(
            status_code=401,
            detail="Garmin com problema de login no momento. Tente novamente em alguns minutos.",
        ) from exc

    return AuthResponse(session=tokens)
