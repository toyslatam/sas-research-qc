from __future__ import annotations

from typing import Optional

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.audio import AudioTooShortError, select_reference_segment
from app.config import settings
from app.logging_conf import logger
from app.models.base import EmbeddingModel, cosine_similarity
from app.models.ecapa import EcapaEmbeddingModel

app = FastAPI(title="SAS Speaker Service", version="0.1.0")

# Selección del modelo. Un solo punto de cambio: para usar otro modelo,
# se implementa EmbeddingModel y se sustituye aquí.
model: EmbeddingModel = EcapaEmbeddingModel(
    settings.model_name, settings.embedding_dim, settings.model_version
)


def confidence_for(score: float) -> str:
    """Traduce la similitud a una etiqueta cualitativa según umbrales configurables."""
    if score >= settings.high_threshold:
        return "high"
    if score >= settings.medium_threshold:
        return "medium"
    if score >= settings.low_threshold:
        return "low"
    return "none"


# ── Health ────────────────────────────────────────────────────────────────
# No carga el modelo: responde siempre, para que el backend Node pueda saber si
# el servicio está vivo sin forzar la carga de torch.
@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "model_name": settings.model_name,
        "embedding_dim": settings.embedding_dim,
        "thresholds": {
            "high": settings.high_threshold,
            "medium": settings.medium_threshold,
            "low": settings.low_threshold,
        },
        "thresholds_calibrated": False,
    }


# ── Embed ─────────────────────────────────────────────────────────────────
class EmbedResponse(BaseModel):
    embedding: list[float]
    model_name: str
    model_version: str
    dim: int
    duration_used: float
    source_start_seconds: float
    source_end_seconds: float
    sample_rate: int


@app.post("/embed", response_model=EmbedResponse)
async def embed(file: UploadFile = File(...)) -> EmbedResponse:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Archivo de audio vacío")
    try:
        seg = select_reference_segment(data)
    except AudioTooShortError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # formato ilegible, etc.
        logger.exception("No se pudo procesar el audio")
        raise HTTPException(status_code=400, detail=f"Audio no procesable: {exc}") from exc

    try:
        vector = model.embed(seg.samples, settings.sample_rate)
    except Exception as exc:
        logger.exception("Falló la generación del embedding")
        raise HTTPException(status_code=500, detail=f"Error del modelo: {exc}") from exc

    return EmbedResponse(
        embedding=vector.tolist(),
        model_name=model.name,
        model_version=model.version,
        dim=model.dim,
        duration_used=round(seg.used_seconds, 2),
        source_start_seconds=round(seg.start_seconds, 2),
        source_end_seconds=round(seg.end_seconds, 2),
        sample_rate=settings.sample_rate,
    )


# ── Compare ───────────────────────────────────────────────────────────────
# Comparación pura (sin modelo): rankea candidatos ya embebidos frente a una
# consulta. En producción, la búsqueda masiva se hace en Postgres con pgvector;
# este endpoint sirve para validar y para conjuntos pequeños.
class Candidate(BaseModel):
    embedding_id: Optional[int] = None
    person_id: Optional[str] = None
    recording_id: Optional[str] = None
    embedding: list[float]


class CompareRequest(BaseModel):
    embedding: list[float]
    candidates: list[Candidate]
    top_k: int = 5


class Match(BaseModel):
    embedding_id: Optional[int]
    person_id: Optional[str]
    recording_id: Optional[str]
    similarity_score: float
    confidence: str
    rank: int


@app.post("/compare", response_model=list[Match])
def compare(req: CompareRequest) -> list[Match]:
    query = np.asarray(req.embedding, dtype=np.float32)
    scored = []
    for cand in req.candidates:
        score = cosine_similarity(query, np.asarray(cand.embedding, dtype=np.float32))
        scored.append((cand, score))
    scored.sort(key=lambda x: x[1], reverse=True)

    matches: list[Match] = []
    for rank, (cand, score) in enumerate(scored[: req.top_k], start=1):
        matches.append(
            Match(
                embedding_id=cand.embedding_id,
                person_id=cand.person_id,
                recording_id=cand.recording_id,
                similarity_score=round(score, 4),
                confidence=confidence_for(score),
                rank=rank,
            )
        )
    return matches
