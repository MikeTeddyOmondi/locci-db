# @locci/db - NPM Package - Guide

## Table of Contents
1. [Project Structure](#project-structure)
2. [Package Configuration](#package-configuration)
3. [Security Considerations](#security-considerations)
4. [Configurable Settings](#configurable-settings)
5. [Docker Packaging](#docker-packaging)
6. [Publishing & Distribution](#publishing--distribution)
7. [Testing](#testing)

---

## Project Structure

```
locci-db/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── index.ts            # Main server logic
│   ├── utils.ts            # Utilities
│   ├── config.ts           # Configuration management
│   └── types.ts            # TypeScript types
├── bin/
│   └── locci-db.js         # Executable shim
├── .dockerignore
├── Dockerfile
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

---

## Package Configuration

### package.json

```json
{
  "name": "@locci/db",
  "version": "1.0.0",
  "description": "Lightweight PostgreSQL-compatible database server powered by PGlite",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "locci-db": "./bin/locci-db.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx ./src/cli.ts",
    "start": "node ./dist/cli.js",
    "prepublishOnly": "npm run build",
    "test": "node --test",
    "lint": "eslint src/**/*.ts",
    "docker:build": "docker build -t locci/db:latest .",
    "docker:run": "docker run -p 5432:5432 locci/db:latest"
  },
  "keywords": [
    "postgresql",
    "pglite",
    "database",
    "cli",
    "postgres",
    "embedded-database"
  ],
  "author": "MikeTeddyOmondi <contact@miketeddyomondi.dev>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/locci-db.git"
  },
  "bugs": {
    "url": "https://github.com/yourusername/locci-db/issues"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "files": [
    "dist",
    "bin",
    "README.md",
    "LICENSE"
  ],
  "dependencies": {
    "pg-gateway": "0.3.0-beta.3",
    "pino": "^9.5.0",
    "pino-pretty": "^11.3.0",
    "@electric-sql/pglite": "^0.2.9",
    "commander": "^12.0.0",
    "cosmiconfig": "^9.0.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.14.11",
    "tsx": "^4.16.2",
    "typescript": "^5.5.3",
    "eslint": "^8.57.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0"
  }
}
```

### bin/locci-db.js

```javascript
#!/usr/bin/env node

// Shim to load the compiled TypeScript CLI
import('../dist/cli.js').catch((err) => {
  console.error('Failed to start @locci/db:', err);
  process.exit(1);
});
```

**Important**: Make this file executable:
```bash
chmod +x bin/locci-db.js
```

---

## Security Considerations

### 1. **Authentication Security**

**Current Issue**: Hardcoded credentials in `index.ts`

**Solution** - `src/config.ts`:

```typescript
import { z } from 'zod';
import { cosmiconfigSync } from 'cosmiconfig';
import { randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Configuration schema with validation
export const ConfigSchema = z.object({
  port: z.number().int().min(1024).max(65535).default(5432),
  host: z.string().default('127.0.0.1'),
  dataDir: z.string().optional(),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  auth: z.object({
    username: z.string().min(3).max(63),
    password: z.string().min(8),
    // Optional: password hash instead of plaintext
    passwordHash: z.string().optional(),
  }),
  security: z.object({
    allowedHosts: z.array(z.string()).default(['127.0.0.1', 'localhost']),
    maxConnections: z.number().int().positive().default(10),
  }).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

// Hash password securely
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

// Verify password against hash
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':');
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
  return key === derivedKey.toString('hex');
}

// Load configuration from multiple sources
export function loadConfig(): Config {
  const explorer = cosmiconfigSync('locci-db', {
    searchPlaces: [
      'package.json',
      '.locci-db.json',
      '.locci-db.yaml',
      '.locci-db.yml',
      '.locci-db.config.js',
      'locci-db.config.js',
    ],
  });

  const result = explorer.search();
  const config = result?.config || {};

  // Merge with environment variables
  const envConfig = {
    port: process.env.LOCCI_DB_PORT ? parseInt(process.env.LOCCI_DB_PORT, 10) : undefined,
    host: process.env.LOCCI_DB_HOST,
    dataDir: process.env.LOCCI_DB_DATA_DIR,
    logLevel: process.env.LOCCI_DB_LOG_LEVEL,
    auth: {
      username: process.env.LOCCI_DB_USERNAME,
      password: process.env.LOCCI_DB_PASSWORD,
      passwordHash: process.env.LOCCI_DB_PASSWORD_HASH,
    },
  };

  // Deep merge, env vars take precedence
  const mergedConfig = deepMerge(config, removeUndefined(envConfig));

  // Validate with Zod
  return ConfigSchema.parse(mergedConfig);
}

// Helper to remove undefined values
function removeUndefined(obj: any): any {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  );
}

// Simple deep merge
function deepMerge(target: any, source: any): any {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}
```

### 2. **Network Security**

**Updated `src/index.ts`**:

```typescript
import { PGlite } from "@electric-sql/pglite";
import net from "node:net";
import { join } from "path";
import { homedir } from "os";
import { fromNodeSocket } from "pg-gateway/node";
import { log } from "./utils.js";
import { loadConfig, verifyPassword } from "./config.js";

export async function startServer() {
  const config = loadConfig();
  
  // Secure data directory (user's home by default)
  const dataDir = config.dataDir || join(homedir(), '.locci-db', 'data');
  
  const db = new PGlite({ dataDir });

  let activeConnections = 0;

  const server = net.createServer(async (socket) => {
    const clientAddress = socket.remoteAddress;
    
    // Connection limiting
    if (activeConnections >= (config.security?.maxConnections || 10)) {
      log.warn(`Connection rejected: max connections reached (${activeConnections})`);
      socket.destroy();
      return;
    }

    // IP filtering
    if (config.security?.allowedHosts && 
        !config.security.allowedHosts.includes(clientAddress || '')) {
      log.warn(`Connection rejected from unauthorized host: ${clientAddress}`);
      socket.destroy();
      return;
    }

    activeConnections++;
    log.info(`Client connected from ${clientAddress} (${activeConnections} active)`);
    
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
                credentials.clearTextPassword,
                config.auth.passwordHash
              );
            } else {
              isValidPassword = credentials.clearTextPassword === config.auth.password;
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
      log.info(`Client disconnected (${activeConnections} active)`);
    });

    socket.on("error", (err) => {
      activeConnections--;
      log.error(`Socket error: ${err.message}`);
    });
  });

  server.on('error', (err) => {
    log.error(`Server error: ${err.message}`);
    process.exit(1);
  });

  server.listen(config.port, config.host, async () => {
    log.info(`🚀 Server listening on ${config.host}:${config.port}`);
    log.info(`📁 Data directory: ${dataDir}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => gracefulShutdown(server, db));
  process.on('SIGINT', () => gracefulShutdown(server, db));
  
  return server;
}

async function gracefulShutdown(server: net.Server, db: PGlite) {
  log.info('Shutting down gracefully...');
  
  server.close(() => {
    log.info('Server closed');
  });
  
  await db.close();
  process.exit(0);
}
```

### 3. **Input Validation & Rate Limiting**

Consider adding:
- Rate limiting per IP (use `rate-limiter-flexible`)
- Request size limits
- Timeout configurations

---

## Configurable Settings

### Configuration File Examples

#### `.locci-db.json` (User's project directory)

```json
{
  "port": 5433,
  "host": "127.0.0.1",
  "dataDir": "./my-database",
  "logLevel": "debug",
  "auth": {
    "username": "myuser",
    "password": "secure-password-here"
  },
  "security": {
    "allowedHosts": ["127.0.0.1", "::1"],
    "maxConnections": 5
  }
}
```

#### Environment Variables

```bash
export LOCCI_DB_PORT=5433
export LOCCI_DB_HOST=127.0.0.1
export LOCCI_DB_USERNAME=myuser
export LOCCI_DB_PASSWORD=mypassword
export LOCCI_DB_DATA_DIR=/path/to/data
export LOCCI_DB_LOG_LEVEL=info
```

### CLI Implementation - `src/cli.ts`

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { startServer } from './index.js';
import { hashPassword } from './config.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const packageJson = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf-8')
);

const program = new Command();

program
  .name('locci-db')
  .description('Lightweight PostgreSQL-compatible database server')
  .version(packageJson.version);

program
  .command('start')
  .description('Start the database server')
  .option('-p, --port <port>', 'Port to listen on', '5432')
  .option('-h, --host <host>', 'Host to bind to', '127.0.0.1')
  .option('-d, --data-dir <path>', 'Data directory path')
  .option('-l, --log-level <level>', 'Log level', 'info')
  .action(async (options) => {
    // Override config with CLI options
    process.env.LOCCI_DB_PORT = options.port;
    process.env.LOCCI_DB_HOST = options.host;
    if (options.dataDir) process.env.LOCCI_DB_DATA_DIR = options.dataDir;
    if (options.logLevel) process.env.LOCCI_DB_LOG_LEVEL = options.logLevel;

    try {
      await startServer();
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  });

program
  .command('hash-password <password>')
  .description('Generate a password hash for configuration')
  .action(async (password) => {
    const hash = await hashPassword(password);
    console.log('Password hash (store this in your config):');
    console.log(hash);
  });

program.parse();
```

---

## Docker Packaging

### Improved Dockerfile

```dockerfile
# Build stage
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM gcr.io/distroless/nodejs22-debian12

WORKDIR /app

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules/

# Copy compiled code
COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/bin ./bin/
COPY --from=builder /app/package.json ./

# Create data directory with proper permissions
USER nonroot:nonroot

# Expose PostgreSQL port
EXPOSE 5432

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["node", "-e", "require('net').connect(5432, '127.0.0.1').on('error', () => process.exit(1))"]

# Run the CLI
CMD ["./bin/locci-db.js", "start"]
```

### .dockerignore

```
node_modules
npm-debug.log
.git
.gitignore
*.md
.DS_Store
dist
logs
pglite-data
.env
.env.*
tests
*.test.ts
coverage
.vscode
.idea
```

### Docker Compose (Optional)

```yaml
name: locci-db

services:
  locci-db:
    build: .
    image: locci/db:latest
    container_name: locci-db
    ports:
      - "5432:5432"
    environment:
      LOCCI_DB_USERNAME: postgres
      LOCCI_DB_PASSWORD: postgres
      LOCCI_DB_LOG_LEVEL: info
    volumes:
      - locci-data:/app/data
    restart: unless-stopped
    networks:
      - locci-network

volumes:
  locci-data:

networks:
  locci-network:
    driver: bridge
```

### Docker Build & Publish

```bash
# Build
docker build -t locci/db:latest -t locci/db:1.0.0 .

# Test locally
docker run -p 5432:5432 locci/db:latest

# Push to Docker Hub. Normally the release workflow does this on a version tag.
docker push locci/db:latest
```

---

## Publishing & Distribution

### Pre-publish Checklist

1. **Update version**: `npm version patch|minor|major`
2. **Test locally**: `npm link && locci-db start`
3. **Build**: `npm run build`
4. **Lint**: `npm run lint`
5. **Test**: `npm test`

### Publishing to NPM

```bash
# Login to NPM
npm login

# Publish (public package)
npm publish --access public

# Or for scoped private package
npm publish
```

### GitHub Actions CI/CD (`.github/workflows/publish.yml`)

```yaml
name: Publish Package

on:
  release:
    types: [created]

jobs:
  publish-npm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

  publish-docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            yourusername/locci-db:latest
            yourusername/locci-db:${{ github.ref_name }}
```

---

## Testing

### Basic Tests (`tests/config.test.ts`)

```typescript
import { test } from 'node:test';
import assert from 'node:assert';
import { hashPassword, verifyPassword } from '../src/config.js';

test('password hashing and verification', async () => {
  const password = 'test-password-123';
  const hash = await hashPassword(password);
  
  assert.ok(hash.includes(':'), 'Hash should contain salt separator');
  
  const isValid = await verifyPassword(password, hash);
  assert.strictEqual(isValid, true, 'Password should verify correctly');
  
  const isInvalid = await verifyPassword('wrong-password', hash);
  assert.strictEqual(isInvalid, false, 'Wrong password should not verify');
});
```

### Integration Test

```typescript
import { test } from 'node:test';
import assert from 'node:assert';
import { Client } from 'pg';
import { startServer } from '../src/index.js';

test('server accepts connections', async () => {
  process.env.LOCCI_DB_USERNAME = 'testuser';
  process.env.LOCCI_DB_PASSWORD = 'testpass';
  process.env.LOCCI_DB_PORT = '5433';
  
  const server = await startServer();
  
  const client = new Client({
    host: '127.0.0.1',
    port: 5433,
    user: 'testuser',
    password: 'testpass',
    database: 'postgres',
  });
  
  await client.connect();
  const result = await client.query('SELECT 1 as num');
  assert.strictEqual(result.rows[0].num, 1);
  
  await client.end();
  server.close();
});
```

---

## Security Best Practices Summary

### ✅ DO

1. **Never hardcode credentials** - Use environment variables or config files
2. **Use password hashing** - Store bcrypt/scrypt hashes, not plaintext
3. **Validate all inputs** - Use Zod or similar for schema validation
4. **Limit connections** - Prevent resource exhaustion
5. **IP whitelisting** - Restrict access to known hosts
6. **Use HTTPS** - When deploying publicly (consider adding TLS support)
7. **Audit logs** - Log authentication attempts and suspicious activity
8. **Update dependencies** - Regular `npm audit` and updates
9. **Use distroless images** - Minimize attack surface in Docker
10. **Run as non-root** - Use USER directive in Dockerfile

### ❌ DON'T

1. Don't expose to 0.0.0.0 by default
2. Don't store passwords in package.json or source control
3. Don't skip input validation
4. Don't ignore security warnings from `npm audit`
5. Don't run as root in production
6. Don't bundle unnecessary files in npm package

---

## Usage Examples

### As npx command

```bash
# Quick start with defaults
npx @locci/db start

# Custom port and host
npx @locci/db start --port 5433 --host 0.0.0.0

# Generate password hash
npx @locci/db hash-password "my-secure-password"
```

### Global installation

```bash
# Install globally
npm install -g @locci/db

# Run anywhere
locci-db start --data-dir ~/my-databases/prod
```

### With configuration file

```bash
# Create .locci-db.json in your project
echo '{
  "port": 5432,
  "auth": {
    "username": "admin",
    "passwordHash": "hash-from-hash-password-command"
  }
}' > .locci-db.json

# Start (reads config automatically)
locci-db start
```

### Docker

```bash
# Pull from registry
docker pull ranckosolutionsinc/locci-db:latest

# Run with environment variables
docker run -d \
  -p 5432:5432 \
  -e LOCCI_DB_USERNAME=dbuser \
  -e LOCCI_DB_PASSWORD=dbpass \
  -v locci-data:/app/data \
  ranckosolutionsinc/locci-db:latest
```

---

## Additional Resources

- **PGlite Documentation**: https://pglite.dev/
- **pg-gateway Repository**: https://github.com/electric-sql/pg-gateway
- **NPM Publishing Guide**: https://docs.npmjs.com/packages-and-modules
- **Docker Best Practices**: https://docs.docker.com/develop/dev-best-practices/

---

## License Considerations

Ensure your LICENSE file is compatible with dependencies:
- PGlite: Apache 2.0
- pg-gateway: Apache 2.0
- Pino: MIT

MIT license is compatible and recommended for this project.

---

## Notes

I've created a comprehensive guide for creating your `@locci/db` NPM executable package. Here are the key highlights:

## 🔑 Key Improvements

### Security Enhancements
1. **Password hashing** using scrypt instead of plaintext comparison
2. **IP whitelisting** to restrict connections to authorized hosts
3. **Connection limiting** to prevent resource exhaustion
4. **Input validation** with Zod schemas
5. **Environment-based secrets** instead of hardcoded credentials

### Configuration Flexibility
- Multiple configuration sources (files, env vars, CLI args)
- Support for `.locci-db.json`, YAML, or JS config files
- Environment variables with `LOCCI_DB_*` prefix
- CLI flags for quick overrides
- Priority: CLI args > env vars > config file > defaults

### Professional Package Structure
- Proper `bin` executable with shim
- TypeScript compilation to `dist/`
- Only necessary files published via `files` field
- Scoped package name `@locci/db`
- Commander.js for CLI with multiple commands

### Docker Improvements
- Multi-stage build for smaller image
- Distroless base for security
- Health checks
- Non-root user
- Proper .dockerignore

### Distribution Options
1. **NPM**: `npx @locci/db start`
2. **Global install**: `npm i -g @locci/db`
3. **Docker Hub**: `docker run yourusername/locci-db`
4. **GitHub Container Registry**: Alternative to Docker Hub

### Testing & CI/CD
- Node.js native test runner examples
- GitHub Actions for automated publishing
- Pre-publish validation steps

The guide includes working code examples for all components, security best practices, and step-by-step instructions for publishing to both NPM and Docker registries. Let me know if you need clarification on any part!

---
