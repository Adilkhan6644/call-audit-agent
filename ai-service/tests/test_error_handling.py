from fastapi.testclient import TestClient

from app.core.exceptions import NotFoundError
from app.main import app

client = TestClient(app, raise_server_exceptions=False)


@app.get("/_test/not-found")
def _raise_not_found():
    raise NotFoundError("Thing not found")


@app.get("/_test/boom")
def _raise_unexpected():
    raise RuntimeError("boom")


@app.get("/_test/needs-int/{value}")
def _needs_int(value: int):
    return {"value": value}


def test_app_error_returns_unified_shape():
    response = client.get("/_test/not-found")

    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "app_error", "message": "Thing not found"}
    }


def test_validation_error_returns_unified_shape():
    response = client.get("/_test/needs-int/not-a-number")

    assert response.status_code == 422
    assert response.json() == {
        "error": {"code": "validation_error", "message": "Invalid request data"}
    }


def test_unexpected_error_hides_details():
    response = client.get("/_test/boom")

    assert response.status_code == 500
    body = response.json()
    assert body["error"]["code"] == "internal_error"
    assert "boom" not in body["error"]["message"]
