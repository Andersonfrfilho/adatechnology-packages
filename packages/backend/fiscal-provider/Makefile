.PHONY: all build build-lib build-example dev api web test clean

all: build

build-lib:
	pnpm run build

build-example:
	pnpm --filter=fiscal-example run build
	pnpm --filter=fiscal-example-frontend run build

build: build-lib build-example

dev:
	pnpm --filter=fiscal-example run start:dev & pnpm --filter=fiscal-example-frontend run dev & wait

api:
	pnpm --filter=fiscal-example run start:dev

web:
	pnpm --filter=fiscal-example-frontend run dev

test:
	pnpm run test

clean:
	rm -rf dist
	rm -rf example/api/dist
	rm -rf example/web/dist
