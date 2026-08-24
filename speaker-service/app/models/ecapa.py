from __future__ import annotations

import numpy as np

from app.logging_conf import logger
from app.models.base import EmbeddingModel


class EcapaEmbeddingModel(EmbeddingModel):
    """
    ECAPA-TDNN de SpeechBrain (spkrec-ecapa-voxceleb), 192 dimensiones, CPU.

    El modelo se carga de forma perezosa (en la primera llamada a embed), no al
    importar: así el proceso arranca rápido y /health responde aunque los pesos
    aún no estén descargados.
    """

    def __init__(self, model_name: str, dim: int) -> None:
        self.name = model_name
        self.dim = dim
        self._encoder = None  # type: ignore[var-annotated]

    def _ensure_loaded(self) -> None:
        if self._encoder is not None:
            return
        # Import diferido: torch/speechbrain son pesados; no cargarlos si solo
        # se consulta /health o /compare.
        from speechbrain.inference.speaker import EncoderClassifier

        logger.info("Cargando modelo ECAPA '%s' (primera vez puede tardar)…", self.name)
        self._encoder = EncoderClassifier.from_hparams(
            source=self.name,
            savedir=f"pretrained/{self.name.replace('/', '_')}",
            run_opts={"device": "cpu"},
        )
        logger.info("Modelo ECAPA cargado.")

    def embed(self, samples: np.ndarray, sample_rate: int) -> np.ndarray:
        import torch

        self._ensure_loaded()
        assert self._encoder is not None

        wav = torch.from_numpy(np.ascontiguousarray(samples, dtype=np.float32)).unsqueeze(0)
        with torch.no_grad():
            emb = self._encoder.encode_batch(wav)  # [1, 1, dim]
        vec = emb.squeeze().cpu().numpy().astype(np.float32)

        norm = float(np.linalg.norm(vec))
        if norm > 0:
            vec = vec / norm
        if vec.shape[0] != self.dim:
            raise ValueError(f"El modelo devolvió dim {vec.shape[0]}, se esperaba {self.dim}")
        return vec
