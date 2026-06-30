precision highp float;

varying vec2 v_coordinates;

uniform vec4 u_currentHSVA;

const float PI = 3.14159265;

// Coordinate constants matching colorpicker.js
#define SQ_LEFT 10.0
#define SQ_RIGHT 170.0
#define SQ_BOTTOM 40.0
#define SQ_TOP 200.0
#define SQ_SIZE 160.0

#define HUE_LEFT 10.0
#define HUE_RIGHT 170.0
#define HUE_BOTTOM 12.0
#define HUE_TOP 28.0
#define HUE_HEIGHT 16.0

vec4 alphaBlend (vec4 color, vec4 source) {
    vec4 result = vec4(0.0);
    result.rgb = source.a * source.rgb + (1.0 - source.a) * color.rgb;
    result.a = 1.0 * source.a + (1.0 - source.a) * color.a;

    return result;
}

vec3 trilinearInterpolate(vec3 p, vec3 v000, vec3 v100, vec3 v010, vec3 v001, vec3 v101, vec3 v011, vec3 v110, vec3 v111) {
    return v000 * (1.0 - p.x) * (1.0 - p.y) * (1.0 - p.z) +
           v100 * p.x * (1.0 - p.y) * (1.0 - p.z) +
           v010 * (1.0 - p.x) * p.y * (1.0 - p.z) +
           v001 * (1.0 - p.x) * (1.0 - p.y) * p.z +
           v101 * p.x * (1.0 - p.y) * p.z +
           v011 * (1.0 - p.x) * p.y * p.z +
           v110 * p.x * p.y * (1.0 - p.z) +
           v111 * p.x * p.y * p.z;
}

vec3 rybToRgb(vec3 ryb) {
#ifdef RGB
    return ryb;
#endif

    return trilinearInterpolate(ryb, 
        vec3(1.0, 1.0, 1.0), 
        vec3(1.0, 0.0, 0.0), 
        vec3(0.163, 0.373, 0.6), 
        vec3(1.0, 1.0, 0.0), 
        vec3(1.0, 0.5, 0.0), 
        vec3(0.0, 0.66, 0.2),
        vec3(0.5, 0.0, 0.5),
        vec3(0.2, 0.094, 0.0));
}

vec3 hsv2ryb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 hsvToRgb (vec3 hsv) {
    return rybToRgb(hsv2ryb(hsv));
}

float boxAlpha (vec2 position, vec2 bottomLeft, vec2 dimensions, vec2 feather) {
    vec2 center = bottomLeft + dimensions * 0.5;
    vec2 distances = max(abs(position - center) - dimensions * 0.5, vec2(0.0, 0.0));

    return smoothstep(feather.x, 0.0, distances.x) * smoothstep(feather.y, 0.0, distances.y);
}

float boxStrokeAlpha (vec2 position, vec2 bottomLeft, vec2 dimensions, vec2 strokeWidth, vec2 feather) {
    return boxAlpha(position, bottomLeft - strokeWidth * 0.5, dimensions + strokeWidth, feather) *
           (1.0 - boxAlpha(position, bottomLeft + strokeWidth * 0.5, dimensions - strokeWidth, feather));
}

vec4 sbSquare () {
    vec2 coords = v_coordinates;
    float inSquare = step(SQ_LEFT, coords.x) * step(coords.x, SQ_RIGHT) *
                     step(SQ_BOTTOM, coords.y) * step(coords.y, SQ_TOP);
    
    float saturation = clamp((coords.x - SQ_LEFT) / SQ_SIZE, 0.0, 1.0);
    float lightness = clamp((coords.y - SQ_BOTTOM) / SQ_SIZE, 0.0, 1.0);

#ifdef RGB
    float vVal = lightness;
#else
    float vVal = 1.0 - lightness;
#endif

    vec3 squareRYB = hsv2ryb(vec3(u_currentHSVA.x, saturation, vVal));
    vec3 squareRGB = rybToRgb(squareRYB);

    float squareAlpha = boxAlpha(coords, vec2(SQ_LEFT, SQ_BOTTOM), vec2(SQ_SIZE), vec2(0.5)) * inSquare;

    return vec4(squareRGB, squareAlpha);
}

