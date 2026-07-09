.PHONY: all build api web dev clean

all: build

build:
	pnpm run build:fiscal-all

api:
	pnpm run dev:fiscal-api

web:
	pnpm run dev:fiscal-web

dev:
	pnpm run dev:fiscal

clean:
	rm -rf packages/backend/fiscal-example/dist
	rm -rf packages/frontend/fiscal-example/dist
