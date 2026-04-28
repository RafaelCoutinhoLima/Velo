"""
Regras hard-coded de validação do plano de treino (US-06).
Progressão máx 10%/semana, máx 1 treino intervalado, descanso obrigatório.
"""
_MAX_PROGRESSION_RATIO = 0.10
_MAX_INTERVAL_SESSIONS = 1


def validate_weekly_progression(prev_km: float, new_km: float) -> bool:
    if new_km < 0:
        raise ValueError("new_km não pode ser negativo")
    if prev_km == 0:
        return True
    return new_km <= prev_km * (1 + _MAX_PROGRESSION_RATIO)


def count_interval_sessions(days: list[dict]) -> int:
    return sum(1 for d in days if d.get("workout_type") == "intervals")


def has_rest_day(days: list[dict]) -> bool:
    return any(d.get("workout_type") == "rest" for d in days)


def validate_week(days: list[dict], prev_km: float, new_km: float) -> list[str]:
    errors: list[str] = []

    if not validate_weekly_progression(prev_km, new_km):
        errors.append(
            f"Progressão de volume excede 10%: de {prev_km} km para {new_km} km"
        )

    intervals = count_interval_sessions(days)
    if intervals > _MAX_INTERVAL_SESSIONS:
        errors.append(
            f"Máximo de {_MAX_INTERVAL_SESSIONS} sessão intervalar por semana para iniciantes "
            f"(encontrado: {intervals})"
        )

    if not has_rest_day(days):
        errors.append("Semana sem dia de descanso obrigatório")

    return errors
