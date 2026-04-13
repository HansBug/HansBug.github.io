HOST ?= 127.0.0.1
PORT ?= 4321

.PHONY: dev start build preview check clean install

install:
	npm install

dev:
	npm run dev -- --host $(HOST) --port $(PORT)

start: dev

build:
	npm run build

preview:
	npm run preview -- --host $(HOST) --port $(PORT)

check:
	npm run check

clean:
	rm -rf dist .astro
