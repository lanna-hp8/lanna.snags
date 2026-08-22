// Bump this on every deployed change — it's the one reliable way to tell
// whether your phone is actually running the latest code, since the old
// "Rev" line was showing the last-edited-snag time (which is per-device
// data, not a code version) and was misleading for that purpose.
const APP_BUILD = 'Build #14';

/* ============================================================
   STORAGE LAYER — IndexedDB.
   Two stores, deliberately kept separate for scalability:
     - 'snags'  — text data only (room, trade, description, pins).
                  Small records; fast to list/search/edit regardless
                  of how many photos exist.
     - 'photos' — one record per photo (thumb + full-res together),
                  tagged with snagId via an index. Editing a snag's
                  text never touches this store; only opening that
                  specific snag (or exporting) reads its photos.
   This avoids the old design's problem: every snag record carried
   its photos embedded inside it, so even a small text edit meant
   reading/rewriting the photos too.
   ============================================================ */
const DB_NAME = 'siteSnagDB';
const DB_VERSION = 2;
let dbPromise = null;

function openDB(){
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const tx = e.target.transaction;
      if (!db.objectStoreNames.contains('snags')) {
        db.createObjectStore('snags', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
      let photoStore;
      if (!db.objectStoreNames.contains('photos')) {
        photoStore = db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
        photoStore.createIndex('snagId', 'snagId', { unique: false });
      } else {
        photoStore = tx.objectStore('photos');
      }
      // One-time migration from v1 shape (photos embedded in the snag record,
      // single pinX/pinY) into the new shape (separate photos store, pins array).
      if (e.oldVersion < 2) {
        const snagStore = tx.objectStore('snags');
        snagStore.openCursor().onsuccess = (ev) => {
          const cursor = ev.target.result;
          if (!cursor) return;
          const item = cursor.value;
          let changed = false;
          const thumbs = item.thumbs || [];
          const fulls = item.photosFull || [];
          for (let i = 0; i < Math.max(thumbs.length, fulls.length); i++){
            photoStore.add({ snagId: item.id, thumb: thumbs[i] || null, full: fulls[i] || null, order: i, createdAt: item.createdAt || new Date().toISOString() });
          }
          if (thumbs.length || fulls.length){
            delete item.thumbs;
            delete item.photosFull;
            changed = true;
          }
          if (item.pinX != null || item.pinY != null){
            item.pins = [{ x: item.pinX, y: item.pinY }];
            delete item.pinX;
            delete item.pinY;
            changed = true;
          } else if (!item.pins){
            item.pins = [];
            changed = true;
          }
          if (changed) cursor.update(item);
          cursor.continue();
        };
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

/* ---- Photos store helpers ---- */
async function getPhotosForSnag(snagId){
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readonly');
    const idx = tx.objectStore('photos').index('snagId');
    const req = idx.getAll(snagId);
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => (a.order || 0) - (b.order || 0)));
    req.onerror = () => reject(req.error);
  });
}
async function getAllPhotos(){ return idbGetAll('photos'); }
async function addPhoto(record){ return idbPut('photos', record); }
async function deletePhoto(id){ return idbDelete('photos', id); }
async function deletePhotosForSnag(snagId){
  const photos = await getPhotosForSnag(snagId);
  for (const p of photos) await deletePhoto(p.id);
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
function uint8ArrayToDataUrl(u8, mime){
  mime = mime || 'image/jpeg';
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < u8.length; i += chunkSize){
    binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunkSize));
  }
  return `data:${mime};base64,` + btoa(binary);
}

/* ============================================================
   MINIMAL ZIP READER — counterpart to ZipWriter above, for restoring
   from a backup export. Reads the central directory, then extracts
   individual entries on demand (STORE or DEFLATE, matching what
   ZipWriter can produce).
   ============================================================ */
