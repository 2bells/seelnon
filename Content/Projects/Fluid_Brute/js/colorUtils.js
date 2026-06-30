// Helper to convert hex to RGB
export function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const num = parseInt(hex, 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
}

// Helper to convert RGB to hex
export function rgbToHex(r, g, b) {
    r = Math.max(0, Math.min(255, Math.round(r)));
    g = Math.max(0, Math.min(255, Math.round(g)));
    b = Math.max(0, Math.min(255, Math.round(b)));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

// Helper to convert RGB to HSV
// h: 0-360, s: 0-100, v: 0-100
export function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) {
        h = 0; // achromatic
    } else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return {
        h: h * 360,
        s: s * 100,
        v: v * 100
    };
}

// Helper to convert HSV to RGB
export function hsvToRgb(h, s, v) {
    h = (h % 360 + 360) % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    v = Math.max(0, Math.min(100, v)) / 100;

    let r, g, b;
    const i = Math.floor(h / 60);
    const f = h / 60 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

export function mixColors(hex1, hex2) {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);
    // Average the pigment / RGB colors
    const r = (rgb1.r + rgb2.r) / 2;
    const g = (rgb1.g + rgb2.g) / 2;
    const b = (rgb1.b + rgb2.b) / 2;
    return rgbToHex(r, g, b);
}

export function shiftColor(hex, dh, ds, dv) {
    const rgb = hexToRgb(hex);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    
    // Shift Hue, Saturation, and Value
    hsv.h = (hsv.h + dh) % 360;
    hsv.s = Math.max(0, Math.min(100, hsv.s + ds));
    hsv.v = Math.max(0, Math.min(100, hsv.v + dv));
    
    const shiftedRgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
    return rgbToHex(shiftedRgb.r, shiftedRgb.g, shiftedRgb.b);
}

// Trilinear interpolation for RYB to RGB conversion
function trilinearInterpolate(p, v000, v100, v010, v001, v101, v011, v110, v111) {
    const r = v000[0] * (1.0 - p[0]) * (1.0 - p[1]) * (1.0 - p[2]) +
              v100[0] * p[0] * (1.0 - p[1]) * (1.0 - p[2]) +
              v010[0] * (1.0 - p[0]) * p[1] * (1.0 - p[2]) +
              v001[0] * (1.0 - p[0]) * (1.0 - p[1]) * p[2] +
              v101[0] * p[0] * (1.0 - p[1]) * p[2] +
              v011[0] * (1.0 - p[0]) * p[1] * p[2] +
              v110[0] * p[0] * p[1] * (1.0 - p[2]) +
              v111[0] * p[0] * p[1] * p[2];

    const g = v000[1] * (1.0 - p[0]) * (1.0 - p[1]) * (1.0 - p[2]) +
              v100[1] * p[0] * (1.0 - p[1]) * (1.0 - p[2]) +
              v010[1] * (1.0 - p[0]) * p[1] * (1.0 - p[2]) +
              v001[1] * (1.0 - p[0]) * (1.0 - p[1]) * p[2] +
              v101[1] * p[0] * (1.0 - p[1]) * p[2] +
              v011[1] * (1.0 - p[0]) * p[1] * p[2] +
              v110[1] * p[0] * p[1] * (1.0 - p[2]) +
              v111[1] * p[0] * p[1] * p[2];

    const b = v000[2] * (1.0 - p[0]) * (1.0 - p[1]) * (1.0 - p[2]) +
              v100[2] * p[0] * (1.0 - p[1]) * (1.0 - p[2]) +
              v010[2] * (1.0 - p[0]) * p[1] * (1.0 - p[2]) +
              v001[2] * (1.0 - p[0]) * (1.0 - p[1]) * p[2] +
              v101[2] * p[0] * (1.0 - p[1]) * p[2] +
              v011[2] * (1.0 - p[0]) * p[1] * p[2] +
              v110[2] * p[0] * p[1] * (1.0 - p[2]) +
              v111[2] * p[0] * p[1] * p[2];

    return [r, g, b];
}

export function rybToRgb(ryb) {
    return trilinearInterpolate(ryb, 
        [1.0, 1.0, 1.0], 
        [1.0, 0.0, 0.0], 
        [0.163, 0.373, 0.6], 
        [1.0, 1.0, 0.0], 
        [1.0, 0.5, 0.0], 
        [0.0, 0.66, 0.2],
        [0.5, 0.0, 0.5],
        [0.2, 0.094, 0.0]
    );
}

export function pigmentToScreen(hex, isRyb) {
    if (!isRyb) return hex;
    const rgb = hexToRgb(hex);
    const rybVal = [rgb.r / 255, rgb.g / 255, rgb.b / 255];
    const outRgb = rybToRgb(rybVal);
    return rgbToHex(outRgb[0] * 255, outRgb[1] * 255, outRgb[2] * 255);
}
