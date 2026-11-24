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

CFLAGS ?= -target $(TARGET) -nostdlib -I$(INCLUDE_DIR) -fms-extensions -Wno-missing-braces -Wno-nonportable-include-path -Wno-macro-redefined -Wno-implicit-int -Wno-unused-but-set-variable -Wno-incompatible-pointer-types -Wno-pointer-bool-conversion -Wno-parentheses -Wno-absolute-value -O2 -Wall
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

# --- Chapter 06 ---
CHAP06_BINS := \
	$(BUILD_DIR)/Chap06/KeyView1/KeyView1.wasm \
	$(BUILD_DIR)/Chap06/KeyView2/KeyView2.wasm \
	$(BUILD_DIR)/Chap06/StokFont/StokFont.wasm \
	$(BUILD_DIR)/Chap06/SysMets4/SysMets4.wasm \
	$(BUILD_DIR)/Chap06/Typer/Typer.wasm

# --- Chapter 07 ---
CHAP07_BINS := \
	$(BUILD_DIR)/Chap07/BlokOut1/BlokOut1.wasm \
	$(BUILD_DIR)/Chap07/BlokOut2/BlokOut2.wasm \
	$(BUILD_DIR)/Chap07/Checker1/Checker1.wasm \
	$(BUILD_DIR)/Chap07/Checker2/Checker2.wasm \
	$(BUILD_DIR)/Chap07/Checker3/Checker3.wasm \
	$(BUILD_DIR)/Chap07/Checker4/Checker4.wasm \
	$(BUILD_DIR)/Chap07/Connect/Connect.wasm \
	$(BUILD_DIR)/Chap07/SysMets/SysMets.wasm

# --- Chapter 08 ---
CHAP08_BINS := \
	$(BUILD_DIR)/Chap08/Beeper1/Beeper1.wasm \
	$(BUILD_DIR)/Chap08/Beeper2/Beeper2.wasm \
	$(BUILD_DIR)/Chap08/Clock/Clock.wasm \
	$(BUILD_DIR)/Chap08/DigClock/DigClock.wasm \
	$(BUILD_DIR)/Chap08/WhatClr/WhatClr.wasm

# --- Chapter 09 ---
CHAP09_BINS := \
	$(BUILD_DIR)/Chap09/BtnLook/BtnLook.wasm \
	$(BUILD_DIR)/Chap09/Colors1/Colors1.wasm \
	$(BUILD_DIR)/Chap09/Environ/Environ.wasm \
	$(BUILD_DIR)/Chap09/OwnDraw/OwnDraw.wasm \
	$(BUILD_DIR)/Chap09/PopPad1/PopPad1.wasm \
	$(BUILD_DIR)/Chap09/head/head.wasm

# --- Chapter 10 ---
CHAP10_BINS := \
	$(BUILD_DIR)/Chap10/IconDemo/IconDemo.wasm \
	$(BUILD_DIR)/Chap10/MenuDemo/MenuDemo.wasm \
	$(BUILD_DIR)/Chap10/NoPopups/NoPopups.wasm \
	$(BUILD_DIR)/Chap10/PoePoem/PoePoem.wasm \
	$(BUILD_DIR)/Chap10/PoorMenu/PoorMenu.wasm \
	$(BUILD_DIR)/Chap10/PopMenu/PopMenu.wasm \
	$(BUILD_DIR)/Chap10/PopPad2/PopPad2.wasm

# --- Chapter 11 ---
CHAP11_POPPAD3_SRCS := \
	src/Chap11/PopPad3/PopFile.c \
	src/Chap11/PopPad3/PopFind.c \
	src/Chap11/PopPad3/PopFont.c \
	src/Chap11/PopPad3/PopPad.c \
	src/Chap11/PopPad3/PopPrnt0.c

CHAP11_BINS := \
	$(BUILD_DIR)/Chap11/About1/About1.wasm \
	$(BUILD_DIR)/Chap11/About2/About2.wasm \
	$(BUILD_DIR)/Chap11/About3/About3.wasm \
	$(BUILD_DIR)/Chap11/Colors2/Colors2.wasm \
	$(BUILD_DIR)/Chap11/Colors3/Colors3.wasm \
	$(BUILD_DIR)/Chap11/HexCalc/HexCalc.wasm \
	$(BUILD_DIR)/Chap11/PopPad3/PopPad3.wasm

