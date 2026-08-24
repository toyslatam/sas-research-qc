"""
Genera audios WAV sintéticos para validar el PLUMBING del microservicio
(decodificar → segmentar → embedding → coseno) sin necesidad de audios reales.

NO valida si el modelo distingue personas — eso requiere voz real. Solo prueba
que el componente corre de punta a punta y produce vectores de la dimensión
esperada. Genera tres tonos: dos parecidos y uno distinto.

Uso:
    python scripts/make_test_audio.py
"""
from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

SR = 16000
SECONDS = 12  # supera el mínimo de voz del segmentador


def write_tone(path: Path, freqs: list[float], amp: float = 0.3) -> None:
    n = SR * SECONDS
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = bytearray()
        for i in range(n):
            t = i / SR
            # Suma de armónicos + una envolvente para que no sea silencio puro.
            val = sum(math.sin(2 * math.pi * f * t) for f in freqs) / len(freqs)
            val *= amp * (0.6 + 0.4 * math.sin(2 * math.pi * 3 * t))
            frames += struct.pack("<h", int(val * 32767))
        w.writeframes(bytes(frames))
    print(f"escrito {path.name}")


def main() -> None:
    out = Path(__file__).resolve().parent / "test_audio"
    out.mkdir(exist_ok=True)
    # A1 y A2: espectros parecidos. B: claramente distinto.
    write_tone(out / "tone_A1.wav", [180, 360, 540])
    write_tone(out / "tone_A2.wav", [185, 366, 548])
    write_tone(out / "tone_B.wav", [400, 820, 1240])
    print(f"\nListo. Prueba:\n  python scripts/selftest.py {out/'tone_A1.wav'} {out/'tone_A2.wav'} {out/'tone_B.wav'}")


if __name__ == "__main__":
    main()
