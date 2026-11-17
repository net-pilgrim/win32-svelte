# ==============================================================================
# Makefile: Starter MFC Application for win32-svelte
# ==============================================================================

NODE ?= node
NPX  ?= npx

.PHONY: all test check dev run build clean help

all: test check

test:
	@echo "Running MFC Architecture and Starter App Tests..."
	$(NPX) tsx -r ../../src/test_setup.cjs ../../src/win32/__tests__/mfc.test.ts

check:
	@echo "Typechecking MFC Starter application..."
	$(NPX) svelte-check --tsconfig ../../tsconfig.app.json
	$(NPX) tsc -p ../../tsconfig.node.json

dev: run

run:
	@echo "Starting local Vite development server..."
	npm run dev

build:
	@echo "Building production bundle..."
	npm run build

clean:
	@echo "MFC Starter is clean."

help:
	@echo "Starter MFC Application Build & Test"
	@echo "===================================="
	@echo "Targets:"
	@echo "  make              - Run tests and static typechecks"
	@echo "  make test         - Run dedicated MFC test suite"
	@echo "  make check        - Run svelte-check & tsc typechecker"
	@echo "  make run / dev    - Launch local Vite development server"
	@echo "  make build        - Compile production distribution"
	@echo "  make clean        - Clean build artifacts"
	@echo "  make help         - Display this help message"
