#![no_std]

use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

// Simple deterministic arena allocator in WASM linear memory.
// Memory layout:
// Static data + stack live below 1MB (1048576).
// We manage heap allocations starting at 2MB (2097152) upward, growing WASM pages (64KB each) on demand.
static mut HEAP_TOP: usize = 2097152;
static mut SCRATCH_BASE: usize = 2097152;

#[inline(always)]
unsafe fn ensure_capacity(required_end: usize) -> bool {
    let current_pages = core::arch::wasm32::memory_size(0);
    let current_bytes = current_pages * 65536;
    if required_end > current_bytes {
        let needed_bytes = required_end - current_bytes;
        let needed_pages = (needed_bytes + 65535) / 65536;
        let res = core::arch::wasm32::memory_grow(0, needed_pages);
        if res == usize::MAX {
            return false;
        }
    }
    true
}

#[no_mangle]
pub unsafe extern "C" fn wasm_init_heap(base: usize) -> usize {
    let aligned = (base + 15) & !15;
    let start = if aligned < 2097152 { 2097152 } else { aligned };
    HEAP_TOP = start;
    SCRATCH_BASE = start;
    start
}

#[no_mangle]
pub unsafe extern "C" fn wasm_alloc(size: usize) -> usize {
    if size == 0 || size > 500_000_000 {
        return 0;
    }
    let aligned_size = (size + 15) & !15;
    let ptr = (HEAP_TOP + 15) & !15;
    let new_top = match ptr.checked_add(aligned_size) {
        Some(top) => top,
        None => return 0,
    };
    if !ensure_capacity(new_top) {
        return 0;
    }
    HEAP_TOP = new_top;
    ptr
}

#[no_mangle]
pub unsafe extern "C" fn wasm_mark_scratch() -> usize {
    SCRATCH_BASE = HEAP_TOP;
    SCRATCH_BASE
}

#[no_mangle]
pub unsafe extern "C" fn wasm_reset_scratch() {
    HEAP_TOP = SCRATCH_BASE;
}

#[inline(always)]
fn clamp_i32(val: i32, min_val: i32, max_val: i32) -> i32 {
    if val < min_val {
        min_val
    } else if val > max_val {
        max_val
    } else {
        val
    }
}

#[inline(always)]
fn clamp_f32(val: f32, min_val: f32, max_val: f32) -> f32 {
    if val.is_nan() {
        return min_val;
    }
    if val < min_val {
        min_val
    } else if val > max_val {
        max_val
    } else {
        val
    }
}

#[inline(always)]
fn floor_f32(x: f32) -> i32 {
    if x.is_nan() {
        return 0;
    }
    if x <= -2147483648.0 {
        return i32::MIN;
    }
    if x >= 2147483647.0 {
        return i32::MAX;
    }
    let xi = x as i32;
    if x < (xi as f32) { xi - 1 } else { xi }
}

#[inline(always)]
fn ceil_f32(x: f32) -> i32 {
    if x.is_nan() {
        return 0;
    }
    if x <= -2147483648.0 {
        return i32::MIN;
    }
    if x >= 2147483647.0 {
        return i32::MAX;
    }
    let xi = x as i32;
    if x > (xi as f32) { xi + 1 } else { xi }
}

#[inline(always)]
fn sqrt_f32(x: f32) -> f32 {
    if x <= 0.0 || x.is_nan() {
        return 0.0;
    }
    #[cfg(target_arch = "wasm32")]
    {
        core::arch::wasm32::f32x4_extract_lane::<0>(
            core::arch::wasm32::f32x4_sqrt(core::arch::wasm32::f32x4_splat(x)),
        )
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        x
    }
}

#[inline(always)]
fn pow_f32_approx(base: f32, exp: f32) -> f32 {
    if base <= 0.0 || base.is_nan() {
        return 0.0;
    }
    if (exp - 2.0).abs() < 0.01 {
        return base * base;
    }
    if (exp - 1.0).abs() < 0.01 {
        return base;
    }
    if (exp - 4.0).abs() < 0.01 {
        let b2 = base * base;
        return b2 * b2;
    }
    // Smooth rational Pade-like power approximation for [0,1] falloff curves
    let b2 = base * base;
    let b4 = b2 * b2;
    let t = clamp_f32((exp - 0.5) / 3.5, 0.0, 1.0);
    base * (1.0 - t) + b4 * t
}

