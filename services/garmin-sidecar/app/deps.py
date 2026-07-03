import logging
import os

from fastapi import Header, HTTPException

logger = logging.getLogger("sidecar.deps")


def verify_sidecar_secret(x_sidecar_secret: str | None = Header(default=None)) -> None:
    """Exige o segredo compartilhado API↔sidecar em toda rota operacional.

    Sem isto, qualquer processo que alcance a porta do sidecar podia usá-lo como
    proxy de brute-force contra o Garmin (/auth) ou ler/enviar dados com um
    x-garmin-token roubado (/metrics, /workout).

    Se SIDECAR_SECRET não estiver configurado, opera em modo dev (a porta não é
    publicada no host pelo docker-compose, então a rede interna é a barreira),
    apenas registrando um aviso — assim o ambiente local segue funcionando.
    """
    expected = os.environ.get("SIDECAR_SECRET", "")
    if not expected:
        logger.warning(
            "SIDECAR_SECRET não configurado — sidecar aceitando chamadas sem segredo (modo dev)"
        )
        return
    if x_sidecar_secret != expected:
        raise HTTPException(status_code=401, detail="Não autorizado")
