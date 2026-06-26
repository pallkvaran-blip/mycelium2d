// =============================================================================
// SubstrateRenderer — the cross-section terrain (A4, A8, B1/B2).
//
// Bakes the (mostly static) terrain to a world-size offscreen canvas and only
// re-bakes when the field changes (deposit, depletion, Trichoderma spread).
// The main loop blits it with the camera transform each frame.
// =============================================================================

export class SubstrateRenderer {
  constructor(substrate, config) {
    this.substrate = substrate;
    this.config = config;
    this.dirty = true;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.ceil(substrate.worldWidth);
    this.canvas.height = Math.ceil(substrate.worldHeight);
    this.octx = this.canvas.getContext('2d');
    this.nutrientRef = config.substrate.foodRichnessMax * 1.4;
  }

  markDirty() { this.dirty = true; }

  bake() {
    const { octx, substrate } = this;
    const r = this.config.render;
    const W = this.canvas.width, H = this.canvas.height;
    const surfaceY = substrate.surfaceY;
    octx.clearRect(0, 0, W, H);

    // Sky (above the soil line).
    let sky = octx.createLinearGradient(0, 0, 0, surfaceY);
    sky.addColorStop(0, r.skyTop);
    sky.addColorStop(1, r.skyBottom);
    octx.fillStyle = sky;
    octx.fillRect(0, 0, W, surfaceY);

    // Ground (below the soil line).
    let ground = octx.createLinearGradient(0, surfaceY, 0, H);
    ground.addColorStop(0, r.groundTop);
    ground.addColorStop(1, r.groundBottom);
    octx.fillStyle = ground;
    octx.fillRect(0, surfaceY, W, H - surfaceY);

    const cs = substrate.cellSize;

    // Food + hazards + Trichoderma per cell.
    substrate.forEachCell((cell, col, row) => {
      const x = col * cs, y = surfaceY + row * cs;
      if (cell.hazard) {
        octx.fillStyle = r.hazardColor;
        octx.fillRect(x, y, cs, cs);
        // toxic shimmer
        octx.fillStyle = 'rgba(180,60,80,0.25)';
        octx.fillRect(x + cs * 0.2, y + cs * 0.2, cs * 0.6, cs * 0.6);
      } else if (cell.nutrient > 0) {
        const a = Math.min(0.85, cell.nutrient / this.nutrientRef);
        octx.fillStyle = withAlpha(r.foodColor, a);
        octx.fillRect(x, y, cs, cs);
      }
      if (cell.trich > 0) {
        octx.fillStyle = withAlpha(r.trichodermaColor, Math.min(0.8, cell.trich));
        // speckled mold look
        octx.fillRect(x, y, cs, cs);
        octx.fillStyle = withAlpha('#c8e060', Math.min(0.5, cell.trich * 0.6));
        octx.fillRect(x + cs * 0.25, y + cs * 0.15, cs * 0.3, cs * 0.3);
        octx.fillRect(x + cs * 0.55, y + cs * 0.55, cs * 0.25, cs * 0.25);
      }
    });

    // Surface line: soil (fruitable) vs non-soil, plus shade markers (B1).
    const band = 16;
    for (let c = 0; c < substrate.cols; c++) {
      const surf = substrate.surface[c];
      const x = c * cs;
      if (surf.soil) {
        // Fruitable soil: warm topsoil band with a lighter crust on top.
        const sg = octx.createLinearGradient(0, surfaceY - band, 0, surfaceY + 4);
        sg.addColorStop(0, '#7a5d3c');
        sg.addColorStop(1, r.soilLine);
        octx.fillStyle = sg;
        octx.fillRect(x, surfaceY - band, cs + 1, band + 4);
      } else {
        // Non-soil (concrete / rock): hard grey band, hatched — no fruiting.
        octx.fillStyle = r.nonSoil;
        octx.fillRect(x, surfaceY - band, cs + 1, band + 4);
        octx.strokeStyle = 'rgba(0,0,0,0.35)';
        octx.lineWidth = 1;
        for (let hx = 0; hx < cs; hx += 7) {
          octx.beginPath();
          octx.moveTo(x + hx, surfaceY - band);
          octx.lineTo(x + hx + band, surfaceY + 4);
          octx.stroke();
        }
      }
      // Shaded soil yields more — cool canopy overlay above it.
      if (surf.soil && surf.shade) {
        const sh = octx.createLinearGradient(0, surfaceY - 90, 0, surfaceY);
        sh.addColorStop(0, 'rgba(20,40,70,0)');
        sh.addColorStop(1, 'rgba(40,90,140,0.32)');
        octx.fillStyle = sh;
        octx.fillRect(x, surfaceY - 90, cs + 1, 90);
      }
    }
    // Bright hairline exactly at the soil line so it always reads as "surface".
    octx.strokeStyle = 'rgba(220,210,180,0.55)';
    octx.lineWidth = 1.5;
    octx.beginPath();
    octx.moveTo(0, surfaceY);
    octx.lineTo(W, surfaceY);
    octx.stroke();

    this.dirty = false;
  }

  draw(ctx, camera) {
    if (this.dirty) this.bake();
    const tl = camera.worldToScreen(0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      this.canvas,
      0, 0, this.canvas.width, this.canvas.height,
      tl.x, tl.y, this.canvas.width * camera.zoom, this.canvas.height * camera.zoom,
    );
  }
}

function withAlpha(hex, a) {
  // hex '#rrggbb' -> rgba
  const v = hex.replace('#', '');
  const r = parseInt(v.substring(0, 2), 16);
  const g = parseInt(v.substring(2, 4), 16);
  const b = parseInt(v.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
