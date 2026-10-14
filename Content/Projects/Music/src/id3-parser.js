/**
 * ID3 & AUDIO METADATA PARSER (Pure JavaScript)
 * Extracts metadata (Title, Artist, Album, Year, Genre, Track, BPM, Lyrics, Comments)
 * and embedded APIC cover art images directly from ArrayBuffer / File objects.
 */

// Genre lookup table for ID3v1 / numeric genres
const ID3_GENRES = [
  'Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge', 'Hip-Hop',
  'Jazz', 'Metal', 'New Age', 'Oldies', 'Other', 'Pop', 'R&B', 'Rap', 'Reggae',
  'Rock', 'Techno', 'Industrial', 'Alternative', 'Ska', 'Death Metal', 'Pranks',
  'Soundtrack', 'Euro-Techno', 'Ambient', 'Trip-Hop', 'Vocal', 'Jazz+Funk', 'Fusion',
  'Trance', 'Classical', 'Instrumental', 'Acid', 'House', 'Game', 'Sound Clip',
  'Gospel', 'Noise', 'AlternRock', 'Bass', 'Soul', 'Punk', 'Space', 'Meditative',
  'Instrumental Pop', 'Instrumental Rock', 'Ethnic', 'Gothic', 'Darkwave',
  'Techno-Industrial', 'Electronic', 'Pop-Folk', 'Eurodance', 'Dream', 'Southern Rock',
  'Comedy', 'Cult', 'Gangsta', 'Top 40', 'Christian Rap', 'Pop/Funk', 'Jungle',
  'Native American', 'Cabaret', 'New Wave', 'Psychadelic', 'Rave', 'Showtunes',
  'Trailer', 'Lo-Fi', 'Tribal', 'Acid Punk', 'Acid Jazz', 'Polka', 'Retro', 'Musical',
  'Rock & Roll', 'Hard Rock', 'Folk', 'Folk-Rock', 'National Folk', 'Swing',
  'Fast Fusion', 'Bebob', 'Latin', 'Revival', 'Celtic', 'Bluegrass', 'Avantgarde',
  'Gothic Rock', 'Progressive Rock', 'Psychedelic Rock', 'Symphonic Rock', 'Slow Rock',
  'Big Band', 'Chorus', 'Easy Listening', 'Acoustic', 'Humour', 'Speech', 'Chanson',
  'Opera', 'Chamber Music', 'Sonata', 'Symphony', 'Booty Bass', 'Primus', 'Porn Groove',
  'Satire', 'Slow Jam', 'Club', 'Tango', 'Samba', 'Folklore', 'Ballad', 'Power Ballad',
  'Rhythmic Soul', 'Freestyle', 'Duet', 'Punk Rock', 'Drum Solo', 'Acapella',
  'Euro-House', 'Dance Hall', 'Goa', 'Drum & Bass', 'Club-House', 'Hardcore',
  'Terror', 'Indie', 'BritPop', 'Afro-Punk', 'Polsk Punk', 'Beat', 'Christian Gangsta Rap',
  'Heavy Metal', 'Black Metal', 'Crossover', 'Contemporary Christian', 'Christian Rock',
  'Merengue', 'Salsa', 'Thrash Metal', 'Anime', 'JPop', 'Synthpop'
];

/**
 * Decode text based on ID3 encoding byte:
 * 0: ISO-8859-1 (Latin1)
 * 1: UTF-16 with BOM
 * 2: UTF-16BE without BOM
 * 3: UTF-8
 */
function decodeText(bytes, encodingByte = 0) {
  try {
    if (encodingByte === 1 || encodingByte === 2) {
      const decoder = new TextDecoder(encodingByte === 2 ? 'utf-16be' : 'utf-16');
      return decoder.decode(bytes).replace(/\0/g, '').trim();
    }
    const decoder = new TextDecoder(encodingByte === 3 ? 'utf-8' : 'iso-8859-1');
    return decoder.decode(bytes).replace(/\0/g, '').trim();
  } catch (err) {
    // Fallback string conversion
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] > 31 && bytes[i] < 127) {
        str += String.fromCharCode(bytes[i]);
      }
    }
    return str.trim();
  }
}

/**
 * Synchsafe integer decoder (ID3v2 standard 7-bit bytes)
 */
