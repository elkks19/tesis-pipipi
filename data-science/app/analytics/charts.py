from collections import Counter
from typing import Any

from app.models.responses import Artifact


def chart_artifact(
    title: str,
    label_key: str,
    value_key: str,
    rows: list[dict[str, Any]],
    *,
    description: str | None = None,
    group: str | None = None,
    kind: str,
    role: str | None = None,
    series: str | None = None,
) -> Artifact:
    spec: dict[str, Any] = {
        "kind": kind,
        "x": label_key,
        "y": value_key,
    }
    if description:
        spec["description"] = description
    if group:
        spec["group"] = group
    if role:
        spec["role"] = role
    if series:
        spec["series"] = series

    return Artifact(
        type="chart",
        title=title,
        data=rows,
        spec=spec,
    )


def count_chart_artifact(
    title: str,
    label_key: str,
    value_key: str,
    counts: Counter[str],
    *,
    description: str | None = None,
    kind: str = "bar",
    role: str | None = None,
) -> Artifact:
    data = [{label_key: key, value_key: value} for key, value in counts.most_common()]
    return chart_artifact(
        title,
        label_key,
        value_key,
        data,
        description=description,
        kind=kind,
        role=role,
    )


def table_artifact(
    title: str,
    rows: list[dict[str, Any]],
    *,
    description: str | None = None,
    label_key: str | None = None,
    role: str | None = None,
    value_key: str | None = None,
) -> Artifact:
    spec: dict[str, Any] | None = None
    if label_key and value_key:
        spec = {
            "kind": "table",
            "x": label_key,
            "y": value_key,
        }
    if description or role:
        spec = spec or {"kind": "table"}
        if description:
            spec["description"] = description
        if role:
            spec["role"] = role

    return Artifact(type="table", title=title, data=rows, spec=spec)
