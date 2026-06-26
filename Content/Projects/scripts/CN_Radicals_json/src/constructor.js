// The 214 Kangxi Radicals Database
// Styled for the brutalist approach: zero bloat, high structure.

import { importNames } from './import.js';

const modules = import.meta.glob('./data/*.json', { eager: true });

function getModuleData(name) {
  const path = `./data/${name}.json`;
  const mod = modules[path];
  if (!mod) return [];
  const data = mod.default || mod;
  return data.map(item => ({ ...item, source: path }));
}

// Map of all radicals data by filename
const dataMap = {};
importNames.forEach(name => {
  dataMap[name] = getModuleData(name);
});

// Constructor/Procedural fallback for missing radical properties
const enrichRadical = (rad, index) => {
  const base = {
    no: rad.no || index + 1,
    char: rad.char,
    meaning: rad.meaning,
    pinyin: rad.pinyin || "???",
    strokes: rad.strokes || 0,
    category: rad.category || "ABSTRACT",
    ...rad
  };

  const allDetailRadicals = importNames.flatMap(name => dataMap[name] || []);
  const keyMatch = allDetailRadicals.find(k => k.no === base.no);
  if (keyMatch) {
    return { ...base, ...keyMatch };
  }

  // Generate beautiful, structured, procedurally styled historical notes
  let etymology = `Depicts the raw physical form of a '${base.meaning}'.`;
  let funFact = `This radical commonly groups characters that have to do with '${base.meaning}'.`;
  let philosophy = `In traditional Chinese cosmological frameworks, the '${base.meaning}' corresponds to the dynamic interplay of elements.`;

  // Specific procedural details based on category
  if (base.category === "NATURE") {
    etymology = `An ancient pictogram of a natural phenomenon representing a '${base.meaning}'.`;
    philosophy = `Nature doesn't hurry, yet everything is accomplished. The '${base.meaning}' radical grounds us.`;
    funFact = `Appears in characters relating to climate, ecosystems, resources, or the fundamental elements of the wilderness.`;
  } else if (base.category === "ANIMALS") {
    etymology = `A vivid silhouette of a '${base.meaning}' emphasizing its profile.`;
    philosophy = `Animals symbolize instinctual wisdom and our organic connection to the living web.`;
    funFact = `Used as a key semantic classifier to categorize fauna, zoological species, and animal behaviors.`;
  } else if (base.category === "BODY") {
    etymology = `An anatomical outline of the human '${base.meaning}', capturing its architecture.`;
    philosophy = `The body is the temple of the formless mind.`;
    funFact = `Forms the root of characters denoting physical activities, sensations, gestures, or biological traits.`;
  } else if (base.category === "TOOLS") {
    etymology = `A practical diagram of a '${base.meaning}', illustrating its structural lines.`;
    philosophy = `Tools are extensions of human intellect and desire.`;
    funFact = `Guides the classification of ancient implements, structural creations, materials, and household utensils.`;
  } else if (base.category === "PLANTS") {
    etymology = `A botanical drawing of a sprouting, leafing, or rooted '${base.meaning}'.`;
    philosophy = `Like a seed waiting for rain, all breakthroughs happen in silence.`;
    funFact = `Used primarily at the top or base of characters dealing with agriculture, herbs, flora, or nutrition.`;
  } else if (base.category === "SPIRITUAL" || base.category === "ABSTRACT") {
    etymology = `An abstract symbol representing the conceptual essence of '${base.meaning}'.`;
    philosophy = `The formless gives birth to form.`;
    funFact = `Crucial for terms representing counting, philosophical concepts, cosmic states, or ritualistic duties.`;
  }

  return { ...base, etymology, funFact, philosophy };
};

// Base radicals from 214.json, enriched procedurally
const enriched214 = (dataMap['214'] || []).map(enrichRadical);

const combinedRadicals = [
  ...enriched214,
  ...importNames.filter(name => name !== '214').flatMap(name => dataMap[name] || [])
];

export const radicals = combinedRadicals;