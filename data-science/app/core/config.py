from functools import lru_cache
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    couchdb_url: str = Field(default="", alias="COUCHDB_URL")
    llm_provider: str = Field(default="ollama", alias="DS_LLM_PROVIDER")
    ollama_url: str = Field(default="http://localhost:11434", alias="DS_OLLAMA_URL")
    chat_model: str = Field(default="qwen3:4b", alias="DS_CHAT_MODEL")
    embedding_model: str = Field(
        default="intfloat/multilingual-e5-small",
        alias="DS_EMBEDDING_MODEL",
    )
    storage_dir: Path = Field(default=SERVICE_DIR / "storage", alias="DS_STORAGE_DIR")
    internal_token: str | None = Field(default=None, alias="DS_INTERNAL_TOKEN")
    cors_origins_raw: str = Field(default="http://localhost:5173", alias="DS_CORS_ORIGINS")

    model_config = SettingsConfigDict(
        env_file=(".env", "data-science/.env"),
        extra="ignore",
        populate_by_name=True,
    )

    def model_post_init(self, __context: object) -> None:
        if self.storage_dir.is_absolute():
            return

        if self.storage_dir.parts[:1] == ("data-science",):
            self.storage_dir = SERVICE_DIR.parent / self.storage_dir
            return

        self.storage_dir = SERVICE_DIR / self.storage_dir

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]

    @property
    def vector_db_path(self) -> Path:
        return self.storage_dir / "rag.sqlite3"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    return settings
