// minimal inspector scaffold for timeline keyframes
// provides a modal UI and simple editing capabilities
// exposes window.timelineInspector with inspectKeyframe(trackId,index) and createKeyframe(trackId,defaults)

function createModal(){
  let modal = document.getElementById('kf-inspector-modal');
  if(modal) return modal;
  modal = document.createElement('div');
  modal.id = 'kf-inspector-modal';
  Object.assign(modal.style, {
    position:'fixed', left:'50%', top:'50%', transform:'translate(-50%,-50%)',
    background:'#0f1316', color:'#e6eef8', border:'1px solid rgba(255,255,255,0.04)', padding:'14px',
    borderRadius:'8px', zIndex:9999, minWidth:'360px', boxShadow:'0 6px 30px rgba(0,0,0,0.6)'
  });
  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <strong>Keyframe Inspector</strong>
      <button id="kf-close" style="background:transparent;border:0;color:#9aa6b2;cursor:pointer">✕</button>
    </div>
    <div style="display:grid;gap:8px;grid-template-columns:1fr 240px">
      <div style="display:grid;gap:8px">
        <label>Track: <span id="kf-track" style="color:#9aa6b2"></span></label>
        <label>Index: <span id="kf-index" style="color:#9aa6b2"></span></label>
        <label>Frame <input id="kf-frame" type="number" min="0" style="width:120px"/></label>
        <label>Type 
          <select id="kf-type" style="width:160px;padding:6px;border-radius:6px;background:#0b0f12;color:#e6eef8;border:1px solid rgba(255,255,255,0.04)">
            <option value="value">value</option>
            <option value="grab">grab</option>
            <option value="move">move</option>
            <option value="release">release</option>
            <option value="pin">pin</option>
          </select>
        </label>
        <label>Control (optional) <input id="kf-control" type="text" style="width:160px"/></label>
        <label>Value (numeric) <input id="kf-value" type="number" step="any" style="width:160px"/></label>
        <label style="display:flex;gap:8px;align-items:center;">
          X <input id="kf-x" type="number" step="any" style="width:120px"/> 
          Y <input id="kf-y" type="number" step="any" style="width:120px"/>
          <button id="kf-sample" style="margin-left:6px;padding:6px;border-radius:6px;background:#2b3033;border:1px solid rgba(255,255,255,0.04);color:#e6eef8;cursor:pointer">Sample</button>
        </label>
        <div style="display:flex;gap:8px;align-items:center">
          <div style="flex:1">
            <div style="color:#9aa6b2;margin-bottom:6px">Easing</div>
            <select id="kf-easing" style="width:100%;padding:8px;border-radius:6px;background:#0b0f12;color:#e6eef8;border:1px solid rgba(255,255,255,0.04)">
              <option value="linear">linear</option>
              <option value="ease">ease</option>
              <option value="ease-in">ease-in</option>
              <option value="ease-out">ease-out</option>
              <option value="ease-in-out">ease-in-out</option>
              <option value="cubic-bezier">cubic-bezier...</option>
            </select>
          </div>
          <input id="kf-bezier" placeholder="x1,y1,x2,y2" style="width:160px;padding:8px;border-radius:6px;background:#071013;color:#e6eef8;border:1px solid rgba(255,255,255,0.04)"/>
        </div>
      </div>
      <div style="padding:10px;border-left:1px solid rgba(255,255,255,0.03);color:#9aa6b2;font-size:13px;border-radius:6px">
        <div style="font-weight:600;color:#e6eef8;margin-bottom:6px">Field help</div>
        <div style="margin-bottom:8px"><strong>Control (optional)</strong><br/>Identifier to route this keyframe to a specific UI control (e.g. "strengthRange"). If empty, keyframe is general for the track.</div>
        <div style="margin-bottom:8px"><strong>Value</strong><br/>Numeric payload for value-type keyframes (used by sliders/parameters).</div>
        <div style="margin-bottom:8px"><strong>Cubic-bezier</strong><br/>Enter x1,y1,x2,y2 (0..1) for custom easing curves.</div>
        <div style="margin-top:6px;color:#b7c4ce">Tip: press "Sample" then click on the image to pick canvas coordinates; inspector will restore and fill X/Y.</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">
      <button id="kf-delete" style="background:#ff6b6b;border:0;padding:8px;border-radius:6px;color:#080808;cursor:pointer">Delete</button>
      <button id="kf-save" style="background:#4fb3ff;border:0;padding:8px;border-radius:6px;color:#081018;cursor:pointer">Save</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('kf-close').addEventListener('click', ()=>{ modal.style.display='none'; });
  return modal;
}

