import os
import tempfile
from pathlib import Path

_tmp = Path(tempfile.mkdtemp(prefix="bharosa_test_"))
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp / 'test.db'}"
os.environ["UPLOAD_DIR"] = str(_tmp / "uploads")
os.environ["ENV"] = "dev"
os.environ["LLM_BASE_URL"] = ""; os.environ["GROQ_API"] = ""  # tests never call an LLM

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

PW = "Demo#12345"


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def login(client, email, pw=PW):
    r = client.post("/auth/login", data={"username": email, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def tok(client):
    cache = {}

    def get(email):
        if email not in cache:
            cache[email] = login(client, email)
        return cache[email]
    return get
