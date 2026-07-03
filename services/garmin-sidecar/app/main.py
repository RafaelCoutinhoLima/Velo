import logging
import re
from typing import Any

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse

from app.deps import verify_sidecar_secret
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


# IMPORTANTE: o filtro precisa ficar nos HANDLERS (não no logger "sidecar"). Os
# logs reais vêm de loggers filhos ("sidecar.auth", "sidecar.garmin") que
# propagam direto para os handlers do root — os filtros de um logger ancestral
# NÃO são consultados nessa propagação. Anexar ao handler garante a redação de
# qualquer registro, venha de onde vier.
for _handler in logging.getLogger().handlers:
    _handler.addFilter(RedactingFilter())

# Toda rota operacional exige o segredo compartilhado API↔sidecar.
_secured = [Depends(verify_sidecar_secret)]
app.include_router(auth.router, dependencies=_secured)
app.include_router(metrics.router, dependencies=_secured)
app.include_router(workout.router, dependencies=_secured)


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok"}


@app.exception_handler(Exception)
async def generic_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Erro não tratado: %s", type(exc).__name__)
    return JSONResponse(status_code=500, content={"detail": "Erro interno no sidecar Garmin"})
