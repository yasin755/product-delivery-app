#!/usr/bin/env python3
"""Run the FastAPI server."""

import uvicorn
import sys
import os

# Ensure we're in the right directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    # Get host and port from environment variables (needed for Render deployment)
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    
    print("Starting FastAPI server...")
    print(f"Server will be available at http://{host}:{port}")
    print(f"API documentation at http://{host}:{port}/docs")
    print("\nPress CTRL+C to stop the server\n")
    
    uvicorn.run(
        "server:app",
        host=host,
        port=port,
        reload=False,  # Set to False for production (Render)
        log_level="info"
    )
