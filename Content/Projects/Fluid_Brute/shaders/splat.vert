precision highp float;

attribute vec4 a_splatCoordinates; //(texCoord.x, texCoord.y, quad x (-1 or 1), quad y (-1 or 1))

uniform vec2 u_paintingDimensions;
uniform vec2 u_paintingPosition;
uniform float u_splatRadius;
uniform float u_zThreshold;

uniform sampler2D u_positionsTexture;
uniform sampler2D u_previousPositionsTexture;

uniform vec2 u_brushCenter;
uniform vec2 u_previousBrushCenter;
uniform bool u_unified;

varying vec2 v_coordinates; //in [-1, 1]

varying vec2 v_previousPosition;
varying vec2 v_position;

varying vec2 v_quadPosition;

#ifdef VELOCITY
    uniform sampler2D u_velocitiesTexture;
    uniform sampler2D u_previousVelocitiesTexture;

    varying vec2 v_velocity;
    varying vec2 v_previousVelocity;
#endif

void main () {
    vec2 coordinates = a_splatCoordinates.zw; //in [-1, 1]

    vec3 position = texture2D(u_positionsTexture, a_splatCoordinates.xy).rgb;
    vec3 previousPosition = texture2D(u_previousPositionsTexture, a_splatCoordinates.xy).rgb;

    vec2 planarPosition = position.xy;
    vec2 previousPlanarPosition = previousPosition.xy;

    if (u_unified) {
        planarPosition = u_brushCenter;
        previousPlanarPosition = u_previousBrushCenter;
    } else if (position.z > u_zThreshold) {
        planarPosition = vec3(100000000.0, 1000000.0, 100000000.0).xy;
        previousPlanarPosition = vec3(100000000.0, 1000000.0, 100000000.0).xy;
    }

    vec2 mid = (planarPosition + previousPlanarPosition) * 0.5;
    

    float dist = distance(previousPlanarPosition, planarPosition);
    vec2 direction = vec2(1.0, 0.0);
    if (dist > 0.0001) {
        direction = (planarPosition - previousPlanarPosition) / dist;
    }
    vec2 tangent = vec2(-direction.y, direction.x);


    vec2 finalPosition = mid + coordinates.x * direction * (dist * 0.5 + u_splatRadius) + coordinates.y * tangent * u_splatRadius;

    //finalPosition = mid + coordinates * u_splatRadius;
   

    v_previousPosition = previousPlanarPosition;
    v_position = planarPosition;
    v_quadPosition = finalPosition;


    v_coordinates = a_splatCoordinates.zw;

    gl_Position = vec4(-1.0 + 2.0 * (finalPosition - u_paintingPosition) / u_paintingDimensions, 0.0, 1.0);
    
#ifdef VELOCITY
    vec3 velocity = vec3(0.0);
    vec3 previousVelocity = vec3(0.0);
    if (!u_unified) {
        velocity = texture2D(u_velocitiesTexture, a_splatCoordinates.xy).rgb;
        previousVelocity = texture2D(u_previousVelocitiesTexture, a_splatCoordinates.xy).rgb;
    }

    v_velocity = velocity.xy;
    v_previousVelocity = previousVelocity.xy;
#endif

}
