from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_chat import router as chat_router
from app.api.routes_conversations import router as conversations_router
from app.api.routes_health import router as health_router
from app.api.routes_index import router as index_router
from app.api.routes_reports import router as reports_router
from app.core.config import get_settings


settings = get_settings()

app = FastAPI(
    title="Tesis Investigacion API",
    description="API local para consulta, analisis y chat sobre historias clinicas.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_headers=["*"],
    allow_methods=["*"],
    allow_origins=settings.cors_origins,
)

app.include_router(health_router)
app.include_router(index_router)
app.include_router(conversations_router)
app.include_router(reports_router)
app.include_router(chat_router)
