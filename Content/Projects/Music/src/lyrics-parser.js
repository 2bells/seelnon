/**
 * LYRICS & SUBTITLES PARSER (LRC, SRT, VTT, JSON)
 * Synchronizes timed text lines with playback currentTime for real-time teleprompter display.
 */

export function parseLyrics(content) {
  if (!content) return [];

  // If already array of cues
  if (Array.isArray(content)) {
    return content.map((c) => ({
      time: typeof c.time === 'number' ? c.time : parseFloat(c.time) || 0,
      text: String(c.text || c.line || '').trim()
    })).sort((a, b) => a.time - b.time);
  }

  const str = String(content).trim();
  if (!str) return [];

  // Check if JSON format
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed) && parsed.length && (parsed[0].time !== undefined || parsed[0].start !== undefined)) {
        return parsed.map((c) => ({
          time: typeof c.time === 'number' ? c.time : (parseFloat(c.time || c.start) || 0),
          text: String(c.text || c.line || c.content || '').trim()
        })).sort((a, b) => a.time - b.time);
      }
    } catch (e) {
      // not json, continue
    }
  }

  // Check if SRT format: e.g. "00:01:20,000 --> 00:01:25,000"
  if (str.includes('-->')) {
    return parseSrtOrVtt(str);
  }

  // Check if LRC format: [mm:ss.xx]
  if (/\[\d{1,2}:\d{2}/.test(str)) {
    return parseLrc(str);
  }

  // Fallback: Plain text lines without timestamps (assign evenly or 0)
  const lines = str.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map((text, idx) => ({
    time: idx * 4, // 4-second estimates if untimed
    text
  }));
}

function parseLrc(lrcText) {
  const lines = lrcText.split(/\r?\n/);
  const cues = [];
  const tagRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check metadata tags e.g. [ti:Title], [ar:Artist]
    if (/^\[(ti|ar|al|by|offset|length):/i.test(trimmed)) {
      continue;
    }

    const matches = [...trimmed.matchAll(tagRegex)];
    if (matches.length > 0) {
      // Extract lyric text after all timestamp tags
      const text = trimmed.replace(tagRegex, '').trim();

      for (const m of matches) {
        const minutes = parseInt(m[1], 10);
        const seconds = parseInt(m[2], 10);
        let ms = 0;
        if (m[3]) {
          ms = parseInt(m[3].padEnd(3, '0').slice(0, 3), 10);
        }
        const time = minutes * 60 + seconds + ms / 1000;
        cues.push({ time, text });
      }
    }
  }

  return cues.sort((a, b) => a.time - b.time);
}

function parseSrtOrVtt(subText) {
  const lines = subText.split(/\r?\n/);
  const cues = [];
  let currentTime = null;
  let currentText = [];

  const timeRegex = /(?:(\d{2}):)?(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(?:(\d{2}):)?(\d{2}):(\d{2})[,.](\d{3})/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (currentTime !== null && currentText.length > 0) {
        cues.push({
          time: currentTime,
          text: currentText.join(' ')
        });
        currentTime = null;
        currentText = [];
      }
      continue;
    }

    // Check if timestamp line
    const match = line.match(timeRegex);
    if (match) {
      if (currentTime !== null && currentText.length > 0) {
        cues.push({
          time: currentTime,
          text: currentText.join(' ')
        });
        currentText = [];
      }
      const hours = parseInt(match[1] || '0', 10);
      const mins = parseInt(match[2], 10);
      const secs = parseInt(match[3], 10);
      const ms = parseInt(match[4], 10);
      currentTime = hours * 3600 + mins * 60 + secs + ms / 1000;
      continue;
    }

    // Skip numeric SRT index markers
    if (/^\d+$/.test(line) && currentTime === null) {
      continue;
    }

    // Skip WEBVTT header
    if (line.startsWith('WEBVTT') || line.startsWith('NOTE')) {
      continue;
    }

    if (currentTime !== null) {
      currentText.push(line);
    }
  }

  if (currentTime !== null && currentText.length > 0) {
    cues.push({
      time: currentTime,
      text: currentText.join(' ')
    });
  }

  return cues.sort((a, b) => a.time - b.time);
}

/**
 * Finds the currently active lyric cue index for given currentTime
 * @param {Array<{time: number, text: string}>} cues
 * @param {number} currentTime
 * @returns {number} index of active cue, or -1 if before first cue
 */
export function getActiveCueIndex(cues, currentTime) {
  if (!cues || cues.length === 0) return -1;
  let activeIndex = -1;
  for (let i = 0; i < cues.length; i++) {
    // Add a small 0.3s lookahead tolerance so timestamps light up precisely
    if (currentTime >= (cues[i].time - 0.2)) {
      activeIndex = i;
    } else {
      break;
    }
  }
  return activeIndex;
}

/**
 * Formats seconds to mm:ss or hh:mm:ss string
 */
export function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
