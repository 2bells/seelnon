/**
 * SERVER PLAYLIST MANIFEST
 * References audio tracks directly from the server /music/ folder.
 */

// Generate brutalist SVG cover art data URIs
function createServerCoverSvg(title, artist, color = '#c8a96e', bg = '#151310') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360" width="600" height="360">
    <rect width="600" height="360" fill="${bg}" />
    <defs>
      <pattern id="srvGrid" width="28" height="28" patternUnits="userSpaceOnUse">
        <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#262017" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="600" height="360" fill="url(#srvGrid)" />
    <rect x="24" y="24" width="552" height="312" fill="none" stroke="#3b3226" stroke-width="2" />
    <rect x="40" y="40" width="160" height="110" fill="#1b1814" stroke="${color}" stroke-width="2" />
    <text x="54" y="80" fill="${color}" font-family="monospace" font-weight="800" font-size="12" letter-spacing="1">NODE // SRV-01</text>
    <text x="54" y="105" fill="#82735e" font-family="monospace" font-size="10">SOURCE: DIRECT STREAM</text>
    <line x1="200" y1="95" x2="280" y2="95" stroke="${color}" stroke-width="1.5" />
    <rect x="280" y="55" width="260" height="80" fill="#1b1814" stroke="#4ea8d8" stroke-width="1.5" />
    <text x="296" y="90" fill="#4ea8d8" font-family="monospace" font-weight="700" font-size="12">PROTOCOL: HTTP AUDIO</text>
    <text x="296" y="112" fill="#82735e" font-family="monospace" font-size="10">STATUS: SERVER SYNCED</text>
    <rect x="24" y="240" width="552" height="96" fill="#1a1713" stroke="#3b3226" stroke-width="1" />
    <text x="44" y="278" fill="#c8a96e" font-family="monospace" font-weight="900" font-size="22" letter-spacing="2">${title.toUpperCase()}</text>
    <text x="44" y="308" fill="#dfcfaf" font-family="monospace" font-weight="700" font-size="13" letter-spacing="1">${artist.toUpperCase()}</text>
    <text x="500" y="308" fill="#82735e" font-family="monospace" font-size="11">REV 4.0</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const SERVER_DEMO_TRACKS = [
  {
    id: 'srv-01',
    title: 'RIVERSIDE MUMMY',
    artist: 'SERVER STREAM 05',
    album: 'SERVER ARCHIVE VOL. 1',
    year: '2026',
    genre: 'Industrial Electronic',
    trackNumber: '01',
    bpm: 126,
    duration: 210,
    audioUrl: './music/5-Riverside Mummy.mp3',
    coverUrl: createServerCoverSvg('RIVERSIDE MUMMY', 'SERVER STREAM 05', '#c8a96e', '#151310'),
    format: 'MP3 AUDIO STREAM',
    fileSize: 5242880,
    dateAdded: Date.now() - 300000,
    isFavorite: true,
    comments: 'Direct server stream audio asset loaded from /music/5-Riverside Mummy.mp3.',
    lyrics: ``
  },
  {
    id: 'srv-02',
    title: 'TACTICAL LOGOUT',
    artist: 'SERVER STREAM 06',
    album: 'SERVER ARCHIVE VOL. 1',
    year: '2026',
    genre: 'Cyberpunk / EBM',
    trackNumber: '02',
    bpm: 135,
    duration: 195,
    audioUrl: './music/6-Tactical Logout.mp3',
    coverUrl: createServerCoverSvg('TACTICAL LOGOUT', 'SERVER STREAM 06', '#7da564', '#151310'),
    format: 'MP3 AUDIO STREAM',
    fileSize: 4850000,
    dateAdded: Date.now() - 200000,
    isFavorite: false,
    comments: 'Direct server stream audio asset loaded from /music/6-Tactical Logout.mp3.',
    lyrics: ``
  },
  {
    id: 'srv-03',
    title: 'IT IS WHAT IT IS (ABOBA)',
    artist: 'SERVER STREAM 07',
    album: 'SERVER ARCHIVE VOL. 1',
    year: '2026',
    genre: 'Glitch / Experimental',
    trackNumber: '03',
    bpm: 120,
    duration: 180,
    audioUrl: './music/It Is What It Is (Aboba) (1).mp3',
    coverUrl: createServerCoverSvg('IT IS WHAT IT IS', 'SERVER STREAM 07', '#c85252', '#151310'),
    format: 'MP3 AUDIO STREAM',
    fileSize: 4500000,
    dateAdded: Date.now() - 100000,
    isFavorite: true,
    comments: 'Direct server stream audio asset loaded from /music/It Is What It Is (Aboba) (1).mp3.',
    lyrics: ``
  }
];
