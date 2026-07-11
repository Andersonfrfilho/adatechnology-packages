FROM node:22-alpine AS builder

RUN npm install -g pnpm@10

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json package.json ./
COPY packages/backend/shared/package.json packages/backend/shared/package.json
COPY packages/backend/nestjs-logger/package.json packages/backend/nestjs-logger/package.json
COPY packages/backend/fiscal-provider/package.json packages/backend/fiscal-provider/package.json
COPY packages/backend/fiscal-provider/example/api/package.json packages/backend/fiscal-provider/example/api/package.json

RUN pnpm install --frozen-lockfile

COPY packages/backend/shared/ packages/backend/shared/
COPY packages/backend/nestjs-logger/ packages/backend/nestjs-logger/
COPY packages/backend/fiscal-provider/ packages/backend/fiscal-provider/

RUN pnpm run build:libs
RUN pnpm --filter=fiscal-example run build

FROM node:22-alpine

ENV CI=true

RUN npm install -g pnpm@10

WORKDIR /app

COPY --from=builder /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/tsconfig.base.json /app/package.json ./

COPY --from=builder /app/packages/backend/shared/package.json /app/packages/backend/shared/package.json
COPY --from=builder /app/packages/backend/nestjs-logger/package.json /app/packages/backend/nestjs-logger/package.json
COPY --from=builder /app/packages/backend/fiscal-provider/package.json /app/packages/backend/fiscal-provider/package.json
COPY --from=builder /app/packages/backend/fiscal-provider/example/api/package.json /app/packages/backend/fiscal-provider/example/api/package.json

COPY --from=builder /app/packages/backend/shared/dist /app/packages/backend/shared/dist
COPY --from=builder /app/packages/backend/nestjs-logger/dist /app/packages/backend/nestjs-logger/dist
COPY --from=builder /app/packages/backend/fiscal-provider/dist /app/packages/backend/fiscal-provider/dist
COPY --from=builder /app/packages/backend/fiscal-provider/example/api/dist /app/packages/backend/fiscal-provider/example/api/dist
COPY --from=builder /app/packages/backend/fiscal-provider/example/api/node_modules /app/packages/backend/fiscal-provider/example/api/node_modules
COPY --from=builder /app/node_modules /app/node_modules

RUN pnpm install --frozen-lockfile --prod --ignore-scripts

WORKDIR /app/packages/backend/fiscal-provider/example/api

EXPOSE 3333

CMD ["node", "dist/main.js"]
