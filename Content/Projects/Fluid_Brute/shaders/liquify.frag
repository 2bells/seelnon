precision highp float;

varying vec2 v_coordinates;

uniform sampler2D u_paintTexture;
uniform vec2 u_resolution;
uniform vec2 u_brushPos;
uniform vec2 u_prevBrushPos;
uniform float u_radius;
uniform float u_strength;
uniform int u_mode; // 0: push, 1: twirl CW, 2: twirl CCW, 3: pinch, 4: bloat

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
    
    gl_FragColor = texture2D(u_paintTexture, deformedCoord);
}
