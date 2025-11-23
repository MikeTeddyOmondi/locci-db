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
3. Configuration files
4. Defaults (lowest priority)

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

## Docker

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
docker-compose up -d
```

## Security Features

- **Password Hashing**: Uses scrypt for secure password hashing
- **Connection Limiting**: Prevents resource exhaustion
- **IP Whitelisting**: Restrict connections to authorized hosts
- **Input Validation**: Zod schema validation for all configurations
- **Graceful Shutdown**: Properly closes connections on SIGTERM/SIGINT
- **Non-root User**: Docker image runs as non-root user

## Development

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Installation

```bash
npm install
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

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Project Structure

```
locci-db/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── index.ts            # Main server logic
│   ├── utils.ts            # Utilities and logging
│   ├── config.ts           # Configuration management
│   └── types.ts            # TypeScript types
├── bin/
│   └── locci-db.js         # Executable shim
├── dist/                   # Compiled output
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── tsconfig.json
├── package.json
├── README.md
└── LICENSE
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

### Pre-publish Checklist

1. Update version: `npm version patch|minor|major`
2. Test locally: `npm run build && npm test`
3. Lint: `npm run lint`
4. Build: `npm run build`

### Publish to NPM

```bash
npm login
npm publish --access public
```

### Publish to Docker Hub

```bash
docker tag locci/db:latest ranckosolutionsinc/locci-db:latest
docker push ranckosolutionsinc/locci-db:latest
```

## License

MIT - See LICENSE file for details

## Dependencies

- [PGlite](https://pglite.dev/) - PostgreSQL in WASM
- [pg-gateway](https://github.com/supabase-community/pg-gateway) - PostgreSQL wire protocol handler
- [Pino](https://getpino.io/) - Fast logger
- [Commander](https://github.com/tj/commander.js) - CLI framework
- [Zod](https://zod.dev/) - TypeScript-first schema validation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and feature requests, please use the GitHub issues page.
