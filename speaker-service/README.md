# Speaker Service — reconocimiento de hablante (Fase 1)

Microservicio Python **independiente** que genera y compara *embeddings* de voz.
Su única responsabilidad es "¿quién habla?" — la transcripción ("¿qué se dijo?")
sigue en el backend Node con Whisper, sin cambios.

## Para qué sirve

Detección de **posibles coincidencias** de voz entre grabaciones, como indicador
para **revisión humana** en control de calidad (p. ej. sospecha de que dos
entrevistas fueron hechas por la misma persona). **No decide identidad**: entrega
una *similitud* y una etiqueta (alta/media/baja) que un humano interpreta.

## Aislamiento (garantías)

- Proceso aparte del backend Node. Si está apagado, el backend responde `503` en
  `/api/speaker/*` y **todo lo demás (Whispper, transcripción, QC) sigue igual**.
- No toca tablas de Whispper. Escribe solo en `speaker_*` (migración
  `database/supabase_migration_speaker_1.sql`).
- El modelo es intercambiable (`app/models/`). Hoy: ECAPA-TDNN (SpeechBrain).

## Requisitos

Python 3.11+ **o** Docker. `torch`/`torchaudio` pesan ~2 GB (CPU, sin GPU, sin
API de pago). `ffmpeg` para decodificar m4a/aac/mp3 (incluido en el Dockerfile;
si corres local, instálalo aparte).

## Validación aislada — el paso clave de la Fase 1

Prueba el componente **sin Node y sin base de datos**, con dos audios tuyos:

```bash
cd speaker-service
python -m venv .venv && . .venv/Scripts/activate   # Windows
pip install -r requirements.txt
python scripts/selftest.py  ruta/audio_persona_A_1.m4a  ruta/audio_persona_A_2.m4a  ruta/audio_persona_B.m4a
```

Qué esperar: los dos audios de la **misma** persona deben dar similitud más alta
que los de personas **distintas**. Si eso se cumple con tus grabaciones reales,
el modelo sirve como indicador y avanzamos a los ~2.000 históricos.

## Levantar el servicio

**Local:**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8100
```

**Docker:**
```bash
docker build -t speaker-service .
docker run -p 8100:8100 speaker-service
```

Luego, para conectarlo al backend Node, define en el `.env` del backend:
```
SPEAKER_SERVICE_URL=http://localhost:8100
```
Sin esa variable, la función queda deshabilitada a propósito.

## Endpoints

| Método | Ruta | Qué hace |
|--------|------|----------|
| GET | `/health` | Vivo/config. No carga el modelo. |
| POST | `/embed` | Audio (multipart `file`) → vector 192-d + segundos usados. |
| POST | `/compare` | Un embedding + candidatos → ranking por similitud coseno. |

## Umbrales

`SPEAKER_HIGH/MEDIUM/LOW_THRESHOLD` en `.env`. **Sin calibrar**: son un punto de
partida. Se ajustan con datos reales antes de confiar en la etiqueta.
