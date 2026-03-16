#!/bin/bash

cd examples/http-javascript-cjs
./publish.sh super-power-anonymous-token http://localhost:5000
cd ../../

sleep 3

RESPONSE=$(curl -s "http://localhost:5002/http-javascript-cjs")
if echo "$RESPONSE" | grep -q "path.join example from commonjs"; then
  echo "PASS: Successfully received expected response from http-javascript-cjs job"
else
  echo "FAIL: Failed to receive expected response from http-javascript-cjs job"
  echo "Actual response: $RESPONSE"
  exit 1
fi


echo ""
echo ""
echo "All tests passed!"

exit 0