# --- Chapter 12 ---
CHAP12_BINS := \
	$(BUILD_DIR)/Chap12/ClipText/ClipText.wasm \
	$(BUILD_DIR)/Chap12/ClipView/ClipView.wasm

# --- Chapter 13 ---
CHAP13_PRINT1_SRCS := \
	src/Chap13/Print1/Print1.c \
	src/Chap13/Print1/Print.c \
	src/Chap13/Print1/GetPrnDC.c

CHAP13_PRINT2_SRCS := \
	src/Chap13/Print2/Print2.c \
	src/Chap13/Print1/Print.c \
	src/Chap13/Print1/GetPrnDC.c

CHAP13_PRINT3_SRCS := \
	src/Chap13/Print3/Print3.c \
	src/Chap13/Print1/Print.c \
	src/Chap13/Print1/GetPrnDC.c

CHAP13_FORMFEED_SRCS := \
	src/Chap13/FormFeed/FormFeed.c \
	src/Chap13/Print1/GetPrnDC.c

CHAP13_POPPAD_SRCS := \
	src/Chap13/PopPad/PopFile.c \
	src/Chap13/PopPad/PopFind.c \
	src/Chap13/PopPad/PopFont.c \
	src/Chap13/PopPad/PopPad.c \
	src/Chap13/PopPad/PopPrnt.c

CHAP13_BINS := \
	$(BUILD_DIR)/Chap13/DevCaps2/DevCaps2.wasm \
	$(BUILD_DIR)/Chap13/FormFeed/FormFeed.wasm \
	$(BUILD_DIR)/Chap13/Print1/Print1.wasm \
	$(BUILD_DIR)/Chap13/Print2/Print2.wasm \
	$(BUILD_DIR)/Chap13/Print3/Print3.wasm \
	$(BUILD_DIR)/Chap13/PopPad/PopPad.wasm

# --- Chapter 14 ---
CHAP14_BINS := \
	$(BUILD_DIR)/Chap14/BitBlt/BitBlt.wasm \
	$(BUILD_DIR)/Chap14/BitMask/BitMask.wasm \
	$(BUILD_DIR)/Chap14/Blowup/Blowup.wasm \
	$(BUILD_DIR)/Chap14/Bounce/Bounce.wasm \
	$(BUILD_DIR)/Chap14/Bricks1/Bricks1.wasm \
	$(BUILD_DIR)/Chap14/Bricks2/Bricks2.wasm \
	$(BUILD_DIR)/Chap14/Bricks3/Bricks3.wasm \
	$(BUILD_DIR)/Chap14/GrafMenu/GrafMenu.wasm \
	$(BUILD_DIR)/Chap14/HelloBit/HelloBit.wasm \
	$(BUILD_DIR)/Chap14/Scramble/Scramble.wasm \
	$(BUILD_DIR)/Chap14/Sketch/Sketch.wasm \
	$(BUILD_DIR)/Chap14/Stretch/Stretch.wasm

CHAP15_BINS = \
	$(BUILD_DIR)/Chap15/Apollo11/Apollo11.wasm \
	$(BUILD_DIR)/Chap15/DibConv/DibConv.wasm \
	$(BUILD_DIR)/Chap15/DibHeads/DibHeads.wasm \
	$(BUILD_DIR)/Chap15/DibSect/DibSect.wasm \
	$(BUILD_DIR)/Chap15/SeqDisp/SeqDisp.wasm \
	$(BUILD_DIR)/Chap15/ShowDib1/ShowDib1.wasm \
	$(BUILD_DIR)/Chap15/ShowDib2/ShowDib2.wasm

