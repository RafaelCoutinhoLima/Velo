"""
Cálculo de zonas de treinamento.
Zonas FC: fórmula de Karvonen (percentuais da reserva de FC).
Zonas de pace: percentuais em relação ao pace de limiar.
"""
from typing import TypedDict


class HRZoneData(TypedDict):
    zone: int
    min_bpm: int
    max_bpm: int


class PaceZoneData(TypedDict):
    zone: int
    min_sec: int
    max_sec: int


# Limites de Karvonen para cada zona (percentual da HRR)
_HR_ZONE_THRESHOLDS = [
    (0.00, 0.60),   # Z1: 0–60% HRR
    (0.60, 0.70),   # Z2: 60–70% HRR
    (0.70, 0.80),   # Z3: 70–80% HRR
    (0.80, 0.90),   # Z4: 80–90% HRR
    (0.90, 1.00),   # Z5: 90–100% HRR
]

# Limites de pace em relação ao limiar (fator multiplicador)
# Z1 mais lento, Z3 mais rápido
_PACE_ZONE_FACTORS = [
    (1.15, 1.30),   # Z1: 115–130% do pace limiar (recuperação ativa)
    (1.00, 1.15),   # Z2: 100–115% (aeróbico base, inclui o limiar)
    (0.85, 0.99),   # Z3: 85–99% (abaixo do limiar — mais rápido)
]


def calculate_hr_zones(max_hr: int, resting_hr: int) -> list[HRZoneData]:
    if max_hr <= 0:
        raise ValueError("max_hr deve ser positivo")
    if resting_hr >= max_hr:
        raise ValueError("resting_hr deve ser menor que max_hr")

    hrr = max_hr - resting_hr
    zones: list[HRZoneData] = []

    for i, (low_pct, high_pct) in enumerate(_HR_ZONE_THRESHOLDS):
        zone_num = i + 1
        min_bpm = int(resting_hr + low_pct * hrr) if i > 0 else resting_hr
        max_bpm = int(resting_hr + high_pct * hrr)

        # garante que Z5 toca exatamente max_hr
        if zone_num == 5:
            max_bpm = max_hr

        # garante continuidade entre zonas
        if zones:
            min_bpm = zones[-1]["max_bpm"] + 1

        zones.append({"zone": zone_num, "min_bpm": min_bpm, "max_bpm": max_bpm})

    return zones


def calculate_pace_zones(threshold_pace_sec: int) -> list[PaceZoneData]:
    if threshold_pace_sec <= 0:
        raise ValueError("threshold_pace_sec deve ser positivo")

    zones: list[PaceZoneData] = []
    for i, (fast_factor, slow_factor) in enumerate(_PACE_ZONE_FACTORS):
        # pace mais lento = mais segundos por km
        min_sec = int(threshold_pace_sec * fast_factor)
        max_sec = int(threshold_pace_sec * slow_factor)
        zones.append({"zone": i + 1, "min_sec": min_sec, "max_sec": max_sec})

    return zones
