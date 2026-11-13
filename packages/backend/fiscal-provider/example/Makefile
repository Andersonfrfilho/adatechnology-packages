PROJECT_NAME := fiscal-provider

.PHONY: all build up down logs restart clean

all: up

build:
	docker compose -p $(PROJECT_NAME) build

up:
	docker compose -p $(PROJECT_NAME) up -d --build

down:
	docker compose -p $(PROJECT_NAME) down

logs:
	docker compose -p $(PROJECT_NAME) logs -f

restart:
	docker compose -p $(PROJECT_NAME) down && docker compose -p $(PROJECT_NAME) up -d --build

clean:
	docker compose -p $(PROJECT_NAME) down -v --rmi local
