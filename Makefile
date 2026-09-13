VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS  = -s -w -X main.version=$(VERSION)
BIN      = bin/agentconf

.PHONY: all web build run dev scan doctor test clean landing screenshots

all: web build

web:
	cd app/web && npm install --no-fund --no-audit && npm run build

build:
	CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS)" -o $(BIN) ./app/cmd/agentconf

run: build
	./$(BIN)

dev:
	cd app/web && npm run dev

scan: build
	./$(BIN) scan --pretty

doctor: build
	./$(BIN) doctor

test:
	go vet ./... && go test ./...

screenshots: build
	cd landing && npm install --no-fund --no-audit && node screenshots.mjs

clean:
	rm -rf bin app/web/dist
