# Backend Dockerfile - Optimized for Render
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install only essential packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    libpq-dev \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN addgroup --system app && adduser --system --ingroup app app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Create directories
RUN mkdir -p staticfiles mediafiles && chown -R app:app /app

# Try to collect static files (ignore errors if settings not ready)
RUN python manage.py collectstatic --noinput || true

USER app

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

# Run gunicorn — single CMD; tune workers/threads via env.
# Use sync workers + threading for IO-bound LLM workloads. timeout=120 gives
# enough headroom for non-streaming LLM calls; streaming uses StreamingHttpResponse
# and does not need a higher timeout because the connection stays active.
CMD ["sh", "-c", "python manage.py migrate --noinput && (python manage.py populate_tools || true) && gunicorn core.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${GUNICORN_WORKERS:-3} --threads ${GUNICORN_THREADS:-4} --timeout ${GUNICORN_TIMEOUT:-120} --access-logfile - --error-logfile -"]
