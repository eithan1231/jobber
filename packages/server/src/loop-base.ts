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

    this.loop();

    await awaitTruthy(() => Promise.resolve(this.isLoopRunning));

    this.status = "started";
  }

  public async stop() {
    assert(this.status === "started");

    this.status = "stopping";

    await awaitTruthy(() => Promise.resolve(!this.isLoopRunning));

    this.status = "neutral";
  }

  private async loop() {
    this.isLoopRunning = true;

    if (this.loopStartup) {
      await this.loopStartup();
    }

    while (this.status === "starting" || this.status === "started") {
      await this.loopIteration();

      await timeout(this.loopDuration);
    }

    if (this.loopShutdown) {
      await this.loopShutdown();
    }

    this.isLoopRunning = false;
  }

  protected abstract loopIteration(): Promise<void>;
  protected abstract loopShutdown?(): Promise<void>;
  protected abstract loopStartup?(): Promise<void>;
}
