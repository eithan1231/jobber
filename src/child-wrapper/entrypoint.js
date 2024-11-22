import * as clientEntry from "<<entrypointClient>>";
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

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const main = async () => {
  let handleRequestsProcessing = 0;
  let isShuttingDown = false;

  const jobRunnerIdentifier = getArgument("job-runner-identifier");
  const jobControllerHost = getArgument("job-controller-host");
  const jobControllerPort = Number(getArgument("job-controller-port"));

  if (!clientEntry.handler) {
    throw new Error("Handler is not present");
  }

  const sock = new Socket();

  const onDataHandle = async (data) => {
    handleRequestsProcessing++;

    console.log("[main] Starting client handler, traceId", data.traceId);

    const result = await clientEntry.handler(data.payload);

    console.log("[main] Finished client handler, traceId", data.traceId);

    sock.write(
      JSON.stringify({
        type: "handle-response",
        id: jobRunnerIdentifier,
        traceId: data.traceId,
        payload: result,
      }),
      (err) => {
        handleRequestsProcessing--;
      }
    );
  };

  const onDataShutdown = async (data) => {
    isShuttingDown = true;

    console.log("[main] Initiating shutdown routine");

    for (let i = 0; i < 1000; i++) {
      if (handleRequestsProcessing === 0) {
        break;
      }

      await timeout(100);
    }

    sock.end(() => {
      process.exit();
    });
  };

  sock.on("data", (data) => {
    const parsedData = JSON.parse(data.toString());

    if (isShuttingDown) {
      // throw out
      console.log("[main] Shutting down, not accepting new requests.");

      return;
    }

    if (parsedData.type === "handle") {
      onDataHandle(parsedData);
    }

    if (parsedData.type === "shutdown") {
      onDataShutdown();
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
