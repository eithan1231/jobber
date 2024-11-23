import * as clientEntry from "<<entrypointClient>>";
import { Socket } from "net";
import { promisify } from "util";

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

  const createDtoHandleResponse = (traceId, metadata, payload) => {
    return {
      type: "handle-response",
      id: jobRunnerIdentifier,
      traceId,
      metadata,
      payload,
    };
  };

  const sockWrite = (data) => {
    return new Promise((resolve, reject) => {
      let raw;

      if (typeof data === "string") {
        raw = data;
      } else if (typeof data === "object" && data instanceof Buffer) {
        raw = data;
      } else if (typeof data === "object") {
        raw = JSON.stringify(data);
      } else {
        throw new Error("Cannot write to sock, unknown type of data");
      }

      sock.write(raw, (err) => {
        if (err) {
          return reject(err);
        }

        return resolve(null);
      });
    });
  };

  const onDataHandle = async (data) => {
    const start = performance.now();

    handleRequestsProcessing++;

    console.log("[main/onDataHandle] Starting, traceId", data.traceId);

    try {
      const result = await clientEntry.handler(data.payload);

      console.log(
        "[main/onDataHandle] Handler completed, traceId",
        data.traceId
      );

      const metadata = {
        success: true,
        duration: performance.now() - start,
      };

      await sockWrite(createDtoHandleResponse(data.traceId, metadata, result));

      console.log(
        "[main/onDataHandle] Delivered response, traceId",
        data.traceId
      );
    } catch (err) {
      console.log(
        "[main/onDataHandle] Failed due to error, traceId",
        data.traceId
      );

      console.error(err);

      const metadata = {
        success: false,
        duration: performance.now() - start,
        error: err.toString(),
      };

      await sockWrite(createDtoHandleResponse(data.traceId, metadata, null));
    } finally {
      handleRequestsProcessing--;
    }
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
