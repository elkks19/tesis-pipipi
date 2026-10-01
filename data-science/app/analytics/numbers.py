import math
import re
from typing import Any

_NUMBER_PATTERN = re.compile(r"[-+]?\d+(?:[.,]\d+)?")


def parse_clinical_number(value: Any) -> float | None:
    """Extrae el primer numero finito de valores clinicos, incluso si incluyen unidades."""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    else:
        match = _NUMBER_PATTERN.search(str(value))
        if not match:
            return None
        number = float(match.group(0).replace(",", "."))
    return number if math.isfinite(number) else None
