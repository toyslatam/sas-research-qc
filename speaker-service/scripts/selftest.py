"""
Validación aislada de la Fase 1 — SIN Node, SIN base de datos.

Toma dos (o más) archivos de audio, genera sus embeddings con el modelo real y
muestra la similitud coseno entre ellos. Es la forma más directa de comprobar
que el componente nuevo funciona por su cuenta.

Uso:
    python scripts/selftest.py audio_a.m4a audio_b.wav [audio_c.mp3 ...]

Idea de la prueba:
  · Dos audios de la MISMA persona → similitud alta.
  · Dos audios de personas DISTINTAS → similitud baja.
Si eso se cumple con tus audios reales, el modelo sirve como indicador.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Permite ejecutar el script directamente (python scripts/selftest.py ...).
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.audio import select_reference_segment  # noqa: E402
from app.config import settings  # noqa: E402
from app.models.base import cosine_similarity  # noqa: E402
from app.models.ecapa import EcapaEmbeddingModel  # noqa: E402


def main(paths: list[str]) -> None:
    if len(paths) < 2:
        print("Pasa al menos dos archivos de audio.")
        sys.exit(1)

    model = EcapaEmbeddingModel(settings.model_name, settings.embedding_dim)
    vectors = []
    for p in paths:
        data = Path(p).read_bytes()
        segment, used = select_reference_segment(data)
        vec = model.embed(segment, settings.sample_rate)
        vectors.append((p, vec))
        print(f"✓ {Path(p).name}: embedding dim={vec.shape[0]}, {used:.1f}s de voz usados")

    print("\nSimilitud coseno entre pares:")
    print("-" * 60)
    for i in range(len(vectors)):
        for j in range(i + 1, len(vectors)):
            (pa, va), (pb, vb) = vectors[i], vectors[j]
            score = cosine_similarity(va, vb)
            label = (
                "ALTA" if score >= settings.high_threshold
                else "MEDIA" if score >= settings.medium_threshold
                else "BAJA" if score >= settings.low_threshold
                else "muy baja"
            )
            print(f"{Path(pa).name:28} ↔ {Path(pb).name:28}  {score:6.3f}  {label}")
    print("-" * 60)
    print("Umbrales SIN calibrar. Ajusta SPEAKER_*_THRESHOLD con tus datos reales.")


if __name__ == "__main__":
    main(sys.argv[1:])
