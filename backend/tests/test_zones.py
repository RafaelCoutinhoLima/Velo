"""
US-04: cálculo de zonas FC (Karvonen) e zonas de pace.
Funções puras — sem dependências externas.
"""
import pytest
from app.services.zones import calculate_hr_zones, calculate_pace_zones


class TestHRZones:
    def test_returns_five_zones(self):
        zones = calculate_hr_zones(max_hr=190, resting_hr=60)
        assert len(zones) == 5

    def test_zones_boundaries_are_ordered_ascending(self):
        zones = calculate_hr_zones(max_hr=190, resting_hr=60)
        for i in range(len(zones) - 1):
            assert zones[i]["max_bpm"] < zones[i + 1]["max_bpm"]

    def test_zone1_min_equals_resting_hr(self):
        zones = calculate_hr_zones(max_hr=190, resting_hr=60)
        assert zones[0]["min_bpm"] == 60

    def test_zone5_max_equals_max_hr(self):
        zones = calculate_hr_zones(max_hr=190, resting_hr=60)
        assert zones[4]["max_bpm"] == 190

    def test_zone1_top_boundary_karvonen(self):
        # Z1 topo = resting_hr + 0.60 * HRR  (Karvonen 60%)
        hrr = 190 - 60
        expected = int(60 + 0.60 * hrr)
        zones = calculate_hr_zones(max_hr=190, resting_hr=60)
        assert zones[0]["max_bpm"] == expected

    def test_zone_numbers_are_1_to_5(self):
        zones = calculate_hr_zones(max_hr=190, resting_hr=60)
        assert [z["zone"] for z in zones] == [1, 2, 3, 4, 5]

    def test_adjacent_zones_share_boundary(self):
        zones = calculate_hr_zones(max_hr=190, resting_hr=60)
        for i in range(len(zones) - 1):
            assert zones[i]["max_bpm"] + 1 == zones[i + 1]["min_bpm"]

    def test_invalid_max_hr_raises(self):
        with pytest.raises(ValueError):
            calculate_hr_zones(max_hr=0, resting_hr=60)

    def test_resting_hr_above_max_raises(self):
        with pytest.raises(ValueError):
            calculate_hr_zones(max_hr=150, resting_hr=160)


class TestPaceZones:
    def test_returns_three_zones(self):
        zones = calculate_pace_zones(threshold_pace_sec=360)
        assert len(zones) == 3

    def test_zone_numbers_are_1_to_3(self):
        zones = calculate_pace_zones(threshold_pace_sec=360)
        assert [z["zone"] for z in zones] == [1, 2, 3]

    def test_zone1_is_slower_than_threshold(self):
        # pace mais lento = mais segundos por km
        zones = calculate_pace_zones(threshold_pace_sec=360)
        assert zones[0]["min_sec"] > 360

    def test_zone3_is_faster_than_threshold(self):
        # pace mais rápido = menos segundos por km
        zones = calculate_pace_zones(threshold_pace_sec=360)
        assert zones[2]["max_sec"] < 360

    def test_zone2_contains_threshold(self):
        zones = calculate_pace_zones(threshold_pace_sec=360)
        assert zones[1]["min_sec"] <= 360 <= zones[1]["max_sec"]

    def test_invalid_threshold_raises(self):
        with pytest.raises(ValueError):
            calculate_pace_zones(threshold_pace_sec=0)