async function readZipFile(arrayBuffer){
  const view = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);
  const EOCD_SIG = 0x06054b50;
  let eocdOffset = -1;
  const searchStart = Math.max(0, bytes.length - 22 - 65557);
  for (let i = bytes.length - 22; i >= searchStart; i--){
    if (view.getUint32(i, true) === EOCD_SIG){ eocdOffset = i; break; }
  }
  if (eocdOffset === -1) throw new Error('Not a valid ZIP file — could not find its end-of-central-directory record.');
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);

  const entries = [];
  let offset = centralDirOffset;
  const CENTRAL_SIG = 0x02014b50;
  for (let i = 0; i < totalEntries; i++){
    if (view.getUint32(offset, true) !== CENTRAL_SIG) throw new Error('This ZIP\u2019s central directory looks corrupted.');
    const method = view.getUint16(offset + 10, true);
    const compSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nameBytes = bytes.slice(offset + 46, offset + 46 + nameLen);
    const name = new TextDecoder().decode(nameBytes);
    entries.push({ name, method, compSize, localHeaderOffset });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return { bytes, view, entries };
}
async function extractZipEntry(zip, entry){
  const { bytes, view } = zip;
  const off = entry.localHeaderOffset;
  const LOCAL_SIG = 0x04034b50;
  if (view.getUint32(off, true) !== LOCAL_SIG) throw new Error('Corrupt local file header for ' + entry.name);
  const nameLen = view.getUint16(off + 26, true);
  const extraLen = view.getUint16(off + 28, true);
  const dataStart = off + 30 + nameLen + extraLen;
  const compData = bytes.slice(dataStart, dataStart + entry.compSize);
  if (entry.method === 0) return compData;
  if (entry.method === 8){
    if (typeof DecompressionStream === 'undefined'){
      throw new Error('This browser can\u2019t decompress this ZIP. Try again in an up-to-date Chrome or Safari.');
    }
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(compData);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks = [];
    let total = 0;
    while (true){
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    const out = new Uint8Array(total);
    let o = 0;
    for (const c of chunks){ out.set(c, o); o += c.length; }
    return out;
  }
  throw new Error('Unsupported compression method in ZIP entry: ' + entry.name);
}

/* ============================================================
   APP STATE & CONFIRM/ALERT (no native dialogs relied on, same
   pattern as the previous version, kept for consistency)
   ============================================================ */
let currentEditId = null;
let currentPhotos = [];        // thumbnails (dataURLs) for photos already saved to this snag, in this editing session
let currentPhotosFull = [];    // matching full-res dataURLs, parallel array to currentPhotos
let currentPhotoIds = [];      // matching existing photo-record ids (null for a photo added in this session, not yet saved)
let deletedPhotoIds = [];      // existing photo-record ids removed during this editing session, to delete on save
let currentPinCoords = [];     // ARRAY of {x,y} — a snag can now have multiple pins in a room
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
  populateRoomFilterSelect();
}
function populateRoomFilterSelect(){
  const fFloor = document.getElementById('fFloor');
  const fRoom = document.getElementById('fRoom');
  const prevValue = fRoom.value;
  if (!fFloor.value){
    // No floor chosen — room filter isn't meaningful yet, so just offer every
    // room across every floor rather than nothing (still useful for search).
    const allRooms = [];
    FLOORS.forEach(f => f.rooms.forEach(r => allRooms.push([r[0], `${r[1]} (${f.name})`])));
    fRoom.innerHTML = '<option value="">All rooms</option>' + allRooms.map(r => `<option value="${r[0]}">${r[1]}</option>`).join('');
  } else {
    const floor = FLOORS.find(f => f.code === fFloor.value);
    fRoom.innerHTML = '<option value="">All rooms</option>' + (floor ? floor.rooms.map(r => `<option value="${r[0]}">${r[1]}</option>`).join('') : '');
  }
  // Keep the previous room selection if it's still a valid option for the new floor
  if ([...fRoom.options].some(o => o.value === prevValue)) fRoom.value = prevValue;
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
let activeTab = 'plan';
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    activeTab = btn.dataset.tab;
    renderActiveTab();
  });
});
function renderActiveTab(){
  if (activeTab === 'list') renderList();
  if (activeTab === 'coverage') renderCoverage();
  if (activeTab === 'plan') renderPlanTab();
  // 'export' tab has no data render — it only acts when you tap the export buttons
}

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
  currentPhotosFull = [];
  currentPhotoIds = [];
  deletedPhotoIds = [];
  currentPinCoords = [];
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
  const photos = await getPhotosForSnag(id);
  currentPhotos = photos.map(p => p.thumb);
  currentPhotosFull = photos.map(p => p.full);
  currentPhotoIds = photos.map(p => p.id);
  deletedPhotoIds = [];
  currentPinCoords = (item.pins || []).slice();
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

async function duplicateToNew(id){
  const items = await idbGetAll('snags');
  const item = items.find(i => i.id === id);
  if (!item) return;
  // Reuses the normal "add" flow (so photos, photo ids, and pins all start
  // empty exactly as a fresh snag should) then overlays the text fields from
  // the source snag. Status resets to Open — a duplicate represents a fresh
  // occurrence, not a copy of wherever the original currently stands.
  openAddModal(item.floorCode, item.roomCode);
  document.getElementById('mTrade').value = item.trade;
  document.getElementById('mSeverity').value = item.severity;
  document.getElementById('mStatus').value = 'Open';
  document.getElementById('mLocation').value = item.location || '';
  document.getElementById('mDescription').value = item.description || '';
  document.getElementById('mComments').value = item.comments || '';
}