function decodeSynchsafeInt(byte1, byte2, byte3, byte4) {
  return (byte1 << 21) | (byte2 << 14) | (byte3 << 7) | byte4;
}

/**
 * Normal 4-byte big-endian integer decoder
 */
function decodeInt32(byte1, byte2, byte3, byte4) {
  return (byte1 << 24) | (byte2 << 16) | (byte3 << 8) | byte4;
}

/**
 * Parse ID3v2 tags from ArrayBuffer
 */
function parseID3v2(view, buffer) {
  // Check "ID3" identifier at offset 0
  if (view.getUint8(0) !== 0x49 || view.getUint8(1) !== 0x44 || view.getUint8(2) !== 0x33) {
    return null;
  }

  const majorVersion = view.getUint8(3); // e.g. 3 for ID3v2.3, 4 for ID3v2.4
  const revision = view.getUint8(4);
  const flags = view.getUint8(5);
  const tagSize = decodeSynchsafeInt(
    view.getUint8(6),
    view.getUint8(7),
    view.getUint8(8),
    view.getUint8(9)
  );

  let offset = 10;
  const isExtended = (flags & 0x40) !== 0;
  if (isExtended) {
    const extSize = decodeSynchsafeInt(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    offset += extSize + 4;
  }

  const result = {
    version: `ID3v2.${majorVersion}.${revision}`,
    rawFrames: {}
  };

  const endOffset = Math.min(10 + tagSize, view.byteLength);

  while (offset + 10 <= endOffset) {
    // Check for padding (zeros)
    if (view.getUint8(offset) === 0) break;

    // Frame ID (4 chars in v2.3 and v2.4, 3 chars in v2.2)
    let frameId = '';
    let frameSize = 0;
    let headerSize = 10;

    if (majorVersion === 2) {
      frameId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2));
      frameSize = (view.getUint8(offset + 3) << 16) | (view.getUint8(offset + 4) << 8) | view.getUint8(offset + 5);
      headerSize = 6;
    } else {
      frameId = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      );
      if (majorVersion === 4) {
        frameSize = decodeSynchsafeInt(
          view.getUint8(offset + 4),
          view.getUint8(offset + 5),
          view.getUint8(offset + 6),
          view.getUint8(offset + 7)
        );
      } else {
        frameSize = decodeInt32(
          view.getUint8(offset + 4),
          view.getUint8(offset + 5),
          view.getUint8(offset + 6),
          view.getUint8(offset + 7)
        );
      }
    }

    if (frameSize <= 0 || offset + headerSize + frameSize > endOffset) {
      break;
    }

    const frameDataOffset = offset + headerSize;
    const frameData = new Uint8Array(buffer, frameDataOffset, frameSize);

    // Text frames (TIT2, TPE1, TALB, etc.)
    if (frameId.startsWith('T') && frameId !== 'TXXX') {
      const encoding = frameData[0] || 0;
      const text = decodeText(frameData.subarray(1), encoding);
      result.rawFrames[frameId] = text;

      if (frameId === 'TIT2' || frameId === 'TT2') result.title = text;
      if (frameId === 'TPE1' || frameId === 'TP1') result.artist = text;
      if (frameId === 'TALB' || frameId === 'TAL') result.album = text;
      if (frameId === 'TYER' || frameId === 'TDRC' || frameId === 'TYE') result.year = text.slice(0, 4);
      if (frameId === 'TRCK' || frameId === 'TRK') result.track = text;
      if (frameId === 'TBPM') result.bpm = parseInt(text, 10) || null;
      if (frameId === 'TCON' || frameId === 'TCO') {
        // Resolve numeric genres e.g. (17) or (20)
        let genreMatch = text.match(/\((\d+)\)/);
        if (genreMatch && ID3_GENRES[parseInt(genreMatch[1], 10)]) {
          result.genre = ID3_GENRES[parseInt(genreMatch[1], 10)];
        } else if (!isNaN(parseInt(text, 10)) && ID3_GENRES[parseInt(text, 10)]) {
          result.genre = ID3_GENRES[parseInt(text, 10)];
        } else {
          result.genre = text;
        }
      }
    }
    // Picture frame (APIC in v2.3/2.4, PIC in v2.2)
    else if (frameId === 'APIC' || frameId === 'PIC') {
      try {
        const encoding = frameData[0] || 0;
        let pOffset = 1;

        // MIME type (null terminated)
        let mimeType = 'image/jpeg';
        if (majorVersion === 2) {
          // PIC has 3-char format: JPG, PNG
          const fmt = String.fromCharCode(frameData[1], frameData[2], frameData[3]).toUpperCase();
          mimeType = fmt === 'PNG' ? 'image/png' : 'image/jpeg';
          pOffset = 4;
        } else {
          let mimeEnd = pOffset;
          while (mimeEnd < frameData.length && frameData[mimeEnd] !== 0) mimeEnd++;
          mimeType = decodeText(frameData.subarray(pOffset, mimeEnd), 0) || 'image/jpeg';
          pOffset = mimeEnd + 1;
        }

        const pictureType = frameData[pOffset] || 3; // 3 = front cover
        pOffset += 1;

        // Description (null terminated)
        if (encoding === 1 || encoding === 2) {
          // UTF-16 null terminator is 2 bytes (0x00 0x00)
          while (pOffset < frameData.length - 1 && !(frameData[pOffset] === 0 && frameData[pOffset + 1] === 0)) {
            pOffset += 2;
          }
          pOffset += 2;
        } else {
          while (pOffset < frameData.length && frameData[pOffset] !== 0) pOffset++;
          pOffset += 1;
        }

        const imageData = frameData.subarray(pOffset);
        if (imageData.length > 32) {
          const blob = new Blob([imageData], { type: mimeType });
          const coverUrl = URL.createObjectURL(blob);
          result.coverUrl = coverUrl;
          result.coverMime = mimeType;
          result.coverSize = imageData.length;
          result.coverBlob = blob;
        }
      } catch (e) {
        console.warn('Could not parse APIC cover frame:', e);
      }
    }
    // Lyrics frame (USLT = Unsynchronised lyrics)
    else if (frameId === 'USLT' || frameId === 'ULT') {
      try {
        const encoding = frameData[0] || 0;
        // 3 bytes language
        const lang = String.fromCharCode(frameData[1], frameData[2], frameData[3]);
        let lOffset = 4;
        // Descriptor null terminated
        if (encoding === 1 || encoding === 2) {
          while (lOffset < frameData.length - 1 && !(frameData[lOffset] === 0 && frameData[lOffset + 1] === 0)) {
            lOffset += 2;
          }
          lOffset += 2;
        } else {
          while (lOffset < frameData.length && frameData[lOffset] !== 0) lOffset++;
          lOffset += 1;
        }
        const lyricsText = decodeText(frameData.subarray(lOffset), encoding);
        result.lyrics = lyricsText;
        result.lyricsLanguage = lang;
      } catch (e) {
        console.warn('Could not parse USLT frame:', e);
      }
    }
    // Comments frame (COMM)
    else if (frameId === 'COMM' || frameId === 'COM') {
      try {
        const encoding = frameData[0] || 0;
        let cOffset = 4;
        if (encoding === 1 || encoding === 2) {
          while (cOffset < frameData.length - 1 && !(frameData[cOffset] === 0 && frameData[cOffset + 1] === 0)) {
            cOffset += 2;
          }
          cOffset += 2;
        } else {
          while (cOffset < frameData.length && frameData[cOffset] !== 0) cOffset++;
          cOffset += 1;
        }
        const comment = decodeText(frameData.subarray(cOffset), encoding);
        result.comment = comment;
      } catch (e) {
        // ignore
      }
    }

    offset += headerSize + frameSize;
  }

  return result;
}

