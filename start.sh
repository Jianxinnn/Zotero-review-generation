#!/bin/bash

# Kill child processes on exit
trap 'kill $(jobs -p)' EXIT

echo "🚀 Starting Zotero Chat..."

# Start Backend
echo "Starting API Server..."
python3 main.py ui &

# Wait for API to be ready (optional, but good)
sleep 2

# Start Frontend
echo "Starting Web Interface..."
cd web
npm run dev