async function saveSnag(){
  const floorCode = document.getElementById('mFloor').value;
  const roomCode = document.getElementById('mRoom').value;
  const description = document.getElementById('mDescription').value.trim();
  if (!description){ await showAlert('Please add a description of the defect.'); return; }

  try{
    const items = await idbGetAll('snags');
    let snagId = currentEditId;

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
      item.pins = currentPinCoords;
      item.updatedAt = new Date().toISOString();
      await idbPut('snags', item);
    } else {
      const seq = items.filter(i => i.floorCode === floorCode && i.roomCode === roomCode).length + 1;
      const tag = `${floorCode}-${roomCode}-${String(seq).padStart(2, '0')}`;
      snagId = await idbPut('snags', {
        tag, floorCode, roomCode,
        trade: document.getElementById('mTrade').value,
        severity: document.getElementById('mSeverity').value,
        status: document.getElementById('mStatus').value,
        location: document.getElementById('mLocation').value.trim(),
        description,
        comments: document.getElementById('mComments').value.trim(),
        pins: currentPinCoords,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Photos live in their own store, keyed to this snag — only touch the
    // records that actually changed this session (deletions + new adds).
    for (const pid of deletedPhotoIds) await deletePhoto(pid);
    for (let i = 0; i < currentPhotos.length; i++){
      if (currentPhotoIds[i] == null){ // a newly-added photo this session
        await addPhoto({ snagId, thumb: currentPhotos[i], full: currentPhotosFull[i], order: i, createdAt: new Date().toISOString() });
      }
    }

    closeModal();
    await renderAll();
  }catch(e){
    await showAlert('Could not save this snag: ' + (e && e.message ? e.message : 'unknown storage error') + '. If this keeps happening with photos attached, try removing one photo and saving again — your device may be low on storage.');
  }
}

async function deleteCurrent(){
  if (!currentEditId) return;
  const ok = await showConfirm('Delete this snag entry? This cannot be undone.', 'Delete', true);
  if (!ok) return;
  await deletePhotosForSnag(currentEditId);
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
        // Thumbnail (small, for quick reference in lists)
        const maxW = 700;
        const scale = Math.min(1, maxW / img.width);
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = img.width * scale;
        thumbCanvas.height = img.height * scale;
        thumbCanvas.getContext('2d').drawImage(img, 0, 0, thumbCanvas.width, thumbCanvas.height);
        const thumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.6);

        // Full-resolution version — same pixel dimensions as the original, re-encoded
        // as a JPEG string (not a raw Blob) so it stores reliably across browsers.
        const fullCanvas = document.createElement('canvas');
        fullCanvas.width = img.width;
        fullCanvas.height = img.height;
        fullCanvas.getContext('2d').drawImage(img, 0, 0);
        const fullUrl = fullCanvas.toDataURL('image/jpeg', 0.9);

        currentPhotos.push(thumbUrl);
        currentPhotosFull.push(fullUrl);
        currentPhotoIds.push(null); // null = newly added this session, no stored record yet
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
function removePhoto(idx){
  const existingId = currentPhotoIds[idx];
  if (existingId != null) deletedPhotoIds.push(existingId);
  currentPhotos.splice(idx, 1);
  currentPhotosFull.splice(idx, 1);
  currentPhotoIds.splice(idx, 1);
  renderPhotoPreview();
}
function openLightbox(src){ document.getElementById('lightboxImg').src = src; document.getElementById('lightbox').classList.add('show'); }

/* ============================================================
   PINPOINT ZOOM PICKER (inside the add/edit modal)
   ============================================================ */
function applyZoomBackground(el, floorCode, cxPct, cyPct, containerW, containerH, zoomFactor){
  const zoom = zoomFactor || PIN_ZOOM_FACTOR;
  // scaledW/H are relative to the CONTAINER's actual pixel size, not the source
  // image's native pixel size — this is what makes the field of view consistent
  // across screen sizes. (The old version scaled off the fixed 1500x1059 source
  // dimensions regardless of how wide the container actually was, so the same
  // "zoom" number showed a much smaller fraction of the room on a narrow phone
  // screen than on a wide desktop one — that was the "cutting off the room" bug.)
  const scaledW = containerW * zoom;
  const scaledH = containerH * zoom;
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
// Waits for the pin-zoom container to actually have a real, laid-out size
// before we do any positioning math against it. Without this, opening the
// modal could measure the container before the browser finished laying it
// out (0px), silently falling back to a guessed width — harmless for a new
// snag with no pins yet, but for an EXISTING snag its pins would render
// using that wrong guess and never self-correct. This polls across a few
// animation frames until a real width shows up.
function waitForLayout(el, maxFrames){
  maxFrames = maxFrames || 15;
  return new Promise((resolve) => {
    function check(n){
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 || n >= maxFrames){
        resolve(rect);
      } else {
        requestAnimationFrame(() => check(n + 1));
      }
    }
    check(0);
  });
}
let pinZoomState = null; // caches current floor/room/center so the slider can re-zoom without re-deriving
async function renderPinZoom(){
  const floorCode = document.getElementById('mFloor').value;
  const roomCode = document.getElementById('mRoom').value;
  const wrap = document.getElementById('pinZoomWrap');
  const hint = document.getElementById('pinZoomHint');
  const sliderRow = document.getElementById('pinZoomSlider').parentElement;
  if (floorCode === 'WH'){
    wrap.style.display = 'none';
    sliderRow.style.display = 'none';
    hint.textContent = 'No floor plan available for whole-house / external items.';
    pinZoomState = null;
    return;
  }
  wrap.style.display = 'block';
  sliderRow.style.display = 'flex';
  const coords = PIN_COORDS[floorCode] || [];
  const entry = coords.find(c => c[0] === roomCode);
  const centerX = entry ? entry[1] : 50;
  const centerY = entry ? entry[2] : 50;
  const zoom = getZoomFactor(floorCode, roomCode);
  pinZoomState = { floorCode, roomCode, centerX, centerY };
  document.getElementById('pinZoomSlider').value = zoom;
  document.getElementById('pinZoomValue').textContent = zoom.toFixed(1) + 'x';
  await applyCurrentZoom();
  const otherCount = await renderOtherPins(floorCode, roomCode);
  updateZoomHint(otherCount);
}
function updateZoomHint(otherCount){
  const hint = document.getElementById('pinZoomHint');
  const ownCount = currentPinCoords.length;
  const parts = [];
  parts.push(ownCount > 0
    ? `${ownCount} pin${ownCount > 1 ? 's' : ''} placed for this snag — tap a red pin to remove it, tap elsewhere to add another.`
    : 'Tap the zoomed view to mark where this is — tap again elsewhere to add more than one point.');
  if (otherCount > 0) parts.push(`Coloured dots (${otherCount}) show other snags already logged in this room.`);
  hint.textContent = parts.join(' ');
}
async function applyCurrentZoom(){
  if (!pinZoomState) return;
  const wrap = document.getElementById('pinZoomWrap');
  const rect = await waitForLayout(wrap);
  const containerW = rect.width || 320;
  const containerH = rect.height || Math.round(containerW * PIN_ZOOM_IMG_H / PIN_ZOOM_IMG_W);
  const zoom = parseFloat(document.getElementById('pinZoomSlider').value) || PIN_ZOOM_FACTOR;
  applyZoomBackground(wrap, pinZoomState.floorCode, pinZoomState.centerX, pinZoomState.centerY, containerW, containerH, zoom);
  renderOwnPins();
}
async function onZoomSliderChange(){
  const zoom = parseFloat(document.getElementById('pinZoomSlider').value);
  document.getElementById('pinZoomValue').textContent = zoom.toFixed(1) + 'x';
  await applyCurrentZoom();
  if (pinZoomState) renderOtherPins(pinZoomState.floorCode, pinZoomState.roomCode).then(updateZoomHint);
}

/* Own pins — the snag being logged/edited right now. Editable: shown as
   larger red markers you can tap to remove; tapping empty space adds a new
   one. A snag can have several, since one defect can span multiple points
   in a room (e.g. a crack running across two walls). */
function renderOwnPins(){
  const wrap = document.getElementById('pinZoomWrap');
  wrap.querySelectorAll('.pin-zoom-marker').forEach(el => el.remove());
  const scaledW = parseFloat(wrap.dataset.scaledW || 0);
  const scaledH = parseFloat(wrap.dataset.scaledH || 0);
  const posX = parseFloat(wrap.dataset.posX || 0);
  const posY = parseFloat(wrap.dataset.posY || 0);
  if (!scaledW || !scaledH) return;
  currentPinCoords.forEach((pin, idx) => {
    const marker = document.createElement('div');
    marker.className = 'pin-zoom-marker';
    marker.style.left = ((pin.x / 100) * scaledW + posX) + 'px';
    marker.style.top = ((pin.y / 100) * scaledH + posY) + 'px';
    marker.style.display = 'block';
    marker.title = 'Tap to remove this pin';
    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      currentPinCoords.splice(idx, 1);
      renderOwnPins();
      if (pinZoomState) renderOtherPins(pinZoomState.floorCode, pinZoomState.roomCode).then(updateZoomHint);
      else updateZoomHint(0);
    });
    wrap.appendChild(marker);
  });
}

