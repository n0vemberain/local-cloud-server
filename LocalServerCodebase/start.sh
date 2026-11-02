#!/usr/bin/env bash

# Personal Cloud Server — Launcher
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "Starting Personal Cloud Server..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js was not found. Please install Node.js."
    exit 1
fi

# Ensure bin directory exists
mkdir -p "$DIR/bin"

# If cloudflared is missing, fetch it
if [ ! -f "$DIR/bin/cloudflared" ]; then
    echo "Downloading cloudflared tunnel client..."
    curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz | tar -xz -C "$DIR/bin/"
    chmod +x "$DIR/bin/cloudflared"
    echo "cloudflared binary ready."
fi

# Ensure node dependencies are installed
if [ ! -d "$DIR/node_modules" ]; then
    echo "Installing node dependencies..."
    npm install
fi

# Start server
node server/index.js
