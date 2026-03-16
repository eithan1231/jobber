const unixTimestamp = () => Math.floor(Date.now() / 1000);

const myState = {
  bootstrap: false,
  lastSchedule: 0,
  lastMqtt: 0,
};

export const handlerHttp = async (context) => {
  const action = context.request.query("action");

  if (action === "hang") {
    // It gives no response, it just hangs.
    return;
  }

  if (action === "mqtt") {
    await context.publish("ping", "this is pretty cool");

    return context.response.text("published to mqtt!");
  }

  if (action === "set-state") {
    const key = "test-key";

    const value = context.request.query("value");

    if (!value) {
      return context.response.text("Missing 'value' query parameter");
    }

    await globalThis.jobber.setStore(key, value);

    return await context.response.text("set!");
  }

  if (action === "get-state") {
    const key = "test-key";

    return await context.response.text(await globalThis.jobber.getStore(key));
  }

  context.response.json({
    bootstrap: myState.bootstrap,
    lastScheduleRecent: myState.lastSchedule + 60 > unixTimestamp(),
    lastMqttRecent: myState.lastMqtt + 60 > unixTimestamp(),
  });
};

export const handlerMqtt = async (context) => {
  myState.lastMqtt = unixTimestamp();
  if (context.topic === "ping") {
    await context.publish("pong", "Hello from Jobber MQTT JavaScript Example!");
  }
};

export const handlerSchedule = async (context) => {
  myState.lastSchedule = unixTimestamp();
};

export const bootstrap = async (context) => {
  console.log("Bootstrap function called with context:", context);

  myState.bootstrap = true;
};
