#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

# Prefer the project virtual environment if available, then Homebrew Python.
if [[ -x "$(pwd)/.venv/bin/python" ]]; then
  PYTHON_BIN="$(pwd)/.venv/bin/python"
elif command -v /opt/homebrew/bin/python3 >/dev/null 2>&1; then
  PYTHON_BIN=/opt/homebrew/bin/python3
elif command -v /usr/local/bin/python3 >/dev/null 2>&1; then
  PYTHON_BIN=/usr/local/bin/python3
else
  PYTHON_BIN=python3
fi

if [[ "$PYTHON_BIN" == "python3" ]]; then
  echo "WARNING: using system Python. On macOS, system Python may fail TLS handshakes with MongoDB Atlas."
  echo "If Atlas login still fails, install Homebrew Python and rerun this script."
fi

echo "Using Python: $($PYTHON_BIN --version 2>&1)"

# Get PORT from environment (needed for Render), default to 8000
PORT=${PORT:-8000}
# Get HOST from environment (needed for production), default to 0.0.0.0
HOST=${HOST:-0.0.0.0}
# Disable reload in production
RELOAD="--reload"
if [[ "$RENDER" == "true" ]]; then
  RELOAD=""
fi

$PYTHON_BIN -m uvicorn server:app $RELOAD --host $HOST --port $PORT
