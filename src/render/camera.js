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
    this.bounds = null;  // {minX,minY,maxX,maxY}: the map rect the view is kept inside
  }

  setViewport(w, h) { this.viewW = w; this.viewH = h; this.clamp(); }

  // The map rectangle the camera must stay inside. Once set, panning and zooming
  // can never reveal the empty background beyond the map's edges.
  setWorldBounds(minX, minY, maxX, maxY) {
    this.bounds = { minX, minY, maxX, maxY };
    this.clamp();
  }

  // Smallest zoom that still fills the viewport with map in BOTH axes — below it
  // the view would be wider/taller than the map and show empty space.
  minZoomForBounds() {
    if (!this.bounds) return this.minZoom;
    const w = Math.max(1, this.bounds.maxX - this.bounds.minX);
    const h = Math.max(1, this.bounds.maxY - this.bounds.minY);
    return Math.max(this.minZoom, this.viewW / w, this.viewH / h);
  }

  // Enforce the zoom floor, then keep the visible rect inside the map bounds
  // (centre a dimension when the map is smaller than the view along it).
  clamp() {
    this.zoom = Math.max(this.minZoomForBounds(), Math.min(this.maxZoom, this.zoom));
    if (!this.bounds) return;
    const { minX, minY, maxX, maxY } = this.bounds;
    const halfW = this.viewW / (2 * this.zoom);
    const halfH = this.viewH / (2 * this.zoom);
    this.x = (maxX - minX) <= 2 * halfW
      ? (minX + maxX) / 2
      : Math.max(minX + halfW, Math.min(maxX - halfW, this.x));
    this.y = (maxY - minY) <= 2 * halfH
      ? (minY + maxY) / 2
      : Math.max(minY + halfH, Math.min(maxY - halfH, this.y));
  }

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
    this.clamp();
  }

  // Zoom toward a screen anchor (keeps the world point under the cursor fixed),
  // then re-clamp so a zoom-out at the edge slides back inside the map.
  zoomAt(sx, sy, factor) {
    const before = this.screenToWorld(sx, sy);
    this.zoom = Math.max(this.minZoomForBounds(), Math.min(this.maxZoom, this.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clamp();
  }

  // Frame a world bounding box with padding, then clamp so the framing never
  // over-zooms out past the map edges.
  fitBounds(b, pad = 80) {
    if (!b) return;
    const w = Math.max(1, b.maxX - b.minX);
    const h = Math.max(1, b.maxY - b.minY);
    this.x = (b.minX + b.maxX) / 2;
    this.y = (b.minY + b.maxY) / 2;
    const zx = this.viewW / (w + pad * 2);
    const zy = this.viewH / (h + pad * 2);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, Math.min(zx, zy)));
    this.clamp();
  }
}