CHAP16_BINS = \
	$(BUILD_DIR)/Chap16/AllColor/AllColor.wasm \
	$(BUILD_DIR)/Chap16/Bounce/Bounce.wasm \
	$(BUILD_DIR)/Chap16/Dibble/Dibble.wasm \
	$(BUILD_DIR)/Chap16/Fader/Fader.wasm \
	$(BUILD_DIR)/Chap16/Grays1/Grays1.wasm \
	$(BUILD_DIR)/Chap16/Grays2/Grays2.wasm \
	$(BUILD_DIR)/Chap16/Grays3/Grays3.wasm \
	$(BUILD_DIR)/Chap16/Pipes/Pipes.wasm \
	$(BUILD_DIR)/Chap16/ShowDib3/ShowDib3.wasm \
	$(BUILD_DIR)/Chap16/ShowDib4/ShowDib4.wasm \
	$(BUILD_DIR)/Chap16/ShowDib5/ShowDib5.wasm \
	$(BUILD_DIR)/Chap16/ShowDib6/ShowDib6.wasm \
	$(BUILD_DIR)/Chap16/ShowDib7/ShowDib7.wasm \
	$(BUILD_DIR)/Chap16/ShowDib8/ShowDib8.wasm \
	$(BUILD_DIR)/Chap16/SysPal1/SysPal1.wasm \
	$(BUILD_DIR)/Chap16/SysPal2/SysPal2.wasm \
	$(BUILD_DIR)/Chap16/SysPal3/SysPal3.wasm \
	$(BUILD_DIR)/Chap16/Tunnel/Tunnel.wasm

CHAP17_BINS = \
	$(BUILD_DIR)/Chap17/ChosFont/ChosFont.wasm \
	$(BUILD_DIR)/Chap17/EZTest/EZTest.wasm \
	$(BUILD_DIR)/Chap17/EndJoin/EndJoin.wasm \
	$(BUILD_DIR)/Chap17/FontClip/FontClip.wasm \
	$(BUILD_DIR)/Chap17/FontFill/FontFill.wasm \
	$(BUILD_DIR)/Chap17/FontOut1/FontOut1.wasm \
	$(BUILD_DIR)/Chap17/FontOut2/FontOut2.wasm \
	$(BUILD_DIR)/Chap17/FontRot/FontRot.wasm \
	$(BUILD_DIR)/Chap17/Justify1/Justify1.wasm \
	$(BUILD_DIR)/Chap17/Justify2/Justify2.wasm \
	$(BUILD_DIR)/Chap17/PickFont/PickFont.wasm \
	$(BUILD_DIR)/Chap17/UniChars/UniChars.wasm

CHAP18_BINS = \
	$(BUILD_DIR)/Chap18/Metafile/Metafile.wasm \
	$(BUILD_DIR)/Chap18/Emf1/Emf1.wasm \
	$(BUILD_DIR)/Chap18/Emf2/Emf2.wasm \
	$(BUILD_DIR)/Chap18/Emf3/Emf3.wasm \
	$(BUILD_DIR)/Chap18/Emf4/Emf4.wasm \
	$(BUILD_DIR)/Chap18/Emf5/Emf5.wasm \
	$(BUILD_DIR)/Chap18/Emf6/Emf6.wasm \
	$(BUILD_DIR)/Chap18/Emf7/Emf7.wasm \
	$(BUILD_DIR)/Chap18/Emf8/Emf8.wasm \
	$(BUILD_DIR)/Chap18/Emf9/Emf9.wasm \
	$(BUILD_DIR)/Chap18/Emf10/Emf10.wasm \
	$(BUILD_DIR)/Chap18/Emf11/Emf11.wasm \
	$(BUILD_DIR)/Chap18/Emf12/Emf12.wasm \
	$(BUILD_DIR)/Chap18/Emf13/Emf13.wasm \
	$(BUILD_DIR)/Chap18/EmfView/EmfView.wasm

CHAP19_BINS = \
	$(BUILD_DIR)/Chap19/MDIDemo/MDIDemo.wasm

.PHONY: all clean help scan chap01 chap02 chap03 chap04 chap05 chap06 chap07 chap08 chap09 chap10 chap11 chap12 chap13 chap14 chap15 chap16 chap17 chap18 chap19

all: chap01 chap02 chap03 chap04 chap05 chap06 chap07 chap08 chap09 chap10 chap11 chap12 chap13 chap14 chap15 chap16 chap17 chap18 chap19

