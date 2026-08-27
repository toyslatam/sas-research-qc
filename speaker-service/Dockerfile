# Microservicio de embeddings de voz. Se ejecuta en el VPS (o local con Docker),
# aislado del backend Node. torch/torchaudio en CPU.
FROM python:3.11-slim

# ffmpeg: torchaudio lo usa para decodificar m4a/aac/mp3.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8100
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]
