import { z } from "zod";

// jobber-cursor-v1
const magic = "jcv1";

const cursorSchema = z.object({
  size: z.number().int().positive().min(10).max(100).default(20),

  created: z.date(),
  id: z.string(),

  createdPrevious: z.date().nullable().default(null),
  idPrevious: z.string().nullable().default(null),
});

type Cursor = z.infer<typeof cursorSchema>;

export const parseDatabaseCursor = (input?: string): Cursor | null => {
  try {
    if (!input) {
      return null;
    }

    const decoded = Buffer.from(input, "hex").toString("utf-8");

    if (!decoded.startsWith(magic)) {
      return null;
    }

    const { success, data } = cursorSchema.safeParse(
      JSON.parse(decoded.substring(magic.length)),
    );

    if (!success) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
};

export const createDatabaseCursor = (cursor: Cursor) => {
  const json = JSON.stringify(cursor);

  return Buffer.from(`${magic}${json}`, "utf-8").toString("hex");
};
