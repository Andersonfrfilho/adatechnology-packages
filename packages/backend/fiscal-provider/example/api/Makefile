PROJECT_NAME := fiscal-provider

.PHONY: all build dev clean docker-build docker-up docker-down docker-logs docker-restart

# ─── Local ────────────────────────────────────────────

all: build

build:
	pnpm run build

dev:
	pnpm run start:dev

clean:
	rm -rf dist

# ─── Docker ───────────────────────────────────────────

docker-build:
	docker compose -p $(PROJECT_NAME) build

docker-up:
	docker compose -p $(PROJECT_NAME) up -d

docker-down:
	docker compose -p $(PROJECT_NAME) down

docker-logs:
	docker compose -p $(PROJECT_NAME) logs -f

docker-restart:
	docker compose -p $(PROJECT_NAME) down && docker compose -p $(PROJECT_NAME) up -d --build
