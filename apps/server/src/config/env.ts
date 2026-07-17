import path from "node:path";

import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  STORAGE_ROOT: z.string().default(path.resolve(process.cwd(), "storage")),
  MAX_UPLOAD_SIZE_BYTES: z.coerce.number().int().positive().default(200 * 1024 * 1024),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  port: parsed.data.PORT,
  nodeEnv: parsed.data.NODE_ENV,
  storageRoot: parsed.data.STORAGE_ROOT,
  maxUploadSizeBytes: parsed.data.MAX_UPLOAD_SIZE_BYTES,
};
