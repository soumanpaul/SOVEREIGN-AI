import asyncio
import hashlib
import json
import uuid
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.config import get_settings
from app.core.errors import AppError
from app.db.models import (
    Document,
    DocumentChunk,
    IngestionJob,
    KnowledgeBase,
    KnowledgeBaseDocument,
    StoredFile,
)
from app.db.session import SessionLocal
from app.documents.chunker import chunk_pages
from app.documents.parser import extract_pages
from app.model_providers.ollama import OllamaModelProvider
from app.services.file_storage import resolve_storage_key
from app.services.qdrant_store import QdrantStore


def _now() -> datetime:
    return datetime.now(UTC)


async def run_ingestion(job_id: uuid.UUID) -> None:
    settings = get_settings()
    session = SessionLocal()
    try:
        job = session.get(IngestionJob, job_id)
        if job is None:
            return
        kb = session.get(KnowledgeBase, job.knowledge_base_id)
        if kb is None:
            return
        job.status, job.started_at, kb.status = "running", _now(), "indexing"
        session.commit()
        provider = OllamaModelProvider(settings.ollama_base_url)
        vector_store = QdrantStore(settings.qdrant_url, settings.qdrant_collection)
        all_points: list[dict[str, object]] = []
        dimensions: int | None = None
        for raw_file_id in job.requested_file_ids:
            stored = session.get(StoredFile, uuid.UUID(raw_file_id))
            if stored is None or stored.workspace_id != kb.workspace_id:
                raise AppError(
                    "FILE_NOT_FOUND", "An ingestion file was not found in this workspace.", 404
                )
            document = session.scalar(select(Document).where(Document.file_id == stored.id))
            if document is None:
                document = Document(file_id=stored.id)
                session.add(document)
                session.flush()
            pages, warnings = await asyncio.to_thread(
                extract_pages,
                resolve_storage_key(settings.data_root, stored.storage_key),
                stored.media_type,
                settings.max_pdf_pages,
                settings.ocr_text_threshold,
            )
            if not any(page.text.strip() for page in pages):
                raise AppError(
                    "NO_EXTRACTABLE_TEXT",
                    f"No text could be extracted from {stored.display_name}.",
                    422,
                )
            normalized_key = f"workspaces/{kb.workspace_id}/extracted/{document.id}/pages.json"
            normalized_path = resolve_storage_key(settings.data_root, normalized_key)
            normalized_path.parent.mkdir(parents=True, exist_ok=True)
            normalized_path.write_text(
                json.dumps([page.to_dict() for page in pages], ensure_ascii=False), encoding="utf-8"
            )
            document.page_count = len(pages)
            document.extraction_status = "completed"
            document.normalized_path = normalized_key
            document.warnings = warnings
            document.updated_at = _now()
            chunks = chunk_pages(pages, settings.chunk_size_chars, settings.chunk_overlap_chars)
            link = KnowledgeBaseDocument(
                knowledge_base_id=kb.id,
                document_id=document.id,
                index_version=job.index_version,
                status="indexing",
                chunk_count=len(chunks),
            )
            session.add(link)
            for batch_start in range(0, len(chunks), 8):
                batch = chunks[batch_start : batch_start + 8]
                result = await provider.embed(
                    [chunk.text for chunk in batch], settings.embedding_model
                )
                for chunk, vector in zip(batch, result.vectors, strict=True):
                    dimensions = len(vector)
                    point_id = uuid.uuid4()
                    row = DocumentChunk(
                        knowledge_base_id=kb.id,
                        document_id=document.id,
                        index_version=job.index_version,
                        ordinal=chunk.ordinal,
                        page_start=chunk.page_start,
                        page_end=chunk.page_end,
                        section=chunk.section,
                        text=chunk.text,
                        text_hash=hashlib.sha256(chunk.text.encode()).hexdigest(),
                        vector_point_id=point_id,
                    )
                    session.add(row)
                    all_points.append(
                        {
                            "id": str(point_id),
                            "vector": vector,
                            "payload": {
                                "knowledge_base_id": str(kb.id),
                                "document_id": str(document.id),
                                "index_version": job.index_version,
                                "page_start": chunk.page_start,
                                "page_end": chunk.page_end,
                                "text": chunk.text,
                                "display_name": stored.display_name,
                            },
                        }
                    )
            link.status = "indexed"
            job.completed_documents += 1
            session.commit()
        if not all_points or dimensions is None:
            raise AppError("NO_CHUNKS", "The files did not produce indexable text.", 422)
        await vector_store.ensure_collection(dimensions)
        for start in range(0, len(all_points), 64):
            await vector_store.upsert(all_points[start : start + 64])
        kb.active_index_version, kb.status, kb.updated_at = job.index_version, "ready", _now()
        job.status, job.completed_at = "completed", _now()
        session.commit()
    except Exception as exc:
        session.rollback()
        job = session.get(IngestionJob, job_id)
        if job:
            job.status, job.failed_documents, job.completed_at = "failed", 1, _now()
            job.error_code = exc.code if isinstance(exc, AppError) else "INGESTION_FAILED"
            job.error_message = (exc.message if isinstance(exc, AppError) else str(exc))[:500]
            kb = session.get(KnowledgeBase, job.knowledge_base_id)
            if kb:
                kb.status = "ready" if kb.active_index_version is not None else "error"
            session.commit()
    finally:
        session.close()
