from collections import Counter
from typing import Any

from app.models.responses import Artifact


def chart_artifact(
    title: str,
    label_key: str,
    value_key: str,
    rows: list[dict[str, Any]],
    *,
    kind: str,
) -> Artifact:
    return Artifact(
        type="chart",
        title=title,
        data=rows,
        spec={
            "kind": kind,
            "x": label_key,
            "y": value_key,
        },
    )


def count_chart_artifact(
    title: str,
    label_key: str,
    value_key: str,
    counts: Counter[str],
    *,
    kind: str = "bar",
) -> Artifact:
    data = [{label_key: key, value_key: value} for key, value in counts.most_common()]
    return chart_artifact(title, label_key, value_key, data, kind=kind)


def table_artifact(
    title: str,
    rows: list[dict[str, Any]],
    *,
    label_key: str | None = None,
    value_key: str | None = None,
) -> Artifact:
    spec = None
    if label_key and value_key:
        spec = {
            "kind": "table",
            "x": label_key,
            "y": value_key,
        }

    return Artifact(type="table", title=title, data=rows, spec=spec)
