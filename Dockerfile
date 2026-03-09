# Use a newer Debian-based Python image to reduce known CVEs
FROM python:3.12-slim-bookworm

# Set working directory
WORKDIR /app

# Set environment variables to prevent buffering and configure cache
ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/app/cache

# Install system dependencies required for psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev gcc && rm -rf /var/lib/apt/lists/*

# Create a non-root user with ID 1000 (Required for Hugging Face Spaces)
RUN useradd -m -u 1000 user

# Copy requirements
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Create cache directory and set permissions
RUN mkdir -p /app/cache && chown -R user:user /app

# Copy backend code
COPY --chown=user:user backend/ ./backend/

# Switch to the non-root user
USER user

# Expose port 7860 (Standard for Hugging Face Spaces)
EXPOSE 7860

# Run FastAPI
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]