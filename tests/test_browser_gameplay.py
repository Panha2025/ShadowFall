"""Python entry point for the project's Playwright Core gameplay checks.

Start the game server first, then run `python3 tests/test_browser_gameplay.py`.
"""
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
raise SystemExit(subprocess.run(['node','tests/playwright_gameplay.mjs'],cwd=ROOT).returncode)
