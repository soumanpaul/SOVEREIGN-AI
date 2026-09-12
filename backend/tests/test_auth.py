from collections.abc import Generator

import httpx
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.models import User
from app.db.session import get_db
from app.main import app
from app.services.auth import verify_password

DEMO_EMAIL = "demo@sovereignforge.local"
DEMO_PASSWORD = "SovereignForgeDemo!2026"


@pytest.mark.asyncio
async def test_local_signup_session_signin_and_signout() -> None:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)

    def override_db() -> Generator[Session, None, None]:
        with testing_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            signup = await client.post(
                "/api/v1/auth/signup",
                json={
                    "organization_name": "SOVEREIGN AI Demo",
                    "full_name": "Demo Administrator",
                    "email": DEMO_EMAIL,
                    "password": DEMO_PASSWORD,
                },
            )
            assert signup.status_code == 201
            assert signup.json()["organization"]["name"] == "SOVEREIGN AI Demo"
            assert "HttpOnly" in signup.headers["set-cookie"]

            current = await client.get("/api/v1/auth/me")
            assert current.status_code == 200
            assert current.json()["email"] == DEMO_EMAIL

            with testing_session() as session:
                user = session.scalar(select(User).where(User.email == DEMO_EMAIL))
                assert user is not None
                assert user.password_hash != DEMO_PASSWORD
                assert verify_password(user.password_hash, DEMO_PASSWORD)

            signout = await client.post("/api/v1/auth/signout")
            assert signout.status_code == 204
            assert (await client.get("/api/v1/auth/me")).status_code == 401

            signin = await client.post(
                "/api/v1/auth/signin",
                json={
                    "email": DEMO_EMAIL.upper(),
                    "password": DEMO_PASSWORD,
                },
            )
            assert signin.status_code == 200
            assert (await client.get("/api/v1/auth/me")).status_code == 200
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.mark.asyncio
async def test_protected_api_requires_authentication() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/models")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_required"
