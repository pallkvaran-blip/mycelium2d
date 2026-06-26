// =============================================================================
// Camera — world <-> screen transform, pan, zoom (B2).
// Pure view concern; never touches simulation state.
// =============================================================================

export class Camera {
  constructor() {
    this.x = 0;       // world point at screen centre
    this.y = 0;
    this.zoom = 1;
    this.minZoom = 0.2;
    this.maxZoom = 4;
    this.viewW = 1;
    this.viewH = 1;
  }

  setViewport(w, h) { this.viewW = w; this.viewH = h; }

  worldToScreen(wx, wy) {
    return {
      x: (wx - this.x) * this.zoom + this.viewW / 2,
      y: (wy - this.y) * this.zoom + this.viewH / 2,
    };
  }
  screenToWorld(sx, sy) {
    return {
      x: (sx - this.viewW / 2) / this.zoom + this.x,
      y: (sy - this.viewH / 2) / this.zoom + this.y,
    };
  }

  panByScreen(dxScreen, dyScreen) {
    this.x -= dxScreen / this.zoom;
    this.y -= dyScreen / this.zoom;
  }

  // Zoom toward a screen anchor (keeps the world point under the cursor fixed).
  zoomAt(sx, sy, factor) {
    const before = this.screenToWorld(sx, sy);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
  }

  // Frame a world bounding box with padding.
  fitBounds(b, pad = 80) {
    if (!b) return;
    const w = Math.max(1, b.maxX - b.minX);
    const h = Math.max(1, b.maxY - b.minY);
    this.x = (b.minX + b.maxX) / 2;
    this.y = (b.minY + b.maxY) / 2;
    const zx = this.viewW / (w + pad * 2);
    const zy = this.viewH / (h + pad * 2);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, Math.min(zx, zy)));
  }
}
