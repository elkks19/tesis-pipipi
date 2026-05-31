from fastapi import Header, HTTPException, status

from app.core.config import get_settings


async def require_internal_token(
    authorization: str | None = Header(default=None),
    x_ds_internal_token: str | None = Header(default=None),
) -> None:
    expected = get_settings().internal_token
    if not expected:
        return

    bearer = None
    if authorization and authorization.lower().startswith("bearer "):
        bearer = authorization[7:].strip()

    if bearer == expected or x_ds_internal_token == expected:
        return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token interno invalido.",
    )
