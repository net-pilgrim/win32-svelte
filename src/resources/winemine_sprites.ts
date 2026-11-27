// Win32 WineMine procedural sprite generator
// Generates pixel-faithful classic bitmaps for IDI_MINES, IDI_FACES, IDI_LEDS, IDI_WINEMINE

export interface GeneratedGdiBitmap {
  width: number;
  height: number;
  canvas: any;
  ctx: any;
}

export function createWineMineBitmap(resourceId: number): GeneratedGdiBitmap {
  let width = 32;
  let height = 32;

  switch (resourceId) {
    case 4: // IDI_MINES: 16x256 (16 frames of 16x16)
      width = 16;
      height = 256;
      break;
    case 2: // IDI_FACES: 24x120 (5 frames of 24x24)
      width = 24;
      height = 120;
      break;
    case 3: // IDI_LEDS: 12x253 (11 frames of 12x23)
      width = 12;
      height = 253;
      break;
    case 1: // IDI_WINEMINE: 32x32
      width = 32;
      height = 32;
      break;
    default:
      width = 32;
      height = 32;
      break;
  }

  let canvas: any = null;
  let ctx: any = null;

  if (typeof document !== "undefined") {
    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext("2d");
  } else {
    // Mock context for headless Node testing
    ctx = {
      fillRect: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fillText: () => {},
      save: () => {},
      restore: () => {},
      drawImage: () => {},
    };
    canvas = {
      width,
      height,
      getContext: () => ctx,
    };
  }

  if (ctx && typeof document !== "undefined") {
    renderSpriteContent(resourceId, ctx, width, height);
  }

  return { width, height, canvas, ctx };
}

