from pydantic import BaseModel, field_validator, model_validator


class HRZone(BaseModel):
    zone: int
    min_bpm: int
    max_bpm: int


class PaceZone(BaseModel):
    zone: int
    min_sec: int
    max_sec: int


class AthleteProfile(BaseModel):
    user_id: str
    max_hr: int
    resting_hr: int
    threshold_pace_sec: int
    hr_zones: list[HRZone]
    pace_zones: list[PaceZone]

    @model_validator(mode="after")
    def validate_hr_relationship(self) -> "AthleteProfile":
        if self.resting_hr >= self.max_hr:
            raise ValueError("resting_hr deve ser menor que max_hr")
        return self

    @field_validator("hr_zones")
    @classmethod
    def must_have_five_hr_zones(cls, v: list[HRZone]) -> list[HRZone]:
        if len(v) != 5:
            raise ValueError("hr_zones deve ter exatamente 5 zonas")
        return v

    @field_validator("pace_zones")
    @classmethod
    def must_have_three_pace_zones(cls, v: list[PaceZone]) -> list[PaceZone]:
        if len(v) != 3:
            raise ValueError("pace_zones deve ter exatamente 3 zonas")
        return v
