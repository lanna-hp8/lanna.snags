/* ============================================================
   STORAGE LAYER — IndexedDB (replaces window.storage from the
   Claude-hosted version; this runs in a real browser so it has
   real storage capacity — hundreds of MB to a few GB depending
   on device/browser).
   ============================================================ */
const DB_NAME = 'siteSnagDB';
const DB_VERSION = 1;
let dbPromise = null;

function openDB(){
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('snags')) {
        db.createObjectStore('snags', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbGetAll(storeName){
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(storeName, value){
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(storeName, key){
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getMeta(key, fallback){
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('meta', 'readonly');
    const req = tx.objectStore('meta').get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : fallback);
    req.onerror = () => resolve(fallback);
  });
}
async function setMeta(key, value){
  return idbPut('meta', { key, value });
}

/* ============================================================
   MINIMAL ZIP WRITER — no external library. Supports STORE and
   DEFLATE (via the browser's native CompressionStream, when
   available; falls back to STORE per-file if not supported).
   ============================================================ */
function crc32Table(){
  const table = [];
  for (let n = 0; n < 256; n++){
    let c = n;
    for (let k = 0; k < 8; k++){ c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); }
    table[n] = c >>> 0;
  }
  return table;
}
const CRC_TABLE = crc32Table();
function crc32(buf){
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++){
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function dosDateTime(d){
  const time = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | (Math.floor(d.getSeconds() / 2) & 0x1F);
  const date = (((d.getFullYear() - 1980) & 0x7F) << 9) | (((d.getMonth() + 1) & 0xF) << 5) | (d.getDate() & 0x1F);
  return { time, date };
}
async function deflateRaw(u8){
  try{
    if (typeof CompressionStream === 'undefined') return null;
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(u8);
    writer.close();
    const reader = cs.readable.getReader();
    const chunks = [];
    let total = 0;
    while (true){
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks){ out.set(c, off); off += c.length; }
    return out;
  }catch(e){ return null; }
}
function writeU16(arr, off, v){ arr[off] = v & 0xFF; arr[off+1] = (v >>> 8) & 0xFF; }
function writeU32(arr, off, v){ arr[off]=v&0xFF; arr[off+1]=(v>>>8)&0xFF; arr[off+2]=(v>>>16)&0xFF; arr[off+3]=(v>>>24)&0xFF; }
function strToBytes(s){ return new TextEncoder().encode(s); }

class ZipWriter{
  constructor(){ this.parts = []; this.offset = 0; this.central = []; }
  // returns bytes actually added (for size tracking by caller)
  async addFile(name, dataU8, tryCompress){
    const nameBytes = strToBytes(name);
    const crc = crc32(dataU8);
    const { time, date } = dosDateTime(new Date());
    let method = 0;
    let outData = dataU8;
    if (tryCompress){
      const deflated = await deflateRaw(dataU8);
      if (deflated && deflated.length < dataU8.length){
        method = 8;
        outData = deflated;
      }
    }
    const localHeader = new Uint8Array(30);
    writeU32(localHeader, 0, 0x04034b50);
    writeU16(localHeader, 4, 20);
    writeU16(localHeader, 6, 0x0800);
    writeU16(localHeader, 8, method);
    writeU16(localHeader, 10, time);
    writeU16(localHeader, 12, date);
    writeU32(localHeader, 14, crc);
    writeU32(localHeader, 18, outData.length);
    writeU32(localHeader, 22, dataU8.length);
    writeU16(localHeader, 26, nameBytes.length);
    writeU16(localHeader, 28, 0);

    const localOffset = this.offset;
    this.parts.push(localHeader, nameBytes, outData);
    this.offset += localHeader.length + nameBytes.length + outData.length;

    this.central.push({ nameBytes, crc, compSize: outData.length, uncompSize: dataU8.length, method, time, date, localOffset });
    return localHeader.length + nameBytes.length + outData.length;
  }
  finalize(){
    const centralStart = this.offset;
    for (const e of this.central){
      const ch = new Uint8Array(46);
      writeU32(ch, 0, 0x02014b50);
      writeU16(ch, 4, 20);
      writeU16(ch, 6, 20);
      writeU16(ch, 8, 0x0800);
      writeU16(ch, 10, e.method);
      writeU16(ch, 12, e.time);
      writeU16(ch, 14, e.date);
      writeU32(ch, 16, e.crc);
      writeU32(ch, 20, e.compSize);
      writeU32(ch, 24, e.uncompSize);
      writeU16(ch, 28, e.nameBytes.length);
      writeU32(ch, 42, e.localOffset);
      this.parts.push(ch, e.nameBytes);
      this.offset += ch.length + e.nameBytes.length;
    }
    const centralSize = this.offset - centralStart;
    const eocd = new Uint8Array(22);
    writeU32(eocd, 0, 0x06054b50);
    writeU16(eocd, 8, this.central.length);
    writeU16(eocd, 10, this.central.length);
    writeU32(eocd, 12, centralSize);
    writeU32(eocd, 16, centralStart);
    this.parts.push(eocd);
    return new Blob(this.parts, { type: 'application/zip' });
  }
}

function dataUrlToUint8Array(dataUrl){
  const base64 = dataUrl.split(',')[1];
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
async function blobToUint8Array(blob){
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}

/* ============================================================
   APP STATE & CONFIRM/ALERT (no native dialogs relied on, same
   pattern as the previous version, kept for consistency)
   ============================================================ */
let currentEditId = null;
let currentPhotos = [];      // thumbnails (dataURLs) for the modal in progress
let currentPhotoBlobs = [];  // full-res Blobs, parallel array to currentPhotos
let currentPinCoord = null;
let prefillRoom = null;
const PIN_ZOOM_IMG_W = 1500, PIN_ZOOM_IMG_H = 1059, PIN_ZOOM_FACTOR = 1.5;

function getZoomFactor(floorCode, roomCode){
  return (ROOM_ZOOM_OVERRIDES[floorCode] && ROOM_ZOOM_OVERRIDES[floorCode][roomCode]) || PIN_ZOOM_FACTOR;
}

let confirmResolver = null;
function openConfirmModal(message, mode, okLabel, danger){
  return new Promise(resolve => {
    confirmResolver = resolve;
    document.getElementById('confirmMessage').textContent = message;
    const btnHtml = mode === 'alert'
      ? `<button class="btn primary" onclick="resolveConfirm(true)">${okLabel || 'OK'}</button>`
      : `<button class="btn ghost" onclick="resolveConfirm(false)">Cancel</button><button class="btn primary" style="${danger ? 'background:var(--red);border-color:var(--red);' : ''}" onclick="resolveConfirm(true)">${okLabel || 'OK'}</button>`;
    document.getElementById('confirmButtons').innerHTML = btnHtml;
    document.getElementById('confirmOverlay').classList.add('show');
  });
}
function resolveConfirm(result){
  document.getElementById('confirmOverlay').classList.remove('show');
  if (confirmResolver) confirmResolver(result);
  confirmResolver = null;
}
function showAlert(msg){ return openConfirmModal(msg, 'alert'); }
function showConfirm(msg, okLabel, danger){ return openConfirmModal(msg, 'confirm', okLabel, danger); }

/* ============================================================
   SELECT POPULATION
   ============================================================ */
function populateFloorSelects(){
  const fFloor = document.getElementById('fFloor');
  const mFloor = document.getElementById('mFloor');
  FLOORS.forEach(f => {
    fFloor.insertAdjacentHTML('beforeend', `<option value="${f.code}">${f.name}</option>`);
    mFloor.insertAdjacentHTML('beforeend', `<option value="${f.code}">${f.name}</option>`);
  });
  const fTrade = document.getElementById('fTrade');
  const mTrade = document.getElementById('mTrade');
  const fSeverity = document.getElementById('fSeverity');
  const fStatus = document.getElementById('fStatus');
  TRADES.forEach(t => {
    fTrade.insertAdjacentHTML('beforeend', `<option value="${t}">${t}</option>`);
    mTrade.insertAdjacentHTML('beforeend', `<option value="${t}">${t}</option>`);
  });
  ['Critical','Major','Minor','Cosmetic'].forEach(s => fSeverity.insertAdjacentHTML('beforeend', `<option value="${s}">${s}</option>`));
  ['Open','In Progress','Awaiting Parts','Fixed - To Verify','Verified/Closed'].forEach(s => fStatus.insertAdjacentHTML('beforeend', `<option value="${s}">${s}</option>`));
  populateRoomSelect();
}
function populateRoomSelect(){
  const mFloor = document.getElementById('mFloor');
  const mRoom = document.getElementById('mRoom');
  const floor = FLOORS.find(f => f.code === mFloor.value) || FLOORS[0];
  mRoom.innerHTML = floor.rooms.map(r => `<option value="${r[0]}">${r[1]}</option>`).join('');
  if (prefillRoom && prefillRoom.floor === floor.code) mRoom.value = prefillRoom.room;
}
function renderChecklistHint(){
  const box = document.getElementById('checklistBox');
  const trade = document.getElementById('mTrade').value;
  box.textContent = CHECKLISTS[trade] || '';
}
function toggleChecklist(){ renderChecklistHint(); document.getElementById('checklistBox').classList.toggle('show'); }

/* ============================================================
   TABS
   ============================================================ */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'list') renderList();
    if (btn.dataset.tab === 'coverage') renderCoverage();
    if (btn.dataset.tab === 'plan') renderPlanTab();
  });
});

