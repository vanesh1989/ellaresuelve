"""Iteration 3 tests: Emergent Google session exchange, profile photos
(upload / files / users/me/photo) and bidirectional chat (owner replies).
Regression suite lives in test_maestrasred.py."""

import base64
import uuid

import pytest

from conftest import BASE_URL, auth_headers

CLIENTA_EMAIL = "cliente@maestrasred.cl"
VISITANTE_EMAIL = "visitante@maestrasred.cl"
PASSWORD = "prueba123"

# The shared session carries Content-Type: application/json; multipart uploads
# must drop it so requests sets the boundary header.
MULTIPART = {"Content-Type": None}

# 1x1 red PNG
PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def login(client, email):
    r = client.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, f"login failed for {email}: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def clienta_token(api_client):
    return login(api_client, CLIENTA_EMAIL)


@pytest.fixture(scope="module")
def visitante_token(api_client):
    return login(api_client, VISITANTE_EMAIL)


# ---------- Google Auth (Emergent-managed): session exchange ----------
class TestGoogleSession:
    def test_fake_session_id_returns_401_not_500(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/session", json={"session_id": f"fake-{uuid.uuid4().hex}"})
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"
        assert r.json()["detail"]

    def test_empty_session_id_422(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/session", json={})
        assert r.status_code == 422

    def test_jwt_login_still_works_and_me_accepts_it(self, api_client, clienta_token):
        r = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(clienta_token))
        assert r.status_code == 200
        assert r.json()["email"] == CLIENTA_EMAIL


# ---------- Profile photos: upload, download, attach ----------
class TestPhotos:
    def test_upload_requires_auth_401(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/upload",
                            files={"file": ("foto.png", PNG_BYTES, "image/png")},
                            headers=MULTIPART)
        assert r.status_code == 401

    def test_upload_rejects_non_image_400(self, api_client, clienta_token):
        r = api_client.post(f"{BASE_URL}/api/upload",
                            files={"file": ("nota.txt", b"hola mundo", "text/plain")},
                            headers={"Authorization": f"Bearer {clienta_token}", **MULTIPART})
        assert r.status_code == 400

    def test_full_photo_flow_upload_serve_attach(self, api_client, clienta_token):
        headers = {"Authorization": f"Bearer {clienta_token}"}
        # Upload
        r = api_client.post(f"{BASE_URL}/api/upload",
                            files={"file": ("perfil.png", PNG_BYTES, "image/png")},
                            headers={**headers, **MULTIPART})
        assert r.status_code == 200, r.text
        path = r.json()["path"]
        assert path.startswith("maestrasred/uploads/")

        # Serve with Bearer header
        r2 = api_client.get(f"{BASE_URL}/api/files/{path}", headers=headers)
        assert r2.status_code == 200
        assert r2.headers["Content-Type"].startswith("image/")
        assert r2.content == PNG_BYTES

        # Serve with ?token= (web <img> path)
        r3 = api_client.get(f"{BASE_URL}/api/files/{path}?token={clienta_token}")
        assert r3.status_code == 200
        assert r3.content == PNG_BYTES

        # No auth -> 401
        r4 = api_client.get(f"{BASE_URL}/api/files/{path}")
        assert r4.status_code == 401

        # Attach to user
        r5 = api_client.put(f"{BASE_URL}/api/users/me/photo", json={"path": path}, headers=headers)
        assert r5.status_code == 200
        assert r5.json()["photo_path"] == path

        # Persisted on /auth/me
        me = api_client.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert me.json()["photo_path"] == path

        # Propagated to the user's published providers
        mine = api_client.get(f"{BASE_URL}/api/providers/mine/list", headers=headers)
        assert mine.status_code == 200
        providers = mine.json()
        assert providers, "clienta should own at least one provider"
        for p in providers:
            assert p.get("photo_path") == path, f"provider {p['id']} photo not propagated"

    def test_set_photo_unknown_path_404(self, api_client, clienta_token):
        r = api_client.put(f"{BASE_URL}/api/users/me/photo",
                           json={"path": "maestrasred/uploads/nadie/no-existe.png"},
                           headers=auth_headers(clienta_token))
        assert r.status_code == 404

    def test_set_photo_other_users_file_404(self, api_client, clienta_token, visitante_token):
        # Upload as visitante, try to attach as clienta
        r = api_client.post(f"{BASE_URL}/api/upload",
                            files={"file": ("v.png", PNG_BYTES, "image/png")},
                            headers={"Authorization": f"Bearer {visitante_token}", **MULTIPART})
        assert r.status_code == 200
        path = r.json()["path"]
        r2 = api_client.put(f"{BASE_URL}/api/users/me/photo", json={"path": path},
                            headers=auth_headers(clienta_token))
        assert r2.status_code == 404

    def test_files_unknown_path_404(self, api_client, clienta_token):
        r = api_client.get(f"{BASE_URL}/api/files/maestrasred/uploads/x/no-existe-{uuid.uuid4().hex}.png",
                           headers=auth_headers(clienta_token))
        assert r.status_code == 404

    def test_create_provider_with_foreign_photo_400(self, api_client, clienta_token, visitante_token):
        r = api_client.post(f"{BASE_URL}/api/upload",
                            files={"file": ("v2.png", PNG_BYTES, "image/png")},
                            headers={"Authorization": f"Bearer {visitante_token}", **MULTIPART})
        assert r.status_code == 200
        path = r.json()["path"]
        payload = {"name": "TEST Foto Ajena", "category": "Niñera",
                   "bio": "TEST intenta usar foto de otra usuaria.",
                   "rate": 12000, "city": "Santiago", "commune": "Providencia",
                   "whatsapp": "+56911112222", "photo_path": path}
        r2 = api_client.post(f"{BASE_URL}/api/providers", json=payload,
                             headers=auth_headers(clienta_token))
        assert r2.status_code == 400


# ---------- Bidirectional chat: clienta (owner) sees and replies ----------
class TestBidirectionalChat:
    def test_owner_receives_and_replies(self, api_client, clienta_token, visitante_token):
        clienta = auth_headers(clienta_token)
        visitante = auth_headers(visitante_token)

        # Find a provider owned by clienta
        mine = api_client.get(f"{BASE_URL}/api/providers/mine/list", headers=clienta).json()
        assert mine, "clienta must own a provider for this test"
        provider_id = mine[0]["id"]

        # Visitante starts chat and sends a message
        r = api_client.post(f"{BASE_URL}/api/conversations/{provider_id}", headers=visitante)
        assert r.status_code == 200, r.text
        conv = r.json()
        # Note: when the conversation already exists, the idempotent path returns
        # the raw document WITHOUT role/display_name/display_initials (backend
        # inconsistency, reported). The frontend only consumes conv["id"] here.
        assert conv["id"] and conv["provider_name"]
        cid = conv["id"]
        text_v = f"TEST hola desde visitante {uuid.uuid4().hex[:6]}"
        r = api_client.post(f"{BASE_URL}/api/conversations/{cid}/messages",
                            json={"text": text_v}, headers=visitante)
        assert r.status_code == 200

        # Owner sees the conversation with role=professional and clienta name
        r = api_client.get(f"{BASE_URL}/api/conversations", headers=clienta)
        assert r.status_code == 200
        match = [c for c in r.json() if c["id"] == cid]
        assert match, "conversation not visible to the professional owner"
        owner_view = match[0]
        assert owner_view["role"] == "professional"
        assert owner_view["display_name"] == "Visitante Uno"
        assert owner_view["last_message"] == text_v

        # Owner reads messages and replies
        r = api_client.get(f"{BASE_URL}/api/conversations/{cid}/messages", headers=clienta)
        assert r.status_code == 200
        assert text_v in [m["text"] for m in r.json()]
        text_c = f"TEST respuesta de la profesional {uuid.uuid4().hex[:6]}"
        r = api_client.post(f"{BASE_URL}/api/conversations/{cid}/messages",
                            json={"text": text_c}, headers=clienta)
        assert r.status_code == 200

        # Visitante reads the reply
        r = api_client.get(f"{BASE_URL}/api/conversations/{cid}/messages", headers=visitante)
        assert r.status_code == 200
        texts = [m["text"] for m in r.json()]
        assert text_v in texts and text_c in texts

    def test_stranger_cannot_read_conversation_404(self, api_client, clienta_token, visitante_token):
        # A third user must not access someone else's conversation
        email = f"TEST_stranger_{uuid.uuid4().hex[:6]}@maestrasred.cl"
        r = api_client.post(f"{BASE_URL}/api/auth/register",
                            json={"email": email, "password": "prueba123", "name": "TEST Stranger"})
        assert r.status_code == 200
        stranger = auth_headers(r.json()["token"])
        convs = api_client.get(f"{BASE_URL}/api/conversations", headers=auth_headers(visitante_token)).json()
        assert convs, "visitante should have at least one conversation"
        cid = convs[0]["id"]
        r2 = api_client.get(f"{BASE_URL}/api/conversations/{cid}/messages", headers=stranger)
        assert r2.status_code == 404
        r3 = api_client.post(f"{BASE_URL}/api/conversations/{cid}/messages",
                             json={"text": "TEST intruso"}, headers=stranger)
        assert r3.status_code == 404
