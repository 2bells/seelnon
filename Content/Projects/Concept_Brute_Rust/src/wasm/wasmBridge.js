import { WASM_BASE64 } from './wasmBinary.js';

class WasmCanvasCore {
  constructor() {
    this.instance = null;
    this.exports = null;
    this.memory = null;
    this.ready = false;
    this.liquifySessions = new Map();
    this._initSync();
  }

  _initSync() {
    try {
      const binaryString = atob(WASM_BASE64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const mod = new WebAssembly.Module(bytes);
      this.instance = new WebAssembly.Instance(mod, {});
      this.exports = this.instance.exports;
      this.memory = this.exports.memory;
      const heapBase = this.exports.__heap_base ? this.exports.__heap_base.value : 65536;
      this.exports.wasm_init_heap(heapBase);
      this.exports.wasm_mark_scratch();
      this.ready = true;
    } catch (err) {
      console.error('Failed to initialize Rust WASM Canvas Core:', err);
      this.ready = false;
    }
  }

  /**
   * Displaces a full-resolution Liquify map in WASM memory
   */
  liquifyDisplaceFull(mapF32, w, localMinX, localMaxX, localMinY, localMaxY, clx, cly, p0x, p0y, vxStrength, vyStrength, r, exponent) {
    if (!this.ready || !mapF32 || w <= 0) return false;
    const h = Math.floor(mapF32.length / (w * 2));
    if (h <= 0) return false;

    // Strict boundary clamping to prevent any negative offsets or buffer overflow
    const cMinX = Math.max(0, Math.min(w - 1, Math.floor(localMinX)));
    const cMaxX = Math.max(0, Math.min(w - 1, Math.ceil(localMaxX)));
    const cMinY = Math.max(0, Math.min(h - 1, Math.floor(localMinY)));
    const cMaxY = Math.max(0, Math.min(h - 1, Math.ceil(localMaxY)));
    if (cMaxX < cMinX || cMaxY < cMinY) return false;

    const rowStart = (cMinY * w * 2) >>> 0;
    const rowEnd = ((cMaxY + 1) * w * 2) >>> 0;
    const sliceLen = rowEnd - rowStart;
    if (sliceLen <= 0 || rowEnd > mapF32.length) return false;

    const ex = this.exports;
    ex.wasm_reset_scratch();

    const mapPtr = (ex.wasm_alloc(mapF32.byteLength)) >>> 0;
    const buf = this.memory.buffer;
    if (mapPtr + mapF32.byteLength > buf.byteLength) return false;

    const byteOffset = (mapPtr + rowStart * 4) >>> 0;
    if (byteOffset + sliceLen * 4 > this.memory.buffer.byteLength) return false;

    new Float32Array(buf, byteOffset, sliceLen).set(mapF32.subarray(rowStart, rowEnd));

    ex.liquify_displace_full(
      mapPtr,
      w,
      cMinX,
      cMaxX,
      cMinY,
      cMaxY,
      clx,
      cly,
      p0x,
      p0y,
      vxStrength,
      vyStrength,
      r,
      exponent
    );

    const updated = new Float32Array(this.memory.buffer, byteOffset, sliceLen);
    mapF32.set(updated, rowStart);
    return true;
  }

  /**
   * Computes the 2D fluid velocity grid in Rust WASM
   */
  fluidComputeVelocityField(uF32, vF32, cols, rows, cellSize, ax, ay, bx, by, capDx, capDy, localActiveRadius, brushPowerDamping, speedCap, valVortex, valTurb) {
    if (!this.ready || !uF32 || !vF32 || cols <= 0 || rows <= 0) return false;
    const count = (cols * rows) >>> 0;
    const byteLen = count * 4;

    const ex = this.exports;
    ex.wasm_reset_scratch();

    const uPtr = ex.wasm_alloc(byteLen) >>> 0;
    const vPtr = ex.wasm_alloc(byteLen) >>> 0;

    ex.fluid_compute_velocity_field(
      uPtr,
      vPtr,
      cols,
      rows,
      cellSize,
      ax,
      ay,
      bx,
      by,
      capDx,
      capDy,
      localActiveRadius,
      brushPowerDamping,
      speedCap,
      valVortex,
      valTurb
    );

    const buf = this.memory.buffer;
    uF32.set(new Float32Array(buf, uPtr, count));
    vF32.set(new Float32Array(buf, vPtr, count));
    return true;
  }

  /**
   * Semi-Lagrangian Advection + 3D Impasto Surface Shading in Rust WASM
   */
  fluidAdvectAndShade(srcU8, dstU8, srcHeightF32, dstHeightF32, uF32, vF32, w, h, cols, rows, cellSize, ax, ay, bx, by, calcSize, dt, valGloss, isImpasto) {
    if (!this.ready || !srcU8 || !dstU8 || !srcHeightF32 || !dstHeightF32 || !uF32 || !vF32 || w <= 0 || h <= 0) return false;
    const pixelCount = (w * h) >>> 0;
    const pixelBytes = pixelCount * 4;
    const gridCount = (cols * rows) >>> 0;
    const gridBytes = gridCount * 4;

    const ex = this.exports;
    ex.wasm_reset_scratch();

    const srcPixPtr = ex.wasm_alloc(pixelBytes) >>> 0;
    const dstPixPtr = ex.wasm_alloc(pixelBytes) >>> 0;
    const srcHgtPtr = ex.wasm_alloc(pixelBytes) >>> 0;
    const dstHgtPtr = ex.wasm_alloc(pixelBytes) >>> 0;
    const uPtr = ex.wasm_alloc(gridBytes) >>> 0;
    const vPtr = ex.wasm_alloc(gridBytes) >>> 0;

    let buf = this.memory.buffer;
    new Uint8Array(buf, srcPixPtr, pixelBytes).set(srcU8);
    new Float32Array(buf, srcHgtPtr, pixelCount).set(srcHeightF32);
    new Float32Array(buf, uPtr, gridCount).set(uF32);
    new Float32Array(buf, vPtr, gridCount).set(vF32);

    ex.fluid_advect_and_shade(
      srcPixPtr,
      dstPixPtr,
      srcHgtPtr,
      dstHgtPtr,
      uPtr,
      vPtr,
      w,
      h,
      cols,
      rows,
      cellSize,
      ax,
      ay,
      bx,
      by,
      calcSize,
      dt,
      valGloss,
      isImpasto ? 1 : 0
    );

    buf = this.memory.buffer;
    dstU8.set(new Uint8Array(buf, dstPixPtr, pixelBytes));
    dstHeightF32.set(new Float32Array(buf, dstHgtPtr, pixelCount));
    return true;
  }

  /**
   * Renders a Liquify bounding box in WASM and returns { ok, oobCount }
   */
  liquifyRenderBox(srcU8, dstU8, mapF32, w, h, minX, maxX, minY, maxY, bilinear = false) {
    if (!this.ready || !srcU8 || !dstU8 || !mapF32 || w <= 0 || h <= 0) return null;

    const cMinX = Math.max(0, Math.min(w - 1, Math.floor(minX)));
    const cMaxX = Math.max(0, Math.min(w - 1, Math.ceil(maxX)));
    const cMinY = Math.max(0, Math.min(h - 1, Math.floor(minY)));
    const cMaxY = Math.max(0, Math.min(h - 1, Math.ceil(maxY)));
    if (cMaxX < cMinX || cMaxY < cMinY) return null;

    const boxW = cMaxX - cMinX + 1;
    const boxH = cMaxY - cMinY + 1;
    const dstBytes = boxW * boxH * 4;
    if (dstU8.byteLength < dstBytes) return null;

    const ex = this.exports;
    ex.wasm_reset_scratch();

    const srcBytes = srcU8.byteLength;
    const mapBytes = mapF32.byteLength;

    const srcPtr = (ex.wasm_alloc(srcBytes)) >>> 0;
    const dstPtr = (ex.wasm_alloc(dstBytes)) >>> 0;
    const mapPtr = (ex.wasm_alloc(mapBytes)) >>> 0;

    const buf = this.memory.buffer;
    if (mapPtr + mapBytes > buf.byteLength) return null;

    new Uint8Array(buf, srcPtr, srcBytes).set(srcU8);
    new Float32Array(buf, mapPtr, mapF32.length).set(mapF32);

    const oobCount = bilinear
      ? ex.liquify_render_box_bilinear(srcPtr, dstPtr, mapPtr, w, h, cMinX, cMaxX, cMinY, cMaxY)
      : ex.liquify_render_box_nearest(srcPtr, dstPtr, mapPtr, w, h, cMinX, cMaxX, cMinY, cMaxY);

    dstU8.set(new Uint8Array(this.memory.buffer, dstPtr, dstBytes));
    return { ok: true, oobCount };
  }

  /**
   * Displaces a Liquify grid in WASM memory and returns { hit, minGX, maxGX, minGY, maxGY }
   */
  liquifyDisplaceGrid(mapF32, gridW, gridH, cellSize, chunkLX, chunkLY, p0x, p0y, mvx, mvy, r, falloff) {
    if (!this.ready) return null;
    const ex = this.exports;
    ex.wasm_reset_scratch();

    const mapLen = mapF32.length;
    const mapBytes = mapLen * 4;
    const mapPtr = ex.wasm_alloc(mapBytes);
    const scratchPtr = ex.wasm_alloc(mapBytes);
    const boundsPtr = ex.wasm_alloc(16);

    let memF32 = new Float32Array(this.memory.buffer, mapPtr, mapLen);
    memF32.set(mapF32);

    const hit = ex.liquify_displace_grid(
      mapPtr,
      scratchPtr,
      gridW,
      gridH,
      cellSize,
      chunkLX,
      chunkLY,
      p0x,
      p0y,
      mvx,
      mvy,
      r,
      falloff,
      boundsPtr
    );

    if (!hit) {
      return { hit: false };
    }

    // Re-create views in case memory grew
    memF32 = new Float32Array(this.memory.buffer, mapPtr, mapLen);
    mapF32.set(memF32);
    const boundsI32 = new Int32Array(this.memory.buffer, boundsPtr, 4);

    return {
      hit: true,
      minGX: boundsI32[0],
      maxGX: boundsI32[1],
      minGY: boundsI32[2],
      maxGY: boundsI32[3]
    };
  }

  /**
   * Warps pixels in WASM using either nearest-neighbor (fast live drag) or premultiplied bilinear (resolve/ultra)
   */
  liquifyWarpPixels(srcU8, dstU8, mapF32, w, h, gridW, gridH, invCellSize, minX, maxX, minY, maxY, bilinear = false) {
    if (!this.ready) return false;
    const ex = this.exports;
    ex.wasm_reset_scratch();

    const pixelBytes = w * h * 4;
    const mapLen = mapF32.length;
    const mapBytes = mapLen * 4;

    const srcPtr = ex.wasm_alloc(pixelBytes);
    const dstPtr = ex.wasm_alloc(pixelBytes);
    const mapPtr = ex.wasm_alloc(mapBytes);

    const buf = this.memory.buffer;
    new Uint8Array(buf, srcPtr, pixelBytes).set(srcU8);
    new Uint8Array(buf, dstPtr, pixelBytes).set(dstU8);
    new Float32Array(buf, mapPtr, mapLen).set(mapF32);

    if (bilinear) {
      ex.liquify_warp_bilinear(
        srcPtr,
        dstPtr,
        mapPtr,
        w,
        h,
        gridW,
        gridH,
        invCellSize,
        minX,
        maxX,
        minY,
        maxY
      );
    } else {
      ex.liquify_warp_nearest(
        srcPtr,
        dstPtr,
        mapPtr,
        w,
        h,
        gridW,
        gridH,
        invCellSize,
        minX,
        maxX,
        minY,
        maxY
      );
    }

    dstU8.set(new Uint8Array(this.memory.buffer, dstPtr, pixelBytes));
    return true;
  }

  /**
   * Runs the Air Paint curl-noise + directional blow + radial pressure advection in Rust WASM
   */
  airAdvectRegion(srcU8, dstU8, bw, bh, bx, by, cx, cy, radius, turbScale, turbPower, blowVx, blowVy, radialPush, diffusion, phase) {
    if (!this.ready) return false;
    const ex = this.exports;
    ex.wasm_reset_scratch();

    const byteLen = bw * bh * 4;
    const srcPtr = ex.wasm_alloc(byteLen);
    const dstPtr = ex.wasm_alloc(byteLen);

    new Uint8Array(this.memory.buffer, srcPtr, byteLen).set(srcU8);

    const modified = ex.air_advect_region(
      srcPtr,
      dstPtr,
      bw,
      bh,
      bx,
      by,
      cx,
      cy,
      radius,
      turbScale,
      turbPower,
      blowVx,
      blowVy,
      radialPush,
      diffusion,
      phase
    );

    if (modified) {
      dstU8.set(new Uint8Array(this.memory.buffer, dstPtr, byteLen));
      return true;
    }
    return false;
  }

  /**
   * Persistent Liquify Session Management:
   * Keeps src image and displacement map inside WASM memory for the entire stroke duration.
   * Completely avoids copying multi-megabyte image arrays across the JS-WASM boundary on every mouse move!
   */
  liquifyGetOrCreateSession(chunkId, srcU8, w, h) {
    if (!this.ready || !srcU8 || w <= 0 || h <= 0) return null;
    let session = this.liquifySessions.get(chunkId);
    if (session && session.w === w && session.h === h) {
      return session;
    }

    const ex = this.exports;
    const srcBytes = (w * h * 4) >>> 0;
    const mapBytes = (w * h * 2 * 4) >>> 0;

    const srcPtr = ex.wasm_alloc(srcBytes) >>> 0;
    const mapPtr = ex.wasm_alloc(mapBytes) >>> 0;
    if (!srcPtr || !mapPtr) return null;

    let buf = this.memory.buffer;
    new Uint8Array(buf, srcPtr, srcBytes).set(srcU8);
    new Uint8Array(buf, mapPtr, mapBytes).fill(0); // Zero-fill initial displacement

    ex.wasm_mark_scratch();

    session = {
      chunkId,
      w,
      h,
      srcPtr,
      mapPtr
    };
    this.liquifySessions.set(chunkId, session);
    return session;
  }

  liquifyDisplaceSession(session, localMinX, localMaxX, localMinY, localMaxY, clx, cly, p0x, p0y, vxStrength, vyStrength, r, exponent) {
    if (!this.ready || !session) return false;
    const { w, h, mapPtr } = session;

    const cMinX = Math.max(0, Math.min(w - 1, Math.floor(localMinX)));
    const cMaxX = Math.max(0, Math.min(w - 1, Math.ceil(localMaxX)));
    const cMinY = Math.max(0, Math.min(h - 1, Math.floor(localMinY)));
    const cMaxY = Math.max(0, Math.min(h - 1, Math.ceil(localMaxY)));
    if (cMaxX < cMinX || cMaxY < cMinY) return false;

    // Displaces directly in WASM memory without any data transfers!
    this.exports.liquify_displace_full(
      mapPtr,
      w,
      cMinX,
      cMaxX,
      cMinY,
      cMaxY,
      clx,
      cly,
      p0x,
      p0y,
      vxStrength,
      vyStrength,
      r,
      exponent
    );
    return true;
  }

  liquifyRenderSession(session, minX, maxX, minY, maxY, dstU8, bilinear = true) {
    if (!this.ready || !session || !dstU8) return false;
    const { w, h, srcPtr, mapPtr } = session;

    const cMinX = Math.max(0, Math.min(w - 1, Math.floor(minX)));
    const cMaxX = Math.max(0, Math.min(w - 1, Math.ceil(maxX)));
    const cMinY = Math.max(0, Math.min(h - 1, Math.floor(minY)));
    const cMaxY = Math.max(0, Math.min(h - 1, Math.ceil(maxY)));
    if (cMaxX < cMinX || cMaxY < cMinY) return false;

    const boxW = cMaxX - cMinX + 1;
    const boxH = cMaxY - cMinY + 1;
    const dstBytes = (boxW * boxH * 4) >>> 0;
    if (dstU8.byteLength < dstBytes) return false;

    const ex = this.exports;
    ex.wasm_reset_scratch();
    const dstPtr = ex.wasm_alloc(dstBytes) >>> 0;
    if (!dstPtr) return false;

    if (bilinear) {
      ex.liquify_render_box_bilinear(srcPtr, dstPtr, mapPtr, w, h, cMinX, cMaxX, cMinY, cMaxY);
    } else {
      ex.liquify_render_box_nearest(srcPtr, dstPtr, mapPtr, w, h, cMinX, cMaxX, cMinY, cMaxY);
    }

    dstU8.set(new Uint8Array(this.memory.buffer, dstPtr, dstBytes));
    ex.wasm_reset_scratch();
    return true;
  }

  liquifyEndAllSessions() {
    this.liquifySessions.clear();
    if (this.ready) {
      const heapBase = this.exports.__heap_base ? this.exports.__heap_base.value : 65536;
      this.exports.wasm_init_heap(heapBase);
      this.exports.wasm_mark_scratch();
    }
  }

  /**
   * Fast Fluid Bristle Stamp in Rust WASM
   */
  fluidStampBristle(pixelsU8, heightF32, w, h, px, py, bristleRadius, bristleR, bristleG, bristleB, bristleAlpha, opacity, flow, valDepth, nx, ny) {
    if (!this.ready || !pixelsU8 || !heightF32 || w <= 0 || h <= 0) return false;
    const count = (w * h) >>> 0;
    const pixBytes = count * 4;
    const hgtBytes = count * 4;

    const ex = this.exports;
    ex.wasm_reset_scratch();

    const pixPtr = ex.wasm_alloc(pixBytes) >>> 0;
    const hgtPtr = ex.wasm_alloc(hgtBytes) >>> 0;

    let buf = this.memory.buffer;
    new Uint8Array(buf, pixPtr, pixBytes).set(pixelsU8);
    new Float32Array(buf, hgtPtr, count).set(heightF32);

    ex.fluid_stamp_bristle(
      pixPtr,
      hgtPtr,
      w,
      h,
      px,
      py,
      bristleRadius,
      bristleR,
      bristleG,
      bristleB,
      bristleAlpha,
      opacity,
      flow,
      valDepth,
      nx,
      ny
    );

    buf = this.memory.buffer;
    pixelsU8.set(new Uint8Array(buf, pixPtr, pixBytes));
    heightF32.set(new Float32Array(buf, hgtPtr, count));
    return true;
  }

  /**
   * Converts RGBA image data in-place into a black brush tip alpha mask via Rust WASM
   */
  rgbaToTipMask(u8Data) {
    if (!this.ready) return false;
    const ex = this.exports;
    ex.wasm_reset_scratch();

    const byteLen = u8Data.byteLength;
    const ptr = ex.wasm_alloc(byteLen);
    new Uint8Array(this.memory.buffer, ptr, byteLen).set(u8Data);
    ex.rgba_to_tip_mask(ptr, byteLen >> 2);
    u8Data.set(new Uint8Array(this.memory.buffer, ptr, byteLen));
    return true;
  }
}

export const wasmCore = new WasmCanvasCore();
