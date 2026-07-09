FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json ./
COPY src ./src
RUN bun install
RUN bun run build

FROM oven/bun:1-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY src ./src
EXPOSE 3000
CMD ["bun", "run", "src/main.ts"]
