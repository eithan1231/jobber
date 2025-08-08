import assert from "node:assert";

export const handler = async (
  request: JobberHandlerRequest,
  response: JobberHandlerResponse,
  context: JobberHandlerContext
) => {
  assert(request.type() === "mqtt", "Expecting MQTT request");

  if (request.topic() === "test") {
    console.log(request.text());

    return response.publish("test-reply", "Hello from Jobber MQTT Demo");
  }
};
