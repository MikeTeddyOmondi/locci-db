import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

// Deliberately not import.meta.dirname, which needs Node 20.11 while engines
// allows 20.0.
const CLI = resolve(dirname(fileURLToPath(import.meta.url)), "../../dist/cli.js");
const PORT = 55432;

let server: ChildProcess;
let workDir: string;

/** Resolve once the port accepts a connection, or reject after `attempts`. */
async function waitForPort(port: number, attempts = 40): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    const up = await new Promise<boolean>((res) => {
      const s = net.connect({ host: "127.0.0.1", port });
      s.on("connect", () => (s.destroy(), res(true)));
      s.on("error", () => res(false));
    });
    if (up) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`port ${port} never opened`);
}

/** Send a Postgres SSLRequest and return the single-byte reply. */
async function sslRequest(port: number): Promise<string> {
  return new Promise((res, rej) => {
    const s = net.connect({ host: "127.0.0.1", port });
    const timer = setTimeout(() => (s.destroy(), rej(new Error("no reply"))), 5000);
    s.on("connect", () => {
      const packet = Buffer.alloc(8);
      packet.writeInt32BE(8, 0);
      packet.writeInt32BE(80877103, 4);
      s.write(packet);
    });
    s.on("data", (d) => {
      clearTimeout(timer);
      s.destroy();
      res(d.toString("latin1")[0]!);
    });
    s.on("error", (e) => (clearTimeout(timer), rej(e)));
  });
}

describe("server end to end", () => {
  beforeAll(async () => {
    if (!existsSync(CLI)) {
      throw new Error(`${CLI} is missing. Run \`npm run build\` before the e2e suite.`);
    }
    // Run from a scratch cwd so the repo's own .env and .locci-db.json cannot
    // leak into the spec and change the port or credentials under test.
    workDir = await mkdtemp(join(tmpdir(), "locci-e2e-"));
    server = spawn(process.execPath, [CLI, "start"], {
      cwd: workDir,
      stdio: "ignore",
      env: {
        ...process.env,
        LOCCI_DB_USERNAME: "postgres",
        LOCCI_DB_PASSWORD: "e2e-test-password",
        LOCCI_DB_HOST: "127.0.0.1",
        LOCCI_DB_PORT: String(PORT),
        LOCCI_DB_DATA_DIR: join(workDir, "data"),
      },
    });
    await waitForPort(PORT);
  });

  afterAll(async () => {
    server?.kill("SIGTERM");
    if (workDir) await rm(workDir, { recursive: true, force: true });
  });

  it("accepts TCP connections on the configured port", async () => {
    await expect(waitForPort(PORT, 1)).resolves.toBeUndefined();
  });

  it("answers the postgres SSLRequest handshake", async () => {
    // 'N' means the server understood the request and declines TLS.
    expect(await sslRequest(PORT)).toBe("N");
  });

  it("honours LOCCI_DB_PORT over the packaged defaults", async () => {
    expect(PORT).not.toBe(5432);
    await expect(sslRequest(PORT)).resolves.toBeTruthy();
  });
});
