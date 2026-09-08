# syntax=docker/dockerfile:1

# Build stage: compile a single-file binary with Bun.
# Pinned to the build platform and cross-compiled to the target, so building a
# multi-arch image does not pay for QEMU emulation of the whole toolchain.
FROM --platform=$BUILDPLATFORM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

ARG TARGETARCH
RUN case "$TARGETARCH" in \
      amd64) BUN_TARGET=bun-linux-x64 ;; \
      arm64) BUN_TARGET=bun-linux-arm64 ;; \
      *) echo "unsupported TARGETARCH: $TARGETARCH" >&2; exit 1 ;; \
    esac && \
    bun run scripts/gen-version.mjs && \
    bun build ./src/bun.ts \
      --compile --minify \
      --target="$BUN_TARGET" \
      --outfile /tmp/locci-db

# Release stage: no Node, no Bun, no node_modules. The binary carries its own
# runtime and the embedded PGlite WASM. distroless/cc supplies the glibc and
# libstdc++ that a Bun executable links against.
FROM gcr.io/distroless/cc-debian12

LABEL org.opencontainers.image.source="https://github.com/MikeTeddyOmondi/locci-db" \
      org.opencontainers.image.description="Lightweight PostgreSQL-compatible database server powered by PGlite" \
      org.opencontainers.image.licenses="MIT"

COPY --from=builder /tmp/locci-db /usr/local/bin/locci-db

# Container defaults. Binding to 127.0.0.1 (the app default) would make a
# published port unreachable, and the data dir must match the mounted volume.
ENV LOCCI_DB_HOST=0.0.0.0 \
    LOCCI_DB_PORT=5432 \
    LOCCI_DB_DATA_DIR=/app/data

EXPOSE 5432

ENTRYPOINT ["/usr/local/bin/locci-db"]
CMD ["start"]
