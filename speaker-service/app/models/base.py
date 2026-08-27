from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np


class EmbeddingModel(ABC):
    """
    Contrato de un modelo de speaker embedding. Aísla el resto del servicio del
    modelo concreto: cambiar ECAPA por otro (o por una API) no toca la lógica de
    segmentación, comparación ni los endpoints. (Requisito: modularidad para
    cambiar el modelo sin afectar a los clientes.)
    """

    name: str
    dim: int

    @abstractmethod
    def embed(self, samples: np.ndarray, sample_rate: int) -> np.ndarray:
        """Recibe audio mono float32 y devuelve un vector L2-normalizado de tamaño `dim`."""
        raise NotImplementedError


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Similitud coseno entre dos vectores. Con vectores ya normalizados es el producto punto."""
    a = np.asarray(a, dtype=np.float32)
    b = np.asarray(b, dtype=np.float32)
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0.0:
        return 0.0
    return float(np.dot(a, b) / denom)
