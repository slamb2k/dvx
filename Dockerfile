# Stage 1: Dependencies
FROM node:18-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.31.0 --activate
# Native addon build tools for better-sqlite3
RUN apk add --no-cache python3 make g++
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM deps AS build
COPY . .
RUN pnpm build

# Stage 3: Test (used in CI, not in final image)
FROM build AS test
RUN pnpm test

# Stage 4: Production
FROM node:18-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@10.31.0 --activate
# Runtime native addon support
RUN apk add --no-cache libstdc++
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
# Schema cache directory
RUN mkdir -p /app/.dvx && chown appuser:appgroup /app/.dvx
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js", "mcp", "--transport", "http", "--port", "3000"]
