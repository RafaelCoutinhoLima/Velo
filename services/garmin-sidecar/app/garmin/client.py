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

        # Importa TODAS as atividades (não só corrida): o coach prescreve corrida
        # mas precisa enxergar a carga total (bike/natação/força) pra estimar
        # fadiga/ACWR. Cada uma vem normalizada com o campo `sport`.
        normalized = [self._normalize(a) for a in raw]
        by_sport: dict[str, int] = {}
        for n in normalized:
            by_sport[n["sport"]] = by_sport.get(n["sport"], 0) + 1
        logger.info(
            "Garmin sync: %d atividades importadas. Por esporte: %s",
            len(normalized),
            by_sport,
        )
        return normalized

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

    # Mapa typeKey do Garmin → nosso esporte normalizado.
    # Cobre as variações conhecidas; o que não casar cai na heurística por
    # substring em _classify_sport e, por fim, em "other".
    _SPORT_MAP = {
        # corrida (todas as superfícies/modos contam como 'run')
        "running": "run",
        "trail_running": "run",
        "treadmill_running": "run",
        "track_running": "run",
        "street_running": "run",
        "virtual_run": "run",
        "indoor_running": "run",
        "obstacle_run": "run",
        # bike
        "cycling": "bike",
        "road_biking": "bike",
        "mountain_biking": "bike",
        "gravel_cycling": "bike",
        "cyclocross": "bike",
        "track_cycling": "bike",
        "indoor_cycling": "bike",
        "virtual_ride": "bike",
        "recumbent_cycling": "bike",
        "e_bike_fitness": "bike",
        "bmx": "bike",
        # natação
        "lap_swimming": "swim",
        "open_water_swimming": "swim",
        "swimming": "swim",
        # força / cardio estruturado de academia
        "strength_training": "strength",
        "indoor_cardio": "strength",
        "pilates": "strength",
        "yoga": "strength",
    }

    @classmethod
    def _classify_sport(cls, type_key: Optional[str]) -> str:
        if not type_key:
            return "other"
        if type_key in cls._SPORT_MAP:
            return cls._SPORT_MAP[type_key]
        # Heurística por substring pra pegar variações de firmware não mapeadas.
        if "running" in type_key or type_key == "run":
            return "run"
        if "cycling" in type_key or "biking" in type_key or "bike" in type_key:
            return "bike"
        if "swimming" in type_key:
            return "swim"
        return "other"

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
        type_key = (item.get("activityType") or {}).get("typeKey")
        return {
            "garmin_id": str(item["activityId"]),
            "date": item["startTimeLocal"][:10],
            "sport": GarminClient._classify_sport(type_key),
            "distance_m": int(item.get("distance", 0)),
            "duration_s": int(item.get("duration", 0)),
            "avg_hr": item.get("averageHR"),
            "avg_pace_s": avg_pace_s,
            "perceived_effort": perceived,
            "raw": item,
        }
