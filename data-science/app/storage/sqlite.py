from pathlib import Path


def ensure_storage_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