/**
 * Parse ID3v1 tags from the last 128 bytes of an audio buffer
 */
function parseID3v1(view) {
  const len = view.byteLength;
  if (len < 128) return null;
  const offset = len - 128;

  // Check "TAG"
  if (view.getUint8(offset) !== 0x54 || view.getUint8(offset + 1) !== 0x41 || view.getUint8(offset + 2) !== 0x47) {
    return null;
  }

  const getStr = (start, length) => {
    let str = '';
    for (let i = 0; i < length; i++) {
      const code = view.getUint8(offset + start + i);
      if (code === 0) break;
      str += String.fromCharCode(code);
    }
    return str.trim();
  };

  const title = getStr(3, 30);
  const artist = getStr(33, 30);
  const album = getStr(63, 30);
  const year = getStr(93, 4);
  const comment = getStr(97, 28);
  const track = view.getUint8(offset + 126);
  const genreId = view.getUint8(offset + 127);
  const genre = ID3_GENRES[genreId] || 'Other';

  return {
    version: 'ID3v1',
    title: title || undefined,
    artist: artist || undefined,
    album: album || undefined,
    year: year || undefined,
    comment: comment || undefined,
    track: track ? String(track) : undefined,
    genre: genre !== 'Other' ? genre : undefined
  };
}

/**
 * Fallback parser extracting title, artist, track number from standard filename patterns
 */
