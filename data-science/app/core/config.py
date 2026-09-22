from functools import lru_cache
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    couchdb_url: str = Field(default="", alias="COUCHDB_URL")
    llm_provider: str = Field(default="groq", alias="DS_LLM_PROVIDER")
    ollama_url: str = Field(default="http://localhost:11434", alias="DS_OLLAMA_URL")
    chat_model: str = Field(default="openai/gpt-oss-20b", alias="DS_CHAT_MODEL")
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    groq_base_url: str = Field(
        default="https://api.groq.com/openai/v1",
        alias="DS_GROQ_BASE_URL",
    )
    max_completion_tokens: int = Field(default=900, alias="DS_MAX_COMPLETION_TOKENS")
    temperature: float = Field(default=0.2, alias="DS_TEMPERATURE")
    reasoning_format: str = Field(default="hidden", alias="DS_REASONING_FORMAT")
    reasoning_effort: str = Field(default="low", alias="DS_REASONING_EFFORT")
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
