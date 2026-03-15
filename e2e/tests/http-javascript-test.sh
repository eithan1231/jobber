#!/bin/bash

cd examples/http-javascript
./publish.sh super-power-anonymous-token http://localhost:5000
cd ../../

sleep 1

RESPONSE=$(curl -s "http://localhost:5002/http-javascript")

if echo "$RESPONSE" | grep -q "http://localhost:5002/"; then
  echo "PASS: Response contains expected string"
else
  echo "FAIL: Response does not contain 'http://localhost:5002/'"
  echo "Actual response: $RESPONSE"
  exit 1
fi