export function parseFilename(filename) {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '').trim();

  // Pattern: "01 - Artist - Title"
  let match = nameWithoutExt.match(/^(\d{1,3})[\s._-]+([^\-]+)[\s._-]+(.+)$/);
  if (match) {
    return {
      track: match[1],
      artist: match[2].trim(),
      title: match[3].trim()
    };
  }

  // Pattern: "Artist - Title"
  match = nameWithoutExt.match(/^([^\-]+)[\s._-]+(.+)$/);
  if (match) {
    return {
      artist: match[1].trim(),
      title: match[2].trim()
    };
  }

  // Pattern: "01 Title"
  match = nameWithoutExt.match(/^(\d{1,3})[\s._-]+(.+)$/);
  if (match) {
    return {
      track: match[1],
      title: match[2].trim()
    };
  }

  return {
    title: nameWithoutExt
  };
}

/**
 * Main audio metadata extractor
 * @param {File | Blob | ArrayBuffer} fileOrBuffer
 * @param {string} [filename]
 * @returns {Promise<Object>} parsed metadata object
 */
export async function parseAudioMetadata(fileOrBuffer, filename = '') {
  let buffer;
  let fileObj = null;

  if (fileOrBuffer instanceof File) {
    fileObj = fileOrBuffer;
    filename = filename || fileOrBuffer.name;
    buffer = await fileOrBuffer.arrayBuffer();
  } else if (fileOrBuffer instanceof Blob) {
    buffer = await fileOrBuffer.arrayBuffer();
  } else if (fileOrBuffer instanceof ArrayBuffer) {
    buffer = fileOrBuffer;
  } else {
    throw new Error('Unsupported audio file or buffer source');
  }

  const view = new DataView(buffer);
  const id3v2Data = parseID3v2(view, buffer);
  const id3v1Data = parseID3v1(view);
  const filenameData = parseFilename(filename);

  const combined = {
    title: (id3v2Data && id3v2Data.title) || (id3v1Data && id3v1Data.title) || filenameData.title || 'UNTITLED AUDIO',
    artist: (id3v2Data && id3v2Data.artist) || (id3v1Data && id3v1Data.artist) || filenameData.artist || 'UNKNOWN ARTIST',
    album: (id3v2Data && id3v2Data.album) || (id3v1Data && id3v1Data.album) || 'BRUTAL AUDIO ARCHIVE',
    year: (id3v2Data && id3v2Data.year) || (id3v1Data && id3v1Data.year) || new Date().getFullYear().toString(),
    genre: (id3v2Data && id3v2Data.genre) || (id3v1Data && id3v1Data.genre) || 'ELECTRONIC / NOISE',
    trackNumber: (id3v2Data && id3v2Data.track) || (id3v1Data && id3v1Data.track) || filenameData.track || '01',
    bpm: (id3v2Data && id3v2Data.bpm) || null,
    lyrics: (id3v2Data && id3v2Data.lyrics) || null,
    comments: (id3v2Data && id3v2Data.comment) || (id3v1Data && id3v1Data.comment) || null,
    coverUrl: (id3v2Data && id3v2Data.coverUrl) || null,
    coverBlob: (id3v2Data && id3v2Data.coverBlob) || null,
    format: filename.split('.').pop()?.toUpperCase() || 'AUDIO',
    fileSize: buffer.byteLength,
    tagVersion: id3v2Data?.version || id3v1Data?.version || 'RAW FILE'
  };

  return combined;
}
