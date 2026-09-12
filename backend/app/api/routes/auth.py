from fastapi import APIRouter, Request, Response

from app.api.dependencies import AppSettings, CurrentUser, DatabaseSession
from app.schemas.auth import AuthUserResponse, SigninRequest, SignupRequest
from app.services.auth import (
    auth_response,
    authenticate,
    create_account,
    create_auth_session,
    revoke_session,
)

router = APIRouter(prefix="/auth", tags=["authentication"])


def set_session_cookie(response: Response, token: str, settings: AppSettings) -> None:
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        max_age=settings.auth_session_hours * 60 * 60,
        httponly=True,
        secure=settings.app_env == "production",
        samesite="strict",
        path="/",
    )


@router.post("/signup", response_model=AuthUserResponse, status_code=201)
def signup(
    data: SignupRequest,
    response: Response,
    session: DatabaseSession,
    settings: AppSettings,
) -> AuthUserResponse:
    user = create_account(session, data)
    token = create_auth_session(session, user, settings.auth_session_hours)
    set_session_cookie(response, token, settings)
    return auth_response(user)


@router.post("/signin", response_model=AuthUserResponse)
def signin(
    data: SigninRequest,
    response: Response,
    session: DatabaseSession,
    settings: AppSettings,
) -> AuthUserResponse:
    user = authenticate(session, data.email, data.password)
    token = create_auth_session(session, user, settings.auth_session_hours)
    set_session_cookie(response, token, settings)
    return auth_response(user)


@router.get("/me", response_model=AuthUserResponse)
def me(user: CurrentUser) -> AuthUserResponse:
    return auth_response(user)


@router.post("/signout", status_code=204)
def signout(
    request: Request,
    response: Response,
    session: DatabaseSession,
    settings: AppSettings,
) -> None:
    revoke_session(session, request.cookies.get(settings.auth_cookie_name))
    response.delete_cookie(settings.auth_cookie_name, path="/", samesite="strict")
