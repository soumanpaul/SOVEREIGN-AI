import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, File, UploadFile
from sqlalchemy import select

from app.api.dependencies import AppSettings, DatabaseSession, OllamaProvider
from app.core.errors import AppError
from app.db.models import IngestionJob, KnowledgeBase, StoredFile, Workspace
from app.schemas.knowledge import (
    FileResponse,
    IngestionRequest,
    IngestionResponse,
    KnowledgeBaseCreate,
    KnowledgeBaseResponse,
    SearchHit,
    SearchRequest,
    SearchResponse,
    WorkspaceCreate,
    WorkspaceResponse,
)
from app.services.file_storage import store_upload
from app.services.knowledge_ingestion import run_ingestion
from app.services.qdrant_store import QdrantStore

router = APIRouter(tags=["knowledge"])


@router.get("/workspaces", response_model=list[WorkspaceResponse])
def list_workspaces(session: DatabaseSession) -> list[Workspace]:
    return list(session.scalars(select(Workspace).order_by(Workspace.created_at)))


@router.post("/workspaces", response_model=WorkspaceResponse, status_code=201)
def create_workspace(payload: WorkspaceCreate, session: DatabaseSession) -> Workspace:
    workspace = Workspace(name=payload.name.strip())
    session.add(workspace)
    session.commit()
    session.refresh(workspace)
    return workspace


@router.get("/workspaces/{workspace_id}/files", response_model=list[FileResponse])
def list_files(workspace_id: uuid.UUID, session: DatabaseSession) -> list[StoredFile]:
    return list(
        session.scalars(
            select(StoredFile)
            .where(StoredFile.workspace_id == workspace_id)
            .order_by(StoredFile.created_at.desc())
        )
    )


@router.post("/workspaces/{workspace_id}/files", response_model=FileResponse, status_code=201)
async def upload_file(
    workspace_id: uuid.UUID,
    session: DatabaseSession,
    settings: AppSettings,
    file: Annotated[UploadFile, File()],
) -> StoredFile:
    if session.get(Workspace, workspace_id) is None:
        raise AppError("WORKSPACE_NOT_FOUND", "Workspace not found.", 404)
    uploaded = await store_upload(file, settings.data_root, workspace_id, settings.max_upload_bytes)
    record = StoredFile(
        workspace_id=workspace_id,
        display_name=uploaded.display_name,
        storage_key=uploaded.storage_key,
        media_type=uploaded.media_type,
        size_bytes=uploaded.size_bytes,
        sha256=uploaded.sha256,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


@router.get("/knowledge-bases", response_model=list[KnowledgeBaseResponse])
def list_knowledge_bases(
    session: DatabaseSession, workspace_id: uuid.UUID | None = None
) -> list[KnowledgeBase]:
    statement = select(KnowledgeBase).order_by(KnowledgeBase.created_at)
    if workspace_id:
        statement = statement.where(KnowledgeBase.workspace_id == workspace_id)
    return list(session.scalars(statement))


@router.post("/knowledge-bases", response_model=KnowledgeBaseResponse, status_code=201)
def create_knowledge_base(payload: KnowledgeBaseCreate, session: DatabaseSession) -> KnowledgeBase:
    if session.get(Workspace, payload.workspace_id) is None:
        raise AppError("WORKSPACE_NOT_FOUND", "Workspace not found.", 404)
    kb = KnowledgeBase(workspace_id=payload.workspace_id, name=payload.name.strip())
    session.add(kb)
    session.commit()
    session.refresh(kb)
    return kb


@router.post(
    "/knowledge-bases/{kb_id}/ingestions", response_model=IngestionResponse, status_code=202
)
def ingest(
    kb_id: uuid.UUID, payload: IngestionRequest, tasks: BackgroundTasks, session: DatabaseSession
) -> IngestionJob:
    kb = session.get(KnowledgeBase, kb_id)
    if kb is None:
        raise AppError("KNOWLEDGE_BASE_NOT_FOUND", "Knowledge base not found.", 404)
    if kb.status == "indexing":
        raise AppError(
            "INGESTION_IN_PROGRESS", "This knowledge base is already indexing.", 409, True
        )
    files = list(session.scalars(select(StoredFile).where(StoredFile.id.in_(payload.file_ids))))
    if len(files) != len(set(payload.file_ids)) or any(
        item.workspace_id != kb.workspace_id for item in files
    ):
        raise AppError("FILE_NOT_FOUND", "Every file must belong to this workspace.", 404)
    version = (kb.active_index_version or 0) + 1
    job = IngestionJob(
        knowledge_base_id=kb.id,
        requested_file_ids=[str(item) for item in payload.file_ids],
        index_version=version,
        total_documents=len(payload.file_ids),
    )
    kb.status = "indexing"
    session.add(job)
    session.commit()
    session.refresh(job)
    tasks.add_task(run_ingestion, job.id)
    return job


@router.get("/ingestions/{job_id}", response_model=IngestionResponse)
def ingestion_status(job_id: uuid.UUID, session: DatabaseSession) -> IngestionJob:
    job = session.get(IngestionJob, job_id)
    if job is None:
        raise AppError("INGESTION_NOT_FOUND", "Ingestion job not found.", 404)
    return job


@router.post("/knowledge-bases/{kb_id}/search", response_model=SearchResponse)
async def search(
    kb_id: uuid.UUID,
    payload: SearchRequest,
    session: DatabaseSession,
    settings: AppSettings,
    provider: OllamaProvider,
) -> SearchResponse:
    kb = session.get(KnowledgeBase, kb_id)
    if kb is None or kb.active_index_version is None:
        raise AppError(
            "KNOWLEDGE_BASE_NOT_READY", "Index this knowledge base before searching it.", 409
        )
    embedding = await provider.embed([payload.query], settings.embedding_model)
    points = await QdrantStore(settings.qdrant_url, settings.qdrant_collection).search(
        embedding.vectors[0], str(kb.id), kb.active_index_version, payload.limit
    )
    hits = [
        SearchHit(
            score=float(point.get("score", 0)),
            text=str(point.get("payload", {}).get("text", "")),
            citation={
                "document_id": point.get("payload", {}).get("document_id"),
                "display_name": point.get("payload", {}).get("display_name", "Document"),
                "page_start": point.get("payload", {}).get("page_start", 1),
                "page_end": point.get("payload", {}).get("page_end", 1),
            },
        )
        for point in points
    ]
    return SearchResponse(
        knowledge_base_id=kb.id,
        index_version=kb.active_index_version,
        query=payload.query,
        hits=hits,
    )
