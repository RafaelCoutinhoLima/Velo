"""
Testes de integração da API FastAPI — sem dependências externas.
"""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check_returns_200():
    response = client.get("/health")
    assert response.status_code == 200


def test_health_check_body():
    response = client.get("/health")
    assert response.json() == {"status": "ok"}


def test_unknown_route_returns_404():
    response = client.get("/rota-que-nao-existe")
    assert response.status_code == 404