/* Other snags' pins in the same room — reference only, not interactive:
   a different (severity-based) colour, smaller, and pointer-events:none
   so they can never be dragged, clicked-to-remove, or otherwise edited
   from here. */
async function renderOtherPins(floorCode, roomCode){
  const wrap = document.getElementById('pinZoomWrap');
  wrap.querySelectorAll('.pin-zoom-existing').forEach(el => el.remove());
  const scaledW = parseFloat(wrap.dataset.scaledW || 0);
  const scaledH = parseFloat(wrap.dataset.scaledH || 0);
  const posX = parseFloat(wrap.dataset.posX || 0);
  const posY = parseFloat(wrap.dataset.posY || 0);
  if (!scaledW || !scaledH) return 0;
  const items = await idbGetAll('snags');
  const others = items.filter(i => i.floorCode === floorCode && i.roomCode === roomCode && i.id !== currentEditId && (i.pins || []).length);
  let count = 0;
  others.forEach(it => {
    (it.pins || []).forEach(pin => {
      const dot = document.createElement('div');
      dot.className = 'pin-zoom-existing sev-' + it.severity;
      dot.title = `${it.tag} (${it.status}): ${it.description}`;
      dot.style.left = ((pin.x / 100) * scaledW + posX) + 'px';
      dot.style.top = ((pin.y / 100) * scaledH + posY) + 'px';
      wrap.appendChild(dot);
      count++;
    });
  });
  return count;
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
  currentPinCoords.push({ x: Math.round(xPct * 100) / 100, y: Math.round(yPct * 100) / 100 });
  renderOwnPins();
  if (pinZoomState) renderOtherPins(pinZoomState.floorCode, pinZoomState.roomCode).then(updateZoomHint);
  else updateZoomHint(0);
}
function clearPinCoord(){
  currentPinCoords = [];
  renderOwnPins();
  if (pinZoomState) renderOtherPins(pinZoomState.floorCode, pinZoomState.roomCode).then(updateZoomHint);
  else updateZoomHint(0);
}
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

