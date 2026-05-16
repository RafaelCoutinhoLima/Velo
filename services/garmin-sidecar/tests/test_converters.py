from app.converters import (
    session_to_garmin_steps,
    session_to_garmin_workout,
    zone_to_garmin_zone,
)

ZONES = [
    {"fc_min": 97, "fc_max": 126},   # Z1
    {"fc_min": 126, "fc_max": 146},  # Z2
    {"fc_min": 146, "fc_max": 165},  # Z3
    {"fc_min": 165, "fc_max": 179},  # Z4
    {"fc_min": 179, "fc_max": 194},  # Z5
]


def test_zone_to_garmin_zone():
    assert zone_to_garmin_zone("Z1") == 1
    assert zone_to_garmin_zone("Z5") == 5
    assert zone_to_garmin_zone(None) == 0
    assert zone_to_garmin_zone("") == 0


def test_continuous_session_warmup_main_cooldown():
    session = {
        "duration_min": 45,
        "description": "Rodagem Z2 confortável",
        "aquecimento": {"duracao_min": 8, "zona": "Z1"},
        "parte_principal": {
            "zona_alvo": "Z2",
            "fc_alvo_bpm": {"min": 126, "max": 146},
        },
        "desaquecimento": {"duracao_min": 5, "zona": "Z1"},
    }
    steps = session_to_garmin_steps(session, ZONES)
    assert [s["stepType"]["stepTypeKey"] for s in steps] == [
        "warmup",
        "interval",
        "cooldown",
    ]
    warmup, main, cooldown = steps
    assert warmup["endConditionValue"] == 8 * 60
    assert warmup["targetValueOne"] == 97 and warmup["targetValueTwo"] == 126
    # main = total - warmup - cooldown = (45-8-5)*60
    assert main["endConditionValue"] == (45 - 8 - 5) * 60
    assert main["targetValueOne"] == 126 and main["targetValueTwo"] == 146
    assert cooldown["endConditionValue"] == 5 * 60


def test_interval_session_repeat_with_recovery():
    session = {
        "duration_min": 60,
        "description": "6x800m Z4",
        "aquecimento": {"duracao_min": 12, "zona": "Z1"},
        "parte_principal": {
            "zona_alvo": "Z4",
            "fc_alvo_bpm": {"min": 165, "max": 179},
            "repeticoes": 6,
            "duracao_repeticao_min": 3,
            "recuperacao_min": 2,
            "recuperacao_zona": "Z1",
        },
        "desaquecimento": {"duracao_min": 8, "zona": "Z1"},
    }
    steps = session_to_garmin_steps(session, ZONES)
    assert [s["stepType"]["stepTypeKey"] for s in steps] == [
        "warmup",
        "repeat",
        "cooldown",
    ]
    repeat = steps[1]
    assert repeat["type"] == "RepeatGroupDTO"
    assert repeat["numberOfIterations"] == 6
    child = repeat["workoutSteps"]
    assert [c["stepType"]["stepTypeKey"] for c in child] == ["interval", "recovery"]
    assert child[0]["endConditionValue"] == 3 * 60
    assert child[0]["targetValueOne"] == 165 and child[0]["targetValueTwo"] == 179
    assert child[1]["endConditionValue"] == 2 * 60
    assert child[1]["targetValueOne"] == 97  # Z1 recovery


def test_session_without_parte_principal_falls_back_to_continuous():
    session = {"duration_min": 30, "description": "Solto"}
    steps = session_to_garmin_steps(session, ZONES)
    assert len(steps) == 1
    assert steps[0]["stepType"]["stepTypeKey"] == "interval"
    assert steps[0]["endConditionValue"] == 30 * 60
    assert steps[0]["targetType"]["workoutTargetTypeKey"] == "no.target"


def test_full_workout_dto_shape():
    session = {
        "duration_min": 40,
        "description": "Z2",
        "parte_principal": {"zona_alvo": "Z2", "fc_alvo_bpm": {"min": 126, "max": 146}},
    }
    dto = session_to_garmin_workout(session, "FitSync — Teste", ZONES)
    assert dto["workoutName"] == "FitSync — Teste"
    assert dto["sportType"]["sportTypeKey"] == "running"
    seg = dto["workoutSegments"][0]
    assert seg["segmentOrder"] == 1
    assert len(seg["workoutSteps"]) >= 1
