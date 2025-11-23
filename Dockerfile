# Build stage
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (dev + prod)
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Remove devDependencies (so final image stays clean)
RUN npm prune --production && npm cache clean --force

# Release stage
FROM gcr.io/distroless/nodejs22-debian12

WORKDIR /app

# Copy production node_modules
COPY --from=builder /app/node_modules ./node_modules/

# Copy compiled code
COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/bin ./bin/
COPY --from=builder /app/package.json ./

# Expose PostgreSQL port
EXPOSE 5432

# Run the CLI
CMD ["./bin/locci-db.js", "start"]
