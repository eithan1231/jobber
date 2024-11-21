import * as clientEntry from "./index.js";
import { Socket } from "net";

const getArgument = (name) => {
  const index = process.argv.indexOf(`--${name}`);

  if (index < 0) {
    return null;
  }

  if (typeof process.argv[index + 1] === "undefined") {
    return null;
  }

  return process.argv[index + 1];
};

const main = async () => {
  const jobRunnerIdentifier = getArgument("job-runner-identifier");
  const jobControllerHost = getArgument("job-controller-host");
  const jobControllerPort = Number(getArgument("job-controller-port"));

  if (!clientEntry.handler) {
    throw new Error("Handler is not present");
  }

  const sock = new Socket();

  sock.on("data", async (data) => {
    const parsedData = JSON.parse(data.toString());

    if (parsedData.type === "handle") {
      console.log(
        "[main] Starting client handler, traceId",
        parsedData.traceId
      );

      const result = await clientEntry.handler(parsedData.payload);

      console.log(
        "[main] Finished client handler, traceId",
        parsedData.traceId
      );

      sock.write(
        JSON.stringify({
          type: "handle-response",
          traceId: parsedData.traceId,
          payload: result,
        })
      );
    }
  });

  sock.connect({
    host: jobControllerHost,
    port: jobControllerPort,
  });

  sock.once("connect", () => {
    sock.write(
      JSON.stringify({
        type: "init",
        id: jobRunnerIdentifier,
      })
    );
  });
};

main();