scan:
	python3 scan_chapters.py

$(BUILD_DIR)/Chap11/PopPad3/PopPad3.wasm: $(CHAP11_POPPAD3_SRCS)
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap11/PopPad3 $(CHAP11_POPPAD3_SRCS) $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap13/FormFeed/FormFeed.wasm: $(CHAP13_FORMFEED_SRCS)
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap13/FormFeed -Isrc/Chap13/Print1 $(CHAP13_FORMFEED_SRCS) $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap13/Print1/Print1.wasm: $(CHAP13_PRINT1_SRCS)
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap13/Print1 $(CHAP13_PRINT1_SRCS) $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap13/Print2/Print2.wasm: $(CHAP13_PRINT2_SRCS)
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap13/Print2 -Isrc/Chap13/Print1 $(CHAP13_PRINT2_SRCS) $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap13/Print3/Print3.wasm: $(CHAP13_PRINT3_SRCS)
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap13/Print3 -Isrc/Chap13/Print1 $(CHAP13_PRINT3_SRCS) $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap13/PopPad/PopPad.wasm: $(CHAP13_POPPAD_SRCS)
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap13/PopPad $(CHAP13_POPPAD_SRCS) $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap14/Bricks3/Bricks3.wasm: src/Chap14/Bricks3/BRICKS3.C
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap14/Bricks3 $< $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap15/Apollo11/Apollo11.wasm: src/Chap15/Apollo11/Apollo11.c src/Chap15/ShowDib1/DibFile.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap15/Apollo11 -Isrc/Chap15/ShowDib1 $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap15/ShowDib1/ShowDib1.wasm: src/Chap15/ShowDib1/ShowDib1.c src/Chap15/ShowDib1/DibFile.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap15/ShowDib1 $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap15/ShowDib2/ShowDib2.wasm: src/Chap15/ShowDib2/Showdib2.c src/Chap15/ShowDib2/DibFile.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap15/ShowDib2 $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap16/AllColor/AllColor.wasm: src/Chap16/AllColor/AllColor.c src/Chap16/Bounce/PalAnim.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap16/AllColor -Isrc/Chap16/Bounce $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap16/Bounce/Bounce.wasm: src/Chap16/Bounce/Bounce.c src/Chap16/Bounce/PalAnim.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap16/Bounce $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap16/Dibble/Dibble.wasm: src/Chap16/Dibble/Dibble.c src/Chap16/Dibble/DibConv.c src/Chap16/Dibble/DibHelp.c src/Chap16/Dibble/DibPal.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap16/Dibble $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap16/Fader/Fader.wasm: src/Chap16/Fader/Fader.c src/Chap16/Bounce/PalAnim.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap16/Fader -Isrc/Chap16/Bounce $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap16/Pipes/Pipes.wasm: src/Chap16/Pipes/Pipes.c src/Chap16/Bounce/PalAnim.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap16/Pipes -Isrc/Chap16/Bounce $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap16/ShowDib3/ShowDib3.wasm: src/Chap16/ShowDib3/ShowDib3.c src/Chap16/ShowDib3/PackeDib.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap16/ShowDib3 $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap16/ShowDib4/ShowDib4.wasm: src/Chap16/ShowDib4/ShowDib4.c src/Chap16/ShowDib3/PackeDib.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap16/ShowDib4 -Isrc/Chap16/ShowDib3 $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap16/ShowDib5/ShowDib5.wasm: src/Chap16/ShowDib5/ShowDib5.c src/Chap16/ShowDib3/PackeDib.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap16/ShowDib5 -Isrc/Chap16/ShowDib3 $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap16/ShowDib6/ShowDib6.wasm: src/Chap16/ShowDib6/ShowDib6.c src/Chap16/ShowDib3/PackeDib.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap16/ShowDib6 -Isrc/Chap16/ShowDib3 $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap16/ShowDib7/ShowDib7.wasm: src/Chap16/ShowDib7/ShowDib7.c src/Chap16/ShowDib3/PackeDib.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap16/ShowDib7 -Isrc/Chap16/ShowDib3 $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap16/ShowDib8/ShowDib8.wasm: src/Chap16/ShowDib8/ShowDib8.c src/Chap16/ShowDib3/PackeDib.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap16/ShowDib8 -Isrc/Chap16/ShowDib3 $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap16/Tunnel/Tunnel.wasm: src/Chap16/Tunnel/Tunnel.c src/Chap16/Bounce/PalAnim.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap16/Tunnel -Isrc/Chap16/Bounce $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap17/EZTest/EZTest.wasm: src/Chap17/EZTest/EZTest.c src/Chap17/EZTest/EZFont.c src/Chap17/EZTest/FontDemo.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap17/EZTest $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap17/FontClip/FontClip.wasm: src/Chap17/FontClip/FontClip.c src/Chap17/EZTest/EZFont.c src/Chap17/EZTest/FontDemo.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap17/FontClip -Isrc/Chap17/EZTest $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap17/FontFill/FontFill.wasm: src/Chap17/FontFill/FontFill.c src/Chap17/EZTest/EZFont.c src/Chap17/EZTest/FontDemo.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap17/FontFill -Isrc/Chap17/EZTest $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap17/FontOut1/FontOut1.wasm: src/Chap17/FontOut1/FontOut1.c src/Chap17/EZTest/EZFont.c src/Chap17/EZTest/FontDemo.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap17/FontOut1 -Isrc/Chap17/EZTest $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap17/FontOut2/FontOut2.wasm: src/Chap17/FontOut2/FontOut2.c src/Chap17/EZTest/EZFont.c src/Chap17/EZTest/FontDemo.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap17/FontOut2 -Isrc/Chap17/EZTest $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap17/FontRot/FontRot.wasm: src/Chap17/FontRot/FontRot.c src/Chap17/EZTest/EZFont.c src/Chap17/EZTest/FontDemo.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap17/FontRot -Isrc/Chap17/EZTest $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap17/UniChars/UniChars.wasm: src/Chap17/UniChars/Unichars.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap17/UniChars $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap18/Emf8/Emf8.wasm: src/Chap18/Emf8/Emf8.c src/Chap18/Emf8/Emf.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap18/Emf8 $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap18/Emf9/Emf9.wasm: src/Chap18/Emf9/Emf9.c src/Chap18/Emf8/Emf.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap18/Emf9 -Isrc/Chap18/Emf8 $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap18/Emf10/Emf10.wasm: src/Chap18/Emf10/Emf10.c src/Chap18/Emf8/Emf.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap18/Emf10 -Isrc/Chap18/Emf8 $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap18/Emf11/Emf11.wasm: src/Chap18/Emf11/Emf11.c src/Chap18/Emf8/Emf.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap18/Emf11 -Isrc/Chap18/Emf8 $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap18/Emf12/Emf12.wasm: src/Chap18/Emf12/Emf12.c src/Chap18/Emf8/Emf.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap18/Emf12 -Isrc/Chap18/Emf8 $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

$(BUILD_DIR)/Chap18/Emf13/Emf13.wasm: src/Chap18/Emf13/Emf13.c src/Chap18/Emf8/Emf.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Isrc/Chap18/Emf13 -Isrc/Chap18/Emf8 $^ $(LDFLAGS) -o $@
	@echo "✓ Compiled: $@"

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
chap06: $(CHAP06_BINS)
chap07: $(CHAP07_BINS)
chap08: $(CHAP08_BINS)
chap09: $(CHAP09_BINS)
chap10: $(CHAP10_BINS)
chap11: $(CHAP11_BINS)
chap12: $(CHAP12_BINS)
chap13: $(CHAP13_BINS)
chap14: $(CHAP14_BINS)
chap15: $(CHAP15_BINS)
chap16: $(CHAP16_BINS)
chap17: $(CHAP17_BINS)
chap18: $(CHAP18_BINS)
chap19: $(CHAP19_BINS)

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
