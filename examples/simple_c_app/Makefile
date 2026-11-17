# ==============================================================================
# Makefile: Simple Win32 C WebAssembly Application for win32-svelte
# ==============================================================================

# Compiler detection: prefer zig cc, fallback to clang
ZIG := $(shell which zig 2>/dev/null)
CLANG := $(shell which clang 2>/dev/null)

ifeq ($(origin CC),default)
  ifneq ($(ZIG),)
    CC := zig cc
    TARGET ?= wasm32-freestanding
  else ifneq ($(CLANG),)
    CC := clang
    TARGET ?= wasm32-unknown-unknown
  else
    CC := zig cc
    TARGET ?= wasm32-freestanding
  endif
else
  TARGET ?= wasm32-freestanding
endif

INCLUDE_DIR ?= ../../include
CFLAGS ?= -target $(TARGET) -nostdlib -I$(INCLUDE_DIR) -O2 -Wall
LDFLAGS ?= -Wl,--no-entry -Wl,--export=WinMain -Wl,--export-table

OUTPUT = simple_app.wasm
SOURCES = main.c

.PHONY: all build clean copy-to-public help

all: build

build: $(OUTPUT)

$(OUTPUT): $(SOURCES)
	$(CC) $(CFLAGS) $(SOURCES) $(LDFLAGS) -o $@
	@echo "Built $(OUTPUT) successfully!"
	@ls -lh $(OUTPUT)

copy-to-public: $(OUTPUT)
	@mkdir -p ../../public/wasm
	cp $(OUTPUT) ../../public/wasm/
	cp $(SOURCES) ../../public/wasm/
	@echo "Copied $(OUTPUT) and $(SOURCES) to public/wasm/"

clean:
	rm -f $(OUTPUT)
	@echo "Cleaned build artifacts."

help:
	@echo "Win32-Svelte WebAssembly C Application Build"
	@echo "============================================="
	@echo "Targets:"
	@echo "  make              - Compile $(OUTPUT)"
	@echo "  make clean        - Remove generated binaries"
	@echo "  make copy-to-public - Copy binary and source to public/wasm/"
	@echo "  make help         - Display this help message"
	@echo ""
	@echo "Active Compiler : $(CC)"
	@echo "Target Arch     : $(TARGET)"
	@echo "Include Dir     : $(INCLUDE_DIR)"
