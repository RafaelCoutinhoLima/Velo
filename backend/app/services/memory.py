"""
Serviço de memória de planos (US-11).
Armazena casos passados e os injeta no prompt como few-shot context.
As funções de formatação são puras; as de persistência são stubs até o Supabase conectar.
"""
from __future__ import annotations


# ── Cálculo de outcome ─────────────────────────────────────────────────────────

def compute_outcome(ratings: list[str]) -> str:
    """Calcula o outcome de um plano a partir dos feedbacks coletados.

    Regras:
    - Sem feedbacks → pending
    - Maioria (ou empate) de 'hard' → too_hard  (sinal de alerta tem prioridade)
    - Maioria de 'easy' → too_easy
    - Maioria de 'medium' → appropriate
    """
    if not ratings:
        return "pending"

    counts = {"easy": 0, "medium": 0, "hard": 0}
    for r in ratings:
        counts[r] = counts.get(r, 0) + 1

    # empate entre hard e qualquer outro → too_hard (segurança primeiro)
    if counts["hard"] >= counts["medium"] and counts["hard"] >= counts["easy"] and counts["hard"] > 0:
        return "too_hard"
    if counts["easy"] > counts["medium"] and counts["easy"] > counts["hard"]:
        return "too_easy"
    return "appropriate"


# ── Formatação de casos ────────────────────────────────────────────────────────

def _fmt_pace(sec: int) -> str:
    m, s = divmod(sec, 60)
    return f"{m}:{s:02d}/km"


_OUTCOME_LABELS = {
    "appropriate": "IDEAL — atleta relatou equilíbrio perfeito",
    "too_hard":    "MUITO INTENSO — atleta relatou excesso de carga",
    "too_easy":    "MUITO FÁCIL — atleta precisava de mais volume",
}

_LESSONS = {
    "appropriate": (
        "Esta estrutura de volume e intensidade funcionou bem. "
        "Use como referência para perfis similares."
    ),
    "too_hard": (
        "Reduza o volume inicial em 20-25% e elimine sessões de intervalado "
        "nas primeiras 4-6 semanas para perfis com este limiar."
    ),
    "too_easy": (
        "Aumente o volume semanal em 15-20% e introduza tempos e intervalados "
        "mais cedo (semana 4) para atletas com esta capacidade aeróbica."
    ),
}


def format_example(case: dict) -> str | None:
    """Formata um caso de memória em texto legível para o prompt.
    Retorna None para casos com outcome 'pending' (sem feedbacks suficientes).
    """
    outcome = case.get("outcome", "pending")
    if outcome == "pending":
        return None

    profile = case["profile"]
    goals = case["goals"]
    stats = case["plan_stats"]
    pace_str = _fmt_pace(profile["threshold_pace_sec"])

    lines = [
        f"--- {case['goal_distance_km']:.0f} km / {goals['weeks']} semanas / {goals['days_per_week']}x por semana ---",
        f"Perfil: FC máx {profile['max_hr']} bpm, limiar {pace_str}",
        f"Resultado: {_OUTCOME_LABELS[outcome]}",
        f"Volume: média {stats['avg_km_per_week']:.0f} km/semana, semana 1 com {stats['week1_km']:.0f} km",
        f"Lição: {_LESSONS[outcome]}",
    ]
    return "\n".join(lines)


# ── Seleção de exemplos relevantes ────────────────────────────────────────────

def select_relevant_examples(
    cases: list[dict],
    goal_distance_km: float,
    limit: int = 3,
) -> list[dict]:
    """Seleciona os casos mais relevantes para injetar no prompt.

    Ordem de prioridade:
    1. Mesma distância-alvo
    2. Outra distância
    Casos 'pending' são excluídos.
    """
    concluded = [c for c in cases if c.get("outcome") != "pending"]
    same_dist = [c for c in concluded if c["goal_distance_km"] == goal_distance_km]
    other_dist = [c for c in concluded if c["goal_distance_km"] != goal_distance_km]
    ordered = same_dist + other_dist
    return ordered[:limit]


# ── Seção de prompt ────────────────────────────────────────────────────────────

def build_memory_section(examples: list[str]) -> str:
    """Constrói a seção de memória para injetar no system prompt."""
    if not examples:
        return ""
    joined = "\n\n".join(examples)
    return (
        "\n\n## Histórico de Planos Anteriores\n"
        "Use os casos abaixo como referência. "
        "Aprenda o que funcionou e o que não funcionou para ajustar o novo plano.\n\n"
        + joined
    )


# ── Stubs de persistência (implementar quando Supabase conectar) ───────────────

def save_case(case: dict) -> None:  # pragma: no cover
    """Salva um caso de plano na tabela plan_memory do Supabase."""
    raise NotImplementedError("Aguardando conexão com Supabase")


def get_cases(goal_distance_km: float, user_id: str, limit: int = 10) -> list[dict]:  # pragma: no cover
    """Busca casos históricos do usuário do Supabase."""
    raise NotImplementedError("Aguardando conexão com Supabase")


def update_outcome(case_id: str, ratings: list[str]) -> None:  # pragma: no cover
    """Recalcula e persiste o outcome de um caso com base nos feedbacks acumulados."""
    raise NotImplementedError("Aguardando conexão com Supabase")
