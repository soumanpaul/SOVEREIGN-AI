import time
from typing import Literal

import httpx
from fastapi import APIRouter

from app.api.dependencies import CurrentUser
from app.schemas.common import EgressTestResponse

router = APIRouter(prefix="/security", tags=["security"])
PROBE_TARGET = "https://example.com"


@router.post("/egress-test", response_model=EgressTestResponse)
async def egress_test(_: CurrentUser) -> EgressTestResponse:
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=3, follow_redirects=False) as client:
            response = await client.get(
                PROBE_TARGET, headers={"User-Agent": "sovereign-egress-probe"}
            )
        status: Literal["blocked", "egress_detected", "error"] = "egress_detected"
        detail = f"Outbound HTTPS succeeded with status {response.status_code}."
    except httpx.HTTPError:
        status = "blocked"
        detail = "Outbound HTTPS could not reach the controlled public probe."
    return EgressTestResponse(
        status=status,
        target=PROBE_TARGET,
        duration_ms=int((time.perf_counter() - started) * 1000),
        detail=detail,
    )
