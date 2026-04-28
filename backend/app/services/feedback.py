"""
Lógica de recalibração do plano baseada em feedback (US-10).
Regra: 3 últimos feedbacks iguais disparam ajuste de volume.
"""
from enum import Enum

_VALID_VALUES = {"easy", "medium", "hard"}


class FeedbackSignal(str, Enum):
    REDUCE = "reduce"
    INCREASE = "increase"


def check_recalibration_needed(feedbacks: list[str]) -> FeedbackSignal | None:
    for f in feedbacks:
        if f not in _VALID_VALUES:
            raise ValueError(f"Feedback inválido: '{f}'. Valores aceitos: {_VALID_VALUES}")

    if len(feedbacks) < 3:
        return None

    last_three = feedbacks[-3:]
    if all(f == "hard" for f in last_three):
        return FeedbackSignal.REDUCE
    if all(f == "easy" for f in last_three):
        return FeedbackSignal.INCREASE
    return None
