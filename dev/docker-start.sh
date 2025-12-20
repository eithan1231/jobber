#!/bin/bash

# Should be executed from the repo root.

# Option to skip building images
if [ "$1" != "--no-build" ]; then
  sudo docker build -f docker/node-20.Dockerfile -t jobber-runner:20-latest .
  sudo docker build -f docker/node-22.Dockerfile -t jobber-runner:22-latest .
  sudo docker build -f docker/node-24.Dockerfile -t jobber-runner:24-latest .
fi


# Check that ./server/.env exists
if [ ! -f ./packages/server/.env ]; then
  echo "Error: ./server/.env file not found. Please create it before running the script."
  exit 1
fi

docker compose -f dev/docker-compose.yaml up -d

echo "Must start server and webapp separately."
echo "To start the server, CD into packages/server and run 'pnpm dev'."
echo "To start the webapp, CD into packages/web and run 'pnpm dev'."