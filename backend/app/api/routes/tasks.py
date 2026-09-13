import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Header
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.api.dependencies import AppSettings, CurrentUser, DatabaseSession
from app.core.errors import AppError
from app.db.models import Artifact, AuditEvent, TaskRun, TaskStep, Workspace
from app.schemas.tasks import (
    ArtifactResponse,
    AuditEventResponse,
    TaskAccepted,
    TaskCreate,
    TaskResponse,
    TaskStepResponse,
)
from app.services.file_storage import resolve_storage_key
from app.tasks.runtime import execute_run
from app.tasks.service import (
    cancel_task,
    create_task,
    get_owned_task,
    list_tasks,
    retry_task,
    task_response,
)

router = APIRouter(tags=["tasks"])


@router.post("/tasks", response_model=TaskAccepted, status_code=202)
def submit_task(
    payload: TaskCreate,
    background: BackgroundTasks,
    session: DatabaseSession,
    user: CurrentUser,
    settings: AppSettings,
    idempotency_key: Annotated[str | None, Header(max_length=120)] = None,
) -> TaskAccepted:
    accepted = create_task(session, payload, user, settings, idempotency_key)
    background.add_task(execute_run, accepted.run_id)
    return accepted


@router.get("/tasks", response_model=list[TaskResponse])
def tasks(session: DatabaseSession, user: CurrentUser, limit: int = 25) -> list[TaskResponse]:
    return list_tasks(session, user, max(1, min(limit, 100)))


@router.get("/tasks/{task_id}", response_model=TaskResponse)
def task_detail(task_id: uuid.UUID, session: DatabaseSession, user: CurrentUser) -> TaskResponse:
    return task_response(session, get_owned_task(session, task_id, user))


@router.post("/tasks/{task_id}/cancel", response_model=TaskResponse, status_code=202)
def cancel(task_id: uuid.UUID, session: DatabaseSession, user: CurrentUser) -> TaskResponse:
    return cancel_task(session, get_owned_task(session, task_id, user))


@router.post("/tasks/{task_id}/retry", response_model=TaskAccepted, status_code=202)
def retry(
    task_id: uuid.UUID,
    background: BackgroundTasks,
    session: DatabaseSession,
    user: CurrentUser,
    settings: AppSettings,
) -> TaskAccepted:
    accepted = retry_task(session, get_owned_task(session, task_id, user), settings)
    background.add_task(execute_run, accepted.run_id)
    return accepted


@router.get("/runs/{run_id}/steps", response_model=list[TaskStepResponse])
def run_steps(
    run_id: uuid.UUID, session: DatabaseSession, user: CurrentUser
) -> list[TaskStep]:
    run = session.get(TaskRun, run_id)
    if run is None:
        raise AppError("RUN_NOT_FOUND", "Run not found.", 404)
    get_owned_task(session, run.task_id, user)
    return list(
        session.scalars(
            select(TaskStep).where(TaskStep.run_id == run_id).order_by(TaskStep.sequence)
        )
    )


@router.get("/runs/{run_id}/artifacts", response_model=list[ArtifactResponse])
def run_artifacts(
    run_id: uuid.UUID, session: DatabaseSession, user: CurrentUser
) -> list[ArtifactResponse]:
    run = session.get(TaskRun, run_id)
    if run is None:
        raise AppError("RUN_NOT_FOUND", "Run not found.", 404)
    get_owned_task(session, run.task_id, user)
    return [
        ArtifactResponse.model_validate(item).model_copy(
            update={"download_url": f"/api/v1/artifacts/{item.id}/content"}
        )
        for item in session.scalars(select(Artifact).where(Artifact.run_id == run_id))
    ]


@router.get("/artifacts/{artifact_id}/content")
def artifact_content(
    artifact_id: uuid.UUID,
    session: DatabaseSession,
    user: CurrentUser,
    settings: AppSettings,
) -> FileResponse:
    artifact = session.scalar(
        select(Artifact)
        .join(Workspace, Workspace.id == Artifact.workspace_id)
        .where(Artifact.id == artifact_id, Workspace.organization_id == user.organization_id)
    )
    if artifact is None:
        raise AppError("ARTIFACT_NOT_FOUND", "Artifact not found.", 404)
    path: Path = resolve_storage_key(settings.data_root, artifact.storage_key)
    if not path.is_file():
        raise AppError("ARTIFACT_FILE_MISSING", "Artifact content is unavailable.", 404)
    return FileResponse(path, media_type=artifact.media_type, filename=artifact.display_name)


@router.get("/audit-events", response_model=list[AuditEventResponse])
def audit_events(
    session: DatabaseSession,
    user: CurrentUser,
    run_id: uuid.UUID | None = None,
    limit: int = 100,
) -> list[AuditEvent]:
    statement = (
        select(AuditEvent)
        .join(Workspace, Workspace.id == AuditEvent.workspace_id)
        .where(Workspace.organization_id == user.organization_id)
        .order_by(AuditEvent.occurred_at.desc())
        .limit(max(1, min(limit, 200)))
    )
    if run_id:
        statement = statement.where(AuditEvent.run_id == run_id)
    return list(session.scalars(statement))