/* Tapping the small pin-location preview on a ticket expands it — same idea
   as tapping a photo thumbnail to see it full-size. Shows ALL of that
   snag's pins (not just the first one used for the mini preview), read-only.
   Defaults to a zoomed-OUT view (1x, our minimum) rather than the picker's
   per-room preset — that preset is tuned for precisely placing a pin up
   close, which made pins look oversized here where the point is spatial
   context. A slider still lets you zoom in if you want a closer look. */
async function getSnagById(id){
  const items = await idbGetAll('snags');
  return items.find(i => i.id === id);
}
let pinLightboxState = null;
async function openPinLightbox(id){
  const item = await getSnagById(id);
  if (!item || !item.pins || !item.pins.length) return;
  const overlay = document.getElementById('pinLightbox');
  const wrap = document.getElementById('pinLightboxWrap');
  overlay.classList.add('show');
  const coords = PIN_COORDS[item.floorCode] || [];
  const entry = coords.find(c => c[0] === item.roomCode);
  const centerX = entry ? entry[1] : 50;
  const centerY = entry ? entry[2] : 50;
  pinLightboxState = { floorCode: item.floorCode, roomCode: item.roomCode, centerX, centerY, pins: item.pins };
  const slider = document.getElementById('pinLightboxSlider');
  slider.value = 1; // always start fully zoomed out here, regardless of the picker's per-room preset
  document.getElementById('pinLightboxZoomValue').textContent = '1.0x';
  await renderPinLightboxZoom();
}
async function renderPinLightboxZoom(){
  if (!pinLightboxState) return;
  const wrap = document.getElementById('pinLightboxWrap');
  const zoom = parseFloat(document.getElementById('pinLightboxSlider').value) || 1;
  const rect = await waitForLayout(wrap); // same layout-safe wait as the picker — avoids the "measured before laid out" bug
  const containerW = rect.width || 320;
  const containerH = rect.height || Math.round(containerW * PIN_ZOOM_IMG_H / PIN_ZOOM_IMG_W);
  const { scaledW, scaledH, posX, posY } = applyZoomBackground(wrap, pinLightboxState.floorCode, pinLightboxState.centerX, pinLightboxState.centerY, containerW, containerH, zoom);
  wrap.querySelectorAll('.pin-zoom-marker').forEach(el => el.remove());
  pinLightboxState.pins.forEach(pin => {
    const marker = document.createElement('div');
    marker.className = 'pin-zoom-marker';
    marker.style.left = ((pin.x / 100) * scaledW + posX) + 'px';
    marker.style.top = ((pin.y / 100) * scaledH + posY) + 'px';
    marker.style.display = 'block';
    marker.style.pointerEvents = 'none'; // read-only view — no editing from here
    wrap.appendChild(marker);
  });
}
function onPinLightboxZoomChange(){
  const zoom = parseFloat(document.getElementById('pinLightboxSlider').value);
  document.getElementById('pinLightboxZoomValue').textContent = zoom.toFixed(1) + 'x';
  renderPinLightboxZoom();
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
  const fr = document.getElementById('fRoom').value;
  const ft = document.getElementById('fTrade').value;
  const fs = document.getElementById('fSeverity').value;
  const fst = document.getElementById('fStatus').value;
  const qWords = document.getElementById('fSearch').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(i => {
    if (ff && i.floorCode !== ff) return false;
    if (fr && i.roomCode !== fr) return false;
    if (ft && i.trade !== ft) return false;
    if (fs && i.severity !== fs) return false;
    if (fst && i.status !== fst) return false;
    if (qWords.length){
      // Search every text field on the snag — tag, floor, room, trade,
      // severity, status, location, description, comments. Each word you
      // type must partially match SOMEWHERE in that combined text (AND
      // across words, partial/substring match per word) — e.g. "crack
      // kitch" matches a kitchen snag mentioning "cracked" even though
      // neither word is a full/exact match on its own.
      const hay = [
        i.tag, FLOORS.find(f => f.code === i.floorCode)?.name, roomName(i.floorCode, i.roomCode),
        i.trade, i.severity, i.status, i.location, i.description, i.comments
      ].filter(Boolean).join(' ').toLowerCase();
      if (!qWords.every(w => hay.includes(w))) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
function hasActiveFilter(){
  return !!(document.getElementById('fFloor').value || document.getElementById('fRoom').value ||
    document.getElementById('fTrade').value ||
    document.getElementById('fSeverity').value || document.getElementById('fStatus').value ||
    document.getElementById('fSearch').value.trim());
}
const STATUS_CLASS_MAP = { 'Open':'st-open','In Progress':'st-inprogress','Awaiting Parts':'st-awaiting','Fixed - To Verify':'st-tofix','Verified/Closed':'st-verified' };
function statusClass(s){ return STATUS_CLASS_MAP[s] || 'st-open'; }
function escapeHtml(s){ return (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

let showAllRequested = false;
function showAllSnags(){ showAllRequested = true; renderList(); }
function performSearch(){
  // Explicit action: filters/search no longer trigger on every keystroke or
  // dropdown change — pressing Search (or Enter in the search box) is what
  // actually clears whatever was showing and runs the query fresh.
  showAllRequested = false;
  renderList();
}

async function renderList(){
  const container = document.getElementById('listContainer');
  if (!hasActiveFilter() && !showAllRequested){
    container.innerHTML = `<div class="empty-state">Pick a filter above (floor, trade, severity, status) and/or type a search, then tap Search — keeps things fast with a large list.<br><br><button class="btn" onclick="showAllSnags()">Show every snag anyway</button></div>`;
    return;
  }
  const items = await filteredItems();
  if (items.length === 0){
    container.innerHTML = `<div class="empty-state">No snags match these filters yet.</div>`;
    return;
  }
  const withPhotos = await Promise.all(items.map(async i => ({ item: i, photos: await getPhotosForSnag(i.id) })));
  container.innerHTML = withPhotos.map(({ item: i, photos }) => `
    <div class="snag-ticket sev-${i.severity}">
      <div class="ticket-top">
        <div><span class="tag-code">${i.tag}</span><span class="badge sev-${i.severity}" style="margin-left:6px;">${i.severity}</span></div>
        <span class="badge ${statusClass(i.status)}">${i.status}</span>
      </div>
      <div class="ticket-loc"><b>${roomName(i.floorCode, i.roomCode)}</b> · ${i.trade}${i.location ? ' · ' + i.location : ''}</div>
      <div class="ticket-desc">${escapeHtml(i.description)}</div>
      ${i.comments ? `<div class="ticket-comments">${escapeHtml(i.comments)}</div>` : ''}
      ${(i.pins && i.pins.length) ? (() => { const p = buildMiniPinStyle(i.floorCode, i.roomCode, i.pins[0].x, i.pins[0].y); const extra = i.pins.length > 1 ? `<span class="ticket-photocount">+${i.pins.length - 1} more pin(s)</span>` : ''; return `<div class="ticket-photos"><div class="ticket-pin-mini" style="${p.bg}" onclick="openPinLightbox(${i.id})" title="Tap to see where this is on the floor plan"><div class="pin-zoom-marker" style="left:${p.markerLeft}px; top:${p.markerTop}px; display:block; pointer-events:none;"></div></div>${extra}</div>`; })() : ''}
      ${photos.length ? `<div class="ticket-photos">${photos.map(p => `<img src="${p.thumb}" onclick="openLightbox('${p.full}')">`).join('')}<span class="ticket-photocount">${photos.length} photo(s), full-res saved</span></div>` : ''}
      <div class="ticket-actions">
        <button class="btn small" onclick="openEditModal(${i.id})">Edit</button>
        <button class="btn small" onclick="duplicateToNew(${i.id})" title="Start a new snag pre-filled with this one's details — no photos or pins carried over">⎘ Duplicate to new</button>
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

  // Approximate photo storage used (sum of full-res photo string sizes, from the separate photos store)
  const allPhotos = await getAllPhotos();
  let totalBytes = 0;
  allPhotos.forEach(p => { if (p.full) totalBytes += Math.round(p.full.length * 0.75); });
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
  const headers = ['Tag','Floor','Room','Trade','Severity','Status','Location detail','Description','Comments','Pin count','Photo count','Logged'];
  const photoCounts = await Promise.all(items.map(i => getPhotosForSnag(i.id)));
  const rows = items.map((i, idx) => [
    i.tag, FLOORS.find(f => f.code === i.floorCode).name, roomName(i.floorCode, i.roomCode), i.trade,
    i.severity, i.status, i.location || '', i.description || '', i.comments || '',
    (i.pins || []).length,
    photoCounts[idx].length,
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
   RESTORE FROM BACKUP — reads one or more export ZIPs (chosen
   directly from the phone's own storage, never uploaded anywhere)
   and recreates every snag, its pins, and its photos. Existing
   snags in the app are left alone — this only adds, never
   overwrites or clears anything first, so it's safe to run even
   if the app already has some data in it.
   ============================================================ */
async function importBackupFiles(fileList){
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const statusEl = document.getElementById('importStatus');
  const progWrap = document.getElementById('importProgressWrap');
  const progFill = document.getElementById('importProgressFill');
  progWrap.style.display = 'block';
  progFill.style.width = '0%';

  let totalImported = 0;
  let totalFailed = 0;

  for (const file of files){
    statusEl.textContent = `Reading ${file.name}...`;
    let zip;
    try {
      const buf = await file.arrayBuffer();
      zip = await readZipFile(buf);
    } catch (e){
      await showAlert(`Could not read ${file.name}: ${e.message}`);
      continue;
    }

    const jsonEntry = zip.entries.find(e => e.name === 'data.json');
    if (!jsonEntry){
      await showAlert(`${file.name} doesn't contain a data.json file — is this one of the app's own backup exports?`);
      continue;
    }
    let records;
    try {
      const jsonBytes = await extractZipEntry(zip, jsonEntry);
      records = JSON.parse(new TextDecoder().decode(jsonBytes));
    } catch (e){
      await showAlert(`${file.name}'s data file looks corrupted: ${e.message}`);
      continue;
    }

    for (let i = 0; i < records.length; i++){
      const rec = records[i];
      statusEl.textContent = `Restoring ${rec.tag || 'snag ' + (i + 1)} from ${file.name} (${i + 1}/${records.length})...`;
      progFill.style.width = Math.round(((i + 1) / records.length) * 100) + '%';
      try {
        // A fresh id is assigned (not the backup's original id) so this can
        // never collide with anything already in the app — tag, room, pins,
        // and photos are all preserved exactly as they were, just not the
        // internal row number, which was never shown to you anyway.
        const snagId = await idbPut('snags', {
          tag: rec.tag, floorCode: rec.floorCode, roomCode: rec.roomCode, trade: rec.trade,
          severity: rec.severity, status: rec.status, location: rec.location || '',
          description: rec.description || '', comments: rec.comments || '',
          pins: rec.pins || [],
          createdAt: rec.createdAt || new Date().toISOString(),
          updatedAt: rec.updatedAt || new Date().toISOString()
        });

        const thumbFiles = rec.thumbFiles || [];
        const photoFiles = rec.photoFiles || [];
        const photoCount = Math.max(thumbFiles.length, photoFiles.length);
        for (let n = 0; n < photoCount; n++){
          let thumbUrl = null, fullUrl = null;
          if (thumbFiles[n]){
            const e = zip.entries.find(x => x.name === thumbFiles[n]);
            if (e) thumbUrl = uint8ArrayToDataUrl(await extractZipEntry(zip, e));
          }
          if (photoFiles[n]){
            const e = zip.entries.find(x => x.name === photoFiles[n]);
            if (e) fullUrl = uint8ArrayToDataUrl(await extractZipEntry(zip, e));
          }
          if (thumbUrl || fullUrl){
            await addPhoto({ snagId, thumb: thumbUrl, full: fullUrl, order: n, createdAt: rec.createdAt || new Date().toISOString() });
          }
        }
        totalImported++;
      } catch (e){
        totalFailed++;
        console.error('Failed to restore', rec.tag, e);
      }
    }
  }

  progFill.style.width = '100%';
  statusEl.textContent = `Restore complete — ${totalImported} snag(s) recovered${totalFailed ? `, ${totalFailed} failed (see browser console for details)` : ''}.`;
  document.getElementById('importInput').value = '';
  await renderAll();
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
  const headers = ['Tag','Floor','Room','Trade','Severity','Status','Location detail','Description','Comments','Pins','ThumbFiles','PhotoFiles','Logged','Updated'];
  const csvRows = [headers];
  const jsonRecords = [];

  const photosBySnag = await Promise.all(items.map(i => getPhotosForSnag(i.id)));

  // Count total files to process for progress bar
  let totalFiles = 0;
  photosBySnag.forEach(photos => { totalFiles += photos.length * 2; }); // thumb + full per photo
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

  for (let itemIdx = 0; itemIdx < items.length; itemIdx++){
    const item = items[itemIdx];
    const photos = photosBySnag[itemIdx];
    const thumbFiles = [];
    const photoFiles = [];
    for (let idx = 0; idx < photos.length; idx++){
      if (photos[idx].thumb){
        const fname = `photos/${item.tag}_thumb_${idx + 1}.jpg`;
        await addToZip(fname, dataUrlToUint8Array(photos[idx].thumb));
        thumbFiles.push(fname);
      }
      processed++;
      progFill.style.width = Math.round((processed / totalFiles) * 100) + '%';
      statusEl.textContent = `Packing photos... (${processed}/${totalFiles})`;

      if (photos[idx].full){
        const fname = `photos/${item.tag}_full_${idx + 1}.jpg`;
        await addToZip(fname, dataUrlToUint8Array(photos[idx].full));
        photoFiles.push(fname);
      }
      processed++;
      progFill.style.width = Math.round((processed / totalFiles) * 100) + '%';
      statusEl.textContent = `Packing photos... (${processed}/${totalFiles})`;
    }

    const pinsStr = (item.pins || []).map(p => `${p.x},${p.y}`).join('|');

    csvRows.push([
      item.tag, FLOORS.find(f => f.code === item.floorCode).name, roomName(item.floorCode, item.roomCode),
      item.trade, item.severity, item.status, item.location || '', item.description || '', item.comments || '',
      pinsStr,
      thumbFiles.join('|'), photoFiles.join('|'),
      new Date(item.createdAt).toLocaleString('en-GB'), new Date(item.updatedAt).toLocaleString('en-GB')
    ]);

    jsonRecords.push({
      tag: item.tag, floorCode: item.floorCode, floorName: FLOORS.find(f => f.code === item.floorCode).name,
      roomCode: item.roomCode, roomName: roomName(item.floorCode, item.roomCode),
      trade: item.trade, severity: item.severity, status: item.status,
      location: item.location || '', description: item.description || '', comments: item.comments || '',
      pins: item.pins || [],
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

  await setMeta('lastExportAt', new Date().toISOString());
  await checkBackupReminder();
  statusEl.textContent = `Exported ${items.length} snag(s) across ${partBlobs.length} ZIP part(s). Upload the file(s) to Claude when ready for the final report, or keep them as a safe backup.`;
}

/* ============================================================
   INIT
   ============================================================ */
async function checkBackupReminder(){
  const banner = document.getElementById('backupReminder');
  const text = document.getElementById('backupReminderText');
  const items = await idbGetAll('snags');
  if (items.length === 0){ banner.style.display = 'none'; return; }
  const lastExport = await getMeta('lastExportAt', null);
  const daysSince = lastExport ? (Date.now() - new Date(lastExport).getTime()) / 86400000 : Infinity;
  if (daysSince > 3){
    text.textContent = lastExport
      ? `⚠️ It's been ${Math.floor(daysSince)} day(s) since your last backup export. This data only lives on this device — export regularly.`
      : `⚠️ You haven't exported a backup yet. This data only lives on this device until you do — export now.`;
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}
async function renderAll(){
  // Only the stats bar always refreshes (cheap — just counts). The heavy
  // per-tab renders (especially the Snag List, which loads photos) only
  // run for whichever tab is actually visible right now — previously
  // every save/status-change re-rendered all four tabs regardless of
  // which one you were looking at, which is why things got sluggish as
  // the photo count grew.
  await renderStats();
  await checkBackupReminder();
  await renderActiveTab();
}
(async function init(){
  document.getElementById('buildLabel').textContent = APP_BUILD;
  populateFloorSelects();
  renderChecklistHint();
  // Ask the browser not to silently evict this site's storage under
  // storage pressure or after a period of inactivity — this is the
  // specific protection that was missing before, and the most likely
  // reason a full week's worth of logged snags disappeared on their own.
  if (navigator.storage && navigator.storage.persist){
    try {
      const granted = await navigator.storage.persist();
      console.log('Persistent storage:', granted ? 'granted' : 'not granted (still best-effort — export regularly)');
    } catch (e) { /* not supported in this browser — export reminder is the real backstop */ }
  }
  await renderAll();
  if ('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.update(); // explicitly check for a newer sw.js on every app launch
    }).catch(() => {});
    // If a new service worker takes over mid-session, reload once so the
    // page actually reflects it, rather than sitting on stale code until
    // the next manual relaunch.
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  }
})();
