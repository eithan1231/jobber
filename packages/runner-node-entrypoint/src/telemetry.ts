import { getUnixTimestamp } from "./util.js";

export class Telemetry {
  private _lastRequestAt = 0;

  private _loadAverageBuckets = new Map<string, number>();

  public notifyRequest() {
    this._lastRequestAt = getUnixTimestamp();

    const now = getUnixTimestamp();

    const bucket5Second = (Math.floor(now / 1) * 1).toString();
    const bucket60Second = (Math.floor(now / 60) * 60).toString();

    this._loadAverageBuckets.set(
      bucket5Second,
      (this._loadAverageBuckets.get(bucket5Second) || 0) + 1,
    );

    this._loadAverageBuckets.set(
      bucket60Second,
      (this._loadAverageBuckets.get(bucket60Second) || 0) + 1,
    );

    for (const [key] of this._loadAverageBuckets) {
      if (parseInt(key) < now - 300) {
        this._loadAverageBuckets.delete(key);
      }
    }
  }

  public get loadAverage5Second() {
    const now = getUnixTimestamp();
    const bucket5Second = (Math.floor(now / 1) * 1).toString();

    return this._loadAverageBuckets.get(bucket5Second) || 0;
  }

  public get loadAverage60Second() {
    const now = getUnixTimestamp();
    const bucket60Second = (Math.floor(now / 60) * 60).toString();

    return this._loadAverageBuckets.get(bucket60Second) || 0;
  }

  public get lastRequestAt() {
    return this._lastRequestAt;
  }
}
