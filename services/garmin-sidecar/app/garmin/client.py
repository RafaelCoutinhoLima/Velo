"""
Wrapper isolado do python-garminconnect v0.3.x.
Nunca loga credenciais ou tokens — filtros no logger do main.py cobrem.
"""
import json
import logging
from typing import Any, Optional

from garminconnect import Garmin
from garminconnect.client import (
    GarminConnectAuthenticationError,
    GarminConnectTooManyRequestsError,
)

logger = logging.getLogger("sidecar.garmin")


class GarminAuthError(Exception):
    pass


class GarminSyncError(Exception):
    pass


class GarminClient:
    def __init__(self) -> None:
        self._api: Optional[Garmin] = None

    def login(self, email: str, password: str, mfa_code: Optional[str] = None) -> dict[str, Any]:
        try:
            prompt = (lambda: mfa_code) if mfa_code else None
            self._api = Garmin(email, password, prompt_mfa=prompt)
            self._api.login()
            if not self._api.client.is_authenticated:
                raise GarminAuthError(
                    "Login falhou — verifique suas credenciais ou aguarde alguns minutos (limite de tentativas Garmin)"
                )
            tokens_str = self._api.client.dumps()
            tokens: dict[str, Any] = json.loads(tokens_str)
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

    def restore_session(self, tokens: dict[str, Any]) -> None:
        self._api = Garmin("", "")
        self._api.client.loads(json.dumps(tokens))

    def get_activities(self, start_date: str, days: int = 90) -> list[dict[str, Any]]:
        if not self._api:
            raise GarminSyncError("Sessão Garmin não inicializada")
        try:
            raw = self._api.get_activities_by_date(start_date)
        except Exception as exc:
            raise GarminSyncError(f"Falha ao buscar atividades: {type(exc).__name__}") from exc

        # Loga tipos vistos vs aceitos pra detectar filtros perdendo treinos
        # (ex: usuário corre na esteira = treadmill_running, antes era filtrado).
        seen_types: dict[str, int] = {}
        kept: list[dict[str, Any]] = []
        for a in raw:
            type_key = (a.get("activityType") or {}).get("typeKey", "unknown")
            seen_types[type_key] = seen_types.get(type_key, 0) + 1
            if self._is_running(a):
                kept.append(self._normalize(a))
        logger.info(
            "Garmin sync: %d atividades totais, %d running aceitas. Tipos vistos: %s",
            len(raw),
            len(kept),
            seen_types,
        )
        return kept

    def upload_workout(self, workout_data: dict[str, Any]) -> str:
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

    # Garmin tem múltiplos sub-tipos de "running" — todos contam:
    #   running          → outdoor street run padrão
    #   trail_running    → trilha
    #   treadmill_running → esteira
    #   track_running    → pista (atletismo)
    #   street_running   → variação que aparece em alguns dispositivos
    #   virtual_run      → corrida virtual (apps tipo Zwift)
    #   indoor_running   → alguns Forerunner usam isso pra esteira
    # NÃO conta: walking, hiking, cycling, swimming, etc.
    _RUN_TYPES = frozenset({
        "running",
        "trail_running",
        "treadmill_running",
        "track_running",
        "street_running",
        "virtual_run",
        "indoor_running",
    })

    @classmethod
    def _is_running(cls, item: dict[str, Any]) -> bool:
        type_key = (item.get("activityType") or {}).get("typeKey")
        return type_key in cls._RUN_TYPES

    @staticmethod
    def _normalize(item: dict[str, Any]) -> dict[str, Any]:
        speed = item.get("averageSpeed", 0)
        avg_pace_s = int(1000 / speed) if speed > 0 else 0
        # Garmin grava RPE/sensação subjetiva em campos diferentes dependendo
        # do dispositivo e firmware. Tentamos os mais comuns:
        #   perceivedEffort      → escala 1-10 explícita do app/connect
        #   directSubjectiveFeel → feedback "como me senti" do relógio
        #   subjectiveFeel       → variação antiga
        # Pegamos o primeiro não-null, deixa a API normalizar pra 1-10.
        perceived = (
            item.get("perceivedEffort")
            or item.get("directSubjectiveFeel")
            or item.get("subjectiveFeel")
        )
        return {
            "garmin_id": str(item["activityId"]),
            "date": item["startTimeLocal"][:10],
            "distance_m": int(item.get("distance", 0)),
            "duration_s": int(item.get("duration", 0)),
            "avg_hr": item.get("averageHR"),
            "avg_pace_s": avg_pace_s,
            "perceived_effort": perceived,
            "raw": item,
        }
