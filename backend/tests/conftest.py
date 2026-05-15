"""Shared fixtures: load REACT_APP_BACKEND_URL from frontend/.env."""
import os
from pathlib import Path


def _load_frontend_env():
    """Read REACT_APP_BACKEND_URL from frontend/.env if not already set."""
    if os.environ.get("REACT_APP_BACKEND_URL"):
        return
    env_path = Path("/app/frontend/.env")
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip().strip('"').strip("'")
        os.environ.setdefault(k.strip(), v)


_load_frontend_env()
