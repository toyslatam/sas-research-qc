from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Configuración por variables de entorno. Los umbrales viven aquí, NO en el
    código, para poder calibrarlos con datos reales sin tocar la lógica
    (requisito explícito del proyecto).
    """

    model_config = SettingsConfigDict(env_file=".env", env_prefix="SPEAKER_", extra="ignore")

    # Modelo de embedding. Intercambiable: ver app/models/.
    model_name: str = "speechbrain/spkrec-ecapa-voxceleb"
    model_version: str = "1"  # subir si cambia el modelo o el preprocesamiento
    embedding_dim: int = 192  # ECAPA-TDNN

    # Selección del segmento de referencia dentro de un audio largo.
    sample_rate: int = 16000
    target_seconds: float = 45.0   # cuánta voz limpia usar como referencia
    min_seconds: float = 8.0       # por debajo de esto, no se genera embedding

    # Umbrales de similitud coseno. VALORES SIN CALIBRAR: son un punto de
    # partida, deben ajustarse con audios reales antes de confiar en ellos.
    high_threshold: float = 0.75
    medium_threshold: float = 0.55
    low_threshold: float = 0.40

    log_level: str = "INFO"


settings = Settings()