vec4 sbIndicator () {
#ifdef RGB
    float vVal = u_currentHSVA.z;
#else
    float vVal = 1.0 - u_currentHSVA.z;
#endif

    vec2 indicatorPosition = vec2(
        SQ_LEFT + u_currentHSVA.y * SQ_SIZE,
        SQ_BOTTOM + vVal * SQ_SIZE
    );

    float whiteAlpha = boxStrokeAlpha(v_coordinates, indicatorPosition - vec2(4.0), vec2(8.0), vec2(1.5), vec2(0.5));
    float blackAlpha = boxStrokeAlpha(v_coordinates, indicatorPosition - vec2(5.0), vec2(10.0), vec2(1.0), vec2(0.5));

    vec4 color = vec4(0.0, 0.0, 0.0, blackAlpha);
    color = alphaBlend(color, vec4(1.0, 1.0, 1.0, whiteAlpha));
    return color;
}

vec4 hueSlider () {
    vec2 coords = v_coordinates;
    float inSlider = step(HUE_LEFT, coords.x) * step(coords.x, HUE_RIGHT) *
                     step(HUE_BOTTOM, coords.y) * step(coords.y, HUE_TOP);
    
    float hue = clamp((coords.x - HUE_LEFT) / (HUE_RIGHT - HUE_LEFT), 0.0, 1.0);
    vec3 hueRGB = hsvToRgb(vec3(hue, 1.0, 1.0));

    float alpha = boxAlpha(coords, vec2(HUE_LEFT, HUE_BOTTOM), vec2(HUE_RIGHT - HUE_LEFT, HUE_TOP - HUE_BOTTOM), vec2(0.5)) * inSlider;

    return vec4(hueRGB, alpha);
}

vec4 hueIndicator () {
    float hueX = HUE_LEFT + u_currentHSVA.x * (HUE_RIGHT - HUE_LEFT);
    vec2 indicatorBottomLeft = vec2(hueX - 3.0, HUE_BOTTOM - 2.0);
    vec2 indicatorDimensions = vec2(6.0, HUE_HEIGHT + 4.0);

    float whiteAlpha = boxAlpha(v_coordinates, indicatorBottomLeft, indicatorDimensions, vec2(0.5));
    float blackAlpha = boxStrokeAlpha(v_coordinates, indicatorBottomLeft, indicatorDimensions, vec2(1.5), vec2(0.5));

    vec4 color = vec4(0.0, 0.0, 0.0, blackAlpha);
    color = alphaBlend(color, vec4(1.0, 1.0, 1.0, whiteAlpha));
    return color;
}

void main () {
    vec4 color = vec4(1.0, 1.0, 1.0, 1.0); // Opaque white background

    vec4 sbSquareColor = sbSquare();
    color = alphaBlend(color, sbSquareColor);

    // Draw square border
    float squareBorder = boxStrokeAlpha(v_coordinates, vec2(SQ_LEFT, SQ_BOTTOM), vec2(SQ_SIZE, SQ_SIZE), vec2(2.0), vec2(0.5));
    color = alphaBlend(color, vec4(0.0, 0.0, 0.0, squareBorder));
    
    vec4 sbIndicatorColor = sbIndicator();
    color = alphaBlend(color, sbIndicatorColor);

    vec4 hueSliderColor = hueSlider();
    color = alphaBlend(color, hueSliderColor);

    // Draw hue slider border
    float hueBorder = boxStrokeAlpha(v_coordinates, vec2(HUE_LEFT, HUE_BOTTOM), vec2(HUE_RIGHT - HUE_LEFT, HUE_TOP - HUE_BOTTOM), vec2(2.0), vec2(0.5));
    color = alphaBlend(color, vec4(0.0, 0.0, 0.0, hueBorder));

    vec4 hueIndicatorColor = hueIndicator();
    color = alphaBlend(color, hueIndicatorColor);

    gl_FragColor = color;
}
