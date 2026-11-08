"""End-to-end API tests. Needs a MongoDB:  MONGODB_URI=mongodb://localhost:27017 pytest"""
import os
import uuid

os.environ.setdefault("DB_NAME", "focusflow_test")

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app

PW = "secret123"


@pytest.fixture(scope="module")
def client():
    db.client.drop_database(os.environ["DB_NAME"])
    with TestClient(app) as c:
        yield c
    db.client.drop_database(os.environ["DB_NAME"])


def register(client, email=None, pw=PW):
    email = email or f"{uuid.uuid4().hex[:8]}@test.com"
    r = client.post("/api/auth/register", json={"email": email, "password": pw, "display_name": "Tester"})
    assert r.status_code == 201, r.text
    r = client.post("/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return email, {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_register_rules(client):
    email, _ = register(client)
    r = client.post("/api/auth/register", json={"email": email.upper(), "password": PW, "display_name": "x"})
    assert r.status_code == 409
    r = client.post("/api/auth/register", json={"email": "a@b.com", "password": "short1", "display_name": "x"})
    assert r.status_code == 422 and "8 characters" in r.json()["detail"]
    r = client.post("/api/auth/register", json={"email": "not-an-email", "password": PW, "display_name": "x"})
    assert r.status_code == 422 and isinstance(r.json()["detail"], str)
    r = client.post("/api/auth/register", json={"email": "c@b.com", "password": "abcdefghij", "display_name": "x"})
    assert r.status_code == 422


def test_login_and_me(client):
    email, h = register(client)
    me = client.get("/api/users/me", headers=h).json()
    assert me["email"] == email and "password_hash" not in me
    assert client.post("/api/auth/login", json={"email": email, "password": "wrong1234"}).status_code == 401
    assert client.get("/api/users/me").status_code == 401
    assert client.get("/api/users/me", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_logout_revokes_token(client):
    _, h = register(client)
    assert client.post("/api/auth/logout", headers=h).status_code == 204
    assert client.get("/api/users/me", headers=h).status_code == 401


def test_bruteforce_lock(client):
    email, _ = register(client)
    for _ in range(5):
        assert client.post("/api/auth/login", json={"email": email, "password": "wrong1234"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": email, "password": PW}).status_code == 429


def test_profile_password_delete(client):
    email, h = register(client)
    assert client.patch("/api/users/me", headers=h, json={"display_name": "New Name"}).json()["display_name"] == "New Name"
    r = client.post("/api/users/me/password", headers=h, json={"current_password": "nope12345", "new_password": "newpass123"})
    assert r.status_code == 400
    r = client.post("/api/users/me/password", headers=h, json={"current_password": PW, "new_password": "newpass123"})
    assert r.status_code == 204
    assert client.get("/api/users/me", headers=h).status_code == 401  # old token dead
    r = client.post("/api/auth/login", json={"email": email, "password": "newpass123"})
    h2 = {"Authorization": f"Bearer {r.json()['access_token']}"}
    client.post("/api/content", headers=h2, json={"type": "text", "title": "t", "source": "x" * 30})
    assert client.delete("/api/users/me", headers=h2).status_code == 204
    assert client.post("/api/auth/login", json={"email": email, "password": "newpass123"}).status_code == 401


def test_content_and_isolation(client):
    _, h1 = register(client)
    _, h2 = register(client)
    r = client.post("/api/content", headers=h1, json={"type": "youtube", "title": "Video", "source": "https://youtu.be/dQw4w9WgXcQ?t=5"})
    assert r.status_code == 201, r.text
    item = r.json()
    assert item["source"] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ" and item["video_id"] == "dQw4w9WgXcQ"
    assert client.post("/api/content", headers=h1, json={"type": "youtube", "title": "x", "source": "https://evil.com"}).status_code == 422
    assert client.post("/api/content", headers=h1, json={"type": "pdf", "title": "x", "source": "y"}).status_code == 422
    assert len(client.get("/api/content", headers=h1).json()) == 1
    assert client.get("/api/content", headers=h2).json() == []
    assert client.get(f"/api/content/{item['id']}", headers=h2).status_code == 404
    assert client.delete(f"/api/content/{item['id']}", headers=h2).status_code == 404
    assert client.get("/api/content/not-an-id", headers=h1).status_code == 404
    assert client.post("/api/sessions", headers=h2, json={"content_id": item["id"]}).status_code == 404
    assert client.delete(f"/api/content/{item['id']}", headers=h1).status_code == 204
    assert client.get(f"/api/content/{item['id']}", headers=h1).status_code == 404


def test_session_flow(client):
    _, h = register(client)
    _, other = register(client)
    item = client.post("/api/content", headers=h, json={"type": "youtube", "title": "V", "source": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}).json()
    s = client.post("/api/sessions", headers=h, json={"content_id": item["id"]})
    assert s.status_code == 201
    sid = s.json()["id"]
    for pos, score in [(10, 0.8), (20, 0.3), (30, 0.7)]:
        r = client.post(f"/api/sessions/{sid}/readings", headers=h, json={"position": pos, "score": score, "level": 3})
        assert r.status_code == 201, r.text
    assert client.post(f"/api/sessions/{sid}/readings", headers=h, json={"position": 1, "score": 1.5}).status_code == 422
    assert client.post(f"/api/sessions/{sid}/readings", headers=other, json={"position": 1, "score": 0.5}).status_code == 404
    assert client.get(f"/api/sessions/{sid}", headers=other).status_code == 404
    end = client.post(f"/api/sessions/{sid}/end", headers=h).json()
    assert end["reading_count"] == 3 and end["average_score"] == 0.6 and end["ended_at"]
    assert client.post(f"/api/sessions/{sid}/readings", headers=h, json={"position": 40, "score": 0.5}).status_code == 409
    lst = client.get("/api/sessions", headers=h).json()
    assert lst[0]["content_title"] == "V" and lst[0]["average_score"] == 0.6
    full = client.get(f"/api/sessions/{sid}", headers=h).json()
    assert [r["position"] for r in full["readings"]] == [10, 20, 30]
    assert full["readings"][0]["created_at"].endswith("Z")
    assert client.get("/api/sessions", headers=other).json() == []
