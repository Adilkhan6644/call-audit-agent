from fastapi.testclient import TestClient

from app.api.deps import get_db
from app.main import app


def test_readiness_ok_when_db_reachable():
    client = TestClient(app)

    response = client.get("/api/v1/readiness")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_readiness_returns_503_when_db_unreachable():
    def broken_db():
        class _Broken:
            def execute(self, *_args, **_kwargs):
                raise RuntimeError("connection refused")

        yield _Broken()

    app.dependency_overrides[get_db] = broken_db
    client = TestClient(app)

    try:
        response = client.get("/api/v1/readiness")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 503
    assert response.json()["error"]["message"] == "Database unavailable"
