"""Iteración 4 - MaestrasRed: security fixes + FreeBanner redesign regression.

Covers:
- JWT_SECRET mandatory: fresh login works (new tokens), forged token signed with
  the OLD secret 'maestrasred-local-secret' must be rejected with 401.
- Reviews: duplicate review per user/provider -> 409; owner reviewing own
  profile -> 400; a fresh valid review -> 200 and updates provider average.
- ReDoS: GET /api/providers?search=(a+)+ responds fast (re.escape mitigation).
"""

import time
import uuid

import jwt
import pytest

from conftest import BASE_URL, auth_headers

PREMIUM_EMAIL = "cliente@maestrasred.cl"
PREMIUM_PASS = "prueba123"
FREE_EMAIL = "visitante@maestrasred.cl"
FREE_PASS = "prueba123"
OLD_SECRET = "maestrasred-local-secret"


# ---------- JWT_SECRET regression ----------
class TestJwtSecret:
    def test_login_premium_issues_new_token(self, api_client, premium_token):
        # premium_token fixture logs in with the CURRENT JWT_SECRET
        r = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(premium_token))
        assert r.status_code == 200
        assert r.json()["email"] == PREMIUM_EMAIL

    def test_forged_token_with_old_secret_rejected_401(self, api_client):
        forged = jwt.encode(
            {"sub": "u-premium-1", "email": PREMIUM_EMAIL, "exp": 9999999999},
            OLD_SECRET, algorithm="HS256",
        )
        r = api_client.get(f"{BASE_URL}/api/providers", headers=auth_headers(forged))
        assert r.status_code == 401

    def test_garbage_token_rejected_401(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/providers", headers=auth_headers("not-a-token"))
        assert r.status_code == 401


# ---------- Reviews: 409 duplicate / 400 own profile / 200 new ----------
class TestReviewRules:
    def test_duplicate_review_409(self, api_client, free_token):
        # Register a fresh free user via fixture; review p-camila twice.
        headers = auth_headers(free_token)
        payload = {"rating": 5, "comment": "TEST I4 excelente clase"}
        first = api_client.post(f"{BASE_URL}/api/providers/p-camila/reviews", json=payload, headers=headers)
        assert first.status_code == 200, first.text
        second = api_client.post(f"{BASE_URL}/api/providers/p-camila/reviews", json=payload, headers=headers)
        assert second.status_code == 409
        assert "reseña" in second.json()["detail"]

    def test_owner_cannot_review_own_profile_400(self, api_client, premium_token):
        headers = auth_headers(premium_token)
        mine = api_client.get(f"{BASE_URL}/api/providers/mine/list", headers=headers)
        assert mine.status_code == 200
        owned = mine.json()
        if not owned:
            create = api_client.post(f"{BASE_URL}/api/providers", json={
                "name": "TEST I4 Owner Profile", "category": "Jardinera",
                "bio": "Perfil de prueba propiedad de clienta", "rate": 10000,
                "city": "Santiago", "commune": "Providencia", "whatsapp": "+56911111111",
            }, headers=headers)
            assert create.status_code in (200, 201), create.text
            owned = [create.json()]
        own_id = owned[0]["id"]
        r = api_client.post(f"{BASE_URL}/api/providers/{own_id}/reviews",
                            json={"rating": 5, "comment": "TEST I4 propia"}, headers=headers)
        assert r.status_code == 400
        assert "propio" in r.json()["detail"]

    def test_new_valid_review_updates_average(self, api_client, premium_token):
        headers = auth_headers(premium_token)
        before = api_client.get(f"{BASE_URL}/api/providers/p-daniela", headers=headers).json()
        rating = 4
        r = api_client.post(f"{BASE_URL}/api/providers/p-daniela/reviews",
                            json={"rating": rating, "comment": "TEST I4 buena profe"}, headers=headers)
        if r.status_code == 409:
            pytest.skip("premium user already reviewed p-daniela in a previous run")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "_id" not in body
        assert body["rating"] == rating
        # GET to verify persistence + average recompute from REAL review docs.
        # NOTE: seed reviews_count is fabricated (carry-over); the first real
        # review recomputes count/average from actual docs.
        after = api_client.get(f"{BASE_URL}/api/providers/p-daniela", headers=headers).json()
        mine = [rv for rv in after["reviews"] if rv.get("user_id") == body["user_id"]]
        assert mine and mine[0]["comment"] == "TEST I4 buena profe"
        listed = after["reviews"]
        expected_avg = round(sum(rv["rating"] for rv in listed) / len(listed), 1)
        assert after["reviews_count"] == len(listed)
        assert after["rating"] == expected_avg


# ---------- ReDoS mitigation on /api/providers ----------
class TestReDoSMitigation:
    @pytest.mark.parametrize("payload", ["(a+)+", "(a|a)*$", "a" * 200 + "!"])
    def test_malicious_search_responds_fast(self, api_client, premium_token, payload):
        start = time.monotonic()
        r = api_client.get(f"{BASE_URL}/api/providers", params={"search": payload},
                           headers=auth_headers(premium_token), timeout=10)
        elapsed = time.monotonic() - start
        assert r.status_code == 200
        assert elapsed < 5, f"possible ReDoS: {elapsed:.2f}s for {payload!r}"
        assert isinstance(r.json()["providers"], list)

    def test_malicious_commune_responds_fast(self, api_client, premium_token):
        start = time.monotonic()
        r = api_client.get(f"{BASE_URL}/api/providers", params={"commune": "(a+)+"},
                           headers=auth_headers(premium_token), timeout=10)
        elapsed = time.monotonic() - start
        assert r.status_code == 200
        assert elapsed < 5, f"possible ReDoS: {elapsed:.2f}s"

    def test_normal_search_still_works(self, api_client, premium_token):
        r = api_client.get(f"{BASE_URL}/api/providers", params={"search": "Ana"},
                           headers=auth_headers(premium_token))
        assert r.status_code == 200
        names = [p["name"] for p in r.json()["providers"]]
        assert any("Ana" in n for n in names)
