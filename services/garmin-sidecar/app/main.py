import logging
import re
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.routes import auth, metrics, workout

app = FastAPI(title="FitSync Garmin Sidecar", version="0.1.0")

# Logger com filtro de PII/credenciais
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sidecar")

REDACT_PATTERN = re.compile(
    r'(password|di_token|refresh_token|email|access_token)[\'":\s=]+[^\s,\}\]]+',
    re.IGNORECASE,
)


class RedactingFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = REDACT_PATTERN.sub(r'\1=[REDACTED]', str(record.msg))
        return True


logger.addFilter(RedactingFilter())

app.include_router(auth.router)
app.include_router(metrics.router)
app.include_router(workout.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.exception_handler(Exception)
async def generic_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Erro não tratado: %s", type(exc).__name__)
    return JSONResponse(status_code=500, content={"detail": "Erro interno no sidecar Garmin"})
