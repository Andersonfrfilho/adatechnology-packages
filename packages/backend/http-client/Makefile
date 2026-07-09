.PHONY: build test docker-build docker-run clean

build:
	bun install
	bun run build

test:
	bun run examples/basic.ts

docker-build:
	docker build -t adatechnology-http-client .

docker-run:
	docker run --rm adatechnology-http-client

clean:
	rm -rf dist node_modules
