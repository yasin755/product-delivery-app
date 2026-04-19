#!/usr/bin/env python3
"""Run the FastAPI server."""

import uvicorn
import sys
import os

# Ensure we're in the right directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("Starting FastAPI server...")
    print("Server will be available at http://127.0.0.1:8000")
    print("API documentation at http://127.0.0.1:8000/docs")
    print("\nPress CTRL+C to stop the server\n")
    
    uvicorn.run(
        "server:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )
