import { PGlite } from "@electric-sql/pglite";
import net from "node:net";
import { join } from "path";
import { homedir } from "os";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import { fromNodeSocket } from "pg-gateway/node";
import { log } from "./utils.js";
import { loadConfig, verifyPassword } from "./config.js";
import { getEmbeddedPGliteAssets } from "./pglite-assets.js";

export async function startServer() {
  const config = loadConfig();

  // Secure data directory (user's home by default)
  const dataDir = config.dataDir || join(homedir(), ".locci/db", "data");

  // Ensure parent directory exists
  await mkdir(dirname(dataDir), { recursive: true });

  log.info(`Initializing PGlite database at ${dataDir}`);
  const db = new PGlite({ dataDir, ...getEmbeddedPGliteAssets() });

  let activeConnections = 0;

  const server = net.createServer(async (socket) => {
    const clientAddress = socket.remoteAddress;

    // Connection limiting
    if (activeConnections >= (config.security?.maxConnections || 10)) {
      log.warn(
        `Connection rejected: max connections reached (${activeConnections})`
      );
      socket.destroy();
      return;
    }

    // IP filtering
    if (
      config.security?.allowedHosts &&
      !config.security.allowedHosts.includes(clientAddress || "")
    ) {
      log.warn(`Connection rejected from unauthorized host: ${clientAddress}`);
      socket.destroy();
      return;
    }

    activeConnections++;
    log.info(
      `Client connected from ${clientAddress} (${activeConnections} active)`
    );

    await fromNodeSocket(socket, {
      serverVersion: "16.3 (PGlite 0.2.0)",

      auth: {
        method: "password",

        validateCredentials: async function (credentials) {
          if (credentials.clearTextPassword) {
            const isValidUser = credentials.username === config.auth.username;

            // Use password hash if available, otherwise compare plaintext
            let isValidPassword: boolean;
            if (config.auth.passwordHash) {
              isValidPassword = await verifyPassword(
                credentials.password,
                config.auth.passwordHash
              );
            } else if (config.auth.password) {
              isValidPassword = credentials.password === config.auth.password;
            } else {
              isValidPassword = false;
            }

            if (!isValidUser || !isValidPassword) {
              log.warn(
                `Authentication failed for user: ${credentials.username} from ${clientAddress}`
              );
            }

            return isValidUser && isValidPassword;
          }
          return false;
        },

        getClearTextPassword: async function (credentials) {
          return credentials.username;
        },
      },

      async onStartup() {
        log.debug("Awaiting database to be ready...");
        await db.waitReady;
      },

      async onMessage(data, { isAuthenticated }) {
        if (!isAuthenticated) {
          log.warn("Unauthenticated message rejected");
          return;
        }

        return await db.execProtocolRaw(data);
      },
    });

    socket.on("end", () => {
      activeConnections--;
      log.info(
        `Client disconnected from ${clientAddress} (${activeConnections} active)`
      );
    });

    socket.on("error", (err) => {
      activeConnections--;
      log.error(`Socket error from ${clientAddress}: ${err.message}`);
    });
  });

  server.on("error", (err) => {
    log.error(`Server error: ${err.message}`);
    process.exit(1);
  });

  server.listen(config.port, config.host, async () => {
    log.info(`🚀 Server listening on ${config.host}:${config.port}`);
    log.info(`📁 Data directory: ${dataDir}`);
    log.info(`🔐 Authenticated as: ${config.auth.username}`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => gracefulShutdown(server, db));
  process.on("SIGINT", () => gracefulShutdown(server, db));

  return server;
}

async function gracefulShutdown(server: net.Server, db: PGlite) {
  log.info("Shutting down gracefully...");

  server.close(() => {
    log.info("Server closed");
  });

  try {
    await db.close();
    log.info("Database closed");
  } catch (error) {
    log.error({ error }, "Error closing database:");
  }

  process.exit(0);
}
