# locci-db Backlog

Open work, roughly in priority order. Completed items move to `CHANGELOG.md`.

---

## Important

### The Docker Image Runs As Root

**Files:** `Dockerfile`

The release stage is `gcr.io/distroless/cc-debian12`, whose default user is uid
0. The README used to claim otherwise; that claim was removed rather than left
standing, but the underlying issue is unfixed.

The fix is the `:nonroot` variant, which runs as uid 65532. It is not a one line
change: `/app/data` is the mounted volume, and a named Docker volume is created
root-owned, so the server would fail its first write. Switching needs the data
directory created and chowned in the image, and a note for anyone with an
existing volume, who has to chown it once out of band.

### The arm64 Image Is Never Smoke Tested

**Files:** `.github/workflows/ci.yml`, `.github/workflows/release.yml`

CI builds and smoke tests the image on a native amd64 runner. The release builds
`linux/amd64,linux/arm64` and pushes both, but only amd64 has ever been run.

This is not hypothetical fragility. A Bun binary needs AVX, and a QEMU emulated
CPU does not expose it, so an emulated smoke test segfaults with `CPU lacks AVX
support` and proves nothing. Verifying arm64 honestly needs an arm64 runner.

### Release Binaries Are Published Unsigned

**Files:** `.github/workflows/release.yml`

The signing step is written and verifies what it signs, but it is skipped with a
warning unless `GPG_PRIVATE_KEY` and `GPG_PASSPHRASE` are set on the repository.
Until a key exists, releases ship binaries and a `SHA256SUMS` file with no
signature. `.asc` was chosen to match the convention `release-upload` already
encodes, where `.asc` maps to `application/pgp-signature`.

---

## Worth Doing

### Test Coverage Is About 10%

**Files:** `tests/`

The unit suite covers password hashing only. The e2e suite proves the server
boots and completes a handshake. Nothing exercises the paths most likely to
break in production: a failed password, `maxConnections` being reached, or a
connection from a host outside `allowedHosts`.

Config loading in particular has no test, which is notable given the release it
shipped in was broken precisely there.

### defu Concatenates Arrays

**Files:** `src/config.ts`

Nothing in the environment override block is an array today, so this is inert.
It stops being inert the moment something like `LOCCI_DB_ALLOWED_HOSTS` is
added: the environment value would append to `security.allowedHosts` from the
config file rather than replace it, quietly widening who can connect. Use
`createDefu` with a replacing array merger before adding any array-valued
environment variable.

### The PGlite Asset Paths Reach Into node_modules

**Files:** `src/bun.ts`

The WASM and data files are imported by relative path through
`../node_modules/@electric-sql/pglite/dist/`, because the package's `exports`
map does not expose them. Bun resolves this at bundle time, so it works, but it
depends on a flat install layout and on those filenames surviving a PGlite
upgrade. A PGlite version bump should re-run `bun run compile` and start the
binary, not just check that the build passes.

### `.env` Duplicates The Config File Credentials

**Files:** `.env`, `.locci-db.json`

Both carry the same username and password hash. They agree today. Nothing keeps
them agreeing, and the precedence rules mean `.env` silently wins, so a stale
copy there is an confusing failure to debug.

### `src/version.ts` Is Generated And Committed

**Files:** `scripts/gen-version.mjs`, `src/version.ts`

Committing it keeps a fresh clone building without a prior generate step, and
`prebuild` regenerates it, so the published artifact is always right. The cost
is that the committed copy can lag `package.json` in a working tree until
something runs a build. A CI check that regenerates and diffs would close it.

### Docker Compose Health Check Is Weak

**Files:** `compose.yml`

The health check opens a TCP connection with `/dev/tcp` and calls that healthy.
It runs inside the container, so it does not hit the docker-proxy false positive
that hid the bind address bug, but it still passes while Postgres itself is
unable to answer. A real check would complete the SSLRequest handshake.

### Publish Binaries To s3.locci.cloud

**Files:** `.github/workflows/release.yml`

The suite has `release-upload` for exactly this, uploading to
`s3://locci-cloud/<service>/releases/<version>/` with multipart streaming and
skip-if-unchanged behaviour. Release binaries currently only land on the GitHub
release. Wiring the uploader in would put them where the rest of the suite's
artifacts live.
