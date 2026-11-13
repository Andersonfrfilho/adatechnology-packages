.PHONY: dev start build test docker-build docker-run clean

dev:
	bun run dev

start:
	bun run src/main.ts

build:
	bun install
	bun run build

test:
	bun run src/main.ts

docker-build:
	docker build -t adatechnology-bun-app .

docker-run:
	docker run --rm adatechnology-bun-app

clean:
	rm -rf node_modules
