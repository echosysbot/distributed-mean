# ─── Quality stage: run linting and type checks at build time ─────────────────
FROM python:3.11-slim AS quality

WORKDIR /app

# Upgrade pip + setuptools first — python:3.11-slim ships with outdated pip
# that lacks setuptools.backends, causing install failures on CI
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Install all deps including dev tools
COPY pyproject.toml .
RUN pip install --no-cache-dir -e ".[dev]"

COPY models.py worker.py ./

# ──── Quality gates — build fails if any of these fail ────────────────────────
# Ruff: linting
RUN ruff check .

# Black: formatting check
RUN black --check .

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

WORKDIR /app
ENV PYTHONUNBUFFERED=1

COPY pyproject.toml .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -e .

COPY --from=quality /app/models.py /app/worker.py ./

CMD ["python", "-u", "worker.py"]
