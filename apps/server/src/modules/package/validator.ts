import { SUPPORTED_PLATFORMS } from "@openota/shared";
import { z } from "zod";

const platformSchema = z.enum(SUPPORTED_PLATFORMS);

const semverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "Version must follow semantic versioning (e.g. 1.0.0)");

// Opaque, server-defined label — see @openota/shared's Channel type. Not a closed enum: channels
// are configured per deployment, not fixed by the server. Same charset as platform/version path
// segments since it flows through assertSafePathSegment when used to build a storage key.
const channelSchema = z
  .string()
  .min(1)
  .regex(/^[a-zA-Z0-9_-]+$/, "Channel may only contain letters, numbers, hyphens, and underscores");

export const uploadPackageSchema = z.object({
  platform: platformSchema,
  version: semverSchema,
  runtimeVersion: semverSchema,
  bundleName: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, "sha256 must be a 64-character hex digest"),
  size: z.coerce.number().int().positive(),
  assets: z.array(z.string()).optional(),
  channel: channelSchema.optional(),
});

export const packageParamsSchema = z.object({
  platform: platformSchema,
  version: semverSchema,
});

export const checkUpdateQuerySchema = z.object({
  platform: platformSchema,
  currentVersion: semverSchema,
  deviceId: z.string().min(1).optional(),
  runtimeVersion: z.string().min(1).optional(),
  channel: channelSchema.optional(),
});

export const rollbackSchema = z.object({
  platform: platformSchema,
  version: semverSchema,
  channel: channelSchema.optional(),
});

export type UploadPackageBody = z.infer<typeof uploadPackageSchema>;
export type PackageParams = z.infer<typeof packageParamsSchema>;
export type CheckUpdateQuery = z.infer<typeof checkUpdateQuerySchema>;
export type RollbackBody = z.infer<typeof rollbackSchema>;
