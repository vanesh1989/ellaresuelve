import os
import uuid

import pytest
import requests


def _base_url() -> str:
    url = os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if not url:
        env_path = "/app/frontend/.env"
        if os.path.exists(env_path):
            with open(env_path) as fh:
                for line in fh:
                    if line.startswith("EXPO_PUBLIC_BACKEND_URL=") or line.startswith("EXPO_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip().strip('"')
                        break
    assert url, "EXPO_BACKEND_URL / EXPO_PUBLIC_BACKEND_URL is not configured"
    return url.rstrip("/")


BASE_URL = _base_url()
FREE_EMAIL = f"TEST_free_{uuid.uuid4().hex[:8]}@maestrasred.cl"
FREE_PASS = "prueba123"


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def premium_token(api_client):
    r = api_client.post(f"{BASE_URL}/api/auth/login",
                        json={"email": "cliente@maestrasred.cl", "password": "prueba123"})
    assert r.status_code == 200, f"premium login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def free_token(api_client):
    r = api_client.post(f"{BASE_URL}/api/auth/register",
                        json={"email": FREE_EMAIL, "password": FREE_PASS, "name": "Test Free"})
    assert r.status_code == 200, f"free register failed: {r.text}"
    return r.json()["token"]
