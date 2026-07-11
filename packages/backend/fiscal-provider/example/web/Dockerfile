FROM node:22-alpine AS builder

ENV CI=true

RUN npm install -g pnpm@10

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json package.json ./
COPY packages/backend/fiscal-provider/example/web/package.json packages/backend/fiscal-provider/example/web/package.json

RUN pnpm install --frozen-lockfile

COPY packages/backend/fiscal-provider/example/web/ packages/backend/fiscal-provider/example/web/

RUN pnpm --filter=fiscal-example-frontend run build

FROM nginx:1.27-alpine

COPY --from=builder /app/packages/backend/fiscal-provider/example/web/dist /usr/share/nginx/html
COPY packages/backend/fiscal-provider/example/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
