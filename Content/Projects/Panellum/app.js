const pannellum = window.pannellum;

const fileInput = document.getElementById('fileInput');
const thumbList = document.getElementById('thumbList');
const panoramaEl = document.getElementById('panorama');
const gyroBtn = document.getElementById('gyroBtn');
/* removed nav elements (prevBtn, nextBtn, indexLabel) as UI menu was deleted */

let images = []; // {url,name}
let current = -1;
let viewer = null;
let gyroEnabled = false;

// New: settings UI bindings and stored settings
const settingsToggle = document.getElementById('settingsToggle');
const settingsPanel = document.getElementById('settingsPanel');
const inpHaov = document.getElementById('inpHaov');
const inpVaov = document.getElementById('inpVaov');
const inpHfov = document.getElementById('inpHfov');
const inpMinHfov = document.getElementById('inpMinHfov');
const inpMaxHfov = document.getElementById('inpMaxHfov');
const applySettingsBtn = document.getElementById('applySettings');
const closeSettingsBtn = document.getElementById('closeSettings');
// New: local library toggle
const localLibToggle = document.getElementById('localLibToggle');

let pannellumSettings = {
  haov: 180,
  vaov: 110,
  hfov: 90,
  minHfov: 30,
  maxHfov: 120
};

// Helper to read inputs into settings
function readSettingsFromUI() {
  pannellumSettings.haov = Number(inpHaov.value) || 180;
  pannellumSettings.vaov = Number(inpVaov.value) || 110;
  pannellumSettings.hfov = Number(inpHfov.value) || 90;
  pannellumSettings.minHfov = Number(inpMinHfov.value) || 30;
  pannellumSettings.maxHfov = Number(inpMaxHfov.value) || 120;
}

// Populate UI from settings
function populateSettingsUI() {
  inpHaov.value = pannellumSettings.haov;
  inpVaov.value = pannellumSettings.vaov;
  inpHfov.value = pannellumSettings.hfov;
  inpMinHfov.value = pannellumSettings.minHfov;
  inpMaxHfov.value = pannellumSettings.maxHfov;
}

settingsToggle.addEventListener('click', () => {
  const expanded = settingsToggle.getAttribute('aria-expanded') === 'true';
  settingsToggle.setAttribute('aria-expanded', String(!expanded));
  settingsPanel.hidden = expanded;
  if (!expanded) populateSettingsUI();
});

closeSettingsBtn.addEventListener('click', () => {
  settingsPanel.hidden = true;
  settingsToggle.setAttribute('aria-expanded', 'false');
});

// New: compute haov/vaov from aspect ratio with piecewise interpolation
function computeAnglesFromAspect(aspect) {
  // control points:
  // 9:16 (~0.5625) -> haov=90, vaov=140
  // 1:1 (1)           -> haov=120, vaov=100
  // 16:9 (~1.7778) -> haov=180, vaov=90
  const a9_16 = 9/16;
  const a1 = 1;
  const a16_9 = 16/9;

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  if (aspect <= a1) {
    // interpolate between 9:16 and 1:1
    const t = clamp((aspect - a9_16) / (a1 - a9_16), 0, 1);
    return {
      haov: Math.round(lerp(90, 120, t)),
      vaov: Math.round(lerp(140, 100, t))
    };
  } else {
    // interpolate between 1:1 and 16:9
    const t = clamp((aspect - a1) / (a16_9 - a1), 0, 1);
    return {
      haov: Math.round(lerp(120, 180, t)),
      vaov: Math.round(lerp(100, 90, t))
    };
  }
}

