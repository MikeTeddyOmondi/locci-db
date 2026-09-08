# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each released section is copied into its GitHub release when the tag is pushed,
so write these entries for the people reading the release page.

## Unreleased

### Fixed

- The `SHA256SUMS` signature was produced but never uploaded. The release only
  attached `locci-db-*` and `SHA256SUMS`, and `SHA256SUMS.asc` matched neither
  pattern, so the checksums file shipped unsigned in v1.0.0-alpha-1 while every
  binary beside it was signed.

- npm and image publishing now wait for the release binaries. They previously
  ran in parallel with the binary build, so a failure while compiling or signing
  could leave a version published to npm, which can never be republished, next
  to a release with no artifacts. This is not theoretical: the Docker Hub push
  in v1.0.0-alpha-1 failed on token scopes after npm had already published.

## [1.0.0-alpha-1] - 2026-09-09

First tagged release. The server worked, but nothing around it did: the config
file was silently discarded, the published Docker port was dead, and both the
test and lint scripts failed, which meant the release pipeline could never have
run green.

### Fixed

- The server refused to start with a valid `.locci-db.json` present, failing on
  `auth.username` with a Zod `invalid_type` error. `removeUndefined` only
  filtered the top level, so the nested `auth` block of unset environment
  variables survived as `{ username: undefined, ... }` and the deep merge
  assigned those `undefined` values over the values from the file.

- CLI flag defaults always beat the config file. The `start` command declared
  commander defaults (`5432`, `127.0.0.1`, `info`) and wrote them into
  `process.env` on every run, where they were treated as explicit overrides. A
  config file asking for port 5433 still bound 5432. Defaults moved into the
  help text, and the environment is now only written for flags actually passed.

- A published container port accepted connections but served nothing. The app
  defaults to binding `127.0.0.1`, which inside a container is unreachable from
  the host, so docker-proxy accepted the TCP connection and then dropped it. The
  image now defaults to `0.0.0.0`. Note that a `/dev/tcp` style check cannot
  catch this, because the proxy answers it either way.

- The Compose volume never persisted anything. It mounted `locci-data` at
  `/app/data` while the app wrote to `/root/.locci/db/data`. The image now sets
  `LOCCI_DB_DATA_DIR=/app/data` to match.

- `npm test` failed outright. The suite imported `../src/config.js`, which
  `node --test` cannot resolve to a `.ts` file.

- `npm run lint` failed outright. No flat config existed and `eslint` was not a
  direct dependency, so it resolved to a transitive 8.57.1.

- The README claimed the Docker image runs as a non-root user. It runs as uid 0.
  The claim was removed rather than left standing. See `BACKLOG.md`.

### Added

- `.env` files are loaded at startup. The variables were documented and shipped
  in `.env.sample`, but nothing read them outside of `docker run --env-file`.
  Real environment variables still win over the file.

- A single-file executable, built with `bun run compile`. It embeds the Bun
  runtime and PGlite's WASM, so it runs with no Node, no Bun and no
  `node_modules` on the target. PGlite resolves `postgres.wasm` and
  `postgres.data` relative to its own module URL at runtime, which does not
  exist inside a compiled binary, so both are embedded and passed explicitly
  through PGlite's `wasmModule` and `fsBundle` options.

- Release binaries for Linux (x64, arm64, x64-musl), macOS (x64, arm64) and
  Windows (x64), attached to each GitHub release with a `SHA256SUMS` file and,
  when a signing key is configured, a detached PGP signature per artifact.

- A CI workflow: lint, typecheck, build, unit and e2e tests across Node 20 and
  22, plus a compiled-binary smoke test and a Docker build that smoke-tests the
  image with a real Postgres handshake.

- A release workflow triggered by pushing a `v*` tag. It refuses to publish when
  the tag does not match `package.json`, and treats a version containing a
  hyphen as a prerelease, publishing it to npm under the `next` dist-tag and
  leaving the `latest` Docker tag alone.

- End-to-end tests that spawn the built CLI, wait for the port and assert a real
  Postgres SSLRequest handshake. They run from a scratch working directory so
  the repository's own `.env` and `.locci-db.json` cannot change the port or
  credentials under test.

### Changed

- Configuration merging uses [defu](https://github.com/unjs/defu) instead of a
  hand-rolled `deepMerge` and `removeUndefined`. Skipping `undefined` and
  merging by falling priority is exactly what defu does. `deepmerge` was the
  intuitive alternative and is the wrong one here: it reproduces the original
  bug.

- Linting uses [oxlint](https://oxc.rs/) instead of ESLint, which also removed
  the `@typescript-eslint/*@7` packages whose peer range broke a clean install.
  Lint time went from seconds to 0.17s, and warnings now fail the build.

- Tests run on Vitest, split into `unit` and `e2e` projects. E2E specs bind real
  ports, so they run serially with longer timeouts.

- Dependencies are managed with Bun. `package-lock.json` is replaced by
  `bun.lock`. Tests still run on Node, because the published package targets
  Node and running them under Bun would hide Node-only regressions.

- The Docker image ships the compiled binary on `distroless/cc` rather than a
  Node runtime with `node_modules`. It cross-compiles per target architecture
  instead of emulating the toolchain under QEMU. Size went from 290MB to 191MB.

- The version is generated into `src/version.ts` at build time instead of read
  from `package.json` at runtime, which does not exist inside a compiled binary.

- The Node floor is now 20. 18 is end of life, and `@types/node` moved to `^22`
  to satisfy Vitest.

[Unreleased]: https://github.com/MikeTeddyOmondi/locci-db/compare/v1.0.0-alpha-1...HEAD
[1.0.0-alpha-1]: https://github.com/MikeTeddyOmondi/locci-db/releases/tag/v1.0.0-alpha-1
