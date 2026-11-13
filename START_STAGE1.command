#!/bin/bash
# Run a local server because browsers restrict GLB imports from file:// pages.
cd "$(dirname "$0")" || exit 1
printf '\nSHADOWFALL • OPEN-WORLD ACTION ADVENTURE\n\n'
if ! command -v python3 >/dev/null; then
  echo 'Python 3 is required to download the public-domain assets and host the game.'
  read -r -p 'Press Enter to close.'
  exit 1
fi
if [ ! -f 'node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs' ]; then
  if ! command -v npm >/dev/null; then
    echo 'Node.js and npm are needed to prepare the Rapier vehicle physics runtime.'
    read -r -p 'Press Enter to close.'
    exit 1
  fi
  echo 'Installing local browser physics package…'
  if ! npm install --no-audit --no-fund; then
    echo 'Rapier setup failed. Check internet access and try again.'
    read -r -p 'Press Enter to close.'
    exit 1
  fi
fi
if ! python3 setup_assets.py; then
  echo 'Three.js runtime installation failed.'
  echo 'Check internet access and try this launcher again; runtime files are cached after success.'
  read -r -p 'Press Enter to close.'
  exit 1
fi
PORT=8787
python3 -m http.server "$PORT" --bind 127.0.0.1 &
PID=$!
trap 'kill "$PID" 2>/dev/null' EXIT
sleep 1
if ! kill -0 "$PID" 2>/dev/null; then
  echo 'Port 8787 is already in use. Close the other server and try again.'
  exit 1
fi
if [ -d '/Applications/Google Chrome.app' ]; then
  open -a 'Google Chrome' "http://127.0.0.1:$PORT/"
else
  open "http://127.0.0.1:$PORT/"
fi
echo "GAME: http://127.0.0.1:$PORT/"
echo 'Leave this Terminal window open while playing. Press Ctrl+C to stop.'
wait "$PID"
