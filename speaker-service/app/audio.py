from __future__ import annotations

import io
from typing import NamedTuple

import numpy as np

from app.config import settings
from app.logging_conf import logger


class AudioTooShortError(Exception):
    """No hay suficiente voz limpia para generar un embedding fiable."""


def _load_mono(data: bytes, target_sr: int) -> np.ndarray:
    """
    Carga audio a mono float32 y target_sr.

    Decodificación en dos niveles: soundfile para WAV/FLAC/OGG (sin dependencias
    del sistema) y, si ese formato no lo soporta, torchaudio con backend ffmpeg
    para los formatos comprimidos del teléfono (m4a/aac/mp3). La conversión de
    frecuencia usa torchaudio.functional.resample, que es una operación de
    tensores y no depende de ningún backend de audio.
    """
    import torch
    import torchaudio.functional as AF

    samples: np.ndarray
    sr: int
    try:
        import soundfile as sf

        audio, sr = sf.read(io.BytesIO(data), dtype="float32", always_2d=True)  # [frames, canales]
        samples = audio.mean(axis=1).astype(np.float32)  # a mono
    except Exception:
        # Formatos comprimidos: requieren backend ffmpeg de torchaudio.
        import torchaudio

        waveform, sr = torchaudio.load(io.BytesIO(data))
        if waveform.shape[0] > 1:
            waveform = waveform.mean(dim=0, keepdim=True)
        samples = waveform.squeeze(0).numpy().astype(np.float32)

    if sr != target_sr:
        tensor = torch.from_numpy(np.ascontiguousarray(samples))
        samples = AF.resample(tensor, sr, target_sr).numpy().astype(np.float32)
    return samples


def _voiced_mask(samples: np.ndarray, sr: int, frame_ms: int = 30) -> np.ndarray:
    """
    VAD sencillo por energía: marca los frames cuya energía supera un umbral
    relativo. No es un VAD entrenado —es suficiente para descartar silencios y
    quedarse con la región hablada—; se refinará en fases posteriores.
    """
    frame = max(1, int(sr * frame_ms / 1000))
    n = len(samples) // frame
    if n == 0:
        return np.zeros(0, dtype=bool)
    energies = np.array([
        float(np.mean(samples[i * frame:(i + 1) * frame] ** 2)) for i in range(n)
    ])
    if energies.max() <= 0:
        return np.zeros(n, dtype=bool)
    # Umbral: 10% de la energía mediana de los frames con señal.
    thresh = max(np.median(energies[energies > 0]) * 0.1, energies.max() * 0.02)
    return energies >= thresh


class ReferenceSegment(NamedTuple):
    samples: np.ndarray
    used_seconds: float
    start_seconds: float
    end_seconds: float


def select_reference_segment(data: bytes) -> ReferenceSegment:
    """
    De un audio largo, extrae hasta `target_seconds` de la región con más voz
    continua. Devuelve el segmento y los offsets (inicio/fin, en segundos)
    dentro del audio original. Lanza AudioTooShortError si no hay al menos
    `min_seconds` de voz.
    """
    sr = settings.sample_rate
    samples = _load_mono(data, sr)
    total_sec = len(samples) / sr
    logger.info("Audio cargado: %.1fs a %d Hz", total_sec, sr)

    mask = _voiced_mask(samples, sr)
    frame = max(1, int(sr * 30 / 1000))

    # Ventana contigua más larga de frames con voz.
    best_start = best_len = cur_start = cur_len = 0
    for i, voiced in enumerate(mask):
        if voiced:
            if cur_len == 0:
                cur_start = i
            cur_len += 1
            if cur_len > best_len:
                best_len, best_start = cur_len, cur_start
        else:
            cur_len = 0

    voiced_sec = best_len * frame / sr
    if voiced_sec < settings.min_seconds:
        raise AudioTooShortError(
            f"Solo {voiced_sec:.1f}s de voz continua; se requieren {settings.min_seconds:.0f}s"
        )

    start_sample = best_start * frame
    max_samples = int(settings.target_seconds * sr)
    end_sample = min(start_sample + max_samples, len(samples))
    segment = samples[start_sample:end_sample]
    used = len(segment) / sr
    start_sec = start_sample / sr
    end_sec = end_sample / sr
    logger.info(
        "Segmento de referencia: %.1fs [%.1f–%.1f] (de %.1fs de voz continua)",
        used, start_sec, end_sec, voiced_sec,
    )
    return ReferenceSegment(segment, used, start_sec, end_sec)
