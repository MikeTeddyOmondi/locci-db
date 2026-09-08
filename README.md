# Locci DB - [@locci/db]()

Lightweight PostgreSQL-compatible database server powered by [PGlite](https://pglite.dev/).

## Features

- **Embedded Database**: Full PostgreSQL compatibility with PGlite
- **Easy to Deploy**: Standalone executable or Docker container
- **Secure**: Password hashing, connection limiting, IP filtering
- **Configurable**: Support for config files, environment variables, and CLI flags
- **CLI Support**: Generate hashes, manage database via command line
- **Production Ready**: Graceful shutdown, connection pooling, comprehensive logging

## Installation

### As NPM Package

```bash
npm install @locci/db
```

### Global Installation

```bash
npm install -g @locci/db
```

### Using npx

```bash
npx @locci/db start
```

## Usage

### Start the Server

```bash
locci-db start
```

Options:
- `-p, --port <port>` - Port to listen on (default: 5432)
- `-h, --host <host>` - Host to bind to (default: 127.0.0.1)
- `-d, --data-dir <path>` - Data directory path
- `-l, --log-level <level>` - Log level: trace, debug, info, warn, error, fatal (default: info)

### Generate Password Hash

```bash
locci-db hash-password "clear-text-password-here"
```

This generates a secure hash to use in configuration files instead of plaintext passwords.

## Configuration

Configuration is loaded from multiple sources in this order:
1. CLI flags (highest priority)
2. Environment variables
3. A `.env` file in the working directory
4. Configuration files
5. Built-in defaults (lowest priority)

A value set at a higher level overrides the same value below it. Levels are
merged per field, so a config file can supply `auth` while an environment
variable overrides only the port.

### Environment Variables

```bash
export LOCCI_DB_PORT=5433
export LOCCI_DB_HOST=127.0.0.1
export LOCCI_DB_USERNAME=dbuser
export LOCCI_DB_PASSWORD=dbpassword
export LOCCI_DB_PASSWORD_HASH="salt:derivedkey"  # If using hash
export LOCCI_DB_DATA_DIR=/path/to/data
export LOCCI_DB_LOG_LEVEL=info
```

These can also live in a `.env` file in the working directory, which is read at
startup. Real environment variables take precedence over the file, so exporting
a value still overrides it.

### Configuration File

Create `.locci-db.json` in your project directory:

```json
{
  "port": 5432,
  "host": "127.0.0.1",
  "dataDir": "./my-database",
  "logLevel": "info",
  "auth": {
    "username": "postgres",
    "passwordHash": "salt:derivedkey"
  },
  "security": {
    "allowedHosts": ["127.0.0.1", "localhost"],
    "maxConnections": 10
  }
}
```

Supported file formats:
- `.locci-db.json`
- `.locci-db.yaml`
- `.locci-db.yml`
- `.locci-db.config.js`
- `locci-db.config.js`
- `package.json` (under `locci-db` key)

## Single-file binary

The server compiles to a standalone executable with Bun. It embeds the Bun
runtime and PGlite's WASM, so it needs no Node, no Bun, and no `node_modules`
on the target machine.

```bash
bun run compile        # -> dist-bin/locci-db
./dist-bin/locci-db start
```

Every release publishes prebuilt binaries for Linux (x64, arm64, x64-musl),
macOS (x64, arm64), and Windows (x64), alongside a `SHA256SUMS` file. Verify a
download before running it:

```bash
sha256sum -c SHA256SUMS --ignore-missing
```

When a signing key is configured for the repository, each artifact also ships a
detached PGP signature (`.asc`):

```bash
gpg --verify locci-db-linux-x64.asc locci-db-linux-x64
```

## Docker

The image ships the compiled binary on `distroless/cc`, so it contains no Node,
no Bun, and no `node_modules`. Images are built for `linux/amd64` and
`linux/arm64`.


### Build

```bash
docker build -t locci/db:latest .
```

### Run

```bash
docker run -d \
  -p 5432:5432 \
  -e LOCCI_DB_USERNAME=postgres \
  -e LOCCI_DB_PASSWORD=postgres \
  -v locci-data:/app/data \
  locci/db:latest
```

### Docker Compose

```bash
docker compose up -d
```

## Security Features

- **Password Hashing**: Uses scrypt for secure password hashing
- **Connection Limiting**: Prevents resource exhaustion
- **IP Whitelisting**: Restrict connections to authorized hosts
- **Input Validation**: Zod schema validation for all configurations
- **Graceful Shutdown**: Properly closes connections on SIGTERM/SIGINT

## Development

### Prerequisites

- [Bun](https://bun.sh/) (package manager, and required to compile binaries)
- Node.js >= 20.0.0 (the published package targets Node)

### Installation

Dependencies are managed with Bun (`bun.lock`):

```bash
bun install
```

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Testing

Tests run on [Vitest](https://vitest.dev/) under Node, split into two projects:

```bash
npm test           # unit tests
npm run test:unit  # same, explicit
npm run test:e2e   # builds, then boots the real server and connects to it
npm run test:all   # both projects
npm run test:watch # unit tests in watch mode
npm run test:coverage
```

Unit specs live in `tests/unit`, end-to-end specs in `tests/e2e`. E2E specs bind
real ports, so they run serially with longer timeouts.

### Linting and type checking

```bash
npm run lint      # oxlint, warnings are errors
npm run lint:fix  # apply autofixes
npm run typecheck # tsc over src and tests
```

### Compiling

```bash
npm run compile   # single-file binary into dist-bin/
```

## API

### `startServer(): Promise<net.Server>`

Starts the database server with loaded configuration.

```typescript
import { startServer } from '@locci/db';

const server = await startServer();
```

### `loadConfig(): Config`

Loads configuration from files and environment variables.

```typescript
import { loadConfig } from '@locci/db/config';

const config = loadConfig();
```

### `hashPassword(password: string): Promise<string>`

Generates a secure password hash.

```typescript
import { hashPassword } from '@locci/db/config';

const hash = await hashPassword('my-password');
```

### `verifyPassword(password: string, hash: string): Promise<boolean>`

Verifies a password against a hash.

```typescript
import { verifyPassword } from '@locci/db/config';

const isValid = await verifyPassword('my-password', hash);
```

## Publishing

Releases are automated. Pushing a version tag runs the `Release` workflow,
which verifies the build, cross-compiles the binaries, creates the GitHub
release with those binaries and their checksums attached, publishes to npm, and
pushes multi-arch images to Docker Hub.

```bash
npm version patch|minor|major   # updates package.json and creates the tag
git push --follow-tags
```

The workflow fails if the tag does not match the version in `package.json`. A
prerelease version (one containing a hyphen, such as `1.0.0-alpha-1`) publishes
to npm under the `next` dist-tag and does not move the `latest` Docker tag.

Required repository secrets: `NPM_TOKEN`, `DOCKER_USERNAME`, `DOCKER_PASSWORD`.
Set `GPG_PRIVATE_KEY` and `GPG_PASSPHRASE` to sign the release binaries; without
them the release still completes, with a warning, and the binaries are published
unsigned.

## License

MIT - See LICENSE file for details

## Dependencies

- [PGlite](https://pglite.dev/) - PostgreSQL in WASM
- [pg-gateway](https://github.com/supabase-community/pg-gateway) - PostgreSQL wire protocol handler
- [Pino](https://getpino.io/) - Fast logger
- [Commander](https://github.com/tj/commander.js) - CLI framework
- [Zod](https://zod.dev/) - TypeScript-first schema validation
- [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig) - Configuration file discovery
- [defu](https://github.com/unjs/defu) - Configuration merging
- [dotenv](https://github.com/motdotla/dotenv) - `.env` file loading

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and feature requests, please use the GitHub issues page.
