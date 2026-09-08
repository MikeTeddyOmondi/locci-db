import { z } from "zod";
import { cosmiconfigSync } from "cosmiconfig";
import { defu } from "defu";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";
import { log } from "./utils.js";

const scryptAsync = promisify(scrypt);

/**
 * Configuration schema with validation
 */
export const ConfigSchema = z.object({
  port: z.number().int().min(1024).max(65535).default(5432),
  host: z.string().default("127.0.0.1"),
  dataDir: z.string().optional(),
  logLevel: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
  auth: z.object({
    username: z.string().min(3).max(63),
    password: z.string().min(8).optional(),
    // Optional: password hash instead of plaintext
    passwordHash: z.string().optional(),
  }),
  security: z
    .object({
      allowedHosts: z.array(z.string()).default(["127.0.0.1", "localhost"]),
      maxConnections: z.number().int().positive().default(10),
    })
    .optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Hash password securely using scrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    const [salt, key] = hash.split(":");
    if (!salt || !key) return false;
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return key === derivedKey.toString("hex");
  } catch (error) {
    log.error({ error }, "Error verifying password:");
    return false;
  }
}

/**
 * Load configuration from multiple sources
 */
export function loadConfig(): Config {
  const explorer = cosmiconfigSync("locci-db", {
    searchPlaces: [
      "package.json",
      ".locci-db.json",
      ".locci-db.yaml",
      ".locci-db.yml",
      ".locci-db.config.js",
      "locci-db.config.js",
    ],
  });

  const result = explorer.search();
  const config = result?.config || {};

  // Merge with environment variables
  const envConfig = {
    port: process.env.LOCCI_DB_PORT
      ? parseInt(process.env.LOCCI_DB_PORT, 10)
      : undefined,
    host: process.env.LOCCI_DB_HOST,
    dataDir: process.env.LOCCI_DB_DATA_DIR,
    logLevel: process.env.LOCCI_DB_LOG_LEVEL,
    auth: {
      username: process.env.LOCCI_DB_USERNAME,
      password: process.env.LOCCI_DB_PASSWORD,
      passwordHash: process.env.LOCCI_DB_PASSWORD_HASH,
    },
  };

  // defu merges right-to-left by falling priority and skips undefined values,
  // so an env var that is not set falls through to the config file.
  const mergedConfig = defu(envConfig, config);

  // Validate with Zod
  return ConfigSchema.parse(mergedConfig);
}