/* ============================================================
   MODAL — open/edit/save/delete
   ============================================================ */
function roomName(floorCode, roomCode){
  const f = FLOORS.find(x => x.code === floorCode);
  if (!f) return roomCode;
  const r = f.rooms.find(x => x[0] === roomCode);
  return r ? r[1] : roomCode;
}

function openAddModal(floorCode, roomCode){
  currentEditId = null;
  currentPhotos = [];
  currentPhotoBlobs = [];
  currentPinCoord = null;
  prefillRoom = floorCode ? { floor: floorCode, room: roomCode } : null;
  document.getElementById('modalTitle').textContent = 'Log a snag';
  document.getElementById('modalTag').textContent = 'New entry — tag assigned on save';
  document.getElementById('deleteBtn').style.display = 'none';
  if (floorCode) document.getElementById('mFloor').value = floorCode;
  populateRoomSelect();
  if (roomCode) document.getElementById('mRoom').value = roomCode;
  document.getElementById('mTrade').selectedIndex = 0;
  document.getElementById('mSeverity').value = 'Minor';
  document.getElementById('mStatus').value = 'Open';
  document.getElementById('mLocation').value = '';
  document.getElementById('mDescription').value = '';
  document.getElementById('mComments').value = '';
  document.getElementById('checklistBox').classList.remove('show');
  renderPhotoPreview();
  document.getElementById('overlay').classList.add('show');
  requestAnimationFrame(renderPinZoom);
}