// Helper: resolve per-image and global settings, allow "auto" entries for angles
function resolveImageAngles(imgObj, callback) {
  // If both haov/vaov present and numeric, return them immediately
  const tryParse = v => {
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'number') return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const haovVal = tryParse(imgObj.haov);
  const vaovVal = tryParse(imgObj.vaov);

  if (haovVal !== undefined && vaovVal !== undefined) {
    callback({haov: haovVal, vaov: vaovVal});
    return;
  }

  // Need to compute from aspect; we may already have aspect (from load), otherwise fetch image dimensions
  const computeAndCallback = (aspect) => {
    const angles = computeAnglesFromAspect(aspect);
    callback({
      haov: (imgObj.haov === 'auto' || haovVal === undefined) ? angles.haov : haovVal,
      vaov: (imgObj.vaov === 'auto' || vaovVal === undefined) ? angles.vaov : vaovVal
    });
  };

  if (typeof imgObj.aspect === 'number') {
    computeAndCallback(imgObj.aspect);
  } else {
    // load image to measure
    const i = new Image();
    i.onload = () => {
      const aspect = i.width / i.height;
      imgObj.aspect = aspect;
      computeAndCallback(aspect);
    };
    i.src = imgObj.url;
  }
}

function createViewer(imageUrl) {
  // destroy existing viewer if present
  if (viewer && typeof viewer.destroy === 'function') {
    try { viewer.destroy(); } catch (e) { /* ignore */ }
    if (viewer && viewer._gyroPollInterval) {
      clearInterval(viewer._gyroPollInterval);
    }
  }

  // decide haov/vaov: prefer per-image values when available, fallback to global settings
  let haovToUse = pannellumSettings.haov;
  let vaovToUse = pannellumSettings.vaov;

  if (current !== -1 && images[current]) {
    const imgObj = images[current];
    // If image requests "auto" or lacks numeric values, compute then recreate viewer once angles known.
    const haovNum = (typeof imgObj.haov === 'number') ? imgObj.haov : (imgObj.haov === 'auto' ? undefined : undefined);
    const vaovNum = (typeof imgObj.vaov === 'number') ? imgObj.vaov : (imgObj.vaov === 'auto' ? undefined : undefined);

    if (haovNum !== undefined && vaovNum !== undefined) {
      haovToUse = haovNum;
      vaovToUse = vaovNum;
      instantiateViewer();
    } else {
      // compute angles then instantiate
      resolveImageAngles(imgObj, (angles) => {
        haovToUse = angles.haov;
        vaovToUse = angles.vaov;
        instantiateViewer();
      });
      return; // will create viewer asynchronously
    }
  } else {
    instantiateViewer();
  }

  function instantiateViewer() {
    // Pannellum configuration: use equirectangular type. For regular photos, set limited hfov.
    viewer = pannellum.viewer('panorama', {
      type: "equirectangular",
      panorama: imageUrl,
      autoLoad: true,
      showZoomCtrl: true,
      showFullscreenCtrl: true,
      mouseZoom: true,
      northOffset: 0,
      hfov: pannellumSettings.hfov,
      minHfov: pannellumSettings.minHfov,
      maxHfov: pannellumSettings.maxHfov,
      pitch: 0,
      yaw: 0,
      // use computed or saved projection angles
      haov: haovToUse,
      vaov: vaovToUse,
      keyboardZoom: false,
      // Enable device orientation controls using Pannellum's built-in feature
      orientationOnByDefault: gyroEnabled
    });

    // Poll viewer orientation state so our UI reflects when pannellum disables gyro (e.g. after touch)
    if (viewer) {
      // clear any leftover
      if (viewer._gyroPollInterval) clearInterval(viewer._gyroPollInterval);
      viewer._gyroPollInterval = setInterval(() => {
        try {
          if (typeof viewer.isOrientationActive === 'function') {
            const active = !!viewer.isOrientationActive();
            if (active !== gyroEnabled) {
              gyroEnabled = active;
              gyroBtn.textContent = gyroEnabled ? 'Gyroscope Enabled' : 'Enable Gyroscope';
            }
          }
        } catch (e) {}
      }, 300);
    }

    viewer.on('load', () => {
      try {
        try { if (typeof viewer.removeHotSpot === 'function') viewer.removeHotSpot('prev-hotspot'); } catch (e) {}
        try { if (typeof viewer.removeHotSpot === 'function') viewer.removeHotSpot('next-hotspot'); } catch (e) {}

        setTimeout(() => {
          const makeButton = (label, onClick) => {
            const btn = document.createElement('div');
            btn.className = 'pannellum-hotspot-btn';
            btn.textContent = label;
            btn.addEventListener('click', (ev) => { ev.stopPropagation(); onClick(); });
            return btn;
          };

          try {
            viewer.addHotSpot({
              id: 'prev-hotspot',
              pitch: -85,
              yaw: 0,
              type: 'custom',
              createTooltipFunc: function(hotSpotDiv) {
                const btn = makeButton('Prev', () => {
                  if (!images.length) return;
                  showIndex((current - 1 + images.length) % images.length);
                });
                hotSpotDiv.appendChild(btn);
              },
              createTooltipArgs: {}
            });
          } catch (e) {}

          try {
            viewer.addHotSpot({
              id: 'next-hotspot',
              pitch: 85,
              yaw: 0,
              type: 'custom',
              createTooltipFunc: function(hotSpotDiv) {
                const btn = makeButton('Next', () => {
                  if (!images.length) return;
                  showIndex((current + 1) % images.length);
                });
                hotSpotDiv.appendChild(btn);
              },
              createTooltipArgs: {}
            });
          } catch (e) {}
        }, 0);
      } catch (e) {}
    });
  }
}