#[no_mangle]
pub unsafe extern "C" fn liquify_displace_full(
    map_ptr: *mut f32,
    w: i32,
    local_min_x: i32,
    local_max_x: i32,
    local_min_y: i32,
    local_max_y: i32,
    clx: f32,
    cly: f32,
    p0_x: f32,
    p0_y: f32,
    vx_strength: f32,
    vy_strength: f32,
    r: f32,
    exponent: f32,
) {
    if map_ptr.is_null() || w <= 0 || r <= 0.0 {
        return;
    }
    let r_sq = r * r;
    let inv_r_sq = 1.0 / r_sq;
    let w_usize = w as usize;

    for y in local_min_y..=local_max_y {
        let world_y = cly + (y as f32);
        let dy = world_y - p0_y;
        let dy_sq = dy * dy;
        if dy_sq >= r_sq {
            continue;
        }
        let row_offset = (y as usize) * w_usize;

        for x in local_min_x..=local_max_x {
            let world_x = clx + (x as f32);
            let dx = world_x - p0_x;
            let dist_sq = dx * dx + dy_sq;
            if dist_sq < r_sq {
                let one_minus_r2 = 1.0 - dist_sq * inv_r_sq;
                let weight = pow_f32_approx(one_minus_r2, exponent);
                let idx = (row_offset + (x as usize)) * 2;
                *map_ptr.add(idx) -= weight * vx_strength;
                *map_ptr.add(idx + 1) -= weight * vy_strength;
            }
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn liquify_render_box_nearest(
    src_u8: *const u8,
    dst_u8: *mut u8,
    map_ptr: *const f32,
    w: i32,
    h: i32,
    min_x: i32,
    max_x: i32,
    min_y: i32,
    max_y: i32,
) -> i32 {
    if src_u8.is_null() || dst_u8.is_null() || map_ptr.is_null() || w <= 0 || h <= 0 || min_x > max_x || min_y > max_y {
        return 0;
    }
    let min_x = clamp_i32(min_x, 0, w - 1);
    let max_x = clamp_i32(max_x, 0, w - 1);
    let min_y = clamp_i32(min_y, 0, h - 1);
    let max_y = clamp_i32(max_y, 0, h - 1);
    if min_x > max_x || min_y > max_y {
        return 0;
    }
    let w_usize = w as usize;
    let box_w = (max_x - min_x + 1) as usize;
    let src_u32 = src_u8 as *const u32;
    let dst_u32 = dst_u8 as *mut u32;

    for y in min_y..=max_y {
        let local_y = (y - min_y) as usize;
        let row_map = (y as usize) * w_usize;
        let dst_row = local_y * box_w;

        for x in min_x..=max_x {
            let local_x = (x - min_x) as usize;
            let idx = (row_map + (x as usize)) * 2;
            let dx = *map_ptr.add(idx);
            let dy = *map_ptr.add(idx + 1);
            let dst_pixel = dst_row + local_x;

            if dx == 0.0 && dy == 0.0 {
                *dst_u32.add(dst_pixel) = *src_u32.add(row_map + (x as usize));
            } else {
                let sx = clamp_i32(floor_f32((x as f32) + dx + 0.5), 0, w - 1);
                let sy = clamp_i32(floor_f32((y as f32) + dy + 0.5), 0, h - 1);
                *dst_u32.add(dst_pixel) =
                    *src_u32.add((sy as usize) * w_usize + (sx as usize));
            }
        }
    }
    0
}

#[no_mangle]
pub unsafe extern "C" fn liquify_render_box_bilinear(
    src_u8: *const u8,
    dst_u8: *mut u8,
    map_ptr: *const f32,
    w: i32,
    h: i32,
    min_x: i32,
    max_x: i32,
    min_y: i32,
    max_y: i32,
) -> i32 {
    if src_u8.is_null() || dst_u8.is_null() || map_ptr.is_null() || w <= 0 || h <= 0 || min_x > max_x || min_y > max_y {
        return 0;
    }
    let min_x = clamp_i32(min_x, 0, w - 1);
    let max_x = clamp_i32(max_x, 0, w - 1);
    let min_y = clamp_i32(min_y, 0, h - 1);
    let max_y = clamp_i32(max_y, 0, h - 1);
    if min_x > max_x || min_y > max_y {
        return 0;
    }
    let w_usize = w as usize;
    let box_w = (max_x - min_x + 1) as usize;
    let src_u32 = src_u8 as *const u32;
    let dst_u32 = dst_u8 as *mut u32;

    for y in min_y..=max_y {
        let local_y = (y - min_y) as usize;
        let row_map = (y as usize) * w_usize;
        let dst_row = local_y * box_w;

        for x in min_x..=max_x {
            let local_x = (x - min_x) as usize;
            let idx = (row_map + (x as usize)) * 2;
            let dx = *map_ptr.add(idx);
            let dy = *map_ptr.add(idx + 1);
            let dst_pixel = dst_row + local_x;

            if dx == 0.0 && dy == 0.0 {
                *dst_u32.add(dst_pixel) = *src_u32.add(row_map + (x as usize));
            } else {
                let src_x = (x as f32) + dx;
                let src_y = (y as f32) + dy;
                let x0 = floor_f32(src_x);
                let y0 = floor_f32(src_y);

                let cx0 = clamp_i32(x0, 0, w - 1);
                let cy0 = clamp_i32(y0, 0, h - 1);
                let cx1 = clamp_i32(x0 + 1, 0, w - 1);
                let cy1 = clamp_i32(y0 + 1, 0, h - 1);

                let tx = clamp_f32(src_x - (x0 as f32), 0.0, 1.0);
                let ty = clamp_f32(src_y - (y0 as f32), 0.0, 1.0);
                let idx00 = ((cy0 as usize) * w_usize + (cx0 as usize)) * 4;
                let idx10 = ((cy0 as usize) * w_usize + (cx1 as usize)) * 4;
                let idx01 = ((cy1 as usize) * w_usize + (cx0 as usize)) * 4;
                let idx11 = ((cy1 as usize) * w_usize + (cx1 as usize)) * 4;

                let dst_byte = dst_pixel * 4;
                for c in 0..4 {
                    let c00 = *src_u8.add(idx00 + c) as f32;
                    let c10 = *src_u8.add(idx10 + c) as f32;
                    let c01 = *src_u8.add(idx01 + c) as f32;
                    let c11 = *src_u8.add(idx11 + c) as f32;
                    let r0 = c00 + tx * (c10 - c00);
                    let r1 = c01 + tx * (c11 - c01);
                    *dst_u8.add(dst_byte + c) = (r0 + ty * (r1 - r0) + 0.5) as u8;
                }
            }
        }
    }
    0
}

// ============================================================================
// 1. LIQUIFY DISPLACEMENT GRID & PIXEL WARPING KERNELS
// ============================================================================

#[no_mangle]
pub unsafe extern "C" fn liquify_displace_grid(
    map_ptr: *mut f32,
    scratch_old_ptr: *mut f32,
    grid_w: i32,
    grid_h: i32,
    cell_size: f32,
    chunk_lx: f32,
    chunk_ly: f32,
    p0_x: f32,
    p0_y: f32,
    mv_x: f32,
    mv_y: f32,
    r: f32,
    falloff: f32,
    out_bounds_ptr: *mut i32,
) -> i32 {
    let r_sq = r * r;
    let inv_r_sq = 1.0 / r_sq;
    let inv_cell = 1.0 / cell_size;

    let min_gx = clamp_i32(floor_f32((p0_x - r - chunk_lx) * inv_cell), 0, grid_w - 1);
    let max_gx = clamp_i32(ceil_f32((p0_x + r - chunk_lx) * inv_cell), 0, grid_w - 1);
    let min_gy = clamp_i32(floor_f32((p0_y - r - chunk_ly) * inv_cell), 0, grid_h - 1);
    let max_gy = clamp_i32(ceil_f32((p0_y + r - chunk_ly) * inv_cell), 0, grid_h - 1);

    if min_gx > max_gx || min_gy > max_gy {
        return 0;
    }

    let move_dist = sqrt_f32(mv_x * mv_x + mv_y * mv_y);
    let margin = ceil_f32(move_dist * inv_cell) + 2;
    let s_min_gx = clamp_i32(min_gx - margin, 0, grid_w - 1);
    let s_max_gx = clamp_i32(max_gx + margin, 0, grid_w - 1);
    let s_min_gy = clamp_i32(min_gy - margin, 0, grid_h - 1);
    let s_max_gy = clamp_i32(max_gy + margin, 0, grid_h - 1);

    let gw_usize = grid_w as usize;
    // Copy affected region + margin into scratch_old_ptr
    for gy in s_min_gy..=s_max_gy {
        let row_offset = (gy as usize) * gw_usize * 2;
        let start_idx = row_offset + (s_min_gx as usize) * 2;
        let count = ((s_max_gx - s_min_gx + 1) as usize) * 2;
        core::ptr::copy_nonoverlapping(
            map_ptr.add(start_idx),
            scratch_old_ptr.add(start_idx),
            count,
        );
    }

    let max_gx_f = (grid_w - 1) as f32;
    let max_gy_f = (grid_h - 1) as f32;

    for gy in min_gy..=max_gy {
        let wy = chunk_ly + (gy as f32) * cell_size;
        let dy = wy - p0_y;
        let dy2 = dy * dy;
        if dy2 >= r_sq {
            continue;
        }
        let row_idx = (gy as usize) * gw_usize;

        for gx in min_gx..=max_gx {
            let wx = chunk_lx + (gx as f32) * cell_size;
            let dx = wx - p0_x;
            let d2 = dx * dx + dy2;
            if d2 < r_sq {
                let w = if falloff >= 0.99 {
                    let u2 = d2 * inv_r_sq;
                    let t = 1.0 - (u2 * u2 * u2);
                    t * t
                } else if falloff >= 0.45 {
                    let t = 1.0 - (d2 * inv_r_sq);
                    t * t
                } else {
                    let d = sqrt_f32(d2);
                    let t = 1.0 - (d / r);
                    t * t * t
                };

                let pull_x = wx - mv_x * w;
                let pull_y = wy - mv_y * w;

                let pull_gx = clamp_f32((pull_x - chunk_lx) * inv_cell, 0.0, max_gx_f);
                let pull_gy = clamp_f32((pull_y - chunk_ly) * inv_cell, 0.0, max_gy_f);

                let gx0 = clamp_i32(floor_f32(pull_gx), s_min_gx, s_max_gx);
                let gy0 = clamp_i32(floor_f32(pull_gy), s_min_gy, s_max_gy);
                let gx1 = clamp_i32(gx0 + 1, s_min_gx, s_max_gx);
                let gy1 = clamp_i32(gy0 + 1, s_min_gy, s_max_gy);

                let tx = pull_gx - (gx0 as f32);
                let ty = pull_gy - (gy0 as f32);
                let inv_tx = 1.0 - tx;
                let inv_ty = 1.0 - ty;

                let i00 = ((gy0 as usize) * gw_usize + (gx0 as usize)) * 2;
                let i10 = ((gy0 as usize) * gw_usize + (gx1 as usize)) * 2;
                let i01 = ((gy1 as usize) * gw_usize + (gx0 as usize)) * 2;
                let i11 = ((gy1 as usize) * gw_usize + (gx1 as usize)) * 2;

                let w00 = inv_tx * inv_ty;
                let w10 = tx * inv_ty;
                let w01 = inv_tx * ty;
                let w11 = tx * ty;

                let prev_dx = (*scratch_old_ptr.add(i00)) * w00
                    + (*scratch_old_ptr.add(i10)) * w10
                    + (*scratch_old_ptr.add(i01)) * w01
                    + (*scratch_old_ptr.add(i11)) * w11;

                let prev_dy = (*scratch_old_ptr.add(i00 + 1)) * w00
                    + (*scratch_old_ptr.add(i10 + 1)) * w10
                    + (*scratch_old_ptr.add(i01 + 1)) * w01
                    + (*scratch_old_ptr.add(i11 + 1)) * w11;

                let idx = (row_idx + (gx as usize)) * 2;
                *map_ptr.add(idx) = prev_dx + mv_x * w;
                *map_ptr.add(idx + 1) = prev_dy + mv_y * w;
            }
        }
    }

    if !out_bounds_ptr.is_null() {
        *out_bounds_ptr.add(0) = min_gx;
        *out_bounds_ptr.add(1) = max_gx;
        *out_bounds_ptr.add(2) = min_gy;
        *out_bounds_ptr.add(3) = max_gy;
    }

    1
}

#[no_mangle]
pub unsafe extern "C" fn liquify_warp_nearest(
    src_u32: *const u32,
    dst_u32: *mut u32,
    map_ptr: *const f32,
    w: i32,
    h: i32,
    grid_w: i32,
    grid_h: i32,
    inv_cell: f32,
    min_x: i32,
    max_x: i32,
    min_y: i32,
    max_y: i32,
) {
    let w_usize = w as usize;
    let gw_usize = grid_w as usize;
    let max_x_idx = w - 1;
    let max_y_idx = h - 1;
    let max_gx_idx = grid_w - 2;
    let max_gy_idx = grid_h - 2;

    let x_start = clamp_i32(min_x, 0, w);
    let x_end = clamp_i32(max_x, 0, w);
    let y_start = clamp_i32(min_y, 0, h);
    let y_end = clamp_i32(max_y, 0, h);

    for y in y_start..y_end {
        let gy_f = (y as f32) * inv_cell;
        let gy0 = clamp_i32(gy_f as i32, 0, max_gy_idx);
        let gy1 = gy0 + 1;
        let ty = gy_f - (gy0 as f32);
        let inv_ty = 1.0 - ty;

        let row0_offset = (gy0 as usize) * gw_usize;
        let row1_offset = (gy1 as usize) * gw_usize;
        let dst_row_offset = (y as usize) * w_usize;

        for x in x_start..x_end {
            let gx_f = (x as f32) * inv_cell;
            let gx0 = clamp_i32(gx_f as i32, 0, max_gx_idx);
            let gx1 = gx0 + 1;
            let tx = gx_f - (gx0 as f32);
            let inv_tx = 1.0 - tx;

            let i00 = (row0_offset + (gx0 as usize)) * 2;
            let i10 = (row0_offset + (gx1 as usize)) * 2;
            let i01 = (row1_offset + (gx0 as usize)) * 2;
            let i11 = (row1_offset + (gx1 as usize)) * 2;

            let w00 = inv_tx * inv_ty;
            let w10 = tx * inv_ty;
            let w01 = inv_tx * ty;
            let w11 = tx * ty;

            let dx = (*map_ptr.add(i00)) * w00
                + (*map_ptr.add(i10)) * w10
                + (*map_ptr.add(i01)) * w01
                + (*map_ptr.add(i11)) * w11;

            let dy = (*map_ptr.add(i00 + 1)) * w00
                + (*map_ptr.add(i10 + 1)) * w10
                + (*map_ptr.add(i01 + 1)) * w01
                + (*map_ptr.add(i11 + 1)) * w11;

            let sx = clamp_i32(floor_f32((x as f32) - dx + 0.5), 0, max_x_idx);
            let sy = clamp_i32(floor_f32((y as f32) - dy + 0.5), 0, max_y_idx);

            *dst_u32.add(dst_row_offset + (x as usize)) =
                *src_u32.add((sy as usize) * w_usize + (sx as usize));
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn liquify_warp_bilinear(
    src_u8: *const u8,
    dst_u8: *mut u8,
    map_ptr: *const f32,
    w: i32,
    h: i32,
    grid_w: i32,
    grid_h: i32,
    inv_cell: f32,
    min_x: i32,
    max_x: i32,
    min_y: i32,
    max_y: i32,
) {
    let w_usize = w as usize;
    let gw_usize = grid_w as usize;
    let max_x_f = (w - 1) as f32;
    let max_y_f = (h - 1) as f32;
    let max_x_idx = w - 1;
    let max_y_idx = h - 1;
    let max_gx_idx = grid_w - 2;
    let max_gy_idx = grid_h - 2;

    let src_u32 = src_u8 as *const u32;
    let dst_u32 = dst_u8 as *mut u32;

    let x_start = clamp_i32(min_x, 0, w);
    let x_end = clamp_i32(max_x, 0, w);
    let y_start = clamp_i32(min_y, 0, h);
    let y_end = clamp_i32(max_y, 0, h);

    for y in y_start..y_end {
        let gy_f = (y as f32) * inv_cell;
        let gy0 = clamp_i32(gy_f as i32, 0, max_gy_idx);
        let gy1 = gy0 + 1;
        let ty = gy_f - (gy0 as f32);
        let inv_ty = 1.0 - ty;

        let row0_offset = (gy0 as usize) * gw_usize;
        let row1_offset = (gy1 as usize) * gw_usize;
        let dst_row_offset = (y as usize) * w_usize;

        for x in x_start..x_end {
            let gx_f = (x as f32) * inv_cell;
            let gx0 = clamp_i32(gx_f as i32, 0, max_gx_idx);
            let gx1 = gx0 + 1;
            let tx = gx_f - (gx0 as f32);
            let inv_tx = 1.0 - tx;

            let i00 = (row0_offset + (gx0 as usize)) * 2;
            let i10 = (row0_offset + (gx1 as usize)) * 2;
            let i01 = (row1_offset + (gx0 as usize)) * 2;
            let i11 = (row1_offset + (gx1 as usize)) * 2;

            let w00 = inv_tx * inv_ty;
            let w10 = tx * inv_ty;
            let w01 = inv_tx * ty;
            let w11 = tx * ty;

            let dx = (*map_ptr.add(i00)) * w00
                + (*map_ptr.add(i10)) * w10
                + (*map_ptr.add(i01)) * w01
                + (*map_ptr.add(i11)) * w11;

            let dy = (*map_ptr.add(i00 + 1)) * w00
                + (*map_ptr.add(i10 + 1)) * w10
                + (*map_ptr.add(i01 + 1)) * w01
                + (*map_ptr.add(i11 + 1)) * w11;

            let dst_pixel_idx = dst_row_offset + (x as usize);

            if dx > -0.001 && dx < 0.001 && dy > -0.001 && dy < 0.001 {
                *dst_u32.add(dst_pixel_idx) = *src_u32.add(dst_pixel_idx);
                continue;
            }

            let sx = clamp_f32((x as f32) - dx, 0.0, max_x_f);
            let sy = clamp_f32((y as f32) - dy, 0.0, max_y_f);

            let x0 = sx as i32;
            let y0 = sy as i32;
            let x1 = if x0 < max_x_idx { x0 + 1 } else { x0 };
            let y1 = if y0 < max_y_idx { y0 + 1 } else { y0 };

            let fx = sx - (x0 as f32);
            let fy = sy - (y0 as f32);
            let ifx = 1.0 - fx;
            let ify = 1.0 - fy;

            let pw00 = ifx * ify;
            let pw10 = fx * ify;
            let pw01 = ifx * fy;
            let pw11 = fx * fy;

            let p00 = ((y0 as usize) * w_usize + (x0 as usize)) * 4;
            let p10 = ((y0 as usize) * w_usize + (x1 as usize)) * 4;
            let p01 = ((y1 as usize) * w_usize + (x0 as usize)) * 4;
            let p11 = ((y1 as usize) * w_usize + (x1 as usize)) * 4;

            let a00 = (*src_u8.add(p00 + 3) as f32) * pw00;
            let a10 = (*src_u8.add(p10 + 3) as f32) * pw10;
            let a01 = (*src_u8.add(p01 + 3) as f32) * pw01;
            let a11 = (*src_u8.add(p11 + 3) as f32) * pw11;
            let out_a = a00 + a10 + a01 + a11;

            let dst_byte_idx = dst_pixel_idx * 4;
            if out_a < 0.5 {
                *dst_u32.add(dst_pixel_idx) = 0;
            } else {
                let inv_a = 1.0 / out_a;
                let r = ((*src_u8.add(p00) as f32) * a00
                    + (*src_u8.add(p10) as f32) * a10
                    + (*src_u8.add(p01) as f32) * a01
                    + (*src_u8.add(p11) as f32) * a11)
                    * inv_a;
                let g = ((*src_u8.add(p00 + 1) as f32) * a00
                    + (*src_u8.add(p10 + 1) as f32) * a10
                    + (*src_u8.add(p01 + 1) as f32) * a01
                    + (*src_u8.add(p11 + 1) as f32) * a11)
                    * inv_a;
                let b = ((*src_u8.add(p00 + 2) as f32) * a00
                    + (*src_u8.add(p10 + 2) as f32) * a10
                    + (*src_u8.add(p01 + 2) as f32) * a01
                    + (*src_u8.add(p11 + 2) as f32) * a11)
                    * inv_a;

                *dst_u8.add(dst_byte_idx) = (r + 0.5) as u8;
                *dst_u8.add(dst_byte_idx + 1) = (g + 0.5) as u8;
                *dst_u8.add(dst_byte_idx + 2) = (b + 0.5) as u8;
                *dst_u8.add(dst_byte_idx + 3) = (out_a + 0.5) as u8;
            }
        }
    }
}

// ============================================================================
// 2. AIR PAINT AERODYNAMIC ADVECTION & CURL NOISE KERNEL
// ============================================================================

#[inline(always)]
fn hash2(x: i32, y: i32) -> f32 {
    let n = x.wrapping_mul(374761393).wrapping_add(y.wrapping_mul(668265263));
    let n2 = (n ^ (n >> 13)).wrapping_mul(1274126177);
    let u = ((n2 ^ (n2 >> 16)) as u32) & 0x7fffffff;
    (u as f32) / 2147483647.0
}

#[inline(always)]
fn noise2d(x: f32, y: f32) -> f32 {
    let ix = floor_f32(x);
    let iy = floor_f32(y);
    let fx = x - (ix as f32);
    let fy = y - (iy as f32);
    let ux = fx * fx * (3.0 - 2.0 * fx);
    let uy = fy * fy * (3.0 - 2.0 * fy);

    let a = hash2(ix, iy);
    let b = hash2(ix + 1, iy);
    let c = hash2(ix, iy + 1);
    let d = hash2(ix + 1, iy + 1);

    a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}

#[no_mangle]
pub unsafe extern "C" fn air_advect_region(
    src_u8: *const u8,
    dst_u8: *mut u8,
    bw: i32,
    bh: i32,
    bx: f32,
    by: f32,
    cx: f32,
    cy: f32,
    radius: f32,
    turb_scale: f32,
    turb_power: f32,
    blow_vx: f32,
    blow_vy: f32,
    radial_push: f32,
    diffusion: f32,
    phase: f32,
) -> i32 {
    let r_sq = radius * radius;
    let bw_usize = bw as usize;
    let max_x_f = (bw - 1) as f32;
    let max_y_f = (bh - 1) as f32;
    let max_x_idx = bw - 1;
    let max_y_idx = bh - 1;

    let src_u32 = src_u8 as *const u32;
    let dst_u32 = dst_u8 as *mut u32;
    let total_pixels = (bw as usize) * (bh as usize);
    core::ptr::copy_nonoverlapping(src_u32, dst_u32, total_pixels);

    let mut modified: i32 = 0;
    let eps = 0.25_f32;
    let inv_2eps = 1.0 / (2.0 * eps);
    let inv_radius = 1.0 / radius;

    for py in 0..bh {
        let wy = by + (py as f32);
        let dy = wy - cy;
        let dy2 = dy * dy;
        if dy2 >= r_sq {
            continue;
        }
        let row_offset = (py as usize) * bw_usize;

        for px in 0..bw {
            let wx = bx + (px as f32);
            let dx = wx - cx;
            let d2 = dx * dx + dy2;
            if d2 >= r_sq {
                continue;
            }

            let dist = sqrt_f32(d2);
            let norm_d = dist * inv_radius;
            let t_fall = 1.0 - norm_d * norm_d;
            let falloff = t_fall * t_fall;

            let mut turb_vx = 0.0_f32;
            let mut turb_vy = 0.0_f32;
            if turb_power > 0.001 {
                let nx_coord = wx * turb_scale + phase;
                let ny_coord = wy * turb_scale + phase * 0.73;
                let n_up = noise2d(nx_coord, ny_coord + eps);
                let n_down = noise2d(nx_coord, ny_coord - eps);
                let n_right = noise2d(nx_coord + eps, ny_coord);
                let n_left = noise2d(nx_coord - eps, ny_coord);

                let curl_x = (n_up - n_down) * inv_2eps;
                let curl_y = -(n_right - n_left) * inv_2eps;
                turb_vx = curl_x * turb_power;
                turb_vy = curl_y * turb_power;
            }

            let inv_dist = if dist > 0.5 { 1.0 / dist } else { 0.0 };
            let r_nx = dx * inv_dist;
            let r_ny = dy * inv_dist;
            let radial_factor = norm_d * (1.0 - norm_d) * 4.0;

            let vx = (blow_vx + turb_vx + r_nx * radial_push * radial_factor) * falloff;
            let vy = (blow_vy + turb_vy + r_ny * radial_push * radial_factor) * falloff;

            if vx > -0.02 && vx < 0.02 && vy > -0.02 && vy < 0.02 {
                continue;
            }

            let src_x = clamp_f32((px as f32) - vx, 0.0, max_x_f);
            let src_y = clamp_f32((py as f32) - vy, 0.0, max_y_f);

            let x0 = src_x as i32;
            let y0 = src_y as i32;
            let x1 = if x0 < max_x_idx { x0 + 1 } else { x0 };
            let y1 = if y0 < max_y_idx { y0 + 1 } else { y0 };

            let fx = src_x - (x0 as f32);
            let fy = src_y - (y0 as f32);
            let w00 = (1.0 - fx) * (1.0 - fy);
            let w10 = fx * (1.0 - fy);
            let w01 = (1.0 - fx) * fy;
            let w11 = fx * fy;

            let i00 = ((y0 as usize) * bw_usize + (x0 as usize)) * 4;
            let i10 = ((y0 as usize) * bw_usize + (x1 as usize)) * 4;
            let i01 = ((y1 as usize) * bw_usize + (x0 as usize)) * 4;
            let i11 = ((y1 as usize) * bw_usize + (x1 as usize)) * 4;

            let a00 = (*src_u8.add(i00 + 3) as f32) * w00;
            let a10 = (*src_u8.add(i10 + 3) as f32) * w10;
            let a01 = (*src_u8.add(i01 + 3) as f32) * w01;
            let a11 = (*src_u8.add(i11 + 3) as f32) * w11;
            let out_a = a00 + a10 + a01 + a11;

            let dst_idx = (row_offset + (px as usize)) * 4;
            let orig_a = *src_u8.add(dst_idx + 3);
            if out_a < 0.5 && orig_a == 0 {
                continue;
            }

            modified = 1;
            if out_a > 0.5 {
                let inv_a = 1.0 / out_a;
                let mut r = ((*src_u8.add(i00) as f32) * a00
                    + (*src_u8.add(i10) as f32) * a10
                    + (*src_u8.add(i01) as f32) * a01
                    + (*src_u8.add(i11) as f32) * a11)
                    * inv_a;
                let mut g = ((*src_u8.add(i00 + 1) as f32) * a00
                    + (*src_u8.add(i10 + 1) as f32) * a10
                    + (*src_u8.add(i01 + 1) as f32) * a01
                    + (*src_u8.add(i11 + 1) as f32) * a11)
                    * inv_a;
                let mut b = ((*src_u8.add(i00 + 2) as f32) * a00
                    + (*src_u8.add(i10 + 2) as f32) * a10
                    + (*src_u8.add(i01 + 2) as f32) * a01
                    + (*src_u8.add(i11 + 2) as f32) * a11)
                    * inv_a;
                let mut final_a = out_a;

                if diffusion > 0.01 && orig_a > 0 {
                    let mix = diffusion * falloff;
                    let inv_mix = 1.0 - mix;
                    r = r * inv_mix + (*src_u8.add(dst_idx) as f32) * mix;
                    g = g * inv_mix + (*src_u8.add(dst_idx + 1) as f32) * mix;
                    b = b * inv_mix + (*src_u8.add(dst_idx + 2) as f32) * mix;
                    final_a = out_a * inv_mix + (orig_a as f32) * mix;
                }

                *dst_u8.add(dst_idx) = (r + 0.5) as u8;
                *dst_u8.add(dst_idx + 1) = (g + 0.5) as u8;
                *dst_u8.add(dst_idx + 2) = (b + 0.5) as u8;
                *dst_u8.add(dst_idx + 3) = clamp_i32((final_a + 0.5) as i32, 0, 255) as u8;
            } else {
                let fade = 1.0 - clamp_f32(0.45 * falloff, 0.0, 0.85);
                *dst_u8.add(dst_idx + 3) = ((orig_a as f32) * fade + 0.5) as u8;
            }
        }
    }

    modified
}

// ============================================================================
// 3. FAST IMAGE MASKING & CHUNK INSPECTION KERNELS
// ============================================================================

#[no_mangle]
pub unsafe extern "C" fn rgba_to_tip_mask(pixels_ptr: *mut u8, pixel_count: usize) {
    let mut i = 0;
    let total_bytes = pixel_count * 4;
    while i < total_bytes {
        let r = *pixels_ptr.add(i) as u32;
        let g = *pixels_ptr.add(i + 1) as u32;
        let b = *pixels_ptr.add(i + 2) as u32;
        let a = *pixels_ptr.add(i + 3) as u32;
        let gray = (r + g + b) / 3;
        let inv_gray = 255 - gray;
        let new_a = (inv_gray * a) / 255;
        *pixels_ptr.add(i) = 0;
        *pixels_ptr.add(i + 1) = 0;
        *pixels_ptr.add(i + 2) = 0;
        *pixels_ptr.add(i + 3) = if new_a > 255 { 255 } else { new_a as u8 };
        i += 4;
    }
}

#[no_mangle]
pub unsafe extern "C" fn is_buffer_empty(pixels_u32: *const u32, pixel_count: usize) -> u32 {
    if pixels_u32.is_null() || pixel_count == 0 {
        return 1;
    }
    let mut i = 0;
    while i + 8 <= pixel_count {
        if (*pixels_u32.add(i) & 0xFF00_0000) != 0
            || (*pixels_u32.add(i + 1) & 0xFF00_0000) != 0
            || (*pixels_u32.add(i + 2) & 0xFF00_0000) != 0
            || (*pixels_u32.add(i + 3) & 0xFF00_0000) != 0
            || (*pixels_u32.add(i + 4) & 0xFF00_0000) != 0
            || (*pixels_u32.add(i + 5) & 0xFF00_0000) != 0
            || (*pixels_u32.add(i + 6) & 0xFF00_0000) != 0
            || (*pixels_u32.add(i + 7) & 0xFF00_0000) != 0
        {
            return 0;
        }
        i += 8;
    }
    while i < pixel_count {
        if (*pixels_u32.add(i) & 0xFF00_0000) != 0 {
            return 0;
        }
        i += 1;
    }
    1
}

// ============================================================================
// 4. HIGH-PERFORMANCE FLUID PAINT ADVECTION & IMPASTO SHADING KERNELS
// ============================================================================

#[inline(always)]
fn sin_f32_approx(mut x: f32) -> f32 {
    const PI: f32 = 3.141592653589793;
    const TWO_PI: f32 = 6.283185307179586;
    x = x - TWO_PI * floor_f32(x / TWO_PI + 0.5) as f32;
    let b = 4.0 / PI;
    let c = -4.0 / (PI * PI);
    let y = b * x + c * x * (if x < 0.0 { -x } else { x });
    const P: f32 = 0.225;
    y * (1.0 - P) + P * y * (if y < 0.0 { -y } else { y })
}

#[inline(always)]
fn cos_f32_approx(x: f32) -> f32 {
    const HALF_PI: f32 = 1.5707963267948966;
    sin_f32_approx(x + HALF_PI)
}

#[inline(always)]
fn get_sq_distance_to_segment(px: f32, py: f32, ax: f32, ay: f32, bx: f32, by: f32) -> f32 {
    let dx = bx - ax;
    let dy = by - ay;
    let len_sq = dx * dx + dy * dy;
    if len_sq <= 0.00001 {
        let dax = px - ax;
        let day = py - ay;
        return dax * dax + day * day;
    }
    let t = clamp_f32(((px - ax) * dx + (py - ay) * dy) / len_sq, 0.0, 1.0);
    let rx = px - (ax + t * dx);
    let ry = py - (ay + t * dy);
    rx * rx + ry * ry
}

#[no_mangle]
pub unsafe extern "C" fn fluid_compute_velocity_field(
    u_vel: *mut f32,
    v_vel: *mut f32,
    cols: i32,
    rows: i32,
    cell_size: f32,
    ax: f32,
    ay: f32,
    bx: f32,
    by: f32,
    cap_dx: f32,
    cap_dy: f32,
    local_active_radius: f32,
    brush_power_damping: f32,
    speed_cap: f32,
    val_vortex: f32,
    val_turb: f32,
) {
    if u_vel.is_null() || v_vel.is_null() || cols <= 0 || rows <= 0 || cell_size <= 0.0 {
        return;
    }
    let r_sq = local_active_radius * local_active_radius;
    let inv_r_sq = if r_sq > 0.0001 { 1.0 / r_sq } else { 0.0 };
    let dx_ab = bx - ax;
    let dy_ab = by - ay;
    let len_sq_ab = dx_ab * dx_ab + dy_ab * dy_ab;
    let inv_len_sq_ab = if len_sq_ab > 0.0001 { 1.0 / len_sq_ab } else { 0.0 };

    let swirl_power = speed_cap * 1.5 * (val_vortex / 100.0) * brush_power_damping;
    let turb_power = speed_cap * 1.0 * (val_turb / 100.0) * brush_power_damping;
    let u_push = cap_dx * 0.58 * brush_power_damping;
    let v_push = cap_dy * 0.58 * brush_power_damping;

    for cy in 0..rows {
        let py = (cy as f32) * cell_size + cell_size * 0.5;
        let row_offset = (cy as usize) * (cols as usize);

        for cx in 0..cols {
            let px = (cx as f32) * cell_size + cell_size * 0.5;
            let grid_idx = row_offset + (cx as usize);

            let dist_sq = get_sq_distance_to_segment(px, py, ax, ay, bx, by);
            if dist_sq >= r_sq {
                *u_vel.add(grid_idx) = 0.0;
                *v_vel.add(grid_idx) = 0.0;
                continue;
            }

            let ratio_sq = dist_sq * inv_r_sq;
            let f_term = 1.0 - ratio_sq;
            let force = f_term * f_term;

            let mut cell_u = u_push * force;
            let mut cell_v = v_push * force;

            // Project onto stroke segment to find segment normal
            let t = if len_sq_ab > 0.0001 {
                clamp_f32(((px - ax) * dx_ab + (py - ay) * dy_ab) * inv_len_sq_ab, 0.0, 1.0)
            } else {
                0.0
            };
            let proj_x = ax + t * dx_ab;
            let proj_y = ay + t * dy_ab;
            let normal_x = px - proj_x;
            let normal_y = py - proj_y;
            let norm_dist = sqrt_f32(normal_x * normal_x + normal_y * normal_y);
            let inv_norm_dist = if norm_dist > 0.1 { 1.0 / norm_dist } else { 1.0 };

            cell_u += (-normal_y * inv_norm_dist) * swirl_power * force;
            cell_v += (normal_x * inv_norm_dist) * swirl_power * force;

            if turb_power > 0.001 {
                let noise_u = sin_f32_approx(py * 0.08 + px * 0.06) * turb_power * force;
                let noise_v = cos_f32_approx(px * 0.08 - py * 0.06) * turb_power * force;
                cell_u += noise_u;
                cell_v += noise_v;
            }

            *u_vel.add(grid_idx) = cell_u;
            *v_vel.add(grid_idx) = cell_v;
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn fluid_advect_and_shade(
    src_pixels: *const u8,
    dst_pixels: *mut u8,
    src_height: *const f32,
    dst_height: *mut f32,
    u_vel: *const f32,
    v_vel: *const f32,
    w: i32,
    h: i32,
    cols: i32,
    rows: i32,
    cell_size: f32,
    ax: f32,
    ay: f32,
    bx: f32,
    by: f32,
    calc_size: f32,
    dt: f32,
    val_gloss: f32,
    is_impasto: i32,
) {
    if src_pixels.is_null()
        || dst_pixels.is_null()
        || src_height.is_null()
        || dst_height.is_null()
        || u_vel.is_null()
        || v_vel.is_null()
        || w <= 0
        || h <= 0
        || cols <= 0
        || rows <= 0
        || cell_size <= 0.0
    {
        return;
    }
    let w_usize = w as usize;
    let inv_cell = 1.0 / cell_size;
    let outer_boundary = calc_size * 1.5;
    let outer_boundary_sq = outer_boundary * outer_boundary;
    let inner_boundary = calc_size * 0.45;
    let inv_boundary_range = if outer_boundary > inner_boundary {
        1.0 / (outer_boundary - inner_boundary)
    } else {
        1.0
    };

    let max_cols_idx = cols - 1;
    let max_rows_idx = rows - 1;
    let max_x_idx = w - 1;
    let max_y_idx = h - 1;

    let src_u32 = src_pixels as *const u32;
    let dst_u32 = dst_pixels as *mut u32;

    for y in 0..h {
        let y_f = y as f32;
        let cell_y = y_f * inv_cell;
        let cy0 = clamp_i32(cell_y as i32, 0, max_rows_idx);
        let cy1 = clamp_i32(cy0 + 1, 0, max_rows_idx);
        let ty = cell_y - (cy0 as f32);
        let inv_ty = 1.0 - ty;

        let row_offset = (y as usize) * w_usize;
        let cy0_offset = (cy0 as usize) * (cols as usize);
        let cy1_offset = (cy1 as usize) * (cols as usize);

        for x in 0..w {
            let x_f = x as f32;
            let pixel_idx = row_offset + (x as usize);
            let byte_idx = pixel_idx * 4;

            let dist_sq = get_sq_distance_to_segment(x_f, y_f, ax, ay, bx, by);
            if dist_sq > outer_boundary_sq {
                *dst_u32.add(pixel_idx) = *src_u32.add(pixel_idx);
                *dst_height.add(pixel_idx) = *src_height.add(pixel_idx);
                continue;
            }

            // Bilinear interpolate velocity field
            let cell_x = x_f * inv_cell;
            let cx0 = clamp_i32(cell_x as i32, 0, max_cols_idx);
            let cx1 = clamp_i32(cx0 + 1, 0, max_cols_idx);
            let tx = cell_x - (cx0 as f32);
            let inv_tx = 1.0 - tx;

            let i00 = cy0_offset + (cx0 as usize);
            let i10 = cy0_offset + (cx1 as usize);
            let i01 = cy1_offset + (cx0 as usize);
            let i11 = cy1_offset + (cx1 as usize);

            let w00 = inv_tx * inv_ty;
            let w10 = tx * inv_ty;
            let w01 = inv_tx * ty;
            let w11 = tx * ty;

            let vel_x = (*u_vel.add(i00)) * w00
                + (*u_vel.add(i10)) * w10
                + (*u_vel.add(i01)) * w01
                + (*u_vel.add(i11)) * w11;

            let vel_y = (*v_vel.add(i00)) * w00
                + (*v_vel.add(i10)) * w10
                + (*v_vel.add(i01)) * w01
                + (*v_vel.add(i11)) * w11;

            // Backtrack
            let src_x = x_f - vel_x * dt;
            let src_y = y_f - vel_y * dt;

            let sx0 = floor_f32(src_x);
            let sy0 = floor_f32(src_y);
            let sx1 = clamp_i32(sx0 + 1, 0, max_x_idx);
            let sy1 = clamp_i32(sy0 + 1, 0, max_y_idx);
            let csx0 = clamp_i32(sx0, 0, max_x_idx);
            let csy0 = clamp_i32(sy0, 0, max_y_idx);

            let s1 = src_x - (sx0 as f32);
            let s0 = 1.0 - s1;
            let t1 = src_y - (sy0 as f32);
            let t0 = 1.0 - t1;

            let p00_idx = ((csy0 as usize) * w_usize + (csx0 as usize)) * 4;
            let p10_idx = ((csy0 as usize) * w_usize + (sx1 as usize)) * 4;
            let p01_idx = ((sy1 as usize) * w_usize + (csx0 as usize)) * 4;
            let p11_idx = ((sy1 as usize) * w_usize + (sx1 as usize)) * 4;

            let a00 = *src_pixels.add(p00_idx + 3) as f32;
            let a10 = *src_pixels.add(p10_idx + 3) as f32;
            let a01 = *src_pixels.add(p01_idx + 3) as f32;
            let a11 = *src_pixels.add(p11_idx + 3) as f32;

            let pw00 = s0 * t0 * a00;
            let pw10 = s1 * t0 * a10;
            let pw01 = s0 * t1 * a01;
            let pw11 = s1 * t1 * a11;
            let sum_w = pw00 + pw10 + pw01 + pw11;

            let (adv_r, adv_g, adv_b) = if sum_w > 0.1 {
                let inv_sum = 1.0 / sum_w;
                (
                    (pw00 * (*src_pixels.add(p00_idx) as f32)
                        + pw10 * (*src_pixels.add(p10_idx) as f32)
                        + pw01 * (*src_pixels.add(p01_idx) as f32)
                        + pw11 * (*src_pixels.add(p11_idx) as f32))
                        * inv_sum,
                    (pw00 * (*src_pixels.add(p00_idx + 1) as f32)
                        + pw10 * (*src_pixels.add(p10_idx + 1) as f32)
                        + pw01 * (*src_pixels.add(p01_idx + 1) as f32)
                        + pw11 * (*src_pixels.add(p11_idx + 1) as f32))
                        * inv_sum,
                    (pw00 * (*src_pixels.add(p00_idx + 2) as f32)
                        + pw10 * (*src_pixels.add(p10_idx + 2) as f32)
                        + pw01 * (*src_pixels.add(p01_idx + 2) as f32)
                        + pw11 * (*src_pixels.add(p11_idx + 2) as f32))
                        * inv_sum,
                )
            } else {
                (
                    s0 * (t0 * (*src_pixels.add(p00_idx) as f32)
                        + t1 * (*src_pixels.add(p01_idx) as f32))
                        + s1 * (t0 * (*src_pixels.add(p10_idx) as f32)
                            + t1 * (*src_pixels.add(p11_idx) as f32)),
                    s0 * (t0 * (*src_pixels.add(p00_idx + 1) as f32)
                        + t1 * (*src_pixels.add(p01_idx + 1) as f32))
                        + s1 * (t0 * (*src_pixels.add(p10_idx + 1) as f32)
                            + t1 * (*src_pixels.add(p11_idx + 1) as f32)),
                    s0 * (t0 * (*src_pixels.add(p00_idx + 2) as f32)
                        + t1 * (*src_pixels.add(p01_idx + 2) as f32))
                        + s1 * (t0 * (*src_pixels.add(p10_idx + 2) as f32)
                            + t1 * (*src_pixels.add(p11_idx + 2) as f32)),
                )
            };

            let h00 = *src_height.add((csy0 as usize) * w_usize + (csx0 as usize));
            let h10 = *src_height.add((csy0 as usize) * w_usize + (sx1 as usize));
            let h01 = *src_height.add((sy1 as usize) * w_usize + (csx0 as usize));
            let h11 = *src_height.add((sy1 as usize) * w_usize + (sx1 as usize));

            let orig_alpha = *src_pixels.add(byte_idx + 3) as f32;
            let orig_height = *src_height.add(pixel_idx);

            let mut adv_height = s0 * (t0 * h00 + t1 * h01) + s1 * (t0 * h10 + t1 * h11);
            if orig_alpha > 10.0 && adv_height < orig_height * 0.5 {
                adv_height = if adv_height > orig_height * 0.7 {
                    adv_height
                } else {
                    orig_height * 0.7
                };
            }

            let dist = sqrt_f32(dist_sq);
            let blend_factor = if dist > inner_boundary {
                let t = clamp_f32((dist - inner_boundary) * inv_boundary_range, 0.0, 1.0);
                1.0 - (t * t * (3.0 - 2.0 * t))
            } else {
                1.0
            };

            let orig_r = *src_pixels.add(byte_idx) as f32;
            let orig_g = *src_pixels.add(byte_idx + 1) as f32;
            let orig_b = *src_pixels.add(byte_idx + 2) as f32;

            let res_r = orig_r + (adv_r - orig_r) * blend_factor;
            let res_g = orig_g + (adv_g - orig_g) * blend_factor;
            let res_b = orig_b + (adv_b - orig_b) * blend_factor;

            let final_height = orig_height + (adv_height - orig_height) * blend_factor;
            let adv_alpha = clamp_f32(final_height * 255.0, orig_alpha, 255.0);
            let final_alpha = orig_alpha + (adv_alpha - orig_alpha) * blend_factor;

            *dst_pixels.add(byte_idx) = clamp_f32(res_r + 0.5, 0.0, 255.0) as u8;
            *dst_pixels.add(byte_idx + 1) = clamp_f32(res_g + 0.5, 0.0, 255.0) as u8;
            *dst_pixels.add(byte_idx + 2) = clamp_f32(res_b + 0.5, 0.0, 255.0) as u8;
            *dst_pixels.add(byte_idx + 3) = clamp_f32(final_alpha + 0.5, 0.0, 255.0) as u8;
            *dst_height.add(pixel_idx) = final_height;
        }
    }

    // Surface Shading Pass
    if is_impasto != 0 && val_gloss > 0.001 {
        for y in 1..(h - 1) {
            let y_f = y as f32;
            let row_offset = (y as usize) * w_usize;

            for x in 1..(w - 1) {
                let x_f = x as f32;
                let dist_sq = get_sq_distance_to_segment(x_f, y_f, ax, ay, bx, by);
                if dist_sq > outer_boundary_sq {
                    continue;
                }

                let dist = sqrt_f32(dist_sq);
                let shading_blend = if dist > inner_boundary {
                    let t = clamp_f32((dist - inner_boundary) * inv_boundary_range, 0.0, 1.0);
                    1.0 - (t * t * (3.0 - 2.0 * t))
                } else {
                    1.0
                };

                let h00 = *dst_height.add(row_offset + ((x - 1) as usize));
                let h10 = *dst_height.add(row_offset + ((x + 1) as usize));
                let h01 = *dst_height.add(((y - 1) as usize) * w_usize + (x as usize));
                let h11 = *dst_height.add(((y + 1) as usize) * w_usize + (x as usize));

                let dh_dx = h10 - h00;
                let dh_dy = h11 - h01;
                let dot = dh_dx * 0.5 + dh_dy * 0.5;

                let byte_idx = (row_offset + (x as usize)) * 4;
                let r_orig = *dst_pixels.add(byte_idx) as f32;
                let g_orig = *dst_pixels.add(byte_idx + 1) as f32;
                let b_orig = *dst_pixels.add(byte_idx + 2) as f32;

                let (r_s, g_s, b_s) = if dot >= 0.0 {
                    let val_highlight = dot * val_gloss * shading_blend;
                    (
                        r_orig + val_highlight * 1.15,
                        g_orig + val_highlight * 1.0,
                        b_orig + val_highlight * 0.4,
                    )
                } else {
                    let val_shadow = (-dot) * val_gloss * shading_blend;
                    (
                        r_orig - val_shadow * 1.25,
                        g_orig - val_shadow * 1.0,
                        b_orig - val_shadow * 0.45,
                    )
                };

                *dst_pixels.add(byte_idx) = clamp_f32(r_s + 0.5, 0.0, 255.0) as u8;
                *dst_pixels.add(byte_idx + 1) = clamp_f32(g_s + 0.5, 0.0, 255.0) as u8;
                *dst_pixels.add(byte_idx + 2) = clamp_f32(b_s + 0.5, 0.0, 255.0) as u8;
            }
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn fluid_stamp_bristle(
    pixels_ptr: *mut u8,
    height_ptr: *mut f32,
    w: i32,
    h: i32,
    px: f32,
    py: f32,
    bristle_radius: f32,
    bristle_r: f32,
    bristle_g: f32,
    bristle_b: f32,
    bristle_alpha: f32,
    opacity: f32,
    flow: f32,
    val_depth: f32,
    nx: f32,
    ny: f32,
) {
    if pixels_ptr.is_null() || height_ptr.is_null() || w <= 0 || h <= 0 || bristle_radius <= 0.0 {
        return;
    }
    let bs_r = bristle_radius;
    let bs_sq = bs_r * bs_r;
    let inv_bs_r = 1.0 / bs_r;

    let start_x = clamp_i32(floor_f32(px - bs_r), 0, w - 1);
    let end_x = clamp_i32(ceil_f32(px + bs_r), 0, w - 1);
    let start_y = clamp_i32(floor_f32(py - bs_r), 0, h - 1);
    let end_y = clamp_i32(ceil_f32(py + bs_r), 0, h - 1);

    if start_x > end_x || start_y > end_y {
        return;
    }

    let w_usize = w as usize;
    let blend_base = bristle_alpha * opacity * flow * 0.7;

    for y in start_y..=end_y {
        let dy = (y as f32) - py;
        let dy_sq = dy * dy;
        let row_offset = (y as usize) * w_usize;

        for x in start_x..=end_x {
            let dx = (x as f32) - px;
            let dist_sq = dx * dx + dy_sq;
            if dist_sq < bs_sq {
                let d_ratio = sqrt_f32(dist_sq) * inv_bs_r;
                let falloff = 1.0 - d_ratio * d_ratio;
                let blend_factor = falloff * blend_base;

                let pix_idx = (row_offset + (x as usize)) * 4;
                let height_idx = row_offset + (x as usize);

                let bg_alpha = (*pixels_ptr.add(pix_idx + 3) as f32) * (1.0 / 255.0);
                let dst_alpha = blend_factor;
                let out_alpha = bg_alpha + dst_alpha * (1.0 - bg_alpha);

                if out_alpha > 0.001 {
                    let bg_weight = bg_alpha * (1.0 - dst_alpha) / out_alpha;
                    let fg_weight = dst_alpha / out_alpha;

                    let cur_r = *pixels_ptr.add(pix_idx) as f32;
                    let cur_g = *pixels_ptr.add(pix_idx + 1) as f32;
                    let cur_b = *pixels_ptr.add(pix_idx + 2) as f32;

                    let new_r = cur_r * bg_weight + bristle_r * fg_weight;
                    let new_g = cur_g * bg_weight + bristle_g * fg_weight;
                    let new_b = cur_b * bg_weight + bristle_b * fg_weight;

                    *pixels_ptr.add(pix_idx) = clamp_f32(new_r + 0.5, 0.0, 255.0) as u8;
                    *pixels_ptr.add(pix_idx + 1) = clamp_f32(new_g + 0.5, 0.0, 255.0) as u8;
                    *pixels_ptr.add(pix_idx + 2) = clamp_f32(new_b + 0.5, 0.0, 255.0) as u8;
                }

                // Surface height accumulation
                let current_h = *height_ptr.add(height_idx);
                let perp_dist = (x as f32) * nx + (y as f32) * ny;
                let ridge_noise = sin_f32_approx(perp_dist * 1.1) * 0.16 + sin_f32_approx(perp_dist * 2.8) * 0.08;
                let build_factor = 0.08 * (val_depth * 0.01) * (1.0 + ridge_noise);
                let new_h = clamp_f32(current_h + dst_alpha * build_factor, out_alpha, 2.5);
                *height_ptr.add(height_idx) = new_h;

                let final_alpha_u8 = clamp_f32(new_h * 255.0 + 0.5, 0.0, 255.0) as u8;
                let old_alpha_u8 = *pixels_ptr.add(pix_idx + 3);
                if final_alpha_u8 > old_alpha_u8 {
                    *pixels_ptr.add(pix_idx + 3) = final_alpha_u8;
                }
            }
        }
    }
}

// ============================================================================
// LIQUIFY UNIFIED STROKE SESSION KERNEL
// ============================================================================

struct LiquifySession {
    w: i32,
    h: i32,
    grid_w: i32,
    grid_h: i32,
    cell_size: f32,
    inv_cell: f32,
    origin_x: f32,
    origin_y: f32,
    src_capacity: usize,
    grid_capacity: usize,
    src_ptr: *mut u8,
    grid_ptr: *mut f32,
    scratch_ptr: *mut f32,
    warp_out_capacity: usize,
    warp_out_ptr: *mut u8,
}

static mut LIQUIFY_SESSION: LiquifySession = LiquifySession {
    w: 0,
    h: 0,
    grid_w: 0,
    grid_h: 0,
    cell_size: 8.0,
    inv_cell: 0.125,
    origin_x: 0.0,
    origin_y: 0.0,
    src_capacity: 0,
    grid_capacity: 0,
    src_ptr: core::ptr::null_mut(),
    grid_ptr: core::ptr::null_mut(),
    scratch_ptr: core::ptr::null_mut(),
    warp_out_capacity: 0,
    warp_out_ptr: core::ptr::null_mut(),
};

#[no_mangle]
pub unsafe extern "C" fn liquify_session_start(
    w: i32,
    h: i32,
    cell_size: f32,
    origin_x: f32,
    origin_y: f32,
) -> i32 {
    if w <= 0 || h <= 0 || cell_size <= 0.0 {
        return 0;
    }

    let grid_w = ceil_f32((w as f32) / cell_size) + 1;
    let grid_h = ceil_f32((h as f32) / cell_size) + 1;
    let inv_cell = 1.0 / cell_size;

    let img_bytes = (w as usize) * (h as usize) * 4;
    let grid_len = (grid_w as usize) * (grid_h as usize) * 2;
    let grid_bytes = grid_len * 4;

    // Check if existing allocated capacity can be reused without touching wasm_alloc!
    if LIQUIFY_SESSION.src_ptr.is_null() || LIQUIFY_SESSION.src_capacity < img_bytes {
        wasm_reset_scratch();
        let alloc_img = if img_bytes < 16 * 1024 * 1024 { 16 * 1024 * 1024 } else { img_bytes };
        let alloc_grid = if grid_bytes < 1024 * 1024 { 1024 * 1024 } else { grid_bytes };
        let alloc_out = if img_bytes < 16 * 1024 * 1024 { 16 * 1024 * 1024 } else { img_bytes };

        LIQUIFY_SESSION.src_ptr = wasm_alloc(alloc_img) as *mut u8;
        LIQUIFY_SESSION.src_capacity = alloc_img;

        LIQUIFY_SESSION.grid_ptr = wasm_alloc(alloc_grid) as *mut f32;
        LIQUIFY_SESSION.scratch_ptr = wasm_alloc(alloc_grid) as *mut f32;
        LIQUIFY_SESSION.grid_capacity = alloc_grid;

        LIQUIFY_SESSION.warp_out_ptr = wasm_alloc(alloc_out) as *mut u8;
        LIQUIFY_SESSION.warp_out_capacity = alloc_out;

        wasm_mark_scratch();
    }

    if LIQUIFY_SESSION.src_ptr.is_null() || LIQUIFY_SESSION.grid_ptr.is_null() {
        return 0;
    }

    // Only zero the active grid displacement! (Only ~133KB -> 0.01ms!)
    // DO NOT zero the entire 16MB image buffer, as stamped pixels overwrite it and unstamped pixels are untouched!
    core::ptr::write_bytes(LIQUIFY_SESSION.grid_ptr as *mut u8, 0, grid_bytes);

    LIQUIFY_SESSION.w = w;
    LIQUIFY_SESSION.h = h;
    LIQUIFY_SESSION.grid_w = grid_w;
    LIQUIFY_SESSION.grid_h = grid_h;
    LIQUIFY_SESSION.cell_size = cell_size;
    LIQUIFY_SESSION.inv_cell = inv_cell;
    LIQUIFY_SESSION.origin_x = origin_x;
    LIQUIFY_SESSION.origin_y = origin_y;

    1
}

#[no_mangle]
pub unsafe extern "C" fn liquify_session_get_src_ptr() -> *mut u8 {
    LIQUIFY_SESSION.src_ptr
}

#[no_mangle]
pub unsafe extern "C" fn liquify_session_get_warp_out_ptr() -> *mut u8 {
    LIQUIFY_SESSION.warp_out_ptr
}

#[no_mangle]
pub unsafe extern "C" fn liquify_session_get_w() -> i32 {
    LIQUIFY_SESSION.w
}

#[no_mangle]
pub unsafe extern "C" fn liquify_session_get_h() -> i32 {
    LIQUIFY_SESSION.h
}

#[no_mangle]
pub unsafe extern "C" fn liquify_session_stamp_src(
    chunk_ptr: *const u8,
    chunk_w: i32,
    chunk_h: i32,
    dst_x: i32,
    dst_y: i32,
) -> i32 {
    if LIQUIFY_SESSION.src_ptr.is_null() || chunk_ptr.is_null() || chunk_w <= 0 || chunk_h <= 0 {
        return 0;
    }
    let sess = &raw const LIQUIFY_SESSION;
    let cw_usize = chunk_w as usize;
    let sw_usize = (*sess).w as usize;

    let x0 = clamp_i32(dst_x, 0, (*sess).w);
    let x1 = clamp_i32(dst_x + chunk_w, 0, (*sess).w);
    let y0 = clamp_i32(dst_y, 0, (*sess).h);
    let y1 = clamp_i32(dst_y + chunk_h, 0, (*sess).h);

    if x0 >= x1 || y0 >= y1 {
        return 0;
    }

    let copy_w = (x1 - x0) as usize;
    let copy_bytes = copy_w * 4;

    for y in y0..y1 {
        let cy = (y - dst_y) as usize;
        let cx = (x0 - dst_x) as usize;
        let src_offset = (cy * cw_usize + cx) * 4;
        let dst_offset = ((y as usize) * sw_usize + (x0 as usize)) * 4;
        core::ptr::copy_nonoverlapping(
            chunk_ptr.add(src_offset),
            (*sess).src_ptr.add(dst_offset),
            copy_bytes,
        );
    }
    1
}

#[no_mangle]
pub unsafe extern "C" fn liquify_session_displace(
    p0_x: f32,
    p0_y: f32,
    mv_x: f32,
    mv_y: f32,
    r: f32,
    falloff: f32,
) -> i32 {
    if LIQUIFY_SESSION.grid_ptr.is_null() || r <= 0.0 {
        return 0;
    }
    let sess = &raw mut LIQUIFY_SESSION;
    liquify_displace_grid(
        (*sess).grid_ptr,
        (*sess).scratch_ptr,
        (*sess).grid_w,
        (*sess).grid_h,
        (*sess).cell_size,
        (*sess).origin_x,
        (*sess).origin_y,
        p0_x,
        p0_y,
        mv_x,
        mv_y,
        r,
        falloff,
        core::ptr::null_mut(),
    )
}

#[no_mangle]
pub unsafe extern "C" fn liquify_session_warp_box(
    min_x: i32,
    max_x: i32,
    min_y: i32,
    max_y: i32,
    out_ptr: *mut u8,
) -> i32 {
    if LIQUIFY_SESSION.src_ptr.is_null() {
        return 0;
    }
    let sess = &raw const LIQUIFY_SESSION;
    let dst_ptr = if !out_ptr.is_null() {
        out_ptr
    } else {
        (*sess).warp_out_ptr
    };
    if dst_ptr.is_null() {
        return 0;
    }

    let min_x = clamp_i32(min_x, 0, (*sess).w - 1);
    let max_x = clamp_i32(max_x, 0, (*sess).w - 1);
    let min_y = clamp_i32(min_y, 0, (*sess).h - 1);
    let max_y = clamp_i32(max_y, 0, (*sess).h - 1);

    if min_x > max_x || min_y > max_y {
        return 0;
    }

    let box_w = (max_x - min_x + 1) as usize;
    let w_usize = (*sess).w as usize;
    let gw_usize = (*sess).grid_w as usize;
    let max_x_f = ((*sess).w - 1) as f32;
    let max_y_f = ((*sess).h - 1) as f32;
    let max_x_idx = (*sess).w - 1;
    let max_y_idx = (*sess).h - 1;
    let max_gx_idx = (*sess).grid_w - 2;
    let max_gy_idx = (*sess).grid_h - 2;

    let src_u8 = (*sess).src_ptr as *const u8;
    let src_u32 = (*sess).src_ptr as *const u32;
    let out_u32 = dst_ptr as *mut u32;

    for y in min_y..=max_y {
        let local_y = (y - min_y) as usize;
        let out_row_offset = local_y * box_w;
        let src_row_offset = (y as usize) * w_usize;

        let gy_f = (y as f32) * (*sess).inv_cell;
        let gy0 = clamp_i32(gy_f as i32, 0, max_gy_idx);
        let gy1 = gy0 + 1;
        let ty = gy_f - (gy0 as f32);
        let inv_ty = 1.0 - ty;

        let row0_offset = (gy0 as usize) * gw_usize;
        let row1_offset = (gy1 as usize) * gw_usize;

        for x in min_x..=max_x {
            let local_x = (x - min_x) as usize;
            let out_pixel_idx = out_row_offset + local_x;

            let gx_f = (x as f32) * (*sess).inv_cell;
            let gx0 = clamp_i32(gx_f as i32, 0, max_gx_idx);
            let gx1 = gx0 + 1;
            let tx = gx_f - (gx0 as f32);
            let inv_tx = 1.0 - tx;

            let i00 = (row0_offset + (gx0 as usize)) * 2;
            let i10 = (row0_offset + (gx1 as usize)) * 2;
            let i01 = (row1_offset + (gx0 as usize)) * 2;
            let i11 = (row1_offset + (gx1 as usize)) * 2;

            let w00 = inv_tx * inv_ty;
            let w10 = tx * inv_ty;
            let w01 = inv_tx * ty;
            let w11 = tx * ty;

            let dx = (*(*sess).grid_ptr.add(i00)) * w00
                + (*(*sess).grid_ptr.add(i10)) * w10
                + (*(*sess).grid_ptr.add(i01)) * w01
                + (*(*sess).grid_ptr.add(i11)) * w11;

            let dy = (*(*sess).grid_ptr.add(i00 + 1)) * w00
                + (*(*sess).grid_ptr.add(i10 + 1)) * w10
                + (*(*sess).grid_ptr.add(i01 + 1)) * w01
                + (*(*sess).grid_ptr.add(i11 + 1)) * w11;

            if dx > -0.001 && dx < 0.001 && dy > -0.001 && dy < 0.001 {
                *out_u32.add(out_pixel_idx) = *src_u32.add(src_row_offset + (x as usize));
                continue;
            }

            let sx = clamp_f32((x as f32) - dx, 0.0, max_x_f);
            let sy = clamp_f32((y as f32) - dy, 0.0, max_y_f);

            let x0 = sx as i32;
            let y0 = sy as i32;
            let x1 = if x0 < max_x_idx { x0 + 1 } else { x0 };
            let y1 = if y0 < max_y_idx { y0 + 1 } else { y0 };

            let fx = sx - (x0 as f32);
            let fy = sy - (y0 as f32);
            let ifx = 1.0 - fx;
            let ify = 1.0 - fy;

            let pw00 = ifx * ify;
            let pw10 = fx * ify;
            let pw01 = ifx * fy;
            let pw11 = fx * fy;

            let p00 = ((y0 as usize) * w_usize + (x0 as usize)) * 4;
            let p10 = ((y0 as usize) * w_usize + (x1 as usize)) * 4;
            let p01 = ((y1 as usize) * w_usize + (x0 as usize)) * 4;
            let p11 = ((y1 as usize) * w_usize + (x1 as usize)) * 4;

            let a00 = (*src_u8.add(p00 + 3) as f32) * pw00;
            let a10 = (*src_u8.add(p10 + 3) as f32) * pw10;
            let a01 = (*src_u8.add(p01 + 3) as f32) * pw01;
            let a11 = (*src_u8.add(p11 + 3) as f32) * pw11;
            let out_a = a00 + a10 + a01 + a11;

            let dst_byte_idx = out_pixel_idx * 4;
            if out_a < 0.5 {
                *out_u32.add(out_pixel_idx) = 0;
            } else {
                let inv_a = 1.0 / out_a;
                let r = ((*src_u8.add(p00) as f32) * a00
                    + (*src_u8.add(p10) as f32) * a10
                    + (*src_u8.add(p01) as f32) * a01
                    + (*src_u8.add(p11) as f32) * a11)
                    * inv_a;
                let g = ((*src_u8.add(p00 + 1) as f32) * a00
                    + (*src_u8.add(p10 + 1) as f32) * a10
                    + (*src_u8.add(p01 + 1) as f32) * a01
                    + (*src_u8.add(p11 + 1) as f32) * a11)
                    * inv_a;
                let b = ((*src_u8.add(p00 + 2) as f32) * a00
                    + (*src_u8.add(p10 + 2) as f32) * a10
                    + (*src_u8.add(p01 + 2) as f32) * a01
                    + (*src_u8.add(p11 + 2) as f32) * a11)
                    * inv_a;

                *dst_ptr.add(dst_byte_idx) = (r + 0.5) as u8;
                *dst_ptr.add(dst_byte_idx + 1) = (g + 0.5) as u8;
                *dst_ptr.add(dst_byte_idx + 2) = (b + 0.5) as u8;
                *dst_ptr.add(dst_byte_idx + 3) = (out_a + 0.5) as u8;
            }
        }
    }
    1
}

#[no_mangle]
pub unsafe extern "C" fn liquify_session_end() {
    LIQUIFY_SESSION.w = 0;
    LIQUIFY_SESSION.h = 0;
    LIQUIFY_SESSION.origin_x = 0.0;
    LIQUIFY_SESSION.origin_y = 0.0;
    // Retain allocated buffers in LIQUIFY_SESSION for subsequent strokes (0-lag reuse)
}

