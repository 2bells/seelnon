// Easing functions for animation curves
export const EasingFunctions = {
  // Linear (no easing)
  linear: t => t,
  
  // Quadratic
  easeInQuad: t => t * t,
  easeOutQuad: t => t * (2 - t),
  easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  
  // Cubic
  easeInCubic: t => t * t * t,
  easeOutCubic: t => (--t) * t * t + 1,
  easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  
  // Exponential
  easeInExpo: t => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
  easeOutExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeInOutExpo: t => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    if ((t *= 2) < 1) return 0.5 * Math.pow(2, 10 * (t - 1));
    return 0.5 * (2 - Math.pow(2, -10 * (t - 1)));
  },
  
  // Bounce
  easeOutBounce: t => {
    if (t < (1/2.75)) {
      return 7.5625 * t * t;
    } else if (t < (2/2.75)) {
      return 7.5625 * (t -= (1.5/2.75)) * t + 0.75;
    } else if (t < (2.5/2.75)) {
      return 7.5625 * (t -= (2.25/2.75)) * t + 0.9375;
    } else {
      return 7.5625 * (t -= (2.625/2.75)) * t + 0.984375;
    }
  },
  easeInBounce: t => 1 - EasingFunctions.easeOutBounce(1 - t),
  easeInOutBounce: t => 
    t < 0.5
      ? EasingFunctions.easeInBounce(t * 2) * 0.5
      : EasingFunctions.easeOutBounce(t * 2 - 1) * 0.5 + 0.5
};