function renderSpriteContent(resourceId: number, ctx: CanvasRenderingContext2D, width: number, height: number) {
  if (resourceId === 4) {
    // IDI_MINES: 16 frames of 16x16
    const numbers = ["", "1", "2", "3", "4", "5", "6", "7", "8"];
    const colors = ["", "#0000ff", "#008000", "#ff0000", "#000080", "#800000", "#008080", "#000000", "#808080"];

    for (let frame = 0; frame < 16; frame++) {
      const y = frame * 16;
      // Frame 0: MPRESS_BMP (flat pressed cell)
      if (frame === 0) {
        ctx.fillStyle = "#c0c0c0";
        ctx.fillRect(0, y, 16, 16);
        ctx.fillStyle = "#808080";
        ctx.fillRect(0, y, 16, 1);
        ctx.fillRect(0, y, 1, 16);
      }
      // Frame 1..8: Numbered cells
      else if (frame >= 1 && frame <= 8) {
        ctx.fillStyle = "#c0c0c0";
        ctx.fillRect(0, y, 16, 16);
        ctx.fillStyle = "#808080";
        ctx.fillRect(0, y, 16, 1);
        ctx.fillRect(0, y, 1, 16);

        ctx.font = "bold 11px Tahoma, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = colors[frame];
        ctx.fillText(numbers[frame], 8, y + 9);
      }
      // Frame 9: BOX_BMP (unpressed normal cell)
      else if (frame === 9) {
        drawRaisedBox(ctx, 0, y, 16, 16);
      }
      // Frame 10: FLAG_BMP
      else if (frame === 10) {
        drawRaisedBox(ctx, 0, y, 16, 16);
        // Flag
        ctx.fillStyle = "#ff0000";
        ctx.beginPath();
        ctx.moveTo(9, y + 4);
        ctx.lineTo(4, y + 7);
        ctx.lineTo(9, y + 10);
        ctx.closePath();
        ctx.fill();

        // Pole
        ctx.fillStyle = "#000000";
        ctx.fillRect(9, y + 4, 1.5, 8);
        ctx.fillRect(5, y + 12, 7, 2);
      }
      // Frame 11: QUESTION_BMP
      else if (frame === 11) {
        drawRaisedBox(ctx, 0, y, 16, 16);
        ctx.font = "bold 12px Tahoma, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#000000";
        ctx.fillText("?", 8, y + 8);
      }
      // Frame 12: EXPLODE_BMP (triggered mine: red background)
      else if (frame === 12) {
        ctx.fillStyle = "#ff0000";
        ctx.fillRect(0, y, 16, 16);
        drawMineGlyph(ctx, 0, y);
      }
      // Frame 13: WRONG_BMP (falsely flagged mine)
      else if (frame === 13) {
        ctx.fillStyle = "#c0c0c0";
        ctx.fillRect(0, y, 16, 16);
        drawMineGlyph(ctx, 0, y);
        // Red X over mine
        ctx.strokeStyle = "#ff0000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(2, y + 2);
        ctx.lineTo(14, y + 14);
        ctx.moveTo(14, y + 2);
        ctx.lineTo(2, y + 14);
        ctx.stroke();
      }
      // Frame 14: MINE_BMP (unexploded mine)
      else if (frame === 14) {
        ctx.fillStyle = "#c0c0c0";
        ctx.fillRect(0, y, 16, 16);
        ctx.fillStyle = "#808080";
        ctx.fillRect(0, y, 16, 1);
        ctx.fillRect(0, y, 1, 16);
        drawMineGlyph(ctx, 0, y);
      }
      // Frame 15: QPRESS_BMP (pressed question mark)
      else if (frame === 15) {
        ctx.fillStyle = "#c0c0c0";
        ctx.fillRect(0, y, 16, 16);
        ctx.fillStyle = "#808080";
        ctx.fillRect(0, y, 16, 1);
        ctx.fillRect(0, y, 1, 16);
        ctx.font = "bold 12px Tahoma, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#000000";
        ctx.fillText("?", 8, y + 9);
      }
    }
  } else if (resourceId === 2) {
    // IDI_FACES: 5 frames of 24x24
    for (let frame = 0; frame < 5; frame++) {
      const y = frame * 24;
      const isPressed = frame === 0;

      if (isPressed) {
        drawSunkenBox(ctx, 0, y, 24, 24);
      } else {
        drawRaisedBox(ctx, 0, y, 24, 24);
      }

      const cx = 12;
      const cy = y + 12;

      // Yellow head
      ctx.fillStyle = "#ffff00";
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Facial expressions
      // 0: SPRESS_BMP (pressed smile)
      // 1: COOL_BMP (won)
      // 2: DEAD_BMP (lost)
      // 3: OOH_BMP (surprised)
      // 4: SMILE_BMP (normal smile)
      if (frame === 4 || frame === 0) {
        // Eyes
        ctx.fillStyle = "#000000";
        ctx.fillRect(cx - 4, cy - 3, 2, 2);
        ctx.fillRect(cx + 2, cy - 3, 2, 2);
        // Smile
        ctx.beginPath();
        ctx.arc(cx, cy + 1, 4, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
      } else if (frame === 1) {
        // Sunglasses
        ctx.fillStyle = "#000000";
        ctx.fillRect(cx - 6, cy - 4, 12, 4);
        ctx.strokeStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy - 3);
        ctx.lineTo(cx - 2, cy - 1);
        ctx.moveTo(cx + 1, cy - 3);
        ctx.lineTo(cx + 4, cy - 1);
        ctx.stroke();
        // Grin
        ctx.strokeStyle = "#000000";
        ctx.beginPath();
        ctx.arc(cx, cy + 1, 4, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
      } else if (frame === 2) {
        // X eyes
        ctx.strokeStyle = "#000000";
        drawX(ctx, cx - 4, cy - 3, 3);
        drawX(ctx, cx + 2, cy - 3, 3);
        // Frown
        ctx.beginPath();
        ctx.arc(cx, cy + 5, 4, 1.2 * Math.PI, 1.8 * Math.PI);
        ctx.stroke();
      } else if (frame === 3) {
        // Open wide eyes
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(cx - 4, cy - 2, 1.5, 0, Math.PI * 2);
        ctx.arc(cx + 4, cy - 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
        // 'O' mouth
        ctx.beginPath();
        ctx.arc(cx, cy + 3, 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  } else if (resourceId === 3) {
    // IDI_LEDS: 11 frames of 12x23 (digits 0..9 and '-' for 10)
    for (let digit = 0; digit < 11; digit++) {
      const y = digit * 23;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, y, 12, 23);
      draw7SegmentDigit(ctx, 0, y, digit);
    }
  } else if (resourceId === 1) {
    // IDI_WINEMINE: 32x32 icon
    ctx.fillStyle = "#c0c0c0";
    ctx.fillRect(0, 0, 32, 32);
    // Draw enlarged mine & fuse
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(16, 17, 9, 0, Math.PI * 2);
    ctx.fill();
    // Spikes
    for (let a = 0; a < 8; a++) {
      const angle = (a * Math.PI) / 4;
      ctx.fillRect(16 + Math.cos(angle) * 11 - 1, 17 + Math.sin(angle) * 11 - 1, 3, 3);
    }
    // Highlight
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(13, 13, 3, 3);
  }
}

function drawRaisedBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#c0c0c0";
  ctx.fillRect(x, y, w, h);
  // White top & left
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, w - 1, 2);
  ctx.fillRect(x, y, 2, h - 1);
  // Dark gray inner bottom & right
  ctx.fillStyle = "#808080";
  ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
  ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
  // Black outer bottom & right
  ctx.fillStyle = "#000000";
  ctx.fillRect(x + w - 1, y, 1, h);
  ctx.fillRect(x, y + h - 1, w, 1);
}

function drawSunkenBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#c0c0c0";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#808080";
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x + w - 1, y, 1, h);
  ctx.fillRect(x, y + h - 1, w, 1);
}

