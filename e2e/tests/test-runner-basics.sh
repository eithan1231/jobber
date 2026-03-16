#!/bin/bash

cd examples/e2e
./publish.sh super-power-anonymous-token http://localhost:5000
cd ../../

sleep 3

curl -s "http://localhost:5002/e2e?action=set-state&value=my-test-value" > /dev/null
GET_STORE_RESPONSE=$(curl -s "http://localhost:5002/e2e?action=get-state")
if echo "$GET_STORE_RESPONSE" | grep -q "my-test-value"; then
  echo "PASS: Successfully set and got state value"
else
  echo "FAIL: Failed to set and get state value"
  echo "Actual response: $GET_STORE_RESPONSE"
  exit 1
fi


sleep 1

curl -s "http://localhost:5002/e2e?action=mqtt" > /dev/null

sleep 1


RESPONSE=$(curl -s "http://localhost:5002/e2e")

# Check that bootstrap is true

if echo "$RESPONSE" | grep -q '"bootstrap":true'; then
  echo "PASS: Bootstrap is true"
else
  echo "FAIL: Bootstrap is not true"
  echo "Actual response: $RESPONSE"
  exit 1
fi

if echo "$RESPONSE" | grep -q '"lastScheduleRecent":true'; then
  echo "PASS: Schedule Recent is true"
else
  echo "FAIL: Schedule Recent is not true"
  echo "Actual response: $RESPONSE"
  exit 1
fi


if echo "$RESPONSE" | grep -q '"lastMqttRecent":true'; then
  echo "PASS: MQTT Recent is true"
else
  echo "FAIL: MQTT Recent is not true"
  echo "Actual response: $RESPONSE"
  exit 1
fi


# hang response status code should be 204
HANG_RESPONSE=$(curl -s "http://localhost:5002/e2e?action=hang")
if [ -z "$HANG_RESPONSE" ]; then
  echo "PASS: Hang response is empty as expected"
else
  echo "FAIL: Hang response is not empty"
  echo "Actual response: $HANG_RESPONSE"
  exit 1
fi