function updateThumbs() {
  thumbList.innerHTML = '';
  images.forEach((img, i) => {
    const li = document.createElement('li');
    li.dataset.index = i;
    if (i === current) li.classList.add('active');
    const image = document.createElement('img');
    image.src = img.url;
    image.alt = img.name || `Image ${i+1}`;
    li.appendChild(image);
    li.addEventListener('click', () => { showIndex(i); });
    thumbList.appendChild(li);
  });
  // menu/index removed — no UI element to update
}

function showIndex(i) {
  if (i < 0 || i >= images.length) return;
  current = i;
  updateThumbs();
  createViewer(images[i].url);
}

fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  files.forEach(file => {
    const url = URL.createObjectURL(file);
    // determine image aspect before pushing so we store haov/vaov per image
    const img = new Image();
    img.onload = () => {
      const aspect = img.width / img.height;
      const angles = computeAnglesFromAspect(aspect);
      images.push({url, name: file.name, aspect, haov: angles.haov, vaov: angles.vaov});
      // If first load, show first image
      if (current === -1) current = 0;
      updateThumbs();
      showIndex(current);
    };
    img.src = url;
  });
});

// Drag & drop support on thumbnails area
const thumbsArea = document.getElementById('thumbs');
thumbsArea.addEventListener('dragover', (e) => { e.preventDefault(); thumbsArea.classList.add('dragover'); });
thumbsArea.addEventListener('dragleave', () => { thumbsArea.classList.remove('dragover'); });
thumbsArea.addEventListener('drop', (e) => {
  e.preventDefault(); thumbsArea.classList.remove('dragover');
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (!files.length) return;
  let pending = files.length;
  files.forEach(file => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const aspect = img.width / img.height;
      const angles = computeAnglesFromAspect(aspect);
      images.push({url, name: file.name, aspect, haov: angles.haov, vaov: angles.vaov});
      pending--;
      if (pending === 0) {
        if (current === -1) current = 0;
        updateThumbs();
        showIndex(current);
      }
    };
    img.src = url;
  });
});

// Navigation buttons
/* previous/next controls removed from bottom UI; keyboard navigation remains */

