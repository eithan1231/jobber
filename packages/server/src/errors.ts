import { Context, ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { output, ZodError, ZodType } from "zod";

/**
 * An error whose message and details are safe to send to clients. Anything else thrown from a
 * route is treated as internal, and only a generic message is returned.
 */
export class PublicError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    message: string,
    public readonly details?: string[],
  ) {
    super(message);
    this.name = "PublicError";
  }
}

export type RequestLocation = "body" | "query" | "param";

const requestLocationMessages: Record<RequestLocation, string> = {
  body: "Malformed request body",
  query: "Malformed request query",
  param: "Malformed request parameter",
};

export class RequestValidationError extends PublicError {
  constructor(
    location: RequestLocation,
    error: ZodError,
    path: PropertyKey[] = [],
  ) {
    super(
      400,
      requestLocationMessages[location],
      error.issues.map(
        (issue) =>
          `${["request", location, ...path, ...issue.path].join(".")} - ${issue.message}`,
      ),
    );
    this.name = "RequestValidationError";
  }
}

/**
 * Parses client input, throwing a RequestValidationError that is safe to return to the client.
 */
export const parseRequest = <T extends ZodType>(
  schema: T,
  data: unknown,
  location: RequestLocation,
): output<T> => {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new RequestValidationError(location, result.error);
  }

  return result.data;
};

export const parseRequestAsync = async <T extends ZodType>(
  schema: T,
  data: unknown,
  location: RequestLocation,
): Promise<output<T>> => {
  const result = await schema.safeParseAsync(data);

  if (!result.success) {
    throw new RequestValidationError(location, result.error);
  }

  return result.data;
};

/**
 * Reads and validates the JSON request body, malformed JSON is reported to the client as a 400.
 */
export const parseRequestJson = async <T extends ZodType>(
  c: Context,
  schema: T,
): Promise<output<T>> => {
  let data: unknown;

  try {
    data = await c.req.json();
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new PublicError(400, "Malformed JSON body");
    }

    throw err;
  }

  return await parseRequestAsync(schema, data, "body");
};

/**
 * Reads and validates a single path parameter.
 */
export const parseRequestParam = <T extends ZodType>(
  c: Context,
  name: string,
  schema: T,
): output<T> => {
  const result = schema.safeParse(c.req.param(name));

  if (!result.success) {
    throw new RequestValidationError("param", result.error, [name]);
  }

  return result.data;
};

/**
 * Only errors explicitly marked as public are shown to clients, everything else is internal.
 */
export const errorHandler: ErrorHandler = async (err, c) => {
  if (err instanceof PublicError) {
    return c.json(
      {
        success: false,
        message: err.message,
        ...(err.details && { errors: err.details }),
      },
      err.status,
    );
  }

  if (err instanceof HTTPException) {
    if (err.res) {
      return err.getResponse();
    }

    return c.json({ success: false, message: err.message }, err.status);
  }

  console.error(err);

  return c.json(
    {
      success: false,
      message: "Internal Server Error",
    },
    500,
  );
};
