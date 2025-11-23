#!/usr/bin/env node

import { Command } from "commander";
import { startServer } from "./index.js";
import { hashPassword } from "./config.js";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { log } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8")
);

const program = new Command();

program
  .name("locci-db")
  .description("Lightweight PostgreSQL-compatible database server")
  .version(packageJson.version);

program
  .command("start")
  .description("Start the database server")
  .option("-p, --port <port>", "Port to listen on", "5432")
  .option("-h, --host <host>", "Host to bind to", "127.0.0.1")
  .option("-d, --data-dir <path>", "Data directory path")
  .option("-l, --log-level <level>", "Log level", "info")
  .action(async (options) => {
    // Override config with CLI options
    process.env.LOCCI_DB_PORT = options.port;
    process.env.LOCCI_DB_HOST = options.host;
    if (options.dataDir) process.env.LOCCI_DB_DATA_DIR = options.dataDir;
    if (options.logLevel) process.env.LOCCI_DB_LOG_LEVEL = options.logLevel;

    try {
      await startServer();
    } catch (error) {
      log.error({ error }, "Failed to start server:");
      process.exit(1);
    }
  });

program
  .command("hash-password <password>")
  .description("Generate a password hash for configuration")
  .action(async (password) => {
    try {
      const hash = await hashPassword(password);
      log.info({ hash }, "Password hash (store this in your config) ");
    } catch (error) {
      log.error({ error }, "Failed to generate password hash:");
      process.exit(1);
    }
  });

program.parse();
