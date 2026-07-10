/**
 * Active Particle Sandbox Math Helper
 * Implements clean, fun simulation attributes.
 */

export const MEDIUMS = {
  A: {
    id: 'A',
    name: 'Option A: Straight Lines',
    formula: 'Grid Lock',
    leftFormula: 'Lines: Connected',
    rightFormula: 'Snapping: Enabled',
    solvedFormula: 'Grid Line Constraint: ON',
    massLabel: 'Grid Line Weight',
    massUnit: 'x',
    cUnit: 'speed',
    hUnit: 'scale',
    freqUnit: 'wind',
    energyUnit: 'Points',
    description: 'Forces dots to stay on straight tracks. Higher wind speed makes them slide and wobble faster along the tracks.',
    dimensionalCheck: [
      { step: 'Grid Snapping', value: 'Enabled' },
      { step: 'Side Flow', value: 'Active' },
      { step: 'Up-Down Flow', value: 'Active' },
      { step: 'Slowing', value: 'Grid Lock' },
      { step: 'Clumping', value: 'High' }
    ],
    vibe: 'Straight paths, dots locked on grids.'
  },
  B: {
    id: 'B',
    name: 'Option B: Swirling Circle',
    formula: 'Circular Swirl',
    leftFormula: 'Orbit: Inward',
    rightFormula: 'Spin: Twisted',
    solvedFormula: 'Swirling Motion: ON',
    massLabel: 'Swirl Density',
    massUnit: 'x',
    cUnit: 'speed',
    hUnit: 'scale',
    freqUnit: 'wind',
    energyUnit: 'Points',
    description: 'Pulls dots into spinning circles. Wind speed makes them rotate and wrap faster like a big whirlpool.',
    dimensionalCheck: [
      { step: 'Whirlpool Spin', value: 'Active' },
      { step: 'Messiness', value: 'High' },
      { step: 'Spinning', value: 'Extreme' },
      { step: 'Shape', value: 'Swirling Circle' },
      { step: 'Clumping', value: 'Extreme' }
    ],
    vibe: 'Swirling whirlpools, twisted grids.'
  },
  C: {
    id: 'C',
    name: 'Option C: Free Flowing',
    formula: 'Free Motion',
    leftFormula: 'Orbit: Off',
    rightFormula: 'Snapping: Off',
    solvedFormula: 'Free Floating: ON',
    massLabel: 'Dot Weight',
    massUnit: 'x',
    cUnit: 'speed',
    hUnit: 'scale',
    freqUnit: 'wind',
    energyUnit: 'Points',
    description: 'Standard playground where dots float around freely, bouncing off borders in smooth patterns.',
    dimensionalCheck: [
      { step: 'Air Resistance', value: 'None' },
      { step: 'Waving Pattern', value: 'Smooth' },
      { step: 'Spinning', value: 'Moderate' },
      { step: 'Flow Pattern', value: 'Straight' },
      { step: 'Clumping', value: 'Normal' }
    ],
    vibe: 'Smooth floating, neat straight lines.'
  }
};

/**
 * Dynamically computes solved values and dimensional cancellation values
 * where wind is the primary input.
 */
export function computeEngineMetrics(mediumId, wind, velocityCap = 3.0, intensityWeight = 6.626, attractionWeight = 6.6743e-11) {
  let nodeDensity = 0;
  let kineticPower = wind * intensityWeight;
  const absWind = Math.abs(wind);
  
  switch(mediumId) {
    case 'A':
      nodeDensity = (absWind * intensityWeight) / Math.pow(velocityCap, 3);
      break;
    case 'B':
      nodeDensity = (absWind * intensityWeight) / Math.pow(velocityCap, 3);
      break;
    case 'C':
    default:
      nodeDensity = (absWind * intensityWeight) / Math.pow(velocityCap, 2);
      break;
  }
  
  const clumpThreshold = Math.sqrt((intensityWeight * velocityCap) / Math.max(1e-18, Math.abs(attractionWeight)));
  
  return {
    nodeDensity: nodeDensity,
    kineticPower: kineticPower,
    clumpThreshold: clumpThreshold
  };
}
