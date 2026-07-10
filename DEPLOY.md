
# Deploying Sovereign

Frontend → **Vercel** (static React build). Backend + Postgres + Redis → **Railway**.

## Backend (Railway)
Service root: `backend/` · builds from `backend/Dockerfile` (see `backend/railway.json`).

Add plugins: **PostgreSQL** and **Redis**.

Required env vars:

| Var | Value |
| --- | --- |
| `DJANGO_SETTINGS_MODULE` | `core.settings_production` |
| `SECRET_KEY` | a long random string |
| `DATABASE_URL` | from the Railway Postgres plugin |
| `REDIS_URL` | from the Railway Redis plugin |
| `CELERY_BROKER_URL` | same as `REDIS_URL` |
| `ALLOWED_HOSTS` | `.railway.app,<custom-domain>` |
| `CORS_ALLOWED_ORIGINS` | `https://<your-vercel-app>.vercel.app` |
| `CSRF_TRUSTED_ORIGINS` | `https://<your-vercel-app>.vercel.app` |
| `AGENTS_DEFAULT_PROVIDER` | `fireworks` |
| `AGENTS_FALLBACK_PROVIDERS` | `groq,amd` |
| `FIREWORKS_API_KEY` | your Fireworks key |
| `FIREWORKS_MODEL` | `accounts/fireworks/models/gpt-oss-120b` |
| `GROQ_API_KEY` | your Groq key |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` |
| `AMD_VLLM_BASE_URL` | (optional) URL of your AMD Developer Cloud vLLM endpoint |

The start command runs `migrate` then `gunicorn` (see `railway.json`). Healthcheck: `/health`.
Optional extra services from the same repo: `worker` and `beat` (see `backend/Procfile`).

## Frontend (Vercel)
Root directory: `frontend/` · framework auto-detected (CRA) · see `frontend/vercel.json` (SPA rewrite).

Required env var (build-time):

| Var | Value |
| --- | --- |
| `REACT_APP_API_URL` | `https://<your-railway-backend>/api` |

## Note on the AMD-private path
Vercel and Railway have no AMD GPUs, so `provider='amd'` runs on **AMD Developer Cloud**; point
`AMD_VLLM_BASE_URL` at that endpoint. Fireworks (default) and Groq work from Railway directly.
