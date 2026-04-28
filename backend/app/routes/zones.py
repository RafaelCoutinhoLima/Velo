"""
Endpoint de cálculo de zonas de treinamento (US-04).
Lógica pura — sem dependências externas.
"""
from fastapi import APIRouter
from pydantic import BaseModel, field_validator, model_validator
from app.services.zones import calculate_hr_zones, calculate_pace_zones

router = APIRouter()


class ZoneCalculationRequest(BaseModel):
    max_hr: int
    resting_hr: int
    threshold_pace_sec: int

    @field_validator("max_hr")
    @classmethod
    def max_hr_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("max_hr deve ser positivo")
        return v

    @field_validator("threshold_pace_sec")
    @classmethod
    def pace_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("threshold_pace_sec deve ser positivo")
        return v

    @model_validator(mode="after")
    def resting_below_max(self) -> "ZoneCalculationRequest":
        if self.resting_hr >= self.max_hr:
            raise ValueError("resting_hr deve ser menor que max_hr")
        return self


@router.post("/zones/calculate")
def calculate_zones(body: ZoneCalculationRequest) -> dict:
    hr_zones = calculate_hr_zones(max_hr=body.max_hr, resting_hr=body.resting_hr)
    pace_zones = calculate_pace_zones(threshold_pace_sec=body.threshold_pace_sec)
    return {"hr_zones": hr_zones, "pace_zones": pace_zones}
