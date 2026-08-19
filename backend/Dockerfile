# Use official Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Persist receipt images across Coolify/Docker redeploys by mounting this path.
ENV UPLOAD_DIR=/app/uploads
RUN mkdir -p /app/uploads
VOLUME ["/app/uploads"]

# Expose port (FastAPI default is 8000)
EXPOSE 8000

# Command to run the application using Uvicorn
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000"]
