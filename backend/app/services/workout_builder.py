"""
US-08: converte um dia de treino do plano em steps de workout para o Garmin.
Lógica pura — não faz chamadas de rede.
"""

_WARMUP_SECONDS = 5 * 60
_COOLDOWN_SECONDS = 5 * 60
_MIN_DURATION_SECONDS = (_WARMUP_SECONDS + _COOLDOWN_SECONDS) + 5 * 60  # 15 min total

_WORKOUT_LABELS: dict[str, str] = {
    "easy_run": "Corrida Leve",
    "long_run": "Longão",
    "intervals": "Intervalado",
    "tempo_run": "Tempo",
    "recovery_run": "Recuperação",
}


class WorkoutBuildError(Exception):
    pass


def build_workout(day: dict, date: str) -> dict | None:
    """
    Retorna um dict com name, sport_type, scheduled_date e steps,
    ou None se o dia for de descanso.
    """
    if day["workout_type"] == "rest":
        return None

    total_seconds = day["duration_minutes"] * 60
    if total_seconds < _MIN_DURATION_SECONDS:
        raise WorkoutBuildError(
            f"Duração de {day['duration_minutes']} min é curta demais. "
            f"Mínimo: {_MIN_DURATION_SECONDS // 60} min (aquecimento + treino + desaquecimento)."
        )

    label = _WORKOUT_LABELS.get(day["workout_type"], day["workout_type"])
    name = f"{date} — {label}"

    steps = _build_steps(day, total_seconds)

    return {
        "name": name,
        "sport_type": "running",
        "scheduled_date": date,
        "steps": steps,
    }


def _build_steps(day: dict, total_seconds: int) -> list[dict]:
    main_seconds = total_seconds - _WARMUP_SECONDS - _COOLDOWN_SECONDS
    zone = day.get("target_zone")
    workout_type = day["workout_type"]

    warmup = {"step_type": "warmup", "duration_seconds": _WARMUP_SECONDS, "target_zone": 1}
    cooldown = {"step_type": "cooldown", "duration_seconds": _COOLDOWN_SECONDS, "target_zone": 1}

    if workout_type == "intervals":
        return [warmup, _build_repeat_block(main_seconds, zone), cooldown]

    main = {"step_type": "interval", "duration_seconds": main_seconds, "target_zone": zone}
    return [warmup, main, cooldown]


def _build_repeat_block(main_seconds: int, zone: int | None) -> dict:
    """
    Bloco de repetições para treino intervalado.
    Estrutura: N repetições de (3min esforço + 2min recuperação).
    """
    rep_work_seconds = 3 * 60
    rep_rest_seconds = 2 * 60
    rep_cycle = rep_work_seconds + rep_rest_seconds
    reps = max(1, main_seconds // rep_cycle)

    return {
        "step_type": "repeat",
        "duration_seconds": main_seconds,
        "target_zone": zone,
        "repetitions": reps,
        "repeat_steps": [
            {"step_type": "interval", "duration_seconds": rep_work_seconds, "target_zone": zone},
            {"step_type": "recovery", "duration_seconds": rep_rest_seconds, "target_zone": 1},
        ],
    }
