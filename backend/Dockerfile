FROM python:3.12-slim

# Tesseract gives the document check a real OCR cross-check (printed ID number vs QR vs form). Optional at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-urd libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
ENV PYTHONUNBUFFERED=1 ENV=prod
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8000/health')" || exit 1
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
