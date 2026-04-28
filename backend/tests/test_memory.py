"""
Testes para o serviço de memória de planos (US-11).
Verifica formatação de casos, seleção de exemplos relevantes e cálculo de outcome.
"""
import pytest
from app.services.memory import (
    compute_outcome,
    format_example,
    select_relevant_examples,
    build_memory_section,
)


def _case(
    goal_km: float = 10.0,
    weeks: int = 12,
    days: int = 4,
    max_hr: int = 185,
    threshold_sec: int = 330,
    avg_km: float = 30.0,
    week1_km: float = 20.0,
    outcome: str = "appropriate",
    ratings: list[str] | None = None,
) -> dict:
    return {
        "goal_distance_km": goal_km,
        "profile": {"max_hr": max_hr, "resting_hr": 55, "threshold_pace_sec": threshold_sec},
        "goals": {"weeks": weeks, "days_per_week": days},
        "plan_stats": {"avg_km_per_week": avg_km, "week1_km": week1_km, "interval_sessions": 1},
        "outcome": outcome,
        "feedback_ratings": ratings or [],
        "created_at": "2026-01-15",
    }


# ── compute_outcome ────────────────────────────────────────────────────────────

class TestComputeOutcome:
    def test_all_medium_returns_appropriate(self):
        assert compute_outcome(["medium", "medium", "medium"]) == "appropriate"

    def test_all_hard_returns_too_hard(self):
        assert compute_outcome(["hard", "hard", "hard"]) == "too_hard"

    def test_all_easy_returns_too_easy(self):
        assert compute_outcome(["easy", "easy", "easy"]) == "too_easy"

    def test_majority_hard_returns_too_hard(self):
        assert compute_outcome(["hard", "hard", "medium"]) == "too_hard"

    def test_majority_easy_returns_too_easy(self):
        assert compute_outcome(["easy", "easy", "medium"]) == "too_easy"

    def test_empty_returns_pending(self):
        assert compute_outcome([]) == "pending"

    def test_single_medium_returns_appropriate(self):
        assert compute_outcome(["medium"]) == "appropriate"

    def test_tie_hard_medium_returns_too_hard(self):
        # tie → prioriza sinal de alerta (too_hard)
        assert compute_outcome(["hard", "medium"]) == "too_hard"


# ── format_example ─────────────────────────────────────────────────────────────

class TestFormatExample:
    def test_appropriate_case_contains_ideal_label(self):
        result = format_example(_case(outcome="appropriate"))
        assert "IDEAL" in result

    def test_too_hard_case_contains_intenso_label(self):
        result = format_example(_case(outcome="too_hard"))
        assert "INTENSO" in result

    def test_too_easy_case_contains_facil_label(self):
        result = format_example(_case(outcome="too_easy"))
        assert "FÁCIL" in result

    def test_pending_case_returns_none(self):
        assert format_example(_case(outcome="pending")) is None

    def test_contains_goal_distance(self):
        result = format_example(_case(goal_km=21.0))
        assert "21" in result

    def test_contains_weeks(self):
        result = format_example(_case(weeks=8))
        assert "8" in result

    def test_contains_threshold_pace_formatted(self):
        # 330 sec = 5:30/km
        result = format_example(_case(threshold_sec=330))
        assert "5:30" in result

    def test_contains_max_hr(self):
        result = format_example(_case(max_hr=190))
        assert "190" in result

    def test_too_hard_contains_lesson(self):
        result = format_example(_case(outcome="too_hard"))
        assert "Lição" in result

    def test_too_easy_contains_lesson(self):
        result = format_example(_case(outcome="too_easy"))
        assert "Lição" in result

    def test_appropriate_contains_lesson(self):
        result = format_example(_case(outcome="appropriate"))
        assert "Lição" in result


# ── select_relevant_examples ───────────────────────────────────────────────────

class TestSelectRelevantExamples:
    def test_same_distance_cases_first(self):
        cases = [
            _case(goal_km=5.0, outcome="appropriate"),
            _case(goal_km=10.0, outcome="appropriate"),
            _case(goal_km=10.0, outcome="too_hard"),
        ]
        selected = select_relevant_examples(cases, goal_distance_km=10.0, limit=3)
        assert selected[0]["goal_distance_km"] == 10.0
        assert selected[1]["goal_distance_km"] == 10.0

    def test_limit_is_respected(self):
        cases = [_case() for _ in range(10)]
        selected = select_relevant_examples(cases, goal_distance_km=10.0, limit=3)
        assert len(selected) <= 3

    def test_pending_cases_excluded(self):
        cases = [
            _case(outcome="pending"),
            _case(outcome="appropriate"),
        ]
        selected = select_relevant_examples(cases, goal_distance_km=10.0, limit=5)
        for c in selected:
            assert c["outcome"] != "pending"

    def test_empty_input_returns_empty(self):
        assert select_relevant_examples([], goal_distance_km=10.0) == []


# ── build_memory_section ───────────────────────────────────────────────────────

class TestBuildMemorySection:
    def test_empty_list_returns_empty_string(self):
        assert build_memory_section([]) == ""

    def test_single_example_contains_header(self):
        result = build_memory_section(["Caso: plano ideal 10km"])
        assert "Histórico" in result

    def test_all_examples_included(self):
        examples = ["Caso A", "Caso B", "Caso C"]
        result = build_memory_section(examples)
        assert "Caso A" in result
        assert "Caso B" in result
        assert "Caso C" in result
