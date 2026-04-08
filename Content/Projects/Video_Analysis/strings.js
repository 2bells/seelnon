export async function extractStrings(file, opts = {}) {
  const minLen = Math.max(3, Number(opts.minLen) || 4);
  const includeUTF16 = !!opts.includeUTF16;

  const chunkSize = 2 * 1024 * 1024;
  const asciiStrings = [];
  const utf16Strings = [];
  const items = [];
  let asciiBuf = "";
  let u16Buf = [];
  let asciiRunStart = null;
  let u16RunStart = null;

  // Characters considered printable for string extraction (including numbers and common symbols)
  const isPrintable = (c) => (c >= 32 && c <= 126) || c === 9 || c === 10 || c === 13; // Includes digits, '.', '-', etc.

  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, file.size);
    const buf = await blobToUint8(file.slice(offset, end));

    // ASCII scan
    for (let i = 0; i < buf.length; i++) {
      const b = buf[i];
      if (isPrintable(b)) {
        if (asciiBuf.length === 0) asciiRunStart = offset + i;
        asciiBuf += String.fromCharCode(b);
      } else {
        if (asciiBuf.length >= minLen) { asciiStrings.push(asciiBuf); items.push({ text: asciiBuf, start: asciiRunStart, end: asciiRunStart + asciiBuf.length, encoding: "ascii" }); }
        asciiBuf = ""; asciiRunStart = null;
      }
    }

    // UTF-16LE scan (pattern: printable, 0x00 alternating)
    if (includeUTF16) {
      // Collect code units where pattern (char, 0x00)
      let i = 0;
      while (i + 1 < buf.length) {
        const lo = buf[i], hi = buf[i+1];
        if (hi === 0x00 && isPrintable(lo)) {
          if (u16Buf.length === 0) u16RunStart = offset + i;
          u16Buf.push(lo);
          i += 2;
        } else {
          if (u16Buf.length >= minLen) { const s = String.fromCharCode(...u16Buf); utf16Strings.push(s); items.push({ text: s, start: u16RunStart, end: u16RunStart + u16Buf.length*2, encoding: "utf16le" }); }
          u16Buf = []; u16RunStart = null; i += 1;
        }
      }
    }
  }
  if (asciiBuf.length >= minLen) { asciiStrings.push(asciiBuf); items.push({ text: asciiBuf, start: asciiRunStart, end: asciiRunStart + asciiBuf.length, encoding: "ascii" }); }
  if (includeUTF16 && u16Buf.length >= minLen) { const s = String.fromCharCode(...u16Buf); utf16Strings.push(s); items.push({ text: s, start: u16RunStart, end: u16RunStart + u16Buf.length*2, encoding: "utf16le" }); }

  // Deduplicate while preserving order
  const seen = new Set();
  const all = [];
  const numericalCandidatesRaw = []; // Store raw objects before dedup/sort

  // Regex to identify pure numbers (integers or floats, with optional sign)
  const pureNumberPattern = /^-?\d+(\.\d+)?$/;
  
  // Regex to identify strings resembling coordinate-like data, or numbers embedded in strings.
  // Captures an optional prefix/label (at least 2 letters, possibly with spaces, hyphens, or dots)
  // and the numerical value (with optional sign, decimal, scientific notation).
  const inStringNumberPattern = /([a-zA-Z]{2,}[\s\-\.]*)?([-+]?\d+(\.\d+)?([eE][-+]?\d+)?)/g;

  for (const s of [...asciiStrings, ...utf16Strings]) {
    const t = s.trim();
    if (t.length >= minLen && !seen.has(t)) {
      seen.add(t);
      all.push(t);

      // Check if the string is a pure number
      if (pureNumberPattern.test(t)) {
        numericalCandidatesRaw.push({
          sourceString: t,
          value: t,
          context: 'Pure Number'
        });
      } else {
        // Check for patterns like 'trXYZ' followed by numbers within the string
        let match;
        // Use a new regex instance for each string to avoid state issues with global flag
        const localInStringNumberPattern = new RegExp(inStringNumberPattern.source, 'g'); 
        while ((match = localInStringNumberPattern.exec(t)) !== null) {
          const label = match[1] ? match[1].trim() : ''; // e.g., "trXYZ", "Lat"
          const numberVal = match[2]; // e.g., "123.45", "-34.5"

          if (numberVal) { // Ensure a number was actually found
              numericalCandidatesRaw.push({
                  sourceString: t,
                  value: numberVal,
                  context: label || 'Embedded Number' // Default context if no label
              });
          }
        }
      }
    }
  }

  // Deduplicate and sort numerical candidates
  const uniqueNumericalCandidatesMap = new Map();
  for (const cand of numericalCandidatesRaw) {
    // Create a unique key for deduplication based on relevant properties
    const key = `${cand.sourceString}::${cand.value}::${cand.context}`;
    if (!uniqueNumericalCandidatesMap.has(key)) {
        uniqueNumericalCandidatesMap.set(key, cand);
    }
  }
  const uniqueNumericalCandidates = Array.from(uniqueNumericalCandidatesMap.values()).sort((a, b) => {
    // Sort primarily by context, then by numeric value, then by full source string
    const contextCompare = a.context.localeCompare(b.context);
    if (contextCompare !== 0) return contextCompare;

    const numA = parseFloat(a.value);
    const numB = parseFloat(b.value);
    if (!isNaN(numA) && !isNaN(numB)) {
      const numCompare = numA - numB;
      if (numCompare !== 0) return numCompare;
    }
    return a.sourceString.localeCompare(b.sourceString);
  });

  const preview = all.slice(0, 5000).join("\n");
  return { all, preview, numericalCandidates: uniqueNumericalCandidates, items };
}

function blobToUint8(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(new Uint8Array(fr.result));
    fr.onerror = () => rej(fr.error || new Error("FileReader error"));
    fr.readAsArrayBuffer(blob);
  });
}