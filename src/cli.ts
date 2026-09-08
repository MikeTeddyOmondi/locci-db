#!/usr/bin/env node

// Must come before any import that reads process.env. Values already present
// in the real environment win; .env only fills in what is missing.
import { config as loadEnvFile } from "dotenv";
loadEnvFile({ quiet: true });

import { Command } from "commander";
import { startServer } from "./index.js";
import { hashPassword } from "./config.js";
import { VERSION } from "./version.js";
import { log } from "./utils.js";

const program = new Command();

program
  .name("locci-db")
  .description("Lightweight PostgreSQL-compatible database server")
  .version(VERSION);

program
  .command("start")
  .description("Start the database server")
  .option("-p, --port <port>", "Port to listen on (default: 5432)")
  .option("-h, --host <host>", "Host to bind to (default: 127.0.0.1)")
  .option("-d, --data-dir <path>", "Data directory path")
  .option("-l, --log-level <level>", "Log level (default: info)")
  .action(async (options) => {
    // Only flags the user actually passed become overrides. Setting these
    // unconditionally would make commander defaults outrank the config file.
    if (options.port) process.env.LOCCI_DB_PORT = options.port;
    if (options.host) process.env.LOCCI_DB_HOST = options.host;
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