// Gyroscope enable flow
async function enableGyro() {
  // For iOS 13+ devices, permissions are required
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result === 'granted') {
        gyroEnabled = true;
        gyroBtn.textContent = 'Gyroscope Enabled';
        // Reload viewer to apply new config (orientationOnByDefault: true)
        if (current !== -1) {
          showIndex(current);
        }
      } else {
        alert('Gyroscope permission denied.');
      }
    } catch (err) {
      console.error(err);
      alert('Gyroscope permission request failed.');
    }
  } else {
    // Non iOS browsers - permission isn't required but orientation events may not be available
    gyroEnabled = true;
    gyroBtn.textContent = 'Gyroscope Enabled';
    // Reload viewer to apply new config (orientationOnByDefault: true)
    if (current !== -1) {
      showIndex(current);
    }
  }
}

gyroBtn.addEventListener('click', () => {
  if (gyroEnabled) {
    // disable
    gyroEnabled = false;
    gyroBtn.textContent = 'Enable Gyroscope';
    // Reload viewer to apply new config (orientationOnByDefault: false)
    if (current !== -1) {
      showIndex(current);
    }
  } else {
    enableGyro();
  }
});

// Keyboard left/right navigation
window.addEventListener('keydown', (e) => {
  if (!images.length) return;
  if (e.key === 'ArrowLeft') {
    showIndex((current - 1 + images.length) % images.length);
  } else if (e.key === 'ArrowRight') {
    showIndex((current + 1) % images.length);
  }
});

// Clean up object URLs when page is unloaded
window.addEventListener('beforeunload', () => {
  images.forEach(img => { try { URL.revokeObjectURL(img.url); } catch (e) {} });
});

// New: load local library JSON and populate images array
async function loadLocalLibrary() {
  try {
    const res = await fetch('img/library.json', {cache: "no-store"});
    if (!res.ok) throw new Error('Failed to fetch library.json');
    const list = await res.json();
    if (!Array.isArray(list)) throw new Error('Invalid library.json');
    // Build images entries
    images = [];
    let firstSet = false;
    for (const entry of list) {
      const file = entry.file;
      if (!file) continue;
      const url = `img/${file}`;
      const imgObj = {
        url,
        name: entry.name || file,
        // allow hfov/haov/vaov to be numbers or "auto"
        hfov: entry.hfov !== undefined ? (entry.hfov === 'auto' ? 'auto' : (Number.isFinite(Number(entry.hfov)) ? Number(entry.hfov) : undefined)) : undefined,
        haov: entry.haov !== undefined ? (entry.haov === 'auto' ? 'auto' : (Number.isFinite(Number(entry.haov)) ? Number(entry.haov) : undefined)) : 'auto',
        vaov: entry.vaov !== undefined ? (entry.vaov === 'auto' ? 'auto' : (Number.isFinite(Number(entry.vaov)) ? Number(entry.vaov) : undefined)) : 'auto'
      };
      // pre-measure image aspect to speed up auto calculations
      const measure = new Image();
      measure.onload = () => { imgObj.aspect = measure.width / measure.height; };
      measure.src = url;
      images.push(imgObj);
      if (!firstSet) {
        firstSet = true;
      }
    }
    current = images.length ? 0 : -1;
    updateThumbs();
    if (current !== -1) showIndex(current);
  } catch (e) {
    console.error('Local library load failed', e);
    alert('Failed to load local library. Ensure img/library.json exists and is valid.');
  }
}

// Local library toggle UI
localLibToggle.addEventListener('click', async () => {
  const pressed = localLibToggle.getAttribute('aria-pressed') === 'true';
  if (pressed) {
    // turn off - clear images
    localLibToggle.setAttribute('aria-pressed', 'false');
    // don't destroy uploaded images if present; just clear the local set and reset
    images = [];
    current = -1;
    updateThumbs();
    if (viewer && typeof viewer.destroy === 'function') {
      try { viewer.destroy(); } catch (e) {}
    }
    panoramaEl.innerHTML = '';
  } else {
    localLibToggle.setAttribute('aria-pressed', 'true');
    await loadLocalLibrary();
  }
});