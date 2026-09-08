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
and pushes `linux/amd64,linux/arm64`, and as of v1.0.0-alpha-1 the arm64 half is
confirmed to build and push. It has still never been executed.

This is not hypothetical fragility. A Bun binary needs AVX, and a QEMU emulated
CPU does not expose it, so an emulated smoke test segfaults with `CPU lacks AVX
support` and proves nothing. Verifying arm64 honestly needs an arm64 runner.

### npm `latest` Points At A Prerelease

**Files:** `.github/workflows/release.yml`

The release workflow publishes a hyphenated version under the `next` dist-tag
and deliberately leaves the `latest` Docker tag alone. npm does not play along:
it points `latest` at the first version ever published, whatever `--tag` says.
So `1.0.0-alpha-1` is both `next` and `latest`, and a plain
`npm install @locci/db` installs the alpha.

Nothing can be done while a prerelease is the only version on the registry,
because `latest` has to point somewhere. The fix belongs to the first stable
release, and is easy to forget precisely because the workflow looks correct:

```
npm dist-tag add @locci/db@1.0.0 latest
```

Worth adding as a step in the release workflow, guarded on the version not being
a prerelease, rather than leaving it as folklore.

### The GHCR Package May Be Private

**Files:** `.github/workflows/release.yml`

The release pushes to Docker Hub and `ghcr.io/miketeddyomondi/locci-db`. The
push succeeded, but an anonymous `docker manifest inspect` against GHCR returns
`unauthorized`, which is what a private package looks like. GHCR creates new
packages private by default, and nothing in the workflow changes that.

Docker Hub is confirmed public and working, so this is not blocking. Confirm the
GHCR package's visibility in the repository's package settings and make it
public if it is meant to be a real distribution channel, otherwise drop it from
the workflow rather than publishing to a registry nobody can pull from.

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