function openInspectorFor(trackId, index){
  if(!window.timelineAPI) { alert('Timeline API missing'); return; }
  const data = window.timelineAPI.getData();
  if(!data || !data.tracks || !data.tracks[trackId]) { alert('Track not found'); return; }
  const track = data.tracks[trackId];
  if(index < 0 || index >= track.keyframes.length) { alert('Keyframe index out of range'); return; }
  const kf = Object.assign({}, track.keyframes[index]); // copy for editing
  const modal = createModal();
  modal.style.display = 'block';
  modal.querySelector('#kf-track').textContent = `${track.name} (${track.type})`;
  modal.querySelector('#kf-index').textContent = String(index);
  modal.querySelector('#kf-frame').value = kf.frame || 0;
  modal.querySelector('#kf-type').value = kf.type || '';
  modal.querySelector('#kf-control').value = kf.control || '';
  modal.querySelector('#kf-value').value = (typeof kf.value === 'number') ? kf.value : '';
  modal.querySelector('#kf-x').value = (typeof kf.x === 'number') ? kf.x : '';
  modal.querySelector('#kf-y').value = (typeof kf.y === 'number') ? kf.y : '';
  // easing handling: accept string names or object {type:'cubic-bezier', params:[x1,y1,x2,y2]}
  let easingValue = 'linear';
  let bezierText = '';
  if(kf.easing){
    if(typeof kf.easing === 'string'){
      easingValue = kf.easing;
    } else if(typeof kf.easing === 'object' && kf.easing.type === 'cubic-bezier' && Array.isArray(kf.easing.params)){
      easingValue = 'cubic-bezier';
      bezierText = kf.easing.params.join(',');
    }
  }
  const easingSelect = modal.querySelector('#kf-easing');
  const bezierInput = modal.querySelector('#kf-bezier');
  easingSelect.value = easingValue;
  bezierInput.value = bezierText;

  // show/hide bezier input depending on selection
  function refreshEasingUI(){
    if(easingSelect.value === 'cubic-bezier'){
      bezierInput.style.display = 'inline-block';
    } else {
      bezierInput.style.display = 'inline-block'; // keep visible for manual edits but can be empty
      bezierInput.value = (easingSelect.value.startsWith('cubic')) ? bezierInput.value : bezierInput.value;
    }
  }
  refreshEasingUI();
  easingSelect.addEventListener('change', refreshEasingUI);

  const saveBtn = modal.querySelector('#kf-save');
  const delBtn = modal.querySelector('#kf-delete');
  const sampleBtn = modal.querySelector('#kf-sample');

  function cleanup(){
    saveBtn.removeEventListener('click', onSave);
    delBtn.removeEventListener('click', onDelete);
    sampleBtn && sampleBtn.removeEventListener('click', onSample);
    modal.style.display = 'none';
  }
  function parseBezierText(txt){
    const parts = txt.split(',').map(s=>parseFloat(s.trim())).filter(n=>!Number.isNaN(n));
    if(parts.length === 4) return parts;
    return null;
  }
  function onSave(){
    // apply edits back into timeline data
    const newKf = Object.assign({}, kf);
    newKf.frame = Math.max(0, parseInt(modal.querySelector('#kf-frame').value || 0,10));
    newKf.type = modal.querySelector('#kf-type').value || newKf.type;
    const ctrl = modal.querySelector('#kf-control').value;
    newKf.control = ctrl ? ctrl : (newKf.control || undefined);
    const valRaw = modal.querySelector('#kf-value').value;
    if(valRaw !== '') newKf.value = parseFloat(valRaw);
    const xRaw = modal.querySelector('#kf-x').value;
    const yRaw = modal.querySelector('#kf-y').value;
    if(xRaw !== '') newKf.x = parseFloat(xRaw);
    if(yRaw !== '') newKf.y = parseFloat(yRaw);
    // easing save: named presets or cubic-bezier object
    if(easingSelect.value === 'cubic-bezier'){
      const bz = parseBezierText(bezierInput.value);
      if(bz){
        newKf.easing = { type: 'cubic-bezier', params: bz };
      } else {
        // invalid bezier, fallback to linear
        newKf.easing = 'linear';
      }
    } else {
      newKf.easing = easingSelect.value || 'linear';
    }
    // replace the keyframe object in timeline store
    const store = window.timelineAPI.getData();
    if(store && store.tracks && store.tracks[trackId]){
      store.tracks[trackId].keyframes[index] = newKf;
      // redraw timeline and notify potential consumers
      if(typeof window.timelineAPI.setFrame === 'function') window.timelineAPI.setFrame(window.timelineAPI.currentFrame || 0);
    }
    cleanup();
  }
  function onDelete(){
    const confirmed = confirm('Delete this keyframe?');
    if(!confirmed) return;
    const store = window.timelineAPI.getData();
    if(store && store.tracks && store.tracks[trackId]){
      store.tracks[trackId].keyframes.splice(index,1);
      if(typeof window.timelineAPI.setFrame === 'function') window.timelineAPI.setFrame(window.timelineAPI.currentFrame || 0);
    }
    cleanup();
  }
  // sampling logic: hide inspector, wait for one click on main canvas, populate x/y in canvas coords then restore
  function onSample(){
    modal.style.display = 'none';
    const canvas = document.getElementById('canvas');
    if(!canvas){ alert('Canvas not found'); modal.style.display='block'; return; }
    function captureOnce(ev){
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
      const x = (ev.clientX - rect.left) * scaleX;
      const y = (ev.clientY - rect.top) * scaleY;
      modal.style.display = 'block';
      modal.querySelector('#kf-x').value = Math.round(x);
      modal.querySelector('#kf-y').value = Math.round(y);
      canvas.removeEventListener('click', captureOnce);
      canvas.style.cursor = '';
    }
    canvas.style.cursor = 'crosshair';
    canvas.addEventListener('click', captureOnce);
  }
  sampleBtn && sampleBtn.addEventListener('click', onSample);
  saveBtn.addEventListener('click', onSave);
  delBtn.addEventListener('click', onDelete);
}

