// basic timeline module: drawing a 6s timeline, selectable frames, playback, hotkeys
// exposes window.timelineAPI for integration and future expansion (keyframes, tracks, recording)

let LENGTH_SECONDS = 3.0; // adjustable via UI
const lengthInput = document.getElementById('lengthSeconds');
if(lengthInput){
  lengthInput.addEventListener('input', ()=>{
    const v = parseFloat(lengthInput.value) || 1;
    LENGTH_SECONDS = Math.max(1, Math.min(60, v));
    // do NOT stretch keyframes when timeline length changes; just update total frames
    updateTotals(false);
  });
}

let fps = 24;
let totalFrames = Math.round(LENGTH_SECONDS * fps);
let currentFrame = 0;
let playing = false;
let loopPlayback = false; // new: loop toggle
let lastTick = 0;
let recordMode = false; // new - recording toggle
let recordingLastTick = 0; // added: time base for recording auto-advance
const recordBtn = document.getElementById('recordBtn');
const eraserBtn = document.getElementById('eraserBtn');
const moveBtn = document.getElementById('moveBtn'); // new
let eraserMode = false;
let moveMode = false; // new
let editMode = false; // new: edit toggle state
let erasing = false; // added: track active pointer erasing state
let movingKF = null; // { trackId, index, origFrame, pointerOffsetX }
let moveCursorX = 0; // for rendering while dragging

const playPauseBtn = document.getElementById('playPause');
const timeDisplay = document.getElementById('timeDisplay');
const fpsSelect = document.getElementById('fpsSelect');
const tlCanvas = document.getElementById('timelineCanvas');
const tlCtx = tlCanvas.getContext('2d');

function updateTotals(scaleKeyframes = true){
  // update fps from UI
  const oldFps = fps;
  const oldTotal = totalFrames || Math.round(LENGTH_SECONDS * (oldFps || 24));
  fps = parseInt(fpsSelect.value,10);
  const newTotal = Math.round(LENGTH_SECONDS * fps);
  // only rescale keyframe.frame values when requested (i.e. fps changed), not when length changed
  if(scaleKeyframes && oldTotal > 0 && newTotal > 0 && oldTotal !== newTotal){
    const scale = newTotal / oldTotal;
    for(const tid of Object.keys(timelineData.tracks)){
      const tr = timelineData.tracks[tid];
      for(const kf of tr.keyframes){
        kf.frame = Math.max(0, Math.min(newTotal-1, Math.round(kf.frame * scale)));
      }
    }
  }
  totalFrames = newTotal;
  drawTimeline();
}
if(fpsSelect) fpsSelect.addEventListener('change', updateTotals);
// ensure fpsSelect change scales keyframes (pass true)
if(fpsSelect) fpsSelect.addEventListener('change', ()=> updateTotals(true));

function resizeCanvasToDisplay(){
  const rect = tlCanvas.getBoundingClientRect();
  // ensure CSS height takes into account dynamic layout (clientHeight may change)
  tlCanvas.width = Math.round(rect.width * devicePixelRatio);
  tlCanvas.height = Math.round(rect.height * devicePixelRatio);
  tlCtx.setTransform(1,0,0,1,0,0);
  tlCtx.scale(devicePixelRatio, devicePixelRatio);
}
window.addEventListener('resize', ()=>{ resizeCanvasToDisplay(); drawTimeline(); });

// replace earlier simple timelineData structure and add track management UI/hooks

// new: tracks stored as map: id -> { id, name, type, keyframes: [] }
const timelineData = {
  tracks: {} // populated by addTrack()
};

let activeTrackId = null;
const trackSelect = document.getElementById('trackSelect');
const addTrackBtn = document.getElementById('addTrackBtn');

function generateId(prefix='t'){
  return prefix + Math.random().toString(36).slice(2,9);
}

// create a new track and optionally select it
function addTrack(opts = { name: 'Track', type: 'mouse' }, select = true){
  const id = generateId('track_');
  timelineData.tracks[id] = {
    id, name: opts.name || ('Track ' + Object.keys(timelineData.tracks).length),
    type: opts.type || 'mouse',
    keyframes: []
  };
  rebuildTrackSelect();
  if(select) setActiveTrack(id);
  drawTimeline();
  return id;
}

