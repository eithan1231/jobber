type DataRequest = {
  type: "http" | "schedule" | "mqtt";
  headers: Record<string, string>;
  query: Record<string, string>;
  queries: Record<string, string[]>;
  path: string;
  method: string;
  body: string;
  bodyLength: number;
};

type StoreItem<ValueType = string> = {
  key: string;
  value: ValueType;
  expiry: number | null;
  created: number;
  modified: number;
};

declare class JobberHandlerRequest {
  constructor(data: DataRequest);
  type(): DataRequest["type"];
  name(): string | null;
  header(name: string): string | null;
  query(name: string): string | null;
  queries(name: string): string[] | null;
  method(): string | null;
  path(): string | null;
  topic(): string;
  json<T>(): T;
  text(): string;
  data(): Buffer;
  getHttpRequest(): Request;
}

declare class JobberHandlerResponse {
  constructor(request: JobberHandlerRequest);
  type(): DataRequest["type"];
  header(name: string, value: string): this;
  status(status: number): this;
  redirect(path: string, status?: number): this;
  json(data: any, status?: number): this;
  text(data: string, status?: number): this;
  chunk(data: Buffer): this;
  publish(topic: string, body: string | Buffer | any): this;
}

declare class JobberHandlerContext {
  public async setStore(
    key: string,
    value: string,
    option?: { ttl?: number }
  ): Promise<StoreItem>;
  public async setStoreJson<T = unknown>(
    key: string,
    value: T,
    option?: { ttl?: number }
  ): Promise<void>;
  public async getStore(key: string): Promise<StoreItem | null>;
  public async getStoreJson<T = unknown>(key: string): Promise<T | null>;
  public async deleteStore(key: string): Promise<StoreItem | null>;
  public async deleteStoreJson(key: string): Promise<void>;
  public async publish(
    topic: string,
    body: Buffer | string | unknown
  ): Promise<void>;
}
