#!/bin/bash


sudo docker build -f docker/node-20.Dockerfile -t jobber-e2e-runner:20-latest .
sudo docker build -f docker/node-22.Dockerfile -t jobber-e2e-runner:22-latest .
sudo docker build -f docker/node-24.Dockerfile -t jobber-e2e-runner:24-latest .

docker compose -f e2e/docker-compose.yaml up -d --build

# sleep a few seconds to allow processes to startup
sleep 5

# Run tests
bash e2e/tests/test-runner-basics.sh