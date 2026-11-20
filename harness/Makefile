# ==============================================================================
# Petzold "Programming Windows (5th Edition)" WASM Test Harness Makefile
# ==============================================================================

ZIG ?= $(shell which zig 2>/dev/null)
ifeq ($(ZIG),)
  $(error "zig compiler not found in PATH. Please install Zig 0.13.0+")
endif

CC := $(ZIG) cc
TARGET ?= wasm32-freestanding

ROOT_DIR := $(abspath ..)
INCLUDE_DIR := $(ROOT_DIR)/include
HARNESS_DIR := $(abspath .)
BUILD_DIR := $(HARNESS_DIR)/build

CFLAGS ?= -target $(TARGET) -nostdlib -I$(INCLUDE_DIR) -Wno-missing-braces -Wno-nonportable-include-path -Wno-macro-redefined -O2 -Wall
LDFLAGS ?= -Wl,--no-entry -Wl,--export=WinMain -Wl,--export-table

# --- Chapter 01 ---
CHAP01_SRC := src/Chap01/HelloMsg/HelloMsg.c
CHAP01_BIN := $(BUILD_DIR)/Chap01/HelloMsg.wasm

# --- Chapter 02 ---
CHAP02_SRC := src/Chap02/ScrnSize/ScrnSize.c
CHAP02_BIN := $(BUILD_DIR)/Chap02/ScrnSize.wasm

# --- Chapter 03 ---
CHAP03_SRC := src/Chap03/HelloWin/HelloWin.c
CHAP03_BIN := $(BUILD_DIR)/Chap03/HelloWin.wasm

# --- Chapter 04 ---
CHAP04_BINS := $(BUILD_DIR)/Chap04/SysMets1/SysMets1.wasm $(BUILD_DIR)/Chap04/SysMets2/SysMets2.wasm $(BUILD_DIR)/Chap04/SysMets3/SysMets3.wasm

# --- Chapter 05 ---
CHAP05_BINS := \
	$(BUILD_DIR)/Chap05/AltWind/AltWind.wasm \
	$(BUILD_DIR)/Chap05/Bezier/Bezier.wasm \
	$(BUILD_DIR)/Chap05/Clover/Clover.wasm \
	$(BUILD_DIR)/Chap05/DevCaps1/DevCaps1.wasm \
	$(BUILD_DIR)/Chap05/LineDemo/LineDemo.wasm \
	$(BUILD_DIR)/Chap05/RandRect/RandRect.wasm \
	$(BUILD_DIR)/Chap05/SineWave/SineWave.wasm \
	$(BUILD_DIR)/Chap05/WhatSize/WhatSize.wasm

.PHONY: all clean help scan chap01 chap02 chap03 chap04 chap05

all: chap01 chap02 chap03 chap04 chap05

scan:
	python3 scan_chapters.py

$(BUILD_DIR)/%.wasm: src/%.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -I$(dir $<) $< $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

# Target shortcuts
chap01: $(BUILD_DIR)/Chap01/HelloMsg/HelloMsg.wasm
chap02: $(BUILD_DIR)/Chap02/ScrnSize/ScrnSize.wasm
chap03: $(BUILD_DIR)/Chap03/HelloWin/HelloWin.wasm
chap04: $(CHAP04_BINS)
chap05: $(CHAP05_BINS)

clean:
	rm -rf $(BUILD_DIR)
	@echo "Cleaned harness build artifacts."

help:
	@echo "Petzold Win32 WASM Harness"
	@echo "=========================="
	@echo "Usage:"
	@echo "  make chap01   - Compile Chapter 01 (HelloMsg)"
	@echo "  make chap02   - Compile Chapter 02 (ScrnSize)"
	@echo "  make chap03   - Compile Chapter 03 (HelloWin)"
	@echo "  make clean    - Remove build artifacts"