function drawMineGlyph(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const cx = x + 8;
  const cy = y + 8;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();

  // Spikes
  ctx.fillRect(cx - 6, cy - 0.5, 12, 1);
  ctx.fillRect(cx - 0.5, cy - 6, 1, 12);
  ctx.fillRect(cx - 4, cy - 4, 1.5, 1.5);
  ctx.fillRect(cx + 3, cy - 4, 1.5, 1.5);
  ctx.fillRect(cx - 4, cy + 3, 1.5, 1.5);
  ctx.fillRect(cx + 3, cy + 3, 1.5, 1.5);

  // Glare
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(cx - 2, cy - 2, 1.5, 1.5);
}

function drawX(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + size, y + size);
  ctx.moveTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.stroke();
}

function draw7SegmentDigit(ctx: CanvasRenderingContext2D, x: number, y: number, digit: number) {
  // 7 segments: [a, b, c, d, e, f, g]
  // a: top, b: top-right, c: bot-right, d: bottom, e: bot-left, f: top-left, g: middle
  const map: Record<number, number[]> = {
    0: [1, 1, 1, 1, 1, 1, 0],
    1: [0, 1, 1, 0, 0, 0, 0],
    2: [1, 1, 0, 1, 1, 0, 1],
    3: [1, 1, 1, 1, 0, 0, 1],
    4: [0, 1, 1, 0, 0, 1, 1],
    5: [1, 0, 1, 1, 0, 1, 1],
    6: [1, 0, 1, 1, 1, 1, 1],
    7: [1, 1, 1, 0, 0, 0, 0],
    8: [1, 1, 1, 1, 1, 1, 1],
    9: [1, 1, 1, 1, 0, 1, 1],
    10: [0, 0, 0, 0, 0, 0, 1], // dash '-'
  };

  const segs = map[digit] || [0, 0, 0, 0, 0, 0, 0];
  const litColor = "#ff0000";
  const dimColor = "#300000";

  // Segment geometries
  // a: (2, 2) w=8, h=2
  ctx.fillStyle = segs[0] ? litColor : dimColor;
  ctx.fillRect(x + 2, y + 2, 8, 2);

  // b: (9, 3) w=2, h=8
  ctx.fillStyle = segs[1] ? litColor : dimColor;
  ctx.fillRect(x + 9, y + 3, 2, 8);

  // c: (9, 12) w=2, h=8
  ctx.fillStyle = segs[2] ? litColor : dimColor;
  ctx.fillRect(x + 9, y + 12, 2, 8);

  // d: (2, 19) w=8, h=2
  ctx.fillStyle = segs[3] ? litColor : dimColor;
  ctx.fillRect(x + 2, y + 19, 8, 2);

  // e: (1, 12) w=2, h=8
  ctx.fillStyle = segs[4] ? litColor : dimColor;
  ctx.fillRect(x + 1, y + 12, 2, 8);

  // f: (1, 3) w=2, h=8
  ctx.fillStyle = segs[5] ? litColor : dimColor;
  ctx.fillRect(x + 1, y + 3, 2, 8);

  // g: (2, 10.5) w=8, h=2
  ctx.fillStyle = segs[6] ? litColor : dimColor;
  ctx.fillRect(x + 2, y + 10, 8, 2);
}
