# cc-route-proxy Docker image
# Multi-stage build for minimal image size

# ── Stage 1: Build ──
FROM oven/bun:1-slim AS builder

WORKDIR /app
COPY proxy/package.json proxy/package-lock.json* ./
RUN bun install --frozen-lockfile || bun install

COPY proxy/tsconfig.json ./
COPY proxy/src ./src
RUN bun run build

# ── Stage 2: Runtime ──
FROM oven/bun:1-distroless

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY proxy/package.json ./

ENV NODE_ENV=production
ENV CC_ROUTE_PORT=3456
ENV CC_ROUTE_HOST=0.0.0.0

EXPOSE 3456

ENTRYPOINT ["bun", "run", "dist/index.js"]
