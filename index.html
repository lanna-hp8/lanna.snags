<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Site Snag Register</title>
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#16233E">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<link rel="icon" href="icons/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
  :root{
    --ink:#16233E; --ink-2:#233559; --paper:#EEF1F4; --card:#FFFFFF;
    --line:#CFD7E0; --line-soft:#E3E8ED; --text:#1D2733; --text-soft:#5B6B7C;
    --amber:#DA8B2E; --amber-bg:#FBF0DE; --red:#B23A32; --red-bg:#F7E4E1;
    --green:#3F7A56; --green-bg:#E4EFE8; --blue:#2F5DA6; --blue-bg:#E3EAF6;
    --grey:#8894A0; --grey-bg:#EBEEF1; --radius:10px;
    --shadow: 0 1px 2px rgba(22,35,62,0.06), 0 4px 14px rgba(22,35,62,0.05);
  }
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;}
  body{
    background: linear-gradient(var(--paper), var(--paper)),
      repeating-linear-gradient(0deg, rgba(47,93,166,0.05) 0px, rgba(47,93,166,0.05) 1px, transparent 1px, transparent 40px),
      repeating-linear-gradient(90deg, rgba(47,93,166,0.05) 0px, rgba(47,93,166,0.05) 1px, transparent 1px, transparent 40px);
    font-family:'Inter',sans-serif; color:var(--text); min-height:100vh;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .wrap{max-width:1180px;margin:0 auto;padding:20px 18px 80px;}
  header.top{
    background:var(--ink); background-image: linear-gradient(135deg, var(--ink) 0%, var(--ink-2) 100%);
    color:#fff; border-radius:var(--radius); padding:22px 24px; box-shadow:var(--shadow); position:relative; overflow:hidden;
  }
  header.top::before{
    content:""; position:absolute; inset:0;
    background-image: repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 28px),
      repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 28px);
    pointer-events:none;
  }
  .top-row{display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; position:relative;}
  .proj-label{font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:#B9C6DE; margin-bottom:4px;}
  h1{font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:28px; margin:0 0 4px; letter-spacing:-0.01em;}
  .sub{color:#B9C6DE; font-size:13px; font-family:'IBM Plex Mono',monospace;}
  .stats{display:flex; gap:10px; flex-wrap:wrap; position:relative;}
  .stat{background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.16); border-radius:8px; padding:8px 14px; min-width:78px; text-align:center;}
  .stat .n{font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:20px; line-height:1;}
  .stat .l{font-size:10px; letter-spacing:0.08em; text-transform:uppercase; color:#B9C6DE; margin-top:4px;}
  .stat.open .n{color:#F4C77E;} .stat.crit .n{color:#F0918A;} .stat.verified .n{color:#8FD1AC;}
  .stat.storage .n{color:#9FD6E8; font-size:14px;}

  .tabs{display:flex; gap:6px; margin:20px 0 16px; border-bottom:1px solid var(--line); flex-wrap:wrap;}
  .tab-btn{font-family:'Space Grotesk',sans-serif; font-weight:600; font-size:14px; background:none; border:none; padding:10px 4px; margin-right:18px; cursor:pointer; color:var(--text-soft); border-bottom:2px solid transparent; position:relative; top:1px;}
  .tab-btn.active{color:var(--ink); border-bottom-color:var(--ink);}
  .tab-panel{display:none;} .tab-panel.active{display:block;}

  .toolbar{display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:16px;}
  .btn{font-family:'Inter',sans-serif; font-weight:600; font-size:13px; cursor:pointer; border-radius:8px; padding:9px 16px; border:1px solid var(--line); background:var(--card); color:var(--text); transition:all .12s ease;}
  .btn:hover{border-color:var(--ink); color:var(--ink);}
  .btn.primary{background:var(--ink); color:#fff; border-color:var(--ink);} .btn.primary:hover{background:var(--ink-2);}
  .btn.ghost{background:transparent; border-color:transparent; color:var(--text-soft);} .btn.ghost:hover{color:var(--ink); background:var(--grey-bg);}
  .btn.small{padding:5px 10px; font-size:12px; border-radius:6px;}
  select, input[type=text], input[type=search], textarea, input[type=number]{font-family:'Inter',sans-serif; font-size:13px; padding:8px 10px; border-radius:8px; border:1px solid var(--line); background:var(--card); color:var(--text);}
  select:focus, input:focus, textarea:focus{outline:2px solid var(--blue); outline-offset:1px;}
  .filters{display:flex; gap:8px; flex-wrap:wrap; flex:1;}
  .search-box{flex:1; min-width:160px;} .search-box input{width:100%;}

  .floor-block{margin-bottom:22px;}
  .floor-title{font-family:'IBM Plex Mono',monospace; font-size:12px; letter-spacing:0.1em; text-transform:uppercase; color:var(--text-soft); margin:0 0 10px; display:flex; align-items:center; gap:8px;}
  .floor-title::after{content:""; flex:1; height:1px; background:var(--line);}
  .room-grid{display:grid; grid-template-columns:repeat(auto-fill, minmax(200px,1fr)); gap:10px;}
  .room-card{background:var(--card); border:1px solid var(--line-soft); border-radius:var(--radius); padding:13px 14px; box-shadow:var(--shadow); cursor:pointer; transition:transform .1s ease, border-color .1s ease; position:relative;}
  .room-card:hover{border-color:var(--blue); transform:translateY(-1px);}
  .room-card .code{font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--grey); letter-spacing:0.06em;}
  .room-card .name{font-weight:600; font-size:14px; margin:2px 0 8px;}
  .room-card .count-row{display:flex; align-items:center; justify-content:space-between;}
  .count-pill{font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:13px; border-radius:20px; padding:2px 10px;}
  .count-pill.zero{background:var(--grey-bg); color:var(--grey);} .count-pill.some{background:var(--amber-bg); color:var(--amber);} .count-pill.clear{background:var(--green-bg); color:var(--green);}
  .room-card .plus{font-size:18px; color:var(--grey); border:1px dashed var(--line); border-radius:6px; width:26px; height:26px; display:flex; align-items:center; justify-content:center;}

  .snag-ticket{background:var(--card); border:1px solid var(--line-soft); border-left:5px solid var(--grey); border-radius:var(--radius); padding:14px 16px; margin-bottom:10px; box-shadow:var(--shadow);}
  .snag-ticket.sev-Critical{border-left-color:var(--red);} .snag-ticket.sev-Major{border-left-color:var(--amber);} .snag-ticket.sev-Minor{border-left-color:var(--blue);} .snag-ticket.sev-Cosmetic{border-left-color:var(--grey);}
  .ticket-top{display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:flex-start;}
  .tag-code{font-family:'IBM Plex Mono',monospace; font-weight:600; font-size:12px; color:var(--ink); background:var(--grey-bg); padding:2px 8px; border-radius:5px; letter-spacing:0.03em;}
  .badge{font-size:10px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; padding:3px 9px; border-radius:20px; white-space:nowrap;}
  .badge.sev-Critical{background:var(--red-bg); color:var(--red);} .badge.sev-Major{background:var(--amber-bg); color:var(--amber);} .badge.sev-Minor{background:var(--blue-bg); color:var(--blue);} .badge.sev-Cosmetic{background:var(--grey-bg); color:var(--grey);}
  .badge.st-open{background:var(--red-bg); color:var(--red);} .badge.st-inprogress{background:var(--amber-bg); color:var(--amber);} .badge.st-awaiting{background:var(--blue-bg); color:var(--blue);} .badge.st-tofix{background:var(--blue-bg); color:var(--blue);} .badge.st-verified{background:var(--green-bg); color:var(--green);}
  .ticket-loc{font-size:12px; color:var(--text-soft); margin-top:4px;} .ticket-loc b{color:var(--text);}
  .ticket-desc{font-size:14px; margin:9px 0 4px; line-height:1.45;}
  .ticket-comments{font-size:12.5px; color:var(--text-soft); font-style:italic; margin-bottom:8px;}
  .ticket-photos{display:flex; gap:6px; margin:8px 0; flex-wrap:wrap;}
  .ticket-photos img{width:64px; height:64px; object-fit:cover; border-radius:6px; border:1px solid var(--line); cursor:pointer;}
  .ticket-actions{display:flex; gap:8px; align-items:center; margin-top:8px; flex-wrap:wrap;}
  .ticket-actions select{font-size:12px; padding:5px 8px;}
  .ticket-date{font-family:'IBM Plex Mono',monospace; font-size:10.5px; color:var(--grey);}
  .ticket-photocount{font-size:11px; color:var(--text-soft); font-family:'IBM Plex Mono',monospace;}

  .empty-state{text-align:center; padding:50px 20px; color:var(--text-soft); background:var(--card); border-radius:var(--radius); border:1px dashed var(--line);}

  .overlay{position:fixed; inset:0; background:rgba(22,35,62,0.45); display:none; align-items:flex-start; justify-content:center; padding:30px 16px; overflow-y:auto; z-index:50;}
  .overlay.show{display:flex;}
  .modal{background:var(--card); border-radius:14px; padding:24px; width:100%; max-width:560px; box-shadow:0 20px 60px rgba(22,35,62,0.3);}
  .modal h2{font-family:'Space Grotesk',sans-serif; margin:0 0 4px; font-size:19px;}
  .modal .modal-sub{font-size:12px; color:var(--text-soft); margin-bottom:16px; font-family:'IBM Plex Mono',monospace;}
  .field{margin-bottom:13px;} .field label{display:block; font-size:12px; font-weight:600; margin-bottom:5px; color:var(--text-soft);}
  .field select, .field input[type=text], .field textarea{width:100%;}
  .field textarea{resize:vertical; min-height:56px; font-family:'Inter',sans-serif;}
  .row2{display:grid; grid-template-columns:1fr 1fr; gap:10px;}
  .info-toggle{font-size:11px; color:var(--blue); cursor:pointer; margin-left:6px; text-decoration:underline;}
  .checklist-box{background:var(--blue-bg); border-radius:8px; padding:10px 12px; font-size:12px; color:var(--ink-2); margin-top:6px; display:none; line-height:1.5;}
  .checklist-box.show{display:block;}
  .photo-row{display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;}
  .photo-thumb{position:relative; width:64px; height:64px;}
  .photo-thumb img{width:100%; height:100%; object-fit:cover; border-radius:6px; border:1px solid var(--line);}
  .photo-thumb .rm{position:absolute; top:-6px; right:-6px; background:var(--red); color:#fff; border-radius:50%; width:18px; height:18px; font-size:11px; display:flex; align-items:center; justify-content:center; cursor:pointer; border:none;}
  .photo-thumb .full-tag{position:absolute; bottom:-6px; left:-6px; background:var(--green); color:#fff; border-radius:4px; font-size:8px; padding:1px 4px; font-weight:700;}
  .modal-actions{display:flex; justify-content:space-between; gap:10px; margin-top:18px;}

  .plan-subtabs{display:flex; gap:8px; margin-bottom:12px;}
  .plan-subtab-btn{font-family:'IBM Plex Mono',monospace; font-size:12px; font-weight:600; letter-spacing:0.04em; padding:7px 14px; border-radius:20px; border:1px solid var(--line); background:var(--card); color:var(--text-soft); cursor:pointer;}
  .plan-subtab-btn.active{background:var(--ink); color:#fff; border-color:var(--ink);}
  .plan-wrap{position:relative; width:100%; border-radius:var(--radius); overflow:hidden; box-shadow:var(--shadow); border:1px solid var(--line-soft); background:#fff; line-height:0;}
  .plan-wrap img{width:100%; display:block;}
  .pin{position:absolute; transform:translate(-50%,-50%); width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:9px; color:#fff; border:2px solid #fff; box-shadow:0 1px 4px rgba(0,0,0,0.35); background:var(--grey);}
  .pin.some{background:var(--amber);} .pin.clear{background:var(--green);}
  .pin-label{position:absolute; transform:translate(-50%, 4px); top:100%; white-space:nowrap; font-family:'IBM Plex Mono',monospace; font-size:9px; background:rgba(22,35,62,0.85); color:#fff; padding:1px 5px; border-radius:4px; pointer-events:none; opacity:0; transition:opacity .1s ease;}
  .pin-holder:hover .pin-label{opacity:1;} .pin-holder{position:absolute;}
  .wh-strip{margin-top:6px;}
  .wh-btn{display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; padding:8px 14px; border-radius:20px; border:1px solid var(--line); background:var(--card); cursor:pointer; margin:0 8px 8px 0;}
  .wh-btn:hover{border-color:var(--ink); color:var(--ink);}
  .wh-btn .dot{width:8px; height:8px; border-radius:50%; background:var(--grey);}
  .wh-btn .dot.some{background:var(--amber);} .wh-btn .dot.clear{background:var(--green);}

  .pin-zoom-wrap{position:relative; width:100%; aspect-ratio:1500/1059; border-radius:8px; overflow:hidden; border:1px solid var(--line); background:var(--grey-bg); cursor:crosshair; background-repeat:no-repeat;}
  .pin-zoom-marker{position:absolute; width:20px; height:20px; margin-left:-10px; margin-top:-10px; border-radius:50%; background:var(--red); border:2px solid #fff; box-shadow:0 1px 4px rgba(0,0,0,0.4); pointer-events:none;}
  .pin-zoom-marker::after{content:""; position:absolute; left:50%; top:50%; width:4px; height:4px; background:#fff; border-radius:50%; transform:translate(-50%,-50%);}
  .pin-zoom-hint{font-size:11px; color:var(--text-soft); margin-top:5px;}
  .ticket-pin-mini{position:relative; width:90px; height:64px; border-radius:6px; overflow:hidden; border:1px solid var(--line); background-repeat:no-repeat; flex-shrink:0;}
  .ticket-pin-mini .pin-zoom-marker{width:14px; height:14px; margin-left:-7px; margin-top:-7px;}
  .pin-zoom-existing{position:absolute; width:14px; height:14px; margin-left:-7px; margin-top:-7px; border-radius:50%; border:2px solid #fff; box-shadow:0 1px 3px rgba(0,0,0,0.35); opacity:0.9; pointer-events:none;}
  .pin-zoom-existing.sev-Critical{background:var(--red);} .pin-zoom-existing.sev-Major{background:var(--amber);} .pin-zoom-existing.sev-Minor{background:var(--blue);} .pin-zoom-existing.sev-Cosmetic{background:var(--grey);}

  .export-box{background:var(--card); border:1px solid var(--line-soft); border-radius:var(--radius); padding:18px; box-shadow:var(--shadow); margin-bottom:14px;}
  .export-box h3{font-family:'Space Grotesk',sans-serif; margin:0 0 8px; font-size:15px;}
  .export-row{display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:10px;}
  .progress-bar{height:8px; background:var(--grey-bg); border-radius:4px; overflow:hidden; margin-top:10px;}
  .progress-bar .fill{height:100%; background:var(--ink); width:0%; transition:width .2s ease;}

  @media (max-width:640px){ .row2{grid-template-columns:1fr;} h1{font-size:22px;} .stats{gap:6px;} .stat{min-width:64px; padding:6px 10px;} }
</style>
</head>
<body>
<div class="wrap">

  <header class="top">
    <div class="top-row">
      <div>
        <div class="proj-label">Snag Register (PWA)</div>
        <h1>Site Snag Register</h1>
        <div class="sub">Rev — <span id="lastUpdated">no entries yet</span></div>
      </div>
      <div class="stats">
        <div class="stat"><div class="n" id="statTotal">0</div><div class="l">Logged</div></div>
        <div class="stat open"><div class="n" id="statOpen">0</div><div class="l">Open</div></div>
        <div class="stat crit"><div class="n" id="statCrit">0</div><div class="l">Critical</div></div>
        <div class="stat verified"><div class="n" id="statVerified">0</div><div class="l">Verified</div></div>
        <div class="stat storage"><div class="n" id="statStorage">—</div><div class="l">Photo data</div></div>
      </div>
    </div>
  </header>

  <nav class="tabs">
    <button class="tab-btn active" data-tab="plan">Floor Plan</button>
    <button class="tab-btn" data-tab="coverage">Coverage</button>
    <button class="tab-btn" data-tab="list">Snag List</button>
    <button class="tab-btn" data-tab="export">Export</button>
  </nav>

  <div class="tab-panel active" id="tab-plan">
    <div class="toolbar" style="margin-bottom:10px;">
      <span id="planHint" style="font-size:12.5px;color:var(--text-soft)">Tap a pin to log a snag against that room.</span>
    </div>
    <div class="plan-subtabs" id="planSubtabs"></div>
    <div class="plan-wrap" id="planWrap"></div>
    <div class="wh-strip">
      <div class="floor-title" style="margin-top:18px;">Whole House / External (no fixed plan location)</div>
      <div id="whButtons"></div>
    </div>
  </div>

  <div class="tab-panel" id="tab-coverage">
    <div class="toolbar"><button class="btn primary" onclick="openAddModal()">+ Log a snag</button></div>
    <div id="coverageContainer"></div>
  </div>

  <div class="tab-panel" id="tab-list">
    <div class="toolbar">
      <button class="btn primary" onclick="openAddModal()">+ Log a snag</button>
      <div class="filters">
        <select id="fFloor" onchange="renderList()"><option value="">All floors</option></select>
        <select id="fTrade" onchange="renderList()"><option value="">All trades</option></select>
        <select id="fSeverity" onchange="renderList()"><option value="">All severities</option></select>
        <select id="fStatus" onchange="renderList()"><option value="">All statuses</option></select>
      </div>
      <div class="search-box"><input type="search" id="fSearch" placeholder="Search..." oninput="renderList()"></div>
    </div>
    <div id="listContainer"></div>
  </div>

  <div class="tab-panel" id="tab-export">
    <div class="export-box">
      <h3>Export everything to a ZIP</h3>
      <p style="margin:0;font-size:12.5px;color:var(--text-soft)">Bundles a CSV/JSON of all snag data plus every thumbnail and full-resolution photo, organised by tag code. Upload the ZIP to Claude when you're ready to build the final report.</p>
      <div class="export-row">
        <label style="font-size:12.5px;">Max file size per ZIP part:</label>
        <select id="exportMaxSize">
          <option value="80">80 MB (safest for chat upload)</option>
          <option value="150" selected>150 MB</option>
          <option value="300">300 MB</option>
          <option value="99999">No limit (single file)</option>
        </select>
      </div>
      <div class="export-row">
        <label style="font-size:12.5px;"><input type="checkbox" id="exportCompress" checked> Compress photos (deflate) — smaller files, slower export</label>
      </div>
      <div class="export-row">
        <button class="btn primary" onclick="runExport()">Build ZIP export</button>
      </div>
      <div class="progress-bar" id="exportProgressWrap" style="display:none;"><div class="fill" id="exportProgressFill"></div></div>
      <div id="exportStatus" style="font-size:12px;color:var(--text-soft);margin-top:8px;"></div>
    </div>
    <div class="export-box">
      <h3>Quick CSV only</h3>
      <p style="margin:0 0 10px;font-size:12.5px;color:var(--text-soft)">Just the data table, no photos — useful for a quick working punch list.</p>
      <button class="btn" onclick="exportCSV()">⬇ Export CSV</button>
    </div>
  </div>

</div>

<div class="overlay" id="overlay">
  <div class="modal">
    <h2 id="modalTitle">Log a snag</h2>
    <div class="modal-sub" id="modalTag">—</div>
    <div class="row2">
      <div class="field"><label>Floor</label><select id="mFloor" onchange="populateRoomSelect(); renderPinZoom();"></select></div>
      <div class="field"><label>Room / area</label><select id="mRoom" onchange="renderPinZoom()"></select></div>
    </div>
    <div class="field" id="pinZoomField">
      <label>Pinpoint on plan (optional) <span class="info-toggle" onclick="clearPinCoord()">clear pin</span></label>
      <div class="pin-zoom-wrap" id="pinZoomWrap" onclick="handlePinZoomClick(event)">
        <div class="pin-zoom-marker" id="pinZoomMarker" style="display:none;"></div>
      </div>
      <div class="pin-zoom-hint" id="pinZoomHint">Tap the zoomed view to mark exactly where in the room this is.</div>
    </div>
    <div class="field">
      <label>Trade responsible <span class="info-toggle" onclick="toggleChecklist()">what to check</span></label>
      <select id="mTrade" onchange="renderChecklistHint()"></select>
      <div class="checklist-box" id="checklistBox"></div>
    </div>
    <div class="row2">
      <div class="field"><label>Severity</label><select id="mSeverity"><option>Critical</option><option>Major</option><option selected>Minor</option><option>Cosmetic</option></select></div>
      <div class="field"><label>Status</label><select id="mStatus"><option selected>Open</option><option>In Progress</option><option>Awaiting Parts</option><option>Fixed - To Verify</option><option>Verified/Closed</option></select></div>
    </div>
    <div class="field"><label>Location detail (optional)</label><input type="text" id="mLocation" placeholder="Where exactly in the room?"></div>
    <div class="field"><label>Description of defect</label><textarea id="mDescription" placeholder="What's wrong?"></textarea></div>
    <div class="field"><label>Comments / notes (optional)</label><textarea id="mComments" placeholder="Extra context"></textarea></div>
    <div class="field">
      <label>Photos — captures both a thumbnail and the full-resolution original</label>
      <input type="file" accept="image/*" multiple id="mPhotoInput" onchange="handlePhotoInput(event)">
      <div class="photo-row" id="photoPreviewRow"></div>
    </div>
    <div class="modal-actions">
      <div><button class="btn" id="deleteBtn" style="display:none;color:var(--red);border-color:var(--red)" onclick="deleteCurrent()">Delete</button></div>
      <div style="display:flex;gap:8px;">
        <button class="btn ghost" onclick="closeModal()">Cancel</button>
        <button class="btn primary" onclick="saveSnag()">Save snag</button>
      </div>
    </div>
  </div>
</div>

<div class="overlay" id="lightbox" onclick="this.classList.remove('show')">
  <img id="lightboxImg" style="max-width:90%;max-height:90%;border-radius:8px;margin:auto;">
</div>

<div class="overlay" id="confirmOverlay">
  <div class="modal" style="max-width:380px;">
    <p id="confirmMessage" style="margin:0 0 18px; font-size:14px; line-height:1.5; color:var(--text);"></p>
    <div id="confirmButtons" style="display:flex; gap:10px; justify-content:flex-end;"></div>
  </div>
</div>

<script src="data.js"></script>
<script src="app.js"></script>
</body>
</html>
