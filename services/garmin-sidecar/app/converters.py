"""Conversão de sessão FitSync -> Garmin workout DTO (generation_spec.md §5).

Espelha apps/api/src/garmin/workoutBuilder.ts no lado Python. Produz o DTO
real que `garminconnect.upload_workout` aceita (ExecutableStepDTO /
RepeatGroupDTO / workoutSegments), não o intermediário ilustrativo do spec.

Caminho de uso: o sidecar recebe o `workout` já montado pela API (fluxo
atual). Quando recebe apenas `session` + `zones`, monta o DTO aqui.
"""

from __future__ import annotations

from typing import Any, Optional

SPORT_RUNNING = {"sportTypeId": 1, "sportTypeKey": "running"}

STEP_TYPES = {
    "warmup": {"stepTypeId": 1, "stepTypeKey": "warmup"},
    "cooldown": {"stepTypeId": 2, "stepTypeKey": "cooldown"},
    "interval": {"stepTypeId": 3, "stepTypeKey": "interval"},
    "recovery": {"stepTypeId": 4, "stepTypeKey": "recovery"},
    "repeat": {"stepTypeId": 6, "stepTypeKey": "repeat"},
}

END_CONDITION_TIME = {"conditionTypeId": 2, "conditionTypeKey": "time"}
END_CONDITION_ITERATIONS = {"conditionTypeId": 7, "conditionTypeKey": "iterations"}

TARGET_NONE = {"workoutTargetTypeId": 1, "workoutTargetTypeKey": "no.target"}
TARGET_HR = {"workoutTargetTypeId": 2, "workoutTargetTypeKey": "heart.rate.zone"}


def zone_to_garmin_zone(zona: Optional[str]) -> int:
    """'Z1'..'Z5' -> índice numérico 1..5 (0 se desconhecido)."""
    if not zona:
        return 0
    digits = "".join(ch for ch in zona if ch.isdigit())
    return int(digits) if digits else 0


def _zone_range(
    zona: Optional[str], zones: list[dict[str, Any]]
) -> Optional[dict[str, Any]]:
    idx = zone_to_garmin_zone(zona) - 1
    if 0 <= idx < len(zones):
        return zones[idx]
    return None


def _exec_step(
    order: int,
    step_type: str,
    duration_sec: int,
    hr_low: Optional[int] = None,
    hr_high: Optional[int] = None,
) -> dict[str, Any]:
    has_hr = bool(hr_low and hr_high and hr_low > 0 and hr_high > 0)
    step: dict[str, Any] = {
        "stepOrder": order,
        "type": "ExecutableStepDTO",
        "stepType": STEP_TYPES[step_type],
        "endCondition": END_CONDITION_TIME,
        "endConditionValue": duration_sec,
        "targetType": TARGET_HR if has_hr else TARGET_NONE,
    }
    if has_hr:
        step["targetValueOne"] = hr_low
        step["targetValueTwo"] = hr_high
    return step


def _repeat_step(
    order: int, iterations: int, child_steps: list[dict[str, Any]]
) -> dict[str, Any]:
    return {
        "stepOrder": order,
        "type": "RepeatGroupDTO",
        "stepType": STEP_TYPES["repeat"],
        "numberOfIterations": iterations,
        "smartRepeat": False,
        "endCondition": END_CONDITION_ITERATIONS,
        "endConditionValue": iterations,
        "workoutSteps": child_steps,
    }


def session_to_garmin_steps(
    session: dict[str, Any], zones: Optional[list[dict[str, Any]]] = None
) -> list[dict[str, Any]]:
    """Monta os workoutSteps a partir de aquecimento/parte_principal/desaquecimento."""
    zones = zones or []
    pp = session.get("parte_principal")
    steps: list[dict[str, Any]] = []
    order = 1

    aq = session.get("aquecimento")
    if aq and aq.get("duracao_min", 0) > 0:
        wz = _zone_range(aq.get("zona"), zones)
        steps.append(
            _exec_step(
                order,
                "warmup",
                int(aq["duracao_min"] * 60),
                wz.get("fc_min") if wz else None,
                wz.get("fc_max") if wz else None,
            )
        )
        order += 1

    if not pp:
        # Sem parte estruturada: bloco contínuo simples (fallback)
        total = int(session.get("duracao_total_min", session.get("duration_min", 0)) * 60)
        if total > 0:
            steps.append(_exec_step(order, "interval", total))
            order += 1
        return steps

    fc = pp.get("fc_alvo_bpm", {})
    hr_low, hr_high = fc.get("min"), fc.get("max")
    reps = pp.get("repeticoes")
    rep_min = pp.get("duracao_repeticao_min")

    if reps and reps > 1 and rep_min:
        work = _exec_step(1, "interval", int(rep_min * 60), hr_low, hr_high)
        child = [work]
        rec_min = pp.get("recuperacao_min")
        if rec_min and rec_min > 0:
            rz = _zone_range(pp.get("recuperacao_zona") or "Z1", zones)
            child.append(
                _exec_step(
                    2,
                    "recovery",
                    int(rec_min * 60),
                    rz.get("fc_min") if rz else None,
                    rz.get("fc_max") if rz else None,
                )
            )
        steps.append(_repeat_step(order, int(reps), child))
        order += 1
    else:
        warm_sec = int(session.get("aquecimento", {}).get("duracao_min", 0) * 60)
        cool_sec = int(session.get("desaquecimento", {}).get("duracao_min", 0) * 60)
        total = int(
            session.get("duracao_total_min", session.get("duration_min", 0)) * 60
        )
        main_sec = max(60, total - warm_sec - cool_sec)
        steps.append(_exec_step(order, "interval", main_sec, hr_low, hr_high))
        order += 1

    dq = session.get("desaquecimento")
    if dq and dq.get("duracao_min", 0) > 0:
        cz = _zone_range(dq.get("zona"), zones)
        steps.append(
            _exec_step(
                order,
                "cooldown",
                int(dq["duracao_min"] * 60),
                cz.get("fc_min") if cz else None,
                cz.get("fc_max") if cz else None,
            )
        )
        order += 1

    return steps


def session_to_garmin_workout(
    session: dict[str, Any],
    name: str,
    zones: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    """DTO completo pronto para garminconnect.upload_workout."""
    steps = session_to_garmin_steps(session, zones)
    description = str(session.get("description", ""))[:500]
    return {
        "workoutName": name,
        "description": description,
        "sportType": SPORT_RUNNING,
        "workoutSegments": [
            {
                "segmentOrder": 1,
                "sportType": SPORT_RUNNING,
                "workoutSteps": steps,
            }
        ],
    }