// convenience: create a new keyframe modal prefilled with defaults for manual authoring
function openCreateModal(trackId, defaults = {}){
  if(!window.timelineAPI) return;
  const data = window.timelineAPI.getData();
  if(!data || !data.tracks || !data.tracks[trackId]) { alert('Track not found'); return; }
  const track = data.tracks[trackId];
  // create a temporary keyframe and push to end; then open inspector for it
  const newKf = Object.assign({
    frame: Math.max(0, Math.floor((window.timelineAPI && window.timelineAPI.currentFrame) ? window.timelineAPI.currentFrame : 0)),
    type: defaults.type || 'value',
    control: defaults.control || '',
    value: (typeof defaults.value === 'number') ? defaults.value : undefined,
    x: defaults.x, y: defaults.y,
    easing: defaults.easing || 'linear'
  }, defaults);
  track.keyframes.push(newKf);
  const idx = track.keyframes.length - 1;
  // open inspector for the new keyframe
  openInspectorFor(trackId, idx);
}

// expose inspector API
window.timelineInspector = {
  inspectKeyframe(trackId, index){ openInspectorFor(trackId, index); },
  createKeyframe(trackId, defaults){ openCreateModal(trackId, defaults); }
};

// optional: wire up simple double-click on timeline keyframes to open inspector if timeline canvas exists
const tlCanvas = document.getElementById('timelineCanvas');
if(tlCanvas){
  tlCanvas.addEventListener('dblclick', (ev)=>{
    try{
      const rect = tlCanvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      // dispatch a custom event that timeline.js can listen to (already done by timeline); also attempt local hit-test
      const custom = new CustomEvent('timeline:requestInspect', { detail: { x, y } });
      window.dispatchEvent(custom);

      // Try local hit-test using timelineAPI.getData() if available (fallback to timeline event if timeline doesn't handle)
      if(window.timelineAPI && typeof window.timelineAPI.getData === 'function'){
        const data = window.timelineAPI.getData();
        if(data && data.tracks){
          // replicate timeline.findKeyframeAtCanvas hit test to find kf under coords
          const w = tlCanvas.clientWidth;
          const h = tlCanvas.clientHeight;
          const trackIds = Object.keys(data.tracks);
          const laneStart = Math.round(h * 0.35);
          const maxLaneArea = Math.max(40, Math.round(h * 0.5));
          const laneSpacing = Math.min(36, Math.max(18, Math.floor(maxLaneArea / Math.max(1, trackIds.length))));
          let ti = 0;
          for(const tid of trackIds){
            const track = data.tracks[tid];
            const laneY = laneStart + (ti * laneSpacing);
            for(let i=0;i<track.keyframes.length;i++){
              const kf = track.keyframes[i];
              const kx = (kf.frame / Math.max(1, Math.round((window.timelineAPI && window.timelineAPI.fps) ? window.timelineAPI.fps * (parseFloat(document.getElementById('lengthSeconds').value||6)) : 24 * (parseFloat(document.getElementById('lengthSeconds').value||6)))) ) * w;
              // simpler mapping: timeline draw uses (kf.frame / totalFrames)*w, so try to compute totalFrames if available
            }
            ti++;
          }
        }
      }
    }catch(e){}
  });
}