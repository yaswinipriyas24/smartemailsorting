# Deployment Notes

## Backend env

Create root `.env` from `.env.example` and set:

- `SECRET_KEY`
- `DATABASE_URL`
- `MODEL_VERSION` (optional)
- `DEFAULT_REMINDER_WINDOW_HOURS` (optional, default `24`)
- `REMINDER_POLL_SECONDS` (optional, default `300`)

## Frontend env

Create `frontend/.env` from `frontend/.env.example`:

```env
REACT_APP_API_BASE_URL=http://localhost:8000
```

Use your deployed backend URL in production.

