"""MaestrasRed E2E backend tests: auth, plans (free/premium), providers,
reviews, conversations and messages. Uses the public URL from env."""

import uuid

import pytest

from conftest import BASE_URL, FREE_EMAIL, FREE_PASS, auth_headers

PREMIUM_EMAIL = "cliente@maestrasred.cl"
PREMIUM_PASS = "prueba123"


# ---------- Auth: register / login ----------
class TestAuth:
    def test_root_health(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert "MaestrasRed" in r.json()["message"]

    def test_login_premium_user(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login",
                            json={"email": PREMIUM_EMAIL, "password": PREMIUM_PASS})
        assert r.status_code == 200
        data = r.json()
        assert data["token"]
        assert data["user"]["plan"] == "premium"
        assert data["user"]["email"] == PREMIUM_EMAIL

    def test_register_new_free_user(self, api_client, free_token):
        # Fixture already registered FREE_EMAIL; verify a fresh login returns plan free
        r = api_client.post(f"{BASE_URL}/api/auth/login",
                            json={"email": FREE_EMAIL, "password": FREE_PASS})
        assert r.status_code == 200
        assert r.json()["user"]["plan"] == "free"

    def test_register_duplicate_email_409(self, api_client, free_token):
        r = api_client.post(f"{BASE_URL}/api/auth/register",
                            json={"email": FREE_EMAIL, "password": FREE_PASS})
        assert r.status_code == 409

    def test_login_wrong_password_401(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login",
                            json={"email": PREMIUM_EMAIL, "password": "wrongpass1"})
        assert r.status_code == 401

    def test_register_short_password_422(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/register",
                            json={"email": "TEST_short@maestrasred.cl", "password": "123"})
        assert r.status_code == 422

    def test_auth_me(self, api_client, premium_token):
        r = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(premium_token))
        assert r.status_code == 200
        assert r.json()["email"] == PREMIUM_EMAIL

    def test_providers_requires_auth_401(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/providers")
        assert r.status_code == 401


# ---------- Plans: free limited / premium full ----------
class TestPlans:
    def test_free_user_limited_providers(self, api_client, free_token):
        r = api_client.get(f"{BASE_URL}/api/providers", headers=auth_headers(free_token))
        assert r.status_code == 200
        data = r.json()
        assert data["limited"] is True
        assert len(data["providers"]) > 0
        for p in data["providers"]:
            assert p["rating"] >= 4.5, f"{p['name']} rating {p['rating']} visible to free plan"

    def test_premium_user_sees_all(self, api_client, premium_token):
        r = api_client.get(f"{BASE_URL}/api/providers", headers=auth_headers(premium_token))
        assert r.status_code == 200
        data = r.json()
        assert data["limited"] is False
        assert any(p["rating"] < 4.5 for p in data["providers"]), "premium should see low-rated providers"

    def test_upgrade_free_to_premium(self, api_client, free_token):
        r = api_client.post(f"{BASE_URL}/api/users/upgrade", headers=auth_headers(free_token))
        assert r.status_code == 200
        assert r.json()["plan"] == "premium"
        r2 = api_client.get(f"{BASE_URL}/api/providers", headers=auth_headers(free_token))
        assert r2.json()["limited"] is False


# ---------- Providers: filters, detail ----------
class TestProviders:
    @pytest.mark.parametrize("category", ["Niñera", "Gasfitera", "Jardinera", "Profesora"])
    def test_category_filter(self, api_client, premium_token, category):
        r = api_client.get(f"{BASE_URL}/api/providers?category={category}",
                           headers=auth_headers(premium_token))
        assert r.status_code == 200
        providers = r.json()["providers"]
        assert len(providers) > 0
        for p in providers:
            assert p["category"] == category

    def test_search_filter(self, api_client, premium_token):
        r = api_client.get(f"{BASE_URL}/api/providers?search=gasfiter",
                           headers=auth_headers(premium_token))
        assert r.status_code == 200
        assert len(r.json()["providers"]) > 0

    def test_provider_detail_with_reviews(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/providers/p-ana")
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Ana Morales"
        assert "reviews" in data and isinstance(data["reviews"], list)

    def test_provider_not_found_404(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/providers/no-existe-123")
        assert r.status_code == 404

    def test_create_provider_invalid_rate_422(self, api_client, premium_token):
        payload = {"name": "TEST X", "category": "Niñera", "bio": "TEST bio suficientemente larga",
                   "rate": -5, "city": "Santiago", "commune": "Ñuñoa", "whatsapp": "+56911112222"}
        r = api_client.post(f"{BASE_URL}/api/providers", json=payload,
                            headers=auth_headers(premium_token))
        assert r.status_code == 422


# ---------- Create provider + reviews: average rating update ----------
class TestProviderLifecycle:
    def test_create_review_average_flow(self, api_client, premium_token):
        # Create provider (persistence check)
        payload = {"name": "TEST Paula Test", "category": "Jardinera",
                   "bio": "TEST provider creada por tests automatizados.",
                   "rate": 15000, "city": "Santiago", "commune": "Providencia",
                   "whatsapp": "+56911112222"}
        r = api_client.post(f"{BASE_URL}/api/providers", json=payload,
                            headers=auth_headers(premium_token))
        assert r.status_code == 200
        created = r.json()
        assert created["name"] == payload["name"]
        assert created["rating"] == 0
        assert created["initials"] == "TP"
        pid = created["id"]

        r2 = api_client.get(f"{BASE_URL}/api/providers/{pid}")
        assert r2.status_code == 200
        assert r2.json()["whatsapp"] == payload["whatsapp"]

        # Reviews update average and count
        r1 = api_client.post(f"{BASE_URL}/api/providers/{pid}/reviews",
                             json={"rating": 5, "comment": "TEST excelente servicio"},
                             headers=auth_headers(premium_token))
        assert r1.status_code == 200
        assert r1.json()["rating"] == 5
        r2 = api_client.post(f"{BASE_URL}/api/providers/{pid}/reviews",
                             json={"rating": 4, "comment": "TEST muy buen trabajo"},
                             headers=auth_headers(premium_token))
        assert r2.status_code == 200
        after = api_client.get(f"{BASE_URL}/api/providers/{pid}").json()
        assert after["rating"] == 4.5, f"expected 4.5 got {after['rating']}"
        assert after["reviews_count"] == 2
        assert len(after["reviews"]) == 2

    def test_review_invalid_rating_422(self, api_client, premium_token):
        r = api_client.post(f"{BASE_URL}/api/providers/p-ana/reviews",
                            json={"rating": 6, "comment": "TEST rating invalido"},
                            headers=auth_headers(premium_token))
        assert r.status_code == 422

    def test_review_provider_not_found_404(self, api_client, premium_token):
        r = api_client.post(f"{BASE_URL}/api/providers/no-existe-123/reviews",
                            json={"rating": 5, "comment": "TEST inexistente"},
                            headers=auth_headers(premium_token))
        assert r.status_code == 404


# ---------- Conversations and messages ----------
class TestChat:
    def test_conversation_message_flow(self, api_client, premium_token):
        # Create conversation (idempotent on second call)
        r = api_client.post(f"{BASE_URL}/api/conversations/p-ana",
                            headers=auth_headers(premium_token))
        assert r.status_code == 200
        conv = r.json()
        assert conv["provider_name"] == "Ana Morales"
        r2 = api_client.post(f"{BASE_URL}/api/conversations/p-ana",
                             headers=auth_headers(premium_token))
        assert r2.status_code == 200
        assert r2.json()["id"] == conv["id"], "conversation should be reused"
        cid = conv["id"]

        # Send message and verify persistence
        text = f"TEST hola {uuid.uuid4().hex[:6]}"
        r3 = api_client.post(f"{BASE_URL}/api/conversations/{cid}/messages",
                             json={"text": text}, headers=auth_headers(premium_token))
        assert r3.status_code == 200
        assert r3.json()["text"] == text
        r4 = api_client.get(f"{BASE_URL}/api/conversations/{cid}/messages",
                            headers=auth_headers(premium_token))
        assert r4.status_code == 200
        assert text in [m["text"] for m in r4.json()]

        # Conversation list shows last message
        r5 = api_client.get(f"{BASE_URL}/api/conversations",
                            headers=auth_headers(premium_token))
        assert r5.status_code == 200
        match = [c for c in r5.json() if c["id"] == cid]
        assert match and match[0]["last_message"] == text

    def test_messages_of_unknown_conversation_404(self, api_client, premium_token):
        r = api_client.get(f"{BASE_URL}/api/conversations/no-existe/messages",
                           headers=auth_headers(premium_token))
        assert r.status_code == 404
