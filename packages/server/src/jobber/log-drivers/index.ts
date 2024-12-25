import { getConfigOption } from "~/config.js";
import { LogDriverDatabase } from "./database.js";
import { LogDriverLoki } from "./loki.js";

export async function createLogDriver() {
  const driver = getConfigOption("LOG_DRIVER");

  if (driver === "database") {
    return new LogDriverDatabase();
  }

  if (driver === "loki") {
    const pushUrl = getConfigOption("LOG_DRIVER_LOKI_PUSH");
    const queryUrl = getConfigOption("LOG_DRIVER_LOKI_QUERY");

    if (!pushUrl) {
      throw new Error(
        '"LOG_DRIVER_LOKI_PUSH" expected to be type of string when LOG_DRIVER is loki'
      );
    }

    if (!queryUrl) {
      throw new Error(
        '"LOG_DRIVER_LOKI_QUERY" expected to be type of string when LOG_DRIVER is loki'
      );
    }

    return new LogDriverLoki({
      pushUrl,
      queryUrl,
    });
  }

  throw new Error("Unexpected log driver!");
}
