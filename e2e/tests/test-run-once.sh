#!/bin/bash

cd examples/http-javascript-run-once
./publish.sh super-power-anonymous-token http://localhost:5000
cd ../../

sleep 3

RESPONSE=$(curl -s "http://localhost:5002/http-javascript-run-once")
if echo "$RESPONSE" | grep -q "run-once-response"; then
  echo "PASS: Successfully received expected response from http-javascript-run-once job"
else
  echo "FAIL: Failed to receive expected response from http-javascript-run-once job"
  echo "Actual response: $RESPONSE"
  exit 1
fi
