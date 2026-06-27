precision highp float;

varying vec2 v_coordinates;

uniform sampler2D u_paintTexture;
uniform sampler2D u_velocityTexture;
uniform vec2 u_resolution;
uniform float u_mixAmount;
uniform bool u_bilateral;

void main () {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 texel = 1.0 / u_resolution;

    vec4 center = texture2D(u_paintTexture, uv);

    // Localize the blur by multiplying the mix amount by the brush stroke mask (u_velocityTexture.a)
    float mask = texture2D(u_velocityTexture, uv).a;
    float finalMix = u_mixAmount * mask;

    if (finalMix > 0.0) {
        vec4 left   = texture2D(u_paintTexture, uv + vec2(-texel.x, 0.0));
        vec4 right  = texture2D(u_paintTexture, uv + vec2( texel.x, 0.0));
        vec4 bottom = texture2D(u_paintTexture, uv + vec2(0.0, -texel.y));
        vec4 top    = texture2D(u_paintTexture, uv + vec2(0.0,  texel.y));

        // Bilateral weight computation based on color (RGB) and height (Alpha)
        // - Less blending between highly contrasting colors (preserves color boundaries)
        // - Less blending between different paint heights (preserves 3D stroke ridges and brush marks)
        // For pure blur tool, u_bilateral is false so scales are 0 (giving equal neighbor weights)
        float colorScale = u_bilateral ? 5.0 : 0.0;
        float heightScale = u_bilateral ? 15.0 : 0.0;

        float w_center = smoothstep(0.0, 0.01, center.a);

        float w_left   = max(1.0 - distance(center.rgb, left.rgb) * colorScale, 0.0) * max(1.0 - abs(center.a - left.a) * heightScale, 0.0) * smoothstep(0.0, 0.01, left.a);
        float w_right  = max(1.0 - distance(center.rgb, right.rgb) * colorScale, 0.0) * max(1.0 - abs(center.a - right.a) * heightScale, 0.0) * smoothstep(0.0, 0.01, right.a);
        float w_bottom = max(1.0 - distance(center.rgb, bottom.rgb) * colorScale, 0.0) * max(1.0 - abs(center.a - bottom.a) * heightScale, 0.0) * smoothstep(0.0, 0.01, bottom.a);
        float w_top    = max(1.0 - distance(center.rgb, top.rgb) * colorScale, 0.0) * max(1.0 - abs(center.a - top.a) * heightScale, 0.0) * smoothstep(0.0, 0.01, top.a);

        float total_weight = w_center + w_left + w_right + w_bottom + w_top;
        vec4 blurred;
        if (total_weight > 0.0001) {
            blurred = (center * w_center + left * w_left + right * w_right + bottom * w_bottom + top * w_top) / total_weight;
        } else {
            blurred = center;
        }

        gl_FragColor = mix(center, blurred, finalMix);
    } else {
        gl_FragColor = center;
    }
}

