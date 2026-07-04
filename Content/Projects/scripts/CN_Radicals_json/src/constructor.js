// The 214 Kangxi Radicals Database
// Styled for the brutalist approach: zero bloat, high structure.

import { importNames } from './import.js';

async function grabJsonFile(fileName) {
  try {
    const targetUrl = new URL(`./data/${fileName}.json`, import.meta.url).href;
    
    console.log(`Fetching from: ${targetUrl}`);
    const response = await fetch(targetUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP Error Status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error loading dataset segment for '${fileName}':`, error);
    return [];
  }
}

// Constructor/Procedural fallback for missing radical properties
export const enrichRadical = (rad, index, dataMap) => {
  // Find supplementary record in other files excluding '214' to avoid self-matching
  const otherFiles = importNames.filter(name => name !== '214');
  const allDetailRadicals = otherFiles.flatMap(name => dataMap[name] || []);
  const keyMatch = allDetailRadicals.find(k => k.no === rad.no);

  const base = {
    no: rad.no || index + 1,
    char: rad.char,
    meaning: rad.meaning,
    pinyin: rad.pinyin || "???",
    strokes: rad.strokes || 0,
    category: rad.category || "ABSTRACT",
    ...rad,
    ...(keyMatch || {})
  };

  // If we already have etymology, funFact, and philosophy, return base directly
  if (base.etymology && base.funFact && base.philosophy) {
    return base;
  }

  // Generate beautiful, structured, procedurally styled historical notes if missing
  let etymology = base.etymology || `Depicts the raw physical form of a '${base.meaning}'.`;
  let funFact = base.funFact || `This radical commonly groups characters that have to do with '${base.meaning}'.`;
  let philosophy = base.philosophy || `In traditional Chinese cosmological frameworks, the '${base.meaning}' corresponds to the dynamic interplay of elements.`;

  // Specific procedural details based on category
  if (!base.etymology || !base.funFact || !base.philosophy) {
    if (base.category === "NATURE") {
      if (!base.etymology) etymology = `An ancient pictogram of a natural phenomenon representing a '${base.meaning}'.`;
      if (!base.philosophy) philosophy = `Nature doesn't hurry, yet everything is accomplished. The '${base.meaning}' radical grounds us.`;
      if (!base.funFact) funFact = `Appears in characters relating to climate, ecosystems, resources, or the fundamental elements of the wilderness.`;
    } else if (base.category === "ANIMALS") {
      if (!base.etymology) etymology = `A vivid silhouette of a '${base.meaning}' emphasizing its profile.`;
      if (!base.philosophy) philosophy = `Animals symbolize instinctual wisdom and our organic connection to the living web.`;
      if (!base.funFact) funFact = `Used as a key semantic classifier to categorize fauna, zoological species, and animal behaviors.`;
    } else if (base.category === "BODY") {
      if (!base.etymology) etymology = `An anatomical outline of the human '${base.meaning}', capturing its architecture.`;
      if (!base.philosophy) philosophy = `The body is the temple of the formless mind.`;
      if (!base.funFact) funFact = `Forms the root of characters denoting physical activities, sensations, gestures, or biological traits.`;
    } else if (base.category === "TOOLS") {
      if (!base.etymology) etymology = `A practical diagram of a '${base.meaning}', illustrating its structural lines.`;
      if (!base.philosophy) philosophy = `Tools are extensions of human intellect and desire.`;
      if (!base.funFact) funFact = `Guides the classification of ancient implements, structural creations, materials, and household utensils.`;
    } else if (base.category === "PLANTS") {
      if (!base.etymology) etymology = `A botanical drawing of a sprouting, leafing, or rooted '${base.meaning}'.`;
      if (!base.philosophy) philosophy = `Like a seed waiting for rain, all breakthroughs happen in silence.`;
      if (!base.funFact) funFact = `Used primarily at the top or base of characters dealing with agriculture, herbs, flora, or nutrition.`;
    } else if (base.category === "SPIRITUAL" || base.category === "ABSTRACT") {
      if (!base.etymology) etymology = `An abstract symbol representing the conceptual essence of '${base.meaning}'.`;
      if (!base.philosophy) philosophy = `The formless gives birth to form.`;
      if (!base.funFact) funFact = `Crucial for terms representing counting, philosophical concepts, cosmic states, or ritualistic duties.`;
    }
  }

  return { ...base, etymology, funFact, philosophy };
};

export async function getRadicals() {
  try {
    const cached = localStorage.getItem('kangxi_all_radicals_cached');
    if (cached) {
      console.log('Using cached radicals database.');
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn('Could not read cached radicals database:', e);
  }

  const dataMap = {};
  await Promise.all(importNames.map(async (name) => {
    dataMap[name] = await grabJsonFile(name);
  }));

  // Base radicals from 214.json, enriched procedurally
  const enriched214 = (dataMap['214'] || []).map((rad, i) => enrichRadical(rad, i, dataMap));

  const combinedRadicals = [
    ...enriched214,
    ...importNames.filter(name => name !== '214').flatMap(name => dataMap[name] || [])
  ];

  try {
    localStorage.setItem('kangxi_all_radicals_cached', JSON.stringify(combinedRadicals));
  } catch (e) {
    console.warn('Could not save radicals database to localStorage:', e);
  }

  return combinedRadicals;
}
