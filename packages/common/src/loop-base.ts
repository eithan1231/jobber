import assert from "node:assert";
import { awaitTruthy } from "./await-truthy.js";
import { timeout } from "./timeout.js";
import EventEmitter from "node:events";

/**
 * Lifecycle:
 * 1) neutral = = default state (pre-start or stopped)
 * 2) starting = in process of starting
 * 3) started = active and running
 * 4) stopping = in process of stopping
 * 5) One stopped, goes to neutral.
 */
export type StatusLifecycle = "neutral" | "starting" | "started" | "stopping";

type EventEmitterEvents = {
  neutral: [];
  starting: [];
  started: [];
  stopping: [];
};

export abstract class LoopBase {
  protected status: StatusLifecycle = "neutral";

  private signal: AbortController | null = null;

  protected abstract loopDuration: number;

  private events = new EventEmitter<EventEmitterEvents>();

  public start() {
    return new Promise<void>(async (resolve) => {
      assert(this.status === "neutral");

      this.signal = new AbortController();

      this.events.once("started", () => {
        resolve();
      });

      this.status = "starting";

      if (this.loopStarting) {
        await this.loopStarting();
      }

      this.events.emit("starting");

      this.loop();
    });
  }

  public stop() {
    return new Promise<void>(async (resolve) => {
      assert(this.status === "started");

      this.events.once("neutral", () => {
        resolve();
      });

      this.status = "stopping";

      this.signal?.abort();

      if (this.loopClosing) {
        await this.loopClosing();
      }

      this.events.emit("stopping");
    });
  }

  private async loop() {
    this.status = "started";

    if (this.loopStarted) {
      await this.loopStarted();
    }

    this.events.emit("started");

    while (this.status === "started") {
      try {
        await this.loopIteration();
      } catch (err) {
        console.error(err);
      }

      await timeout(this.loopDuration, this.signal?.signal);
    }

    this.status = "neutral";
    this.signal = null;

    if (this.loopClosed) {
      await this.loopClosed();
    }

    this.events.emit("neutral");
  }

  protected abstract loopIteration(): Promise<void>;
  protected abstract loopClosing?(): Promise<void>;
  protected abstract loopClosed?(): Promise<void>;
  protected abstract loopStarting?(): Promise<void>;
  protected abstract loopStarted?(): Promise<void>;
}
