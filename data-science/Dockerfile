# syntax=docker/dockerfile:1
# Build from the repository root: docker build -t tesis-data-science:local data-science
ARG PYTHON_VERSION=3.12
FROM python:${PYTHON_VERSION}-slim-bookworm AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

FROM base AS dependencies
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt ./
# Install CPU wheels first; constrain subsequent resolution to that exact build.
# Never fall back to the large CUDA distribution from PyPI.
RUN pip install --only-binary=:all: torch --index-url https://download.pytorch.org/whl/cpu && \
    python -c "from importlib.metadata import version; open('/tmp/torch-constraint.txt', 'w').write('torch==' + version('torch') + '\n')" && \
    pip install --only-binary=:all: -c /tmp/torch-constraint.txt -r requirements.txt && \
    pip check && \
    python -c "import torch; from sentence_transformers import SentenceTransformer; assert torch.version.cuda is None"

FROM base AS runtime
ENV PATH="/opt/venv/bin:$PATH" \
    DS_STORAGE_DIR="/data/storage" \
    HF_HOME="/data/huggingface" \
    TOKENIZERS_PARALLELISM=false
RUN groupadd --gid 10001 app && \
    useradd --uid 10001 --gid app --create-home app && \
    mkdir -p /data/storage /data/huggingface && chown -R app:app /data
COPY --from=dependencies /opt/venv /opt/venv
COPY --chown=app:app app ./app
USER app
VOLUME ["/data"]
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