async function openEditModal(id){
  const items = await idbGetAll('snags');
  const item = items.find(i => i.id === id);
  if (!item) return;
  currentEditId = id;
  currentPhotos = (item.thumbs || []).slice();
  currentPhotoBlobs = (item.photoBlobs || []).slice();
  currentPinCoord = (item.pinX != null && item.pinY != null) ? { x: item.pinX, y: item.pinY } : null;
  document.getElementById('modalTitle').textContent = 'Edit snag';
  document.getElementById('modalTag').textContent = item.tag;
  document.getElementById('deleteBtn').style.display = 'inline-block';
  document.getElementById('mFloor').value = item.floorCode;
  populateRoomSelect();
  document.getElementById('mRoom').value = item.roomCode;
  document.getElementById('mTrade').value = item.trade;
  document.getElementById('mSeverity').value = item.severity;
  document.getElementById('mStatus').value = item.status;
  document.getElementById('mLocation').value = item.location || '';
  document.getElementById('mDescription').value = item.description || '';
  document.getElementById('mComments').value = item.comments || '';
  document.getElementById('checklistBox').classList.remove('show');
  renderPhotoPreview();
  document.getElementById('overlay').classList.add('show');
  requestAnimationFrame(renderPinZoom);
}
function closeModal(){ document.getElementById('overlay').classList.remove('show'); }

