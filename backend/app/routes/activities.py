"""
US-03: importar e listar atividades de corrida do Garmin.
"""
from fastapi import APIRouter, Header, HTTPException
from app.models.activity import Activity

router = APIRouter()


def get_activities_from_db(token: str) -> list[dict]:
    """Stub — será substituído pela chamada real ao Supabase."""
    raise NotImplementedError


@router.get("/activities", response_model=list[Activity])
def list_activities(authorization: str | None = Header(default=None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token ausente")
    token = authorization.removeprefix("Bearer ")
    return get_activities_from_db(token)
