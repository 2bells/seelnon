precision highp float;

varying vec2 v_coordinates;

uniform sampler2D u_paintTexture;
uniform vec2 u_resolution;
uniform vec2 u_brushPos;
uniform vec2 u_prevBrushPos;
uniform float u_radius;
uniform float u_strength;
uniform int u_mode; // 0: push, 1: twirl CW, 2: twirl CCW, 3: pinch, 4: bloat

vec4 sampleTexel(sampler2D tex, vec2 coord, vec2 resolution) {
    vec2 clamped = clamp(coord, vec2(0.5) / resolution, vec2(1.0) - vec2(0.5) / resolution);
    return texture2D(tex, clamped);
}

vec4 textureCatmullRom(sampler2D tex, vec2 uv, vec2 resolution) {
    vec2 texelSize = 1.0 / resolution;
    vec2 position = uv * resolution - 0.5;
    vec2 i = floor(position);
    vec2 f = fract(position);

    vec4 wx, wy;
    
    // X Weights
    float t = f.x;
    float t2 = t * t;
    float t3 = t2 * t;
    wx.x = 0.5 * (-t3 + 2.0 * t2 - t);
    wx.y = 0.5 * (3.0 * t3 - 5.0 * t2 + 2.0);
    wx.z = 0.5 * (-3.0 * t3 + 4.0 * t2 + t);
    wx.w = 0.5 * (t3 - t2);

    // Y Weights
    t = f.y;
    t2 = t * t;
    t3 = t2 * t;
    wy.x = 0.5 * (-t3 + 2.0 * t2 - t);
    wy.y = 0.5 * (3.0 * t3 - 5.0 * t2 + 2.0);
    wy.z = 0.5 * (-3.0 * t3 + 4.0 * t2 + t);
    wy.w = 0.5 * (t3 - t2);

    vec4 color = vec4(0.0);
    
    // Nested loop using conditional selection to be fully WebGL 1.0 ES compliant
    for (int y = -1; y <= 2; y++) {
        float wy_val = (y == -1) ? wy.x : ((y == 0) ? wy.y : ((y == 1) ? wy.z : wy.w));
        float yCoord = (i.y + float(y) + 0.5) * texelSize.y;
        
        for (int x = -1; x <= 2; x++) {
            float wx_val = (x == -1) ? wx.x : ((x == 0) ? wx.y : ((x == 1) ? wx.z : wx.w));
            float xCoord = (i.x + float(x) + 0.5) * texelSize.x;
            
            color += sampleTexel(tex, vec2(xCoord, yCoord), resolution) * wx_val * wy_val;
        }
    }
    
    return color;
}

void main() {
    vec2 pos = v_coordinates * u_resolution;
    vec2 center = u_brushPos;
    vec2 prevCenter = u_prevBrushPos;
    
    vec2 toCenter = pos - center;
    float dist = length(toCenter);
    
    vec2 deformedPos = pos;
    
    if (dist < u_radius) {
        float t = dist / u_radius;
        // Cubic smooth falloff for a beautiful, responsive, and seamless liquify effect
        float falloff = (1.0 - t * t) * (1.0 - t * t);
        
        if (u_mode == 0) { // Push / Translate
            vec2 V = center - prevCenter;
            deformedPos = pos - V * falloff * u_strength;
        } else if (u_mode == 1 || u_mode == 2) { // Twirl (1: CW, 2: CCW)
            float angle = falloff * u_strength * 0.8;
            if (u_mode == 1) {
                angle = -angle;
            }
            float c = cos(angle);
            float s = sin(angle);
            vec2 rotated = vec2(
                toCenter.x * c - toCenter.y * s,
                toCenter.x * s + toCenter.y * c
            );
            deformedPos = center + rotated;
        } else if (u_mode == 3) { // Pinch (Squeeze)
            deformedPos = center + toCenter * (1.0 + falloff * u_strength * 0.5);
        } else if (u_mode == 4) { // Bloat (Expand)
            deformedPos = center + toCenter * (1.0 - falloff * u_strength * 0.35);
        }
    }
    
    vec2 deformedCoord = deformedPos / u_resolution;
    // Clamp to border to prevent drawing edge artifacts
    deformedCoord = clamp(deformedCoord, vec2(0.001), vec2(0.999));
    
    gl_FragColor = textureCatmullRom(u_paintTexture, deformedCoord, u_resolution);
}
