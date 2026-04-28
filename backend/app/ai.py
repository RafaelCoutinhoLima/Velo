"""
Wrapper da Claude API para geração de plano de treino (US-06).
Valida o JSON retornado contra as regras hard-coded antes de aceitar.
"""
import json
import anthropic
from pathlib import Path

from app.models.training_plan import TrainingPlan
from app.services.plan_rules import validate_week
from app.services.memory import format_example, select_relevant_examples, build_memory_section

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "system_plan_generation.md"


class AIGenerationError(Exception):
    pass


class PlanGenerator:
    def __init__(self, api_key: str) -> None:
        self._client = anthropic.Anthropic(api_key=api_key)
        self._system_prompt = _PROMPT_PATH.read_text(encoding="utf-8")

    def generate(
        self,
        profile: dict,
        goals: dict,
        recent_activities: list[dict],
        memory_cases: list[dict] | None = None,
    ) -> TrainingPlan:
        # Injeta casos históricos relevantes no system prompt
        system = self._system_prompt
        if memory_cases:
            relevant = select_relevant_examples(
                memory_cases,
                goal_distance_km=goals.get("goal_distance_km", 0),
            )
            formatted = [f for c in relevant if (f := format_example(c)) is not None]
            system += build_memory_section(formatted)

        user_message = json.dumps(
            {"profile": profile, "goals": goals, "recent_activities": recent_activities},
            ensure_ascii=False,
        )
        try:
            message = self._client.messages.create(
                model="claude-opus-4-7",
                max_tokens=4096,
                system=system,
                messages=[{"role": "user", "content": user_message}],
            )
            raw_text = message.content[0].text
        except Exception as exc:
            raise AIGenerationError(f"Chamada à Claude API falhou: {exc}") from exc

        try:
            data = json.loads(raw_text)
        except json.JSONDecodeError as exc:
            raise AIGenerationError(f"Resposta da Claude não é JSON válido: {raw_text[:200]}") from exc

        try:
            plan = TrainingPlan(**data)
        except Exception as exc:
            raise AIGenerationError(f"Schema do plano inválido: {exc}") from exc

        self._validate_progression(plan)
        return plan

    @staticmethod
    def _validate_progression(plan: TrainingPlan) -> None:
        prev_km = 0.0
        for week in plan.weeks:
            errors = validate_week(
                days=[d.model_dump() for d in week.days],
                prev_km=prev_km,
                new_km=week.total_km,
            )
            if errors:
                raise AIGenerationError(
                    f"Semana {week.week_number} viola regras de progressão: {'; '.join(errors)}"
                )
            prev_km = week.total_km
