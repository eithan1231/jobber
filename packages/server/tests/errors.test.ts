import { Context, Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z, ZodRealError } from "zod";
import {
  errorHandler,
  parseRequest,
  parseRequestAsync,
  parseRequestJson,
  parseRequestParam,
  PublicError,
} from "../src/errors";
import { runnerIdSchema } from "../src/routes/job/schemas-common";
import { createToken } from "../src/util";

const SECRET = "hunter2-super-secret-value";

const request = async (
  handler: (c: Context) => unknown,
  options: { route?: string; path?: string; init?: RequestInit } = {},
) => {
  const app = new Hono();

  app.onError(errorHandler);
  app.all(options.route ?? "/", async (c) => {
    return c.json({ success: true, data: await handler(c) });
  });

  const res = await app.request(options.path ?? "/", options.init);
  const text = await res.text();

  return { status: res.status, text, body: JSON.parse(text) };
};

describe("errorHandler", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("request validation errors", () => {
    it("should return body issues with a 400", async () => {
      const schema = z.object({ value: z.string().max(5) }).strict();

      const res = await request(() =>
        parseRequest(schema, { value: SECRET, extra: 1 }, "body"),
      );

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        success: false,
        message: "Malformed request body",
        errors: [
          "request.body.value - Too big: expected string to have <=5 characters",
          'request.body - Unrecognized key: "extra"',
        ],
      });
    });

    it("should return param and query issues with a 400", async () => {
      const param = await request(() =>
        parseRequestAsync(z.string().min(1), "", "param"),
      );
      const query = await request(() =>
        parseRequestAsync(
          z.object({ duration: z.coerce.number().min(1) }),
          { duration: "0" },
          "query",
        ),
      );

      expect(param.status).toBe(400);
      expect(param.body.message).toBe("Malformed request parameter");
      expect(param.body.errors).toEqual([
        "request.param - Too small: expected string to have >=1 characters",
      ]);
      expect(query.status).toBe(400);
      expect(query.body.message).toBe("Malformed request query");
      expect(query.body.errors).toEqual([
        "request.query.duration - Too small: expected number to be >=1",
      ]);
    });

    it("should not echo rejected input values", async () => {
      const res = await request(() =>
        parseRequest(
          z.object({ type: z.enum(["secret", "text"]) }),
          { type: SECRET },
          "body",
        ),
      );

      expect(res.status).toBe(400);
      expect(res.text).not.toContain(SECRET);
    });
  });

  describe("parseRequestJson", () => {
    const schema = z.object({ username: z.string().min(3) });

    const post = (body: string) =>
      request((c) => parseRequestJson(c, schema), {
        init: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        },
      });

    it("should return malformed JSON with a 400", async () => {
      const res = await post(`{"username":`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        success: false,
        message: "Malformed JSON body",
      });
    });

    it("should return body issues with a 400", async () => {
      const res = await post(`{"username":"ab"}`);

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual([
        "request.body.username - Too small: expected string to have >=3 characters",
      ]);
    });

    it("should return the parsed body", async () => {
      const res = await post(`{"username":"alice"}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ username: "alice" });
    });
  });

  describe("parseRequestParam", () => {
    const getJob = (jobId: string) =>
      request((c) => parseRequestParam(c, "jobId", z.guid()), {
        route: "/job/:jobId",
        path: `/job/${jobId}`,
      });

    it("should return a malformed parameter with a 400", async () => {
      const res = await getJob("not-a-uuid");

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        success: false,
        message: "Malformed request parameter",
        errors: ["request.param.jobId - Invalid GUID"],
      });
    });

    it("should return the parsed parameter", async () => {
      const jobId = "0b6f0c1e-5a7d-4c2b-9e3f-1a2b3c4d5e6f";

      const res = await getJob(jobId);

      expect(res.status).toBe(200);
      expect(res.body.data).toBe(jobId);
    });
  });

  describe("runnerIdSchema", () => {
    it("should accept generated runner IDs", () => {
      const runnerId = createToken({ length: 32, prefix: "JobberRunner-test" });

      expect(runnerIdSchema.safeParse(runnerId).success).toBe(true);
    });

    it("should reject prototype keys", () => {
      for (const key of ["__proto__", "constructor", "hasOwnProperty"]) {
        expect(runnerIdSchema.safeParse(key).success).toBe(false);
      }
    });
  });

  describe("internal errors", () => {
    it("should hide zod errors not thrown by parseRequest", async () => {
      const res = await request(() =>
        z
          .object({ triggers: z.array(z.string()) })
          .parse({ triggers: [SECRET, 1] }),
      );

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        success: false,
        message: "Internal Server Error",
      });
    });

    it("should hide zod errors whose path looks like a request", async () => {
      const res = await request(() => {
        throw new ZodRealError([
          { code: "custom", message: SECRET, path: ["request", "body", "a"] },
        ]);
      });

      expect(res.status).toBe(500);
      expect(res.text).not.toContain(SECRET);
    });

    it("should hide errors thrown inside a request schema", async () => {
      const schema = z.string().transform(() => {
        throw new Error(SECRET);
      });

      const res = await request(() => parseRequest(schema, "x", "body"));

      expect(res.status).toBe(500);
      expect(res.text).not.toContain(SECRET);
    });

    it("should hide errors carrying a third party expose flag", async () => {
      const res = await request(() => {
        throw Object.assign(new Error(SECRET), { expose: true, status: 400 });
      });

      expect(res.status).toBe(500);
      expect(res.text).not.toContain(SECRET);
    });
  });

  describe("public errors", () => {
    it("should return a PublicError without details", async () => {
      const res = await request(() => {
        throw new PublicError(409, "Already exists");
      });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, message: "Already exists" });
    });

    it("should return an HTTPException as json", async () => {
      const res = await request(() => {
        throw new HTTPException(403, { message: "Insufficient Permissions" });
      });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        success: false,
        message: "Insufficient Permissions",
      });
    });

    it("should return an HTTPException custom response as is", async () => {
      const res = await request(() => {
        throw new HTTPException(401, {
          res: Response.json({ custom: true }, { status: 401 }),
        });
      });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ custom: true });
    });
  });
});