// helper: find or create a single dedicated track by type (e.g. 'pinRadius' or 'physics')
function getOrCreateTrackByType(type, humanName){
  for(const id of Object.keys(timelineData.tracks)){
    if(timelineData.tracks[id].type === type) return id;
  }
  // create a friendly named track
  return addTrack({ name: humanName || (type + ' track'), type }, true);
}

function rebuildTrackSelect(){
  if(!trackSelect) return;
  trackSelect.innerHTML = '';
  for(const id of Object.keys(timelineData.tracks)){
    const t = timelineData.tracks[id];
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${t.name} (${t.type})`;
    if(id === activeTrackId) opt.selected = true;
    trackSelect.appendChild(opt);
  }
  // update visual timeline height whenever tracks list changes
  updateTimelineHeight();
}

function setActiveTrack(id){
  if(!timelineData.tracks[id]) return;
  activeTrackId = id;
  if(trackSelect) trackSelect.value = id;
  // immediately refresh the timeline so the active track lane (light grey line) updates
  drawTimeline();
}

// init default track(s)
if(Object.keys(timelineData.tracks).length === 0){
  addTrack({ name: 'Mouse A', type: 'mouse' }, true);
  addTrack({ name: 'Mouse B', type: 'mouse' }, false);
}

// UI handlers for track controls
if(addTrackBtn){
  addTrackBtn.addEventListener('click', ()=>{
    const name = 'Track ' + (Object.keys(timelineData.tracks).length + 1);
    addTrack({ name, type: 'mouse' }, true);
  });
}
if(trackSelect){
  trackSelect.addEventListener('change', ()=>{
    setActiveTrack(trackSelect.value);
  });
}

const loopToggle = document.getElementById('loopToggle');
const editBtn = document.getElementById('editBtn');
if(loopToggle){
  loopToggle.addEventListener('change', ()=>{ loopPlayback = !!loopToggle.checked; });
}
if(editBtn){
  editBtn.addEventListener('click', ()=>{
    editMode = !editMode;
    editBtn.textContent = 'Edit: ' + (editMode ? 'on' : 'off');
    editBtn.style.borderColor = editMode ? 'rgba(79,179,255,0.9)' : '';
    // ensure move/eraser don't conflict with edit mode
    if(editMode && (moveMode || eraserMode)){
      moveMode = false; moveBtn && (moveBtn.textContent = 'Move: off'); eraserMode = false; eraserBtn && (eraserBtn.textContent = 'Eraser: off');
    }
  });
}

// export video button (records the main canvas at timeline fps)
const exportBtn = document.getElementById('exportBtn');
if(exportBtn){
  // show export settings modal then perform export using chosen bitrate/container
  exportBtn.addEventListener('click', (e)=>{
    showExportSettingsModal();
  });
}

// create a small modal to select bitrate and container, then start export
function showExportSettingsModal(){
  if(document.getElementById('export-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'export-modal';
  Object.assign(modal.style, { position:'fixed', left:'50%', top:'50%', transform:'translate(-50%,-50%)', background:'#0f1316', color:'#e6eef8', padding:'12px', borderRadius:'8px', zIndex:9999, border:'1px solid rgba(255,255,255,0.04)' });
  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong>Export Settings</strong><button id="exp-close" style="background:transparent;border:0;color:#9aa6b2;cursor:pointer">✕</button></div>
    <div style="display:grid;gap:8px;min-width:320px">
      <label>Container
        <select id="exp-container"><option value="webm" selected>webm (vp9)</option><option value="png-zip">png sequence (.zip)</option></select>
      </label>
      <label>Bitrate (kbps)
        <input id="exp-bitrate" type="number" min="100" max="50000" value="8000" style="width:150px"/>
      </label>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">
        <button id="exp-start" style="background:#4fb3ff;border:0;padding:8px;border-radius:6px;color:#081018;cursor:pointer">Start Export</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#exp-close').addEventListener('click', ()=>{ modal.remove(); });
  modal.querySelector('#exp-start').addEventListener('click', async ()=>{
    const container = modal.querySelector('#exp-container').value;
    const kbps = parseInt(modal.querySelector('#exp-bitrate').value,10) || 3000;
    modal.remove();
    await performExport(container, kbps);
  });
}

async function performExport(container, kbps){
  try{
    const mainCanvas = document.getElementById('canvas');
    if(!mainCanvas){ alert('Main canvas not found'); return; }
    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';
    const wasPlaying = playing;
    playing = false;

    if(container === 'png-zip'){
      // export every frame as PNG and zip them
      const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js')).default || (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'));
      const zip = new JSZip();
      const frameDelay = 1000 / fps;
      const origFrame = currentFrame;
      for(let f = 0; f < totalFrames; f++){
        setFrame(f);
        // allow render to catch up (small delay)
        await new Promise(r => setTimeout(r, 0));
        // convert canvas to blob png
        const blob = await new Promise(resolve => mainCanvas.toBlob(resolve, 'image/png', 1.0));
        zip.file(`frame_${String(f).padStart(5,'0')}.png`, blob);
      }
      // restore frame and state
      setFrame(origFrame);
      const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timeline_frames.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      exportBtn.textContent = 'Export Video';
      exportBtn.disabled = false;
      playing = wasPlaying;
      return;
    }

    // fallback: webm (vp9)
    const stream = mainCanvas.captureStream(fps);
    const recChunks = [];
    const mime = 'video/webm;codecs=vp9';
    const opts = { mimeType: mime, bitsPerSecond: Math.max(1000, kbps*1000) };
    const mr = new MediaRecorder(stream, opts);
    mr.ondataavailable = (e)=>{ if(e.data && e.data.size) recChunks.push(e.data); };
    mr.start();

    const frameDelay = 1000 / fps;
    for(let f = 0; f < totalFrames; f++){
      setFrame(f);
      await new Promise(r => setTimeout(r, Math.max(16, frameDelay)));
    }
    await new Promise(r => setTimeout(r, 200));
    mr.stop();
    await new Promise(resolve => mr.onstop = resolve);
    const type = recChunks.length ? recChunks[0].type || 'video/webm' : 'video/webm';
    const blob = new Blob(recChunks, { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeline_export.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    playing = wasPlaying;
    exportBtn.textContent = 'Export Video';
    exportBtn.disabled = false;
  }catch(err){
    console.error('Export failed', err);
    alert('Export failed: ' + (err && err.message ? err.message : String(err)));
    exportBtn.disabled = false;
    exportBtn.textContent = 'Export Video';
  }
}

function trackColorFromIndex(i){
  const palette = [
    'rgba(79,179,255,0.95)',
    'rgba(140,220,120,0.95)',
    'rgba(255,120,100,0.95)',
    'rgba(200,150,255,0.95)',
    'rgba(255,200,80,0.95)'
  ];
  return palette[i % palette.length];
}

function drawTimeline(){
  if(!tlCtx) return;
  resizeCanvasToDisplay();
  const w = tlCanvas.clientWidth;
  const h = tlCanvas.clientHeight;
  tlCtx.clearRect(0,0,w,h);
  // background
  tlCtx.fillStyle = 'rgba(20,22,24,0.9)';
  tlCtx.fillRect(0,0,w,h);
  // ticks & seconds markers (unchanged)
  const pxPerSec = w / LENGTH_SECONDS;
  tlCtx.strokeStyle = 'rgba(255,255,255,0.06)';
  tlCtx.fillStyle = 'rgba(255,255,255,0.9)';
  tlCtx.font = '12px "Noto Sans", system-ui';
  for(let s=0;s<=LENGTH_SECONDS;s++){
    const x = s * pxPerSec;
    tlCtx.beginPath();
    tlCtx.moveTo(x, h*0.2);
    tlCtx.lineTo(x, h*0.45);
    tlCtx.stroke();
    tlCtx.fillText(s + 's', x + 4, h*0.18 + 10);
  }

  // frame markers
  const framePx = pxPerSec / fps;
  tlCtx.strokeStyle = 'rgba(255,255,255,0.03)';
  for(let f=0; f<totalFrames; f+= Math.max(1, Math.floor(fps/4))){
    const x = (f / totalFrames) * w;
    tlCtx.beginPath();
    tlCtx.moveTo(x, h*0.5);
    tlCtx.lineTo(x, h*0.6);
    tlCtx.stroke();
  }

  // draw keyframes per track (stack visually by track index)
  let ti = 0;
  const trackIds = Object.keys(timelineData.tracks);
  // compute lane layout: start some distance down and evenly space tracks with comfortable separation
  const laneStart = Math.round(h * 0.35);
  const maxLaneArea = Math.max(40, Math.round(h * 0.5));
  const laneSpacing = Math.min(36, Math.max(18, Math.floor(maxLaneArea / Math.max(1, trackIds.length))));
  for(const tid of trackIds){
    const track = timelineData.tracks[tid];
    const color = trackColorFromIndex(ti);
    const laneY = laneStart + (ti * laneSpacing);
    for(const kf of track.keyframes){
      const x = (kf.frame / Math.max(1,totalFrames)) * w;
      // draw normal keyframe; release keyframes use inverted/highlighted style
      if(kf.type === 'release'){
        // inverted: white fill with subtle dark stroke
        tlCtx.fillStyle = 'rgba(255,255,255,0.95)';
        tlCtx.strokeStyle = 'rgba(6,8,10,0.95)';
        tlCtx.beginPath();
        tlCtx.arc(x, laneY, 5, 0, Math.PI*2);
        tlCtx.fill();
        tlCtx.lineWidth = 1.2;
        tlCtx.stroke();
      } else {
        tlCtx.fillStyle = color;
        tlCtx.beginPath();
        tlCtx.arc(x, laneY, 4, 0, Math.PI*2);
        tlCtx.fill();
      }
    }
    // highlight active track lane
    if(tid === activeTrackId){
      tlCtx.fillStyle = 'rgba(255,255,255,0.04)';
      tlCtx.fillRect(0, laneY - (laneSpacing/2) + 2, w, laneSpacing - 4);
    }
    ti++;
  }

  // if moving a keyframe, draw its ghost at moveCursorX
  if(movingKF){
    const srcTrackIndex = Object.keys(timelineData.tracks).indexOf(movingKF.trackId);
    const ghostY = laneStart + (srcTrackIndex * laneSpacing);
    // draw ghost circle
    tlCtx.beginPath();
    tlCtx.fillStyle = 'rgba(255,240,140,0.95)';
    tlCtx.arc(moveCursorX, ghostY, 6, 0, Math.PI*2);
    tlCtx.fill();
    tlCtx.lineWidth = 1;
    tlCtx.strokeStyle = 'rgba(20,20,20,0.9)';
    tlCtx.stroke();
  }

  // draw current frame playhead
  const playheadX = (currentFrame / Math.max(1,totalFrames)) * w;
  tlCtx.fillStyle = 'rgba(79,179,255,0.95)';
  tlCtx.fillRect(playheadX-1, 0, 2, h);
  // update time display
  const t = (currentFrame / fps);
  timeDisplay.textContent = t.toFixed(2) + 's';
}

function setFrame(f){
  currentFrame = Math.max(0, Math.min(totalFrames-1, Math.round(f)));
  drawTimeline();
  // notify main app via global hook (for later integration)
  if(window.timelineAPI && typeof window.timelineAPI.onFrame === 'function'){
    window.timelineAPI.onFrame(currentFrame, fps);
  }
}

// allow right-click to delete keyframe
tlCanvas.addEventListener('contextmenu', (ev)=>{
  ev.preventDefault();
  const rect = tlCanvas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  const hit = findKeyframeAtCanvas(x,y);
  if(hit){
    // remove keyframe from track
    const track = timelineData.tracks[hit.trackId];
    if(track && typeof hit.index === 'number'){
      track.keyframes.splice(hit.index,1);
      drawTimeline();
    }
  }
});

// left-click behavior: if eraser active, remove clicked keyframe; otherwise normal seek/create selection
tlCanvas.addEventListener('click', (ev)=>{
  const rect = tlCanvas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  if(editMode){
    // if editing is on, clicking a keyframe opens the inspector (if available)
    const hit = findKeyframeAtCanvas(x,y);
    if(hit){
      // prefer inspector API, fallback to custom event
      if(window.timelineInspector && typeof window.timelineInspector.inspectKeyframe === 'function'){
        window.timelineInspector.inspectKeyframe(hit.trackId, hit.index);
      } else {
        const custom = new CustomEvent('timeline:requestInspect', { detail: { trackId: hit.trackId, index: hit.index } });
        window.dispatchEvent(custom);
      }
      return;
    }
    return;
  }
  if(eraserMode){
    const hit = findKeyframeAtCanvas(x,y);
    if(hit){
      const track = timelineData.tracks[hit.trackId];
      if(track && typeof hit.index === 'number'){ track.keyframes.splice(hit.index,1); drawTimeline(); }
      return;
    }
    return;
  }
  if(moveMode) return; // move handled with pointer events, ignore click jump
  const w = tlCanvas.clientWidth;
  const f = Math.floor((x / w) * totalFrames);
  setFrame(f);
});

// enable eraser-drag: start erasing on pointerdown when eraserMode is active
tlCanvas.addEventListener('pointerdown', (ev)=>{
  const rect = tlCanvas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  if(moveMode){
    const hit = findKeyframeAtCanvas(x,y);
    if(hit){
      // copy keyframe data (cut semantics): keep a copy while removing original immediately
      const kfCopy = Object.assign({}, hit.keyframe);
      // remove original from source track immediately so move acts like cut
      const srcTrack = timelineData.tracks[hit.trackId];
      if(srcTrack && typeof hit.index === 'number'){ srcTrack.keyframes.splice(hit.index,1); }
      // store original track index so drop logic can prefer original lane
      const trackIds = Object.keys(timelineData.tracks);
      const origTrackIndex = trackIds.indexOf(hit.trackId);
      movingKF = { trackId: hit.trackId, index: hit.index, origFrame: hit.keyframe.frame, pointerOffsetX: x - ((hit.keyframe.frame/Math.max(1,totalFrames))*tlCanvas.clientWidth), kfCopy, origTrackIndex };
      moveCursorX = x;
      // capture pointer to track drag outside canvas
      tlCanvas.setPointerCapture(ev.pointerId);
      drawTimeline();
      return;
    }
  }
  if(!eraserMode) return;
  ev.preventDefault();
  erasing = true;
  const hit = findKeyframeAtCanvas(x,y);
  if(hit){
    const track = timelineData.tracks[hit.trackId];
    if(track && typeof hit.index === 'number'){ track.keyframes.splice(hit.index,1); drawTimeline(); }
  }
});

// while dragging, remove any keyframes crossed
tlCanvas.addEventListener('pointermove', (ev)=>{
  const rect = tlCanvas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  if(movingKF){
    moveCursorX = x;
    // live update visual by redrawing; compute tentative frame but not commit until pointerup
    const w = tlCanvas.clientWidth;
    const tentativeFrame = Math.round(((x - movingKF.pointerOffsetX) / w) * totalFrames);
    // clamp and show
    drawTimeline();
    return;
  }
  if(!erasing) return;
  const hit = findKeyframeAtCanvas(x,y);
  if(hit){
    const track = timelineData.tracks[hit.trackId];
    if(track && typeof hit.index === 'number'){ track.keyframes.splice(hit.index,1); drawTimeline(); }
  }
});

window.addEventListener('pointerup', (ev)=>{
  // finalize move if active
  if(movingKF){
    try{
      const rect = tlCanvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const w = tlCanvas.clientWidth, h = tlCanvas.clientHeight;
      const newFrame = Math.max(0, Math.min(totalFrames-1, Math.round(((x - movingKF.pointerOffsetX) / w) * totalFrames)));
      // ensure moved keyframe stays on its original track to avoid accidental lane jumps
      const dropTrackId = movingKF.trackId;
      // paste the copied keyframe into the destination track with updated frame
      if(movingKF.kfCopy){
        const paste = Object.assign({}, movingKF.kfCopy);
        paste.frame = newFrame;
        timelineData.tracks[dropTrackId].keyframes.push(paste);
      }
    }catch(e){}
    movingKF = null;
    try{ tlCanvas.releasePointerCapture(ev.pointerId); }catch(e){}
    drawTimeline();
  }
  erasing = false;
});

// stop erasing when pointer released or leaves canvas
tlCanvas.addEventListener('pointerleave', ()=>{ erasing = false; });

// play/pause toggle
playPauseBtn.addEventListener('click', ()=>{
  playing = !playing;
  playPauseBtn.textContent = playing ? 'Pause' : 'Play';
  if(playing){
    lastTick = performance.now();
    requestAnimationFrame(tick);
  }
});

// keyboard hotkeys: left/right to step, space to toggle play, numbers 0-9 jump percent
window.addEventListener('keydown', (e)=>{
  if(e.target && ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
  if(e.code === 'Space'){ e.preventDefault(); playPauseBtn.click(); return; }
  if(e.key === 'ArrowRight'){ setFrame(currentFrame + 1); return; }
  if(e.key === 'ArrowLeft'){ setFrame(currentFrame - 1); return; }
  // quick jump to percent via digits
  if(/^[0-9]$/.test(e.key)){
    const pct = parseInt(e.key,10) / 9;
    setFrame(Math.round(pct * (totalFrames-1)));
  }
});

// helper: find nearest keyframe to a canvas x/y (returns {trackId, kf, index} or null)
function findKeyframeAtCanvas(x,y){
  const w = tlCanvas.clientWidth;
  const h = tlCanvas.clientHeight;
  const trackIds = Object.keys(timelineData.tracks);
  // same lane math as drawTimeline
  const laneStart = Math.round(h * 0.35);
  const maxLaneArea = Math.max(40, Math.round(h * 0.5));
  const laneSpacing = Math.min(36, Math.max(18, Math.floor(maxLaneArea / Math.max(1, trackIds.length))));
  let ti = 0;
  for(const tid of trackIds){
    const track = timelineData.tracks[tid];
    const laneY = laneStart + (ti * laneSpacing);
    for(let i=0;i<track.keyframes.length;i++){
      const kf = track.keyframes[i];
      const kx = (kf.frame / Math.max(1,totalFrames)) * w;
      const ky = laneY;
      const dx = kx - x, dy = ky - y;
      if(Math.sqrt(dx*dx + dy*dy) <= 8){ return { trackId: tid, keyframe: kf, index: i }; }
    }
    ti++;
  }
  return null;
}

// main tick for playback
function tick(ts){
  if(!playing) return;
  const elapsed = ts - lastTick;
  const frameMs = 1000 / fps;
  if(elapsed >= frameMs){
    const step = Math.floor(elapsed / frameMs);
    const nextFrame = currentFrame + step;
    if(nextFrame >= totalFrames){
      if(loopPlayback){
        // wrap to start preserving extra steps
        const overflow = nextFrame - totalFrames;
        setFrame(Math.max(0, overflow));
      } else {
        setFrame(totalFrames - 1);
        playing = false;
        playPauseBtn.textContent = 'Play';
        return;
      }
    } else {
      setFrame(nextFrame);
    }
    // consume only the time for frames we advanced, keep any leftover fractional time
    lastTick += step * frameMs;
  }
  requestAnimationFrame(tick);
}

// record toggle handling
if(recordBtn){
  recordBtn.addEventListener('click', ()=>{
    recordMode = !recordMode;
    recordBtn.textContent = recordMode ? 'Recording...' : 'Record';
    recordBtn.style.borderColor = recordMode ? 'rgba(255,100,100,0.9)' : '';
    if(recordMode){
      // start recording auto-advance loop
      // ensure normal playback loop is paused when recording to avoid double-advancing (esp. with loop enabled)
      if(playing){
        playing = false;
        playPauseBtn.textContent = 'Play';
      }
      recordingLastTick = performance.now();
      requestAnimationFrame(recordTick);
    }
  });
}

// eraser toggle
if(eraserBtn){
  eraserBtn.addEventListener('click', ()=>{
    eraserMode = !eraserMode;
    eraserBtn.textContent = 'Eraser: ' + (eraserMode ? 'on' : 'off');
    eraserBtn.style.borderColor = eraserMode ? 'rgba(255,100,100,0.9)' : '';
  });
}

// move toggle
if(moveBtn){
  moveBtn.addEventListener('click', ()=>{
    moveMode = !moveMode;
    moveBtn.textContent = 'Move: ' + (moveMode ? 'on' : 'off');
    moveBtn.style.borderColor = moveMode ? 'rgba(120,200,120,0.9)' : '';
    // turn off eraser when enabling move to avoid conflicts
    if(moveMode && eraserMode){
      eraserMode = false;
      eraserBtn.textContent = 'Eraser: off';
      eraserBtn.style.borderColor = '';
    }
  });
}

// recording tick: advances frame at fps while recordMode is true
function recordTick(ts){
  if(!recordMode) return;
  const elapsed = ts - recordingLastTick;
  const frameMs = 1000 / fps;
  if(elapsed >= frameMs){
    const step = Math.floor(elapsed / frameMs);
    const next = currentFrame + step;
    if(next >= totalFrames - 1){
      setFrame(totalFrames - 1);
      // auto-stop recording at end (if looping, wrap and continue recording)
      if(loopPlayback){
        // wrap around and continue recording
        setFrame(0);
        // consume time for frames advanced, preserving remainder
        recordingLastTick += step * frameMs;
      } else {
        recordMode = false;
        recordBtn.textContent = 'Record';
        recordBtn.style.borderColor = '';
        return;
      }
    } else {
      setFrame(next);
    }
    // consume only the time for frames we advanced, keep fractional remainder
    recordingLastTick += step * frameMs;
  }
  requestAnimationFrame(recordTick);
}

// helper - convert DOM event to canvas coords for the main canvas
function getCanvasCoordsFromEvent(ev){
  const canvasEl = document.getElementById('canvas');
  if(!canvasEl) return null;
  const rect = canvasEl.getBoundingClientRect();
  const scaleX = canvasEl.width / rect.width;
  const scaleY = canvasEl.height / rect.height;
  const client = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
  return { x: (client.clientX - rect.left) * scaleX, y: (client.clientY - rect.top) * scaleY };
}

// --- NEW: record slider inputs into tracks when recordMode is active ---
// map control element IDs to logical track types and friendly names
const sliderToTrackMap = {
  'pinRadiusRange': { type: 'pinRadius', name: 'Pin Radius' },
  // physics group sliders will all record into a single 'physics' track
  'strengthRange': { type: 'physics', name: 'Physics' },
  'falloffRange': { type: 'physics', name: 'Physics' },
  'waveStrengthRange': { type: 'physics', name: 'Physics' },
  'waveSpeedRange': { type: 'physics', name: 'Physics' },
  'waveDecayRange': { type: 'physics', name: 'Physics' },
  'waveThresholdRange': { type: 'physics', name: 'Physics' },
  'stiffnessRange': { type: 'physics', name: 'Physics' },
  'dampingRange': { type: 'physics', name: 'Physics' },
  'renderModeSelect': { type: 'rendering', name: 'Rendering' }
};

// attach input listeners for all mapped sliders to record keyframes when recording
Object.keys(sliderToTrackMap).forEach(controlId => {
  const el = document.getElementById(controlId);
  if(!el) return;
  el.addEventListener('input', (ev) => {
    // only record while in recordMode
    if(!recordMode) return;
    // find or create the appropriate track
    const map = sliderToTrackMap[controlId];
    const trackId = getOrCreateTrackByType(map.type, map.name);
    // numeric value recorded; include the control id so later playback can route value back
    const val = parseFloat(ev.target.value);
    const kf = { frame: currentFrame, type: 'value', control: controlId, value: val, easing: 'linear' };
    window.timelineAPI.addKeyframe(trackId, kf);
  });
});

// attach recording handlers to the main canvas to capture pointer actions
(function attachRecorder(){
  const hostCanvas = document.getElementById('canvas');
  if(!hostCanvas) return;
  hostCanvas.addEventListener('pointerdown', (ev)=>{
    if(!recordMode) return;
    const pos = getCanvasCoordsFromEvent(ev);
    if(!pos) return;
    const kf = { frame: currentFrame, type: 'grab', x: pos.x, y: pos.y, easing: 'linear' };
    window.timelineAPI.addKeyframe('mouse', kf);
  });
  hostCanvas.addEventListener('pointermove', (ev)=>{
    if(!recordMode) return;
    // record move keyframes only if pointer is down (dragging)
    if(ev.buttons === 0) return;
    const pos = getCanvasCoordsFromEvent(ev);
    if(!pos) return;
    const kf = { frame: currentFrame, type: 'move', x: pos.x, y: pos.y, easing: 'linear' };
    window.timelineAPI.addKeyframe('mouse', kf);
  });
  hostCanvas.addEventListener('pointerup', (ev)=>{
    if(!recordMode) return;
    const pos = getCanvasCoordsFromEvent(ev) || { x:0, y:0 };
    const kf = { frame: currentFrame, type: 'release', x: pos.x, y: pos.y, easing: 'linear' };
    window.timelineAPI.addKeyframe('mouse', kf);
  });
})();

// dynamically adjust the timeline canvas CSS height based on number of tracks
function updateTimelineHeight(){
  const base = 64; // minimum height in px
  const trackCount = Math.max(1, Object.keys(timelineData.tracks).length);
  // compute desired height: reserve top area for time rulers + one lane per track ~36px each
  const desired = Math.max(base, 36 + (trackCount * 36));
  tlCanvas.style.height = desired + 'px';
  // force a redraw/resize
  resizeCanvasToDisplay();
  drawTimeline();
}

// public API for integration and later UI expansion
window.timelineAPI = {
  setFrame,
  get currentFrame(){ return currentFrame; },
  get fps(){ return fps; },
  addKeyframe(trackOrNull, data){
    // if first arg is a string matching a track ID, use it; else use activeTrackId
    let targetTrackId = null;
    if(typeof trackOrNull === 'string' && timelineData.tracks[trackOrNull]) targetTrackId = trackOrNull;
    else targetTrackId = activeTrackId;
    if(!targetTrackId) return;
    const track = timelineData.tracks[targetTrackId];
    const entry = Object.assign({}, data, { trackId: targetTrackId });

    // Prevent duplicate keyframes at the same frame: replace existing keyframe on same frame
    // This avoids "move" + "release" stacking when both were recorded at the same frame.
    const existingIndexByFrame = track.keyframes.findIndex(k => k.frame === entry.frame && k.control === entry.control);
    if(existingIndexByFrame !== -1){
      // If replacing, keep merged object but prefer release semantics when present.
      // For simplicity we replace existing entry with the new one to avoid stacking.
      track.keyframes[existingIndexByFrame] = Object.assign({}, track.keyframes[existingIndexByFrame], entry);
    } else {
      // also ensure only one keyframe per-frame overall (if no control field)
      const existingAny = track.keyframes.findIndex(k => k.frame === entry.frame && !entry.control);
      if(existingAny !== -1 && !entry.control){
        track.keyframes[existingAny] = Object.assign({}, track.keyframes[existingAny], entry);
      } else {
        track.keyframes.push(entry);
      }
    }

    drawTimeline();
  },
  // remove a specific keyframe by trackId and index or by object reference
  removeKeyframe(trackId, indexOrMatch){
    if(!timelineData.tracks[trackId]) return false;
    const track = timelineData.tracks[trackId];
    if(typeof indexOrMatch === 'number'){
      if(indexOrMatch < 0 || indexOrMatch >= track.keyframes.length) return false;
      track.keyframes.splice(indexOrMatch,1);
      drawTimeline();
      return true;
    } else if(typeof indexOrMatch === 'function'){
      const idx = track.keyframes.findIndex(indexOrMatch);
      if(idx === -1) return false;
      track.keyframes.splice(idx,1);
      drawTimeline();
      return true;
    } else if(typeof indexOrMatch === 'object' && indexOrMatch !== null){
      const idx = track.keyframes.indexOf(indexOrMatch);
      if(idx === -1) return false;
      track.keyframes.splice(idx,1);
      drawTimeline();
      return true;
    }
    return false;
  },
  getData(){ return timelineData; },
  getActiveTrackId(){ return activeTrackId; },
  onFrame: null
};

drawTimeline();