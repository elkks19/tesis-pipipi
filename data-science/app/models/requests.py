from typing import Literal

from pydantic import BaseModel, Field


class ChatScope(BaseModel):
    user_id: str | None = Field(default=None, alias="userId")
    role: str | None = None
    viaje_id: str | None = Field(default=None, alias="viajeId")
    viaje_ids: list[str] | None = Field(default=None, alias="viajeIds")
    station_key: str | None = Field(default=None, alias="stationKey")

    def to_filters(self) -> dict[str, str | list[str] | None]:
        viaje_ids = self.viaje_ids
        if not viaje_ids and self.viaje_id:
            viaje_ids = [self.viaje_id]

        return {
            "user_id": self.user_id,
            "role": self.role,
            "viaje_id": self.viaje_id,
            "viaje_ids": viaje_ids,
            "station_key": self.station_key,
        }


class ChatRequest(BaseModel):
    chart_type: Literal["auto", "table", "bar", "line", "pie"] = Field(
        default="auto",
        alias="chartType",
    )
    conversation_id: str | None = Field(default=None, alias="conversationId")
    message: str = Field(min_length=1)
    scope: ChatScope = Field(default_factory=ChatScope)
    top_k: int = Field(default=6, ge=1, le=20, alias="topK")


class ArtifactUpdateRequest(BaseModel):
    chart_type: str = Field(alias="chartType")


class ReportRequest(BaseModel):
    conversation_id: str | None = Field(default=None, alias="conversationId")
    scope: ChatScope = Field(default_factory=ChatScope)
