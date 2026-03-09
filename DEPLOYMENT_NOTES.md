# Deployment Notes

## 1. Production environment variables (backend)

Create `.env` in the project root from `.env.example` and set at least:

- `SECRET_KEY` (required; long random value)
- `DATABASE_URL` (required)
- `APP_ENV=production`
- `CORS_ALLOW_ORIGINS` (frontend origins, comma-separated)
- `BACKEND_BASE_URL` and `FRONTEND_BASE_URL` (required for Gmail OAuth redirects)

Optional:

- `ENABLE_DEADLINE_WORKER=true`
- `DEFAULT_REMINDER_WINDOW_HOURS=24`
- `REMINDER_POLL_SECONDS=300`
- `MODEL_VERSION=tfidf-logreg-v1`

## 2. Production environment variables (frontend)

Create `frontend/.env` from `frontend/.env.example`:

```env
REACT_APP_API_BASE_URL=https://your-api-domain
```

## 3. Deploy with Docker Compose (recommended)

Build and run:

```bash
docker compose up -d --build
```

Services:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Postgres: `localhost:5432`

Stop:

```bash
docker compose down
```

Stop and remove DB volume:

```bash
docker compose down -v
```

## 4. Health checks

Backend endpoints:

- `GET /healthz` for liveness
- `GET /readyz` for DB-readiness

Frontend (Nginx container):

- `GET /healthz`

## 5. Important deployment checks

- Ensure `backend/credentials.json` is present on deployed backend host.
- Ensure OAuth redirect URI in Google Cloud Console matches:
	`https://your-api-domain/gmail/callback`
- Do not commit `.env`, `credentials.json`, or token files.

## 6. Single-container backend run (no compose)

```bash
docker build -t smart-email-backend .
docker run --env-file .env -p 8000:8000 smart-email-backend
```

