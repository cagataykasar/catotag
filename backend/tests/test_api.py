import os
import sys
import tempfile
from pathlib import Path

import pytest

# Isolated config before the app is imported (real env vars win over backend/.env)
_db_dir = tempfile.mkdtemp()
os.environ["SECRET_KEY"] = "test-secret-key-for-pytest-only-0123456789abcdef"
os.environ["DATABASE_URL"] = f"sqlite:///{_db_dir}/test.db"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import jwt  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import auth  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)

MATCH_ID = "0b9d2a52-6c55-4f1b-9b39-5f3c3f9e1a01"


def register(username, password="testpass123", email=None):
    return client.post(
        "/users/",
        json={"username": username, "password": password, "email": email or f"{username}@test.local"},
    )


def login(username, password="testpass123"):
    return client.post("/api/token", data={"username": username, "password": password})


def headers_for(username):
    register(username)
    token = login(username).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def reset_login_throttle():
    auth._failed_logins.clear()


def test_register_login_and_me():
    assert register("alice").status_code == 201
    h = {"Authorization": f"Bearer {login('alice').json()['access_token']}"}
    me = client.get("/users/me", headers=h).json()
    assert me["username"] == "alice"
    assert "password" not in me


def test_password_is_hashed_in_database():
    register("hashcheck", password="plain-text-pass")
    from db import SessionLocal
    from models import User
    with SessionLocal() as db:
        stored = db.query(User).filter(User.username == "hashcheck").one().password
    assert stored != "plain-text-pass" and stored.startswith("$2")


@pytest.mark.parametrize(
    "payload",
    [
        {"username": "ab", "password": "testpass123", "email": "ab@test.local"},  # username too short
        {"username": "bad name", "password": "testpass123", "email": "x@test.local"},  # invalid chars
        {"username": "shortpw", "password": "short", "email": "s@test.local"},  # password too short
        {"username": "noemail", "password": "testpass123", "email": "not-an-email"},
    ],
)
def test_register_validation(payload):
    assert client.post("/users/", json=payload).status_code == 422


def test_duplicate_username_and_email():
    register("dup")
    assert register("dup", email="other@test.local").status_code == 400
    assert register("dup2", email="dup@test.local").status_code == 400


def test_wrong_password_and_throttling():
    register("bob")
    for _ in range(auth.MAX_FAILED_LOGINS):
        assert login("bob", "wrong-password").status_code == 401
    # Locked even with the right password until the window passes
    assert login("bob").status_code == 429


def test_requests_without_or_with_forged_token_are_rejected():
    assert client.get("/sync/matches").status_code == 401
    forged = jwt.encode({"sub": "alice"}, "not-the-real-secret", algorithm="HS256")
    assert client.get("/sync/matches", headers={"Authorization": f"Bearer {forged}"}).status_code == 401
    expired = auth.create_access_token({"sub": "alice"}, expires_delta=auth.timedelta(seconds=-1))
    assert client.get("/sync/matches", headers={"Authorization": f"Bearer {expired}"}).status_code == 401


def test_settings_optimistic_locking():
    h = headers_for("carol")
    assert client.get("/sync/settings", headers=h).json() is None
    r = client.put("/sync/settings", headers=h, json={"data": {"tags": ["a"]}, "base_version": 0})
    assert r.status_code == 200 and r.json()["version"] == 1
    # Another device still thinks it is at version 0
    stale = client.put("/sync/settings", headers=h, json={"data": {"tags": ["b"]}, "base_version": 0})
    assert stale.status_code == 409
    assert client.get("/sync/settings", headers=h).json()["data"] == {"tags": ["a"]}
    r = client.put("/sync/settings", headers=h, json={"data": {"tags": ["c"]}, "base_version": 1})
    assert r.json()["version"] == 2


def test_matches_crud_and_summary():
    h = headers_for("dave")
    data = {"teamA": "Home", "teamB": "Away", "instances": [{"code": "GOL"}, {"code": "OFSAYT"}]}
    assert client.put(f"/sync/matches/{MATCH_ID}", headers=h, json={"data": data}).status_code == 200
    listing = client.get("/sync/matches", headers=h).json()
    assert listing[0]["team_a"] == "Home" and listing[0]["tag_count"] == 2
    assert client.get(f"/sync/matches/{MATCH_ID}", headers=h).json()["data"] == data
    assert client.delete(f"/sync/matches/{MATCH_ID}", headers=h).status_code == 204
    assert client.get(f"/sync/matches/{MATCH_ID}", headers=h).status_code == 404


def test_users_cannot_touch_each_others_data():
    owner = headers_for("erin")
    other = headers_for("frank")
    secret = {"teamA": "Secret", "instances": [{"code": "X"}]}
    client.put(f"/sync/matches/{MATCH_ID}", headers=owner, json={"data": secret})
    client.put("/sync/settings", headers=owner, json={"data": {"private": True}, "base_version": 0})

    # Reading, listing and deleting with the same id from another account
    assert client.get(f"/sync/matches/{MATCH_ID}", headers=other).status_code == 404
    assert client.get("/sync/matches", headers=other).json() == []
    assert client.delete(f"/sync/matches/{MATCH_ID}", headers=other).status_code == 404
    assert client.get("/sync/settings", headers=other).json() is None

    # Writing the same match id creates the other user's own copy, never overwrites
    client.put(f"/sync/matches/{MATCH_ID}", headers=other, json={"data": {"teamA": "Overwrite"}})
    assert client.get(f"/sync/matches/{MATCH_ID}", headers=owner).json()["data"] == secret


def test_payload_limits_and_id_validation():
    h = headers_for("gina")
    huge = {"instances": ["x" * 1000] * 3000}  # ~3 MB
    assert client.put(f"/sync/matches/{MATCH_ID}", headers=h, json={"data": huge}).status_code == 413
    assert client.put("/sync/matches/bad id!", headers=h, json={"data": {}}).status_code in (404, 422)
    assert client.put("/sync/matches/short", headers=h, json={"data": {}}).status_code == 422


def test_delete_account_requires_password_and_removes_data():
    h = headers_for("hank")
    client.put(f"/sync/matches/{MATCH_ID}", headers=h, json={"data": {"teamA": "X"}})
    assert client.request("DELETE", "/users/me", headers=h, json={"password": "wrong"}).status_code == 403
    assert client.request("DELETE", "/users/me", headers=h, json={"password": "testpass123"}).status_code == 204
    assert login("hank").status_code == 401
    assert client.get("/sync/matches", headers=h).status_code == 401
    from db import SessionLocal
    from models import Match
    with SessionLocal() as db:
        assert db.query(Match).filter(Match.match_id == MATCH_ID, Match.data["teamA"].as_string() == "X").count() == 0


def test_security_headers_and_cors():
    r = client.get("/", headers={"Origin": "https://evil.example"})
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["Cache-Control"] == "no-store"
    assert "access-control-allow-origin" not in r.headers
