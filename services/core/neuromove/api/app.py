import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..config.settings import get_settings
from ..database.connection import default_db_manager
from ..logging.logger import setup_logging
from .router import api_router, ws_router

logger = logging.getLogger("neuromove.api")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application startup and shutdown lifecycle management."""
    setup_logging()
    settings = get_settings()

    core_dir = str(Path(__file__).resolve().parents[2])
    if core_dir not in sys.path:
        sys.path.insert(0, core_dir)

    logger.info(
        "Initializing NeuroMove Core Control Station in %s mode...", settings.neuromove_mode.value
    )

    # Initialize local SQLite persistence
    try:
        default_db_manager.initialize_db()
    except Exception as exc:
        logger.warning("Database bootstrap encountered warning: %s", exc)

    logger.info(
        "NeuroMove Core initialized and ready on %s:%d", settings.api_host, settings.api_port
    )
    yield
    logger.info("Shutting down NeuroMove Core Control Station safely.")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application instance."""
    core_dir = str(Path(__file__).resolve().parents[2])
    if core_dir not in sys.path:
        sys.path.insert(0, core_dir)

    settings = get_settings()

    app = FastAPI(
        title="NeuroMove Core Control Station API",
        description="Local safety-critical BCI control, telemetry, and research service for NeuroMove.",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Configure secure CORS for web command center
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            settings.web_origin,
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Attach routers
    app.include_router(api_router)
    app.include_router(ws_router)

    return app


app = create_app()
