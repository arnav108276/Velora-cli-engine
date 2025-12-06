FROM python:3.10-slim

WORKDIR /app

COPY req.txt .
RUN pip install --no-cache-dir -r req.txt

COPY . .

RUN groupadd -r app && useradd -r -g app appuser

# give permissions to app directories
RUN chown -R appuser:app /app

# switch to non-root user for running the app
USER appuser

EXPOSE 8080

# streamlit run app.py --server.port=8080 --server.address=0.0.0.0
CMD ["streamlit", "run", "app.py", "--server.port=8080", "--server.address=0.0.0.0"]

