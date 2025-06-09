import assert from "node:assert";
import { StatusLifecycle } from "./jobber/types.js";
import { awaitTruthy, timeout } from "./util.js";

export abstract class LoopBase {
  private isLoopRunning = false;

  protected status: StatusLifecycle = "neutral";

  protected abstract loopDuration: number;

  public async start() {
    assert(this.status === "neutral");

    this.status = "starting";

    if (this.loopStarting) {
      await this.loopStarting();
    }

    this.loop();

    await awaitTruthy(() => Promise.resolve(this.isLoopRunning));

    this.status = "started";

    if (this.loopStarted) {
      await this.loopStarted();
    }
  }

  public async stop() {
    assert(this.status === "started");

    this.status = "stopping";

    if (this.loopClosing) {
      await this.loopClosing();
    }

    await awaitTruthy(() => Promise.resolve(!this.isLoopRunning));

    this.status = "neutral";

    if (this.loopClosed) {
      await this.loopClosed();
    }
  }

  private async loop() {
    this.isLoopRunning = true;

    while (this.status === "starting" || this.status === "started") {
      await this.loopIteration();

      await timeout(this.loopDuration);
    }

    this.isLoopRunning = false;
  }

  protected abstract loopIteration(): Promise<void>;
  protected abstract loopClosing?(): Promise<void>;
  protected abstract loopClosed?(): Promise<void>;
  protected abstract loopStarting?(): Promise<void>;
  protected abstract loopStarted?(): Promise<void>;
}
