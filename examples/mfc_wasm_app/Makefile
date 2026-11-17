# ==============================================================================
# Makefile: C++ MFC WebAssembly Application for win32-svelte
# ==============================================================================

# Compiler detection: prefer zig c++, fallback to clang++
ZIG := $(shell which zig 2>/dev/null)
CLANGPP := $(shell which clang++ 2>/dev/null)

ifeq ($(origin CXX),default)
  ifneq ($(ZIG),)
    CXX := zig c++
    TARGET ?= wasm32-freestanding
  else ifneq ($(CLANGPP),)
    CXX := clang++
    TARGET ?= wasm32-unknown-unknown
  else
    CXX := zig c++
    TARGET ?= wasm32-freestanding
  endif
else
  TARGET ?= wasm32-freestanding
endif

INCLUDE_DIR ?= ../../include
CXXFLAGS ?= -target $(TARGET) -nostdlib -fno-exceptions -fno-rtti -I$(INCLUDE_DIR) -O2 -Wall
LDFLAGS ?= -Wl,--no-entry -Wl,--export=WinMain -Wl,--export-table

OUTPUT = mfc_app.wasm
SOURCES = main.cpp

.PHONY: all build clean copy-to-public help

all: build

build: $(OUTPUT)

$(OUTPUT): $(SOURCES) $(INCLUDE_DIR)/afxwin.h
	$(CXX) $(CXXFLAGS) $(SOURCES) $(LDFLAGS) -o $@
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
	@echo "Win32-Svelte C++ MFC WebAssembly Build"
	@echo "======================================"
	@echo "Targets:"
	@echo "  make              - Compile $(OUTPUT)"
	@echo "  make clean        - Remove generated binaries"
	@echo "  make copy-to-public - Copy binary and source to public/wasm/"
	@echo "  make help         - Display this help message"
	@echo ""
	@echo "Active C++ Compiler : $(CXX)"
	@echo "Target Arch         : $(TARGET)"
	@echo "Include Dir         : $(INCLUDE_DIR)"
