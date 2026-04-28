from fastapi import FastAPI
from app.routes import activities, plans, feedback, zones

app = FastAPI(title="FitSync AI", version="0.1.0")

app.include_router(activities.router)
app.include_router(plans.router)
app.include_router(feedback.router)
app.include_router(zones.router)


@app.get("/health")
def health():
    return {"status": "ok"}
