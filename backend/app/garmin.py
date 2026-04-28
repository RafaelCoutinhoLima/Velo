"""
Wrapper do python-garminconnect.
Isola toda interação com a API Garmin num único lugar.
"""
from garminconnect import Garmin


class GarminAuthError(Exception):
    pass


class GarminSyncError(Exception):
    pass


class GarminClient:
    def __init__(self) -> None:
        self._api: Garmin | None = None

    def connect(self, email: str, password: str) -> dict:
        try:
            self._api = Garmin(email, password)
            self._api.login()
            return self._api.garth.dump()
        except Exception as exc:
            raise GarminAuthError(str(exc)) from exc

    def restore(self, tokens: dict) -> None:
        if self._api is None:
            self._api = Garmin("", "")
        self._api.garth.loads(tokens)

    def get_running_activities(self, limit: int = 20) -> list[dict]:
        try:
            raw = self._api.get_activities(0, limit)
        except Exception as exc:
            raise GarminSyncError(str(exc)) from exc

        activities = []
        for item in raw:
            if item.get("activityType", {}).get("typeKey") != "running":
                continue
            activities.append(self._normalize(item))
        return activities

    def schedule_workout(self, workout_id: str, date: str) -> None:
        try:
            self._api.schedule_workout(workout_id, date)
        except Exception as exc:
            raise GarminSyncError(str(exc)) from exc

    @staticmethod
    def _normalize(item: dict) -> dict:
        speed = item.get("averageSpeed", 0)
        avg_pace_sec = int(1000 / speed) if speed > 0 else 0
        return {
            "garmin_id": str(item["activityId"]),
            "date": item["startTimeLocal"][:10],
            "distance_km": round(item["distance"] / 1000, 2),
            "duration_seconds": int(item["duration"]),
            "avg_pace_sec": avg_pace_sec,
            "avg_hr": int(item.get("averageHR", 0)),
            "max_hr": int(item.get("maxHR", 0)),
            "activity_type": "running",
        }
