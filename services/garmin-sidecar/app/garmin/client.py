"""
Wrapper isolado do python-garminconnect v0.3.x.
Nunca loga credenciais ou tokens — filtros no logger do main.py cobrem.
"""
import json
import logging
from typing import Optional

from garminconnect import Garmin
from garminconnect.client import GarminConnectAuthenticationError, GarminConnectTooManyRequestsError

logger = logging.getLogger("sidecar.garmin")


class GarminAuthError(Exception):
    pass


class GarminSyncError(Exception):
    pass


class GarminClient:
    def __init__(self) -> None:
        self._api: Optional[Garmin] = None

    def login(self, email: str, password: str, mfa_code: Optional[str] = None) -> dict:
        try:
            prompt = (lambda: mfa_code) if mfa_code else None
            self._api = Garmin(email, password, prompt_mfa=prompt)
            self._api.login()
            if not self._api.client.is_authenticated:
                raise GarminAuthError(
                    "Login falhou — verifique suas credenciais ou aguarde alguns minutos (limite de tentativas Garmin)"
                )
            tokens_str = self._api.client.dumps()
            tokens = json.loads(tokens_str)
            logger.info("Login Garmin bem-sucedido para athlete (email=[REDACTED])")
            return tokens
        except GarminAuthError:
            raise
        except GarminConnectTooManyRequestsError as exc:
            raise GarminAuthError(
                "Muitas tentativas de login — aguarde alguns minutos antes de tentar novamente"
            ) from exc
        except GarminConnectAuthenticationError as exc:
            raise GarminAuthError(f"Credenciais inválidas: {exc}") from exc
        except Exception as exc:
            raise GarminAuthError(f"Falha no login Garmin: {type(exc).__name__}: {exc}") from exc

    def restore_session(self, tokens: dict) -> None:
        self._api = Garmin("", "")
        self._api.client.loads(json.dumps(tokens))

    def get_activities(self, start_date: str, days: int = 90) -> list[dict]:
        if not self._api:
            raise GarminSyncError("Sessão Garmin não inicializada")
        try:
            raw = self._api.get_activities_by_date(start_date)
        except Exception as exc:
            raise GarminSyncError(f"Falha ao buscar atividades: {type(exc).__name__}") from exc

        return [self._normalize(a) for a in raw if self._is_running(a)]

    def upload_workout(self, workout_data: dict) -> str:
        if not self._api:
            raise GarminSyncError("Sessão Garmin não inicializada")
        try:
            result = self._api.upload_workout(workout_data)
            return str(result.get("detailId", ""))
        except Exception as exc:
            raise GarminSyncError(f"Falha ao enviar workout: {type(exc).__name__}") from exc

    def schedule_workout(self, workout_id: str, date: str) -> None:
        if not self._api:
            raise GarminSyncError("Sessão Garmin não inicializada")
        try:
            self._api.schedule_workout(workout_id, date)
        except Exception as exc:
            raise GarminSyncError(f"Falha ao agendar workout: {type(exc).__name__}") from exc

    @staticmethod
    def _is_running(item: dict) -> bool:
        return item.get("activityType", {}).get("typeKey") in ("running", "trail_running")

    @staticmethod
    def _normalize(item: dict) -> dict:
        speed = item.get("averageSpeed", 0)
        avg_pace_s = int(1000 / speed) if speed > 0 else 0
        return {
            "garmin_id": str(item["activityId"]),
            "date": item["startTimeLocal"][:10],
            "distance_m": int(item.get("distance", 0)),
            "duration_s": int(item.get("duration", 0)),
            "avg_hr": item.get("averageHR"),
            "avg_pace_s": avg_pace_s,
            "perceived_effort": item.get("perceivedEffort"),
            "raw": item,
        }