async function saveSnag(){
  const floorCode = document.getElementById('mFloor').value;
  const roomCode = document.getElementById('mRoom').value;
  const description = document.getElementById('mDescription').value.trim();
  if (!description){ await showAlert('Please add a description of the defect.'); return; }

  const items = await idbGetAll('snags');

  if (currentEditId){
    const item = items.find(i => i.id === currentEditId);
    item.floorCode = floorCode;
    item.roomCode = roomCode;
    item.trade = document.getElementById('mTrade').value;
    item.severity = document.getElementById('mSeverity').value;
    item.status = document.getElementById('mStatus').value;
    item.location = document.getElementById('mLocation').value.trim();
    item.description = description;
    item.comments = document.getElementById('mComments').value.trim();
    item.thumbs = currentPhotos;
    item.photoBlobs = currentPhotoBlobs;
    item.pinX = currentPinCoord ? currentPinCoord.x : null;
    item.pinY = currentPinCoord ? currentPinCoord.y : null;
    item.updatedAt = new Date().toISOString();
    await idbPut('snags', item);
  } else {
    const seq = items.filter(i => i.floorCode === floorCode && i.roomCode === roomCode).length + 1;
    const tag = `${floorCode}-${roomCode}-${String(seq).padStart(2, '0')}`;
    await idbPut('snags', {
      tag, floorCode, roomCode,
      trade: document.getElementById('mTrade').value,
      severity: document.getElementById('mSeverity').value,
      status: document.getElementById('mStatus').value,
      location: document.getElementById('mLocation').value.trim(),
      description,
      comments: document.getElementById('mComments').value.trim(),
      thumbs: currentPhotos,
      photoBlobs: currentPhotoBlobs,
      pinX: currentPinCoord ? currentPinCoord.x : null,
      pinY: currentPinCoord ? currentPinCoord.y : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  closeModal();
  await renderAll();
}

async function deleteCurrent(){
  if (!currentEditId) return;
  const ok = await showConfirm('Delete this snag entry? This cannot be undone.', 'Delete', true);
  if (!ok) return;
  await idbDelete('snags', currentEditId);
  closeModal();
  await renderAll();
}

/* ============================================================
   PHOTOS — capture both a compressed thumbnail AND keep the
   full-resolution original Blob, both linked to this snag with
   no extra steps (this is the core PWA improvement).
   ============================================================ */
function handlePhotoInput(evt){
  const files = Array.from(evt.target.files || []);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e){
      const img = new Image();
      img.onload = function(){
        const maxW = 700;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        currentPhotos.push(dataUrl);
        currentPhotoBlobs.push(file);   // the ORIGINAL full-resolution file, kept as-is
        renderPhotoPreview();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
  evt.target.value = '';
}
function renderPhotoPreview(){
  const row = document.getElementById('photoPreviewRow');
  row.innerHTML = currentPhotos.map((p, idx) => `
    <div class="photo-thumb">
      <img src="${p}">
      <button class="rm" onclick="removePhoto(${idx})">×</button>
      <span class="full-tag">full-res</span>
    </div>`).join('');
}
function removePhoto(idx){ currentPhotos.splice(idx, 1); currentPhotoBlobs.splice(idx, 1); renderPhotoPreview(); }
function openLightbox(src){ document.getElementById('lightboxImg').src = src; document.getElementById('lightbox').classList.add('show'); }

/* ============================================================
   PINPOINT ZOOM PICKER (inside the add/edit modal)
   ============================================================ */
function applyZoomBackground(el, floorCode, cxPct, cyPct, containerW, containerH, zoomFactor){
  const zoom = zoomFactor || PIN_ZOOM_FACTOR;
  const scaledW = PIN_ZOOM_IMG_W * zoom;
  const scaledH = PIN_ZOOM_IMG_H * zoom;
  let targetX = (cxPct / 100) * scaledW;
  let targetY = (cyPct / 100) * scaledH;
  targetX = Math.min(Math.max(targetX, containerW / 2), scaledW - containerW / 2);
  targetY = Math.min(Math.max(targetY, containerH / 2), scaledH - containerH / 2);
  const posX = containerW / 2 - targetX;
  const posY = containerH / 2 - targetY;
  el.style.backgroundImage = `url(plans/${floorCode === '1F' ? 'ff' : floorCode === '2F' ? 'sf' : 'gf'}.jpg)`;
  el.style.backgroundSize = `${scaledW}px ${scaledH}px`;
  el.style.backgroundPosition = `${posX}px ${posY}px`;
  el.dataset.scaledW = scaledW; el.dataset.scaledH = scaledH;
  el.dataset.posX = posX; el.dataset.posY = posY;
  return { scaledW, scaledH, posX, posY };
}
async function renderPinZoom(){
  const floorCode = document.getElementById('mFloor').value;
  const roomCode = document.getElementById('mRoom').value;
  const wrap = document.getElementById('pinZoomWrap');
  const hint = document.getElementById('pinZoomHint');
  if (floorCode === 'WH'){
    wrap.style.display = 'none';
    hint.textContent = 'No floor plan available for whole-house / external items.';
    return;
  }
  wrap.style.display = 'block';
  const coords = PIN_COORDS[floorCode] || [];
  const entry = coords.find(c => c[0] === roomCode);
  const centerX = entry ? entry[1] : 50;
  const centerY = entry ? entry[2] : 50;
  const rect = wrap.getBoundingClientRect();
  const containerW = rect.width || 320;
  const containerH = rect.height || Math.round(containerW * PIN_ZOOM_IMG_H / PIN_ZOOM_IMG_W);
  const zoom = getZoomFactor(floorCode, roomCode);
  applyZoomBackground(wrap, floorCode, centerX, centerY, containerW, containerH, zoom);
  renderPinMarker();
  const otherCount = await renderOtherPins(floorCode, roomCode);
  hint.textContent = otherCount > 0
    ? `Tap to mark exactly where this is. Coloured dots (${otherCount}) show snags already logged in this room.`
    : 'Tap the zoomed view to mark exactly where in the room this is.';
}
function renderPinMarker(){
  const wrap = document.getElementById('pinZoomWrap');
  const marker = document.getElementById('pinZoomMarker');
  if (!currentPinCoord){ marker.style.display = 'none'; return; }
  const scaledW = parseFloat(wrap.dataset.scaledW || 0);
  const scaledH = parseFloat(wrap.dataset.scaledH || 0);
  const posX = parseFloat(wrap.dataset.posX || 0);
  const posY = parseFloat(wrap.dataset.posY || 0);
  if (!scaledW || !scaledH){ marker.style.display = 'none'; return; }
  marker.style.left = ((currentPinCoord.x / 100) * scaledW + posX) + 'px';
  marker.style.top = ((currentPinCoord.y / 100) * scaledH + posY) + 'px';
  marker.style.display = 'block';
}
async function renderOtherPins(floorCode, roomCode){
  const wrap = document.getElementById('pinZoomWrap');
  wrap.querySelectorAll('.pin-zoom-existing').forEach(el => el.remove());
  const scaledW = parseFloat(wrap.dataset.scaledW || 0);
  const scaledH = parseFloat(wrap.dataset.scaledH || 0);
  const posX = parseFloat(wrap.dataset.posX || 0);
  const posY = parseFloat(wrap.dataset.posY || 0);
  if (!scaledW || !scaledH) return 0;
  const items = await idbGetAll('snags');
  const others = items.filter(i => i.floorCode === floorCode && i.roomCode === roomCode && i.pinX != null && i.id !== currentEditId);
  others.forEach(it => {
    const dot = document.createElement('div');
    dot.className = 'pin-zoom-existing sev-' + it.severity;
    dot.title = `${it.tag} (${it.status}): ${it.description}`;
    dot.style.left = ((it.pinX / 100) * scaledW + posX) + 'px';
    dot.style.top = ((it.pinY / 100) * scaledH + posY) + 'px';
    wrap.appendChild(dot);
  });
  return others.length;
}
function handlePinZoomClick(evt){
  const wrap = document.getElementById('pinZoomWrap');
  if (wrap.style.display === 'none') return;
  const scaledW = parseFloat(wrap.dataset.scaledW || 0);
  const scaledH = parseFloat(wrap.dataset.scaledH || 0);
  const posX = parseFloat(wrap.dataset.posX || 0);
  const posY = parseFloat(wrap.dataset.posY || 0);
  if (!scaledW || !scaledH) return;
  const rect = wrap.getBoundingClientRect();
  const clickX = evt.clientX - rect.left;
  const clickY = evt.clientY - rect.top;
  let xPct = ((clickX - posX) / scaledW) * 100;
  let yPct = ((clickY - posY) / scaledH) * 100;
  xPct = Math.max(0, Math.min(100, xPct));
  yPct = Math.max(0, Math.min(100, yPct));
  currentPinCoord = { x: Math.round(xPct * 100) / 100, y: Math.round(yPct * 100) / 100 };
  renderPinMarker();
}
function clearPinCoord(){ currentPinCoord = null; renderPinMarker(); }
function buildMiniPinStyle(floorCode, roomCode, x, y){
  const containerW = 90, containerH = 64;
  const zoom = getZoomFactor(floorCode, roomCode);
  const scaledW = PIN_ZOOM_IMG_W * zoom, scaledH = PIN_ZOOM_IMG_H * zoom;
  let targetX = (x / 100) * scaledW, targetY = (y / 100) * scaledH;
  targetX = Math.min(Math.max(targetX, containerW / 2), scaledW - containerW / 2);
  targetY = Math.min(Math.max(targetY, containerH / 2), scaledH - containerH / 2);
  const posX = containerW / 2 - targetX, posY = containerH / 2 - targetY;
  const markerLeft = (x / 100) * scaledW + posX;
  const markerTop = (y / 100) * scaledH + posY;
  const imgFile = floorCode === '1F' ? 'ff' : floorCode === '2F' ? 'sf' : 'gf';
  const bg = `background-image:url(plans/${imgFile}.jpg);background-size:${scaledW}px ${scaledH}px;background-position:${posX}px ${posY}px;`;
  return { bg, markerLeft, markerTop };
}

/* ============================================================
   FLOOR PLAN TAB
   ============================================================ */
let activePlanFloor = 'GF';
async function roomStatusClass(floorCode, roomCode, items){
  const filtered = items.filter(i => i.floorCode === floorCode && i.roomCode === roomCode);
  const openCount = filtered.filter(i => i.status !== 'Verified/Closed').length;
  if (filtered.length > 0 && openCount > 0) return 'some';
  if (filtered.length > 0 && openCount === 0) return 'clear';
  return '';
}
function renderPlanSubtabs(){
  const el = document.getElementById('planSubtabs');
  el.innerHTML = FLOORS.filter(f => f.code !== 'WH').map(f =>
    `<button class="plan-subtab-btn ${f.code === activePlanFloor ? 'active' : ''}" onclick="setPlanFloor('${f.code}')">${f.name}</button>`
  ).join('');
}
function setPlanFloor(code){ activePlanFloor = code; renderPlanSubtabs(); renderPlanImage(); }
async function renderPlanImage(){
  const wrap = document.getElementById('planWrap');
  const pins = PIN_COORDS[activePlanFloor] || [];
  const floor = FLOORS.find(f => f.code === activePlanFloor);
  const items = await idbGetAll('snags');
  const imgFile = activePlanFloor === '1F' ? 'ff' : activePlanFloor === '2F' ? 'sf' : 'gf';
  const pinHtml = await Promise.all(pins.map(async ([code, x, y]) => {
    const name = (floor.rooms.find(r => r[0] === code) || [code, code])[1];
    const cls = await roomStatusClass(activePlanFloor, code, items);
    return `<div class="pin-holder" style="left:${x}%; top:${y}%;">
      <div class="pin ${cls}" onclick="openAddModal('${activePlanFloor}','${code}')">${code}</div>
      <div class="pin-label">${name}</div>
    </div>`;
  }));
  wrap.innerHTML = `<img src="plans/${imgFile}.jpg" alt="${floor.name} plan">` + pinHtml.join('');
}
async function renderWhButtons(){
  const floor = FLOORS.find(f => f.code === 'WH');
  const el = document.getElementById('whButtons');
  const items = await idbGetAll('snags');
  const html = await Promise.all(floor.rooms.map(async ([code, name]) => {
    const cls = await roomStatusClass('WH', code, items);
    return `<button class="wh-btn" onclick="openAddModal('WH','${code}')"><span class="dot ${cls}"></span>${name}</button>`;
  }));
  el.innerHTML = html.join('');
}
async function renderPlanTab(){ renderPlanSubtabs(); await renderPlanImage(); await renderWhButtons(); }

/* ============================================================
   COVERAGE TAB
   ============================================================ */
async function renderCoverage(){
  const container = document.getElementById('coverageContainer');
  const items = await idbGetAll('snags');
  container.innerHTML = FLOORS.map(floor => {
    const cards = floor.rooms.map(([code, name]) => {
      const filtered = items.filter(i => i.floorCode === floor.code && i.roomCode === code);
      const openCount = filtered.filter(i => i.status !== 'Verified/Closed').length;
      let pillClass = 'zero', pillText = '0 logged';
      if (filtered.length > 0 && openCount > 0){ pillClass = 'some'; pillText = openCount + ' open'; }
      else if (filtered.length > 0 && openCount === 0){ pillClass = 'clear'; pillText = 'all clear'; }
      return `
        <div class="room-card" onclick="openAddModal('${floor.code}','${code}')">
          <div class="code">${floor.code}-${code}</div>
          <div class="name">${name}</div>
          <div class="count-row">
            <span class="count-pill ${pillClass}">${pillText}</span>
            <span class="plus">+</span>
          </div>
        </div>`;
    }).join('');
    return `<div class="floor-block"><div class="floor-title">${floor.name}</div><div class="room-grid">${cards}</div></div>`;
  }).join('');
}

/* ============================================================
   SNAG LIST TAB
   ============================================================ */
async function filteredItems(){
  const items = await idbGetAll('snags');
  const ff = document.getElementById('fFloor').value;
  const ft = document.getElementById('fTrade').value;
  const fs = document.getElementById('fSeverity').value;
  const fst = document.getElementById('fStatus').value;
  const q = document.getElementById('fSearch').value.trim().toLowerCase();
  return items.filter(i => {
    if (ff && i.floorCode !== ff) return false;
    if (ft && i.trade !== ft) return false;
    if (fs && i.severity !== fs) return false;
    if (fst && i.status !== fst) return false;
    if (q){
      const hay = (i.tag + ' ' + roomName(i.floorCode, i.roomCode) + ' ' + i.description + ' ' + (i.comments||'') + ' ' + i.trade).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
const STATUS_CLASS_MAP = { 'Open':'st-open','In Progress':'st-inprogress','Awaiting Parts':'st-awaiting','Fixed - To Verify':'st-tofix','Verified/Closed':'st-verified' };
function statusClass(s){ return STATUS_CLASS_MAP[s] || 'st-open'; }
function escapeHtml(s){ return (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

async function renderList(){
  const items = await filteredItems();
  const container = document.getElementById('listContainer');
  if (items.length === 0){
    container.innerHTML = `<div class="empty-state">No snags match these filters yet.</div>`;
    return;
  }
  container.innerHTML = items.map(i => `
    <div class="snag-ticket sev-${i.severity}">
      <div class="ticket-top">
        <div><span class="tag-code">${i.tag}</span><span class="badge sev-${i.severity}" style="margin-left:6px;">${i.severity}</span></div>
        <span class="badge ${statusClass(i.status)}">${i.status}</span>
      </div>
      <div class="ticket-loc"><b>${roomName(i.floorCode, i.roomCode)}</b> · ${i.trade}${i.location ? ' · ' + i.location : ''}</div>
      <div class="ticket-desc">${escapeHtml(i.description)}</div>
      ${i.comments ? `<div class="ticket-comments">${escapeHtml(i.comments)}</div>` : ''}
      ${i.pinX != null ? (() => { const p = buildMiniPinStyle(i.floorCode, i.roomCode, i.pinX, i.pinY); return `<div class="ticket-photos"><div class="ticket-pin-mini" style="${p.bg}"><div class="pin-zoom-marker" style="left:${p.markerLeft}px; top:${p.markerTop}px; display:block;"></div></div></div>`; })() : ''}
      ${i.thumbs && i.thumbs.length ? `<div class="ticket-photos">${i.thumbs.map(p => `<img src="${p}" onclick="openLightbox('${p}')">`).join('')}<span class="ticket-photocount">${i.thumbs.length} photo(s), full-res saved</span></div>` : ''}
      <div class="ticket-actions">
        <button class="btn small" onclick="openEditModal(${i.id})">Edit</button>
        <select onchange="quickStatus(${i.id}, this.value)">
          ${['Open','In Progress','Awaiting Parts','Fixed - To Verify','Verified/Closed'].map(s => `<option ${s === i.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <span class="ticket-date">logged ${new Date(i.createdAt).toLocaleDateString('en-GB')}</span>
      </div>
    </div>
  `).join('');
}
async function quickStatus(id, value){
  const items = await idbGetAll('snags');
  const item = items.find(i => i.id === id);
  item.status = value;
  item.updatedAt = new Date().toISOString();
  await idbPut('snags', item);
  await renderAll();
}

/* ============================================================
   STATS BAR
   ============================================================ */
async function renderStats(){
  const items = await idbGetAll('snags');
  document.getElementById('statTotal').textContent = items.length;
  document.getElementById('statOpen').textContent = items.filter(i => i.status !== 'Verified/Closed').length;
  document.getElementById('statCrit').textContent = items.filter(i => i.severity === 'Critical' && i.status !== 'Verified/Closed').length;
  document.getElementById('statVerified').textContent = items.filter(i => i.status === 'Verified/Closed').length;
  const last = items.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
  document.getElementById('lastUpdated').textContent = last ? new Date(last.updatedAt).toLocaleString('en-GB') : 'no entries yet';

  // Approximate photo storage used (sum of full-res blob sizes)
  let totalBytes = 0;
  items.forEach(i => (i.photoBlobs || []).forEach(b => { if (b && b.size) totalBytes += b.size; }));
  const mb = totalBytes / (1024 * 1024);
  let label = mb < 1 ? Math.round(totalBytes / 1024) + ' KB' : mb.toFixed(mb < 10 ? 2 : 0) + ' MB';
  if (navigator.storage && navigator.storage.estimate){
    try{
      const est = await navigator.storage.estimate();
      if (est.quota){
        const pct = Math.round((est.usage / est.quota) * 100);
        label += ` (${pct}% of device quota)`;
      }
    }catch(e){ /* ignore */ }
  }
  document.getElementById('statStorage').textContent = label;
}

/* ============================================================
   CSV EXPORT (data only, no photos)
   ============================================================ */
async function exportCSV(){
  const items = await filteredItemsOrAll();
  if (items.length === 0){ await showAlert('No snags to export.'); return; }
  const headers = ['Tag','Floor','Room','Trade','Severity','Status','Location detail','Description','Comments','Photo count','Logged'];
  const rows = items.map(i => [
    i.tag, FLOORS.find(f => f.code === i.floorCode).name, roomName(i.floorCode, i.roomCode), i.trade,
    i.severity, i.status, i.location || '', i.description || '', i.comments || '',
    (i.photoBlobs || []).length,
    new Date(i.createdAt).toLocaleDateString('en-GB')
  ]);
  const csv = [headers, ...rows].map(r => r.map(cell => {
    const c = String(cell).replace(/"/g, '""');
    return /[",\n]/.test(c) ? `"${c}"` : c;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'snag_list.csv';
  a.click();
}
async function filteredItemsOrAll(){
  // On the export tab there are no filters — always all items
  return idbGetAll('snags');
}

/* ============================================================
   FULL ZIP EXPORT — data (JSON+CSV) + thumbnails + full-res
   photos, organised by tag, auto-split by size, optional
   compression.
   ============================================================ */
async function runExport(){
  const maxSizeMB = parseInt(document.getElementById('exportMaxSize').value, 10);
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  const compress = document.getElementById('exportCompress').checked;
  const statusEl = document.getElementById('exportStatus');
  const progWrap = document.getElementById('exportProgressWrap');
  const progFill = document.getElementById('exportProgressFill');

  const items = await idbGetAll('snags');
  if (items.length === 0){ await showAlert('No snags to export yet.'); return; }

  progWrap.style.display = 'block';
  progFill.style.width = '0%';
  statusEl.textContent = 'Preparing export...';

  // Build the data table (CSV) and a JSON with full detail
  const headers = ['Tag','Floor','Room','Trade','Severity','Status','Location detail','Description','Comments','PinX','PinY','ThumbFile','PhotoFiles','Logged','Updated'];
  const csvRows = [headers];
  const jsonRecords = [];

  // Count total files to process for progress bar
  let totalFiles = items.length; // data file itself counts as part of part 1, but we track photo files mainly
  items.forEach(i => { totalFiles += (i.thumbs || []).length + (i.photoBlobs || []).length; });
  let processed = 0;

  let zip = new ZipWriter();
  let zipEstSize = 0;
  let partNum = 1;
  const partBlobs = [];

  async function addToZip(name, dataU8){
    const added = await zip.addFile(name, dataU8, compress);
    zipEstSize += added;
    if (zipEstSize > maxSizeBytes){
      partBlobs.push(zip.finalize());
      zip = new ZipWriter();
      zipEstSize = 0;
      partNum++;
    }
  }

  for (const item of items){
    const thumbFiles = [];
    const photoFiles = [];
    const thumbs = item.thumbs || [];
    for (let idx = 0; idx < thumbs.length; idx++){
      const fname = `photos/${item.tag}_thumb_${idx + 1}.jpg`;
      await addToZip(fname, dataUrlToUint8Array(thumbs[idx]));
      thumbFiles.push(fname);
      processed++;
      progFill.style.width = Math.round((processed / totalFiles) * 100) + '%';
      statusEl.textContent = `Packing photos... (${processed}/${totalFiles})`;
    }
    const blobs = item.photoBlobs || [];
    for (let idx = 0; idx < blobs.length; idx++){
      const blob = blobs[idx];
      const ext = (blob.type && blob.type.includes('png')) ? 'png' : 'jpg';
      const fname = `photos/${item.tag}_full_${idx + 1}.${ext}`;
      const u8 = await blobToUint8Array(blob);
      await addToZip(fname, u8);
      photoFiles.push(fname);
      processed++;
      progFill.style.width = Math.round((processed / totalFiles) * 100) + '%';
      statusEl.textContent = `Packing photos... (${processed}/${totalFiles})`;
    }

    csvRows.push([
      item.tag, FLOORS.find(f => f.code === item.floorCode).name, roomName(item.floorCode, item.roomCode),
      item.trade, item.severity, item.status, item.location || '', item.description || '', item.comments || '',
      item.pinX != null ? item.pinX : '', item.pinY != null ? item.pinY : '',
      thumbFiles.join('|'), photoFiles.join('|'),
      new Date(item.createdAt).toLocaleString('en-GB'), new Date(item.updatedAt).toLocaleString('en-GB')
    ]);

    jsonRecords.push({
      tag: item.tag, floorCode: item.floorCode, floorName: FLOORS.find(f => f.code === item.floorCode).name,
      roomCode: item.roomCode, roomName: roomName(item.floorCode, item.roomCode),
      trade: item.trade, severity: item.severity, status: item.status,
      location: item.location || '', description: item.description || '', comments: item.comments || '',
      pinX: item.pinX, pinY: item.pinY,
      thumbFiles, photoFiles,
      createdAt: item.createdAt, updatedAt: item.updatedAt
    });
  }

  // Write data files into the CURRENT (last) zip part
  const csvText = csvRows.map(r => r.map(cell => {
    const c = String(cell).replace(/"/g, '""');
    return /[",\n]/.test(c) ? `"${c}"` : c;
  }).join(',')).join('\n');
  await addToZip('data.csv', strToBytes(csvText));
  await addToZip('data.json', strToBytes(JSON.stringify(jsonRecords, null, 2)));

  partBlobs.push(zip.finalize());

  statusEl.textContent = `Done — ${partBlobs.length} ZIP part(s). Starting download...`;
  progFill.style.width = '100%';

  for (let p = 0; p < partBlobs.length; p++){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(partBlobs[p]);
    const suffix = partBlobs.length > 1 ? `_part${p + 1}of${partBlobs.length}` : '';
    a.download = `snag_export${suffix}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // small delay between downloads so the browser doesn't block multiple simultaneous downloads
    await new Promise(r => setTimeout(r, 400));
  }

  statusEl.textContent = `Exported ${items.length} snag(s) across ${partBlobs.length} ZIP part(s). Upload the file(s) to Claude when ready for the final report.`;
}

/* ============================================================
   INIT
   ============================================================ */
async function renderAll(){
  await renderStats();
  await renderPlanTab();
  await renderCoverage();
  await renderList();
}
(async function init(){
  populateFloorSelects();
  renderChecklistHint();
  await renderAll();
  if ('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
