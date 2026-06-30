precision highp float;

#ifdef VELOCITY
varying vec2 v_previousVelocity;
varying vec2 v_velocity;
uniform float u_velocityScale;
#else
uniform vec4 u_splatColor;
#endif

uniform float u_splatRadius;
uniform bool u_isRect;
uniform bool u_rectRotate90;

varying vec2 v_previousPosition;
varying vec2 v_position;

varying vec2 v_quadPosition;

varying vec2 v_coordinates;

float distanceToLine(vec2 a, vec2 b, vec2 p) {
    float dist = distance(a, b);
    vec2 direction = (b - a) / dist;

    float projectedDistance = dot(p - a, direction);
    projectedDistance = clamp(projectedDistance, 0.0, dist);

    vec2 projectedPosition = a + projectedDistance * direction;

    return distance(p, projectedPosition);
}

vec2 clampVelocity (vec2 vel) {
    float MAX_SPEED = 2.0;

    float speed = length(vel);

    if (speed > MAX_SPEED) {
        vel *= MAX_SPEED / speed;
    }
    
    return vel;
}

void main () {
    float multiplier;
    if (u_isRect) {
        float dist = distance(v_previousPosition, v_position);
        vec2 direction = vec2(1.0, 0.0);
        if (dist > 0.0001) {
            direction = (v_position - v_previousPosition) / dist;
        }
        vec2 tangent = vec2(-direction.y, direction.x);

        vec2 toFragment = v_quadPosition - v_previousPosition;
        float projD = dot(toFragment, direction);
        float projT = dot(toFragment, tangent);

        if (u_rectRotate90) {
            float temp = projD;
            projD = projT;
            projT = temp;
        }

        float distD = (projD < 0.0) ? -projD : ((projD > dist) ? (projD - dist) : 0.0);
        float distT = abs(projT);

        // Perpendicular profile: flat in the middle, beveled at the edges
        float multiplierT = smoothstep(1.0, 0.7, distT / u_splatRadius);

        // Add gorgeous continuous bristle groove bumps based on normalized perpendicular distance
        float normalizedT = projT / u_splatRadius;
        float ridgeNoise = sin(normalizedT * 22.0) * 0.25 + sin(normalizedT * 48.0) * 0.12;
        multiplierT = clamp(multiplierT + ridgeNoise * multiplierT, 0.0, 1.0);

        // Parallel profile: flat ends with very short bevel
        float endLimit = u_splatRadius * 0.2;
        float multiplierD = smoothstep(endLimit, 0.0, distD);

        multiplier = multiplierT * multiplierD;
    } else {
        float splatDistance = distanceToLine(v_previousPosition, v_position, v_quadPosition);
        multiplier = max(1.0 - splatDistance / u_splatRadius, 0.0);
    }


#ifdef VELOCITY
    vec2 velocity = mix(v_previousVelocity, v_velocity, v_coordinates.x * 0.5 + 0.5);
    gl_FragColor = vec4(clampVelocity(velocity * u_velocityScale), 0.0, multiplier);
#else
    gl_FragColor = vec4(u_splatColor.rgb, u_splatColor.a * multiplier);
#endif
}
