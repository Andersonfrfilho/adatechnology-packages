FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json tsup.config.ts ./
COPY src ./src
RUN bun install
RUN bun run build

FROM oven/bun:1-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
CMD ["bun", "run", "examples/basic.ts"]
