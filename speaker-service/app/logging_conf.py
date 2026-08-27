import logging

from app.config import settings


def configure_logging() -> logging.Logger:
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s  %(levelname)-7s  %(name)s  %(message)s",
    )
    return logging.getLogger("speaker-service")


logger = configure_logging()
