// ── tree.js ──
const Tree = (() => {
  let nodes = {}, roots = [], sel = null, expanded = {}, zoomScale = 1;

  // ── Load / Save ──────────────────────────────────────
  async function load() {
    const d = await api('GET', '/api/tree');
    nodes = d.nodes || {};
    roots = d.roots || [];
    roots.forEach(r => { if (expanded[r] === undefined) expanded[r] = true; });
    render();
    initPan();
  }
  function toPayload() { return { nodes, roots }; }

  // ── Helpers ──────────────────────────────────────────
  function uid() { return 'n' + Math.random().toString(36).slice(2,9); }
  function isLeaf(id) { return nodes[id] && nodes[id].children.length === 0; }

  function ancestors(id) {
    const a = []; let n = nodes[id];
    while (n && n.parentId) { n = nodes[n.parentId]; if (n) a.unshift(n); }
    return a;
  }
  function topRoot(id) {
    let n = nodes[id];
    while (n && n.parentId) n = nodes[n.parentId];
    return n;
  }
  function allLeaves() {
    const l = [];
    function w(id) { const n = nodes[id]; if (!n) return; n.children.length ? n.children.forEach(w) : l.push(n); }
    roots.forEach(w);
    return l;
  }
  function countTagged(id) {
    const tm = (typeof Tags !== 'undefined') ? Tags.tags : {};
    const s = new Set();
    function w(nid) {
      if (!nodes[nid]) return;
      if (isLeaf(nid)) Object.entries(tm).forEach(([t,arr]) => { if (Array.isArray(arr) && arr.includes(nid)) s.add(t); });
      else nodes[nid].children.forEach(w);
    }
    w(id); return s.size;
  }
  function pathOf(id) {
    if (!nodes[id]) return '';
    return [...ancestors(id).map(n => n.name), nodes[id].name].join(' › ');
  }
  function delRec(id) {
    if (!nodes[id]) return;
    [...nodes[id].children].forEach(c => delRec(c));
    const p = nodes[id].parentId;
    if (p && nodes[p]) nodes[p].children = nodes[p].children.filter(c => c !== id);
    else roots = roots.filter(r => r !== id);
    delete nodes[id];
  }

  // ── Mutations ────────────────────────────────────────
  function addRoot() {
    const nm = prompt('Nombre de la nueva categoría raíz:');
    if (!nm || !nm.trim()) return;
    const id = uid(), col = PAL[roots.length % PAL.length];
    nodes[id] = { id, name: nm.trim(), color: col, parentId: null, children: [] };
    roots.push(id);
    sel = id; expanded[id] = true;
    App.markDirty(); render();
    toast(`"${nm.trim()}" creada ✓`);
  }

  function addChild() {
    if (!sel || !nodes[sel]) { toast('Selecciona un nodo primero'); return; }
    const inp = $('ach-inp'); if (!inp) return;
    const nm = inp.value.trim(); if (!nm) return;
    const id = uid();
    nodes[id] = { id, name: nm, color: nodes[sel].color, parentId: sel, children: [] };
    nodes[sel].children.push(id);
    expanded[sel] = true;
    inp.value = '';
    App.markDirty(); render();
    toast(`"${nm}" agregada ✓`);
  }

  function deleteNode(targetId) {
    const id = targetId || sel;
    if (!id || !nodes[id]) { if (!targetId) toast('Selecciona un nodo primero'); return; }
    if (!confirm(`¿Eliminar "${nodes[id].name}" y todo su contenido?`)) return;
    // Collect all IDs to remove from tags
    const toRemove = [];
    function collect(nid) { toRemove.push(nid); (nodes[nid]?.children || []).forEach(collect); }
    collect(id);
    // Clean tags
    if (typeof Tags !== 'undefined') {
      const tm = Tags.tags;
      Object.keys(tm).forEach(t => {
        tm[t] = tm[t].filter(nid => !toRemove.includes(nid));
        if (!tm[t].length) delete tm[t];
      });
    }
    const wasSel = id === sel;
    delRec(id);
    if (wasSel) sel = null;
    App.markDirty(); render();
    toast('Nodo eliminado');
  }

  function renameNode(val) {
    if (!nodes[sel]) return;
    nodes[sel].name = val || 'Sin nombre';
    App.markDirty(); renderNav(); renderDiagram();
  }

  function setColor(c) {
    if (!nodes[sel]) return;
    nodes[sel].color = c;
    App.markDirty(); render();
    toast('Color actualizado ✓');
  }

  function selectNode(id) {
    sel = id; renderEditor(); renderNav();
  }

  function zoom(factor) {
    zoomScale = Math.min(3, Math.max(0.3, zoomScale * factor));
    renderDiagram();
  }

  // ── Render nav ───────────────────────────────────────
  function renderNav() {
    const el = $('tree-nav'); if (!el) return;
    if (!roots.length) {
      el.innerHTML = '<p style="font-size:.75rem;color:var(--muted);padding:8px 6px">Sin categorías aún</p>';
      return;
    }
    el.innerHTML = '';
    function flat(id, indent) {
      const n = nodes[id]; if (!n) return;
      const isSel = sel === id, hasKids = n.children.length > 0, open = expanded[id] !== false;
      const cnt = countTagged(id);
      const row = document.createElement('div');
      row.className = 'tn' + (isSel ? ' sel' : '');
      row.style.paddingLeft = (indent * 14 + 7) + 'px';
      row.innerHTML = `
        <span class="tn-tog">${hasKids ? (open ? '▾' : '▸') : ' '}</span>
        <span class="tn-dot" style="background:${n.color}"></span>
        <span class="tn-label">${n.name}</span>
        ${cnt ? `<span class="tn-cnt">${cnt}</span>` : ''}`;
      row.querySelector('.tn-tog').addEventListener('click', e => {
        e.stopPropagation(); expanded[id] = !open; renderNav();
      });
      row.addEventListener('click', () => selectNode(id));
      el.appendChild(row);
      if (hasKids && open) n.children.forEach(c => flat(c, indent + 1));
    }
    roots.forEach(r => flat(r, 0));
  }

  // ── Render editor ────────────────────────────────────
  function renderEditor() {
    const ph = $('ed-ph'), ct = $('ed-ct'); if (!ph || !ct) return;
    if (!sel || !nodes[sel]) { ph.style.display='block'; ct.style.display='none'; return; }
    ph.style.display = 'none'; ct.style.display = 'block';
    const n = nodes[sel], anc = ancestors(sel);
    const crumb = anc.map(a => `<span>${a.name}</span>`).join('<span style="color:var(--muted)"> / </span>');
    ct.innerHTML = `
      <div class="crumb">
        ${crumb ? crumb + '<span style="color:var(--muted)"> / </span>' : ''}
        <span style="color:var(--a2)">${n.name}</span>
      </div>
      <div class="ed-card">
        <h4>
          <span class="tn-dot" style="background:${n.color};display:inline-block"></span>
          Propiedades
        </h4>
        <div class="fld">
          <label>Nombre</label>
          <input type="text" id="ed-nm"
            value="${n.name.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}"
            oninput="Tree.renameNode(this.value)">
        </div>
        <div class="fld">
          <label>Color</label>
          <div class="clr-row">
            ${PAL.map(c => `<div class="sw${n.color===c?' sel':''}" style="background:${c}" onclick="Tree.setColor('${c}')"></div>`).join('')}
          </div>
        </div>
        <div class="btn-row">
          <button class="btn btn-d" onclick="Tree.deleteNode()">🗑 Eliminar este nodo</button>
        </div>
      </div>
      <div class="ed-card">
        <h4>
          Subcategorías
          <span style="font-size:.72rem;color:var(--muted);font-weight:400">(${n.children.length})</span>
        </h4>
        <div class="ch-list">
          ${n.children.map(cid => {
            const c = nodes[cid]; if (!c) return '';
            const cnt = countTagged(cid);
            return `<div class="ch-item" onclick="Tree.selectNode('${cid}')">
              <span class="tn-dot" style="background:${c.color}"></span>
              <span class="ch-nm">${c.name}</span>
              <span class="ch-cnt">${cnt} téc.</span>
              <button class="ch-del" title="Eliminar ${c.name}"
                onclick="event.stopPropagation(); Tree.deleteNode('${cid}')">✕</button>
            </div>`;
          }).join('')}
        </div>
        <input class="add-inp" id="ach-inp"
          placeholder="＋ Nueva subcategoría… (Enter para agregar)"
          onkeydown="if(event.key==='Enter'){Tree.addChild();event.preventDefault()}">
      </div>
    `;
  }

  // ── Render diagram ───────────────────────────────────
  function renderDiagram() {
    const wrap = $('svg-wrap'); if (!wrap) return;
    if (!roots.length) {
      wrap.innerHTML = '<p style="font-size:.77rem;color:var(--muted);padding:12px">Sin estructura aún</p>';
      return;
    }

    const BW = 112, BH = 28, GX = 14, GY = 40, PAD = 16;
    const ROOT_SEP = 24; // vertical gap between separate root trees

    // Horizontal span needed per subtree
    const SW = {};
    function calcSW(id) {
      const n = nodes[id]; if (!n) return BW;
      if (!n.children.length) { SW[id] = BW; return BW; }
      const tot = n.children.reduce((s,c) => s + calcSW(c) + GX, 0) - GX;
      SW[id] = Math.max(tot, BW); return SW[id];
    }
    roots.forEach(r => calcSW(r));

    // Vertical span needed per subtree (for stacking)
    function treeH(id) {
      const n = nodes[id]; if (!n || !n.children.length) return BH;
      return BH + GY + Math.max(...n.children.map(treeH));
    }

    // Place nodes — roots stacked vertically, children spread horizontally
    const pos = {}; let maxY = 0;
    function place(id, x, y) {
      pos[id] = {x, y};
      maxY = Math.max(maxY, y + BH);
      const n = nodes[id]; if (!n || !n.children.length) return;
      const tot = n.children.reduce((s,c) => s + SW[c] + GX, 0) - GX;
      let cx = x + (BW - tot) / 2;
      n.children.forEach(c => { place(c, cx, y + BH + GY); cx += SW[c] + GX; });
    }
    let ry = PAD;
    roots.forEach(r => {
      // Centre each root tree horizontally based on its subtree width
      const startX = PAD + (SW[r] - BW) / 2;
      place(r, startX, ry);
      ry += treeH(r) + ROOT_SEP;
    });

    // Shift everything so no node has x < PAD (handles negative cx from wide subtrees)
    const minX = Math.min(...Object.values(pos).map(p => p.x));
    const shift = minX < PAD ? PAD - minX : 0;
    if (shift > 0) Object.keys(pos).forEach(id => { pos[id].x += shift; });

    const maxX = Math.max(...Object.values(pos).map(p => p.x + BW));
    const baseW = Math.max(maxX + PAD, 200);
    const baseH = maxY + PAD + 8;
    // Natural size × zoom — never forced to container width
    const W = Math.round(baseW * zoomScale);
    const H = Math.round(baseH * zoomScale);

    let s = `<svg id="live-svg" width="${W}" height="${H}" viewBox="0 0 ${baseW} ${baseH}" xmlns="http://www.w3.org/2000/svg">
<style>
  .dnd text { font-family:'DM Sans',sans-serif; font-size:9.5px; text-anchor:middle; dominant-baseline:central; pointer-events:none; }
  .edge { fill:none; stroke:#c8bfae; stroke-width:.9; }
  .dnd { cursor:pointer; }
  .dnd:hover rect { opacity:.88; }
</style>`;

    // Edges
    Object.keys(pos).forEach(id => {
      const n = nodes[id], p = pos[id]; if (!n) return;
      n.children.forEach(cid => {
        if (!pos[cid]) return;
        const c = pos[cid], x1=p.x+BW/2, y1=p.y+BH, x2=c.x+BW/2, y2=c.y, my=(y1+y2)/2;
        s += `<path class="edge" d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}"/>`;
      });
    });

    // Nodes
    Object.keys(pos).forEach(id => {
      const n = nodes[id]; if (!n) return;
      const {x,y} = pos[id], isSel = sel===id;
      const lbl = n.name.length > 14 ? n.name.slice(0,13)+'…' : n.name;
      const leaf = isLeaf(id);
      const fill = leaf ? '#fff' : n.color, tc = leaf ? n.color : '#fff';
      const cnt = countTagged(id);
      s += `<g class="dnd" onclick="Tree.selectNode('${id}')">
        <rect x="${x}" y="${y}" width="${BW}" height="${BH}"
          fill="${fill}" stroke="${n.color}" stroke-width="${isSel?2:.5}" rx="5"/>
        <text x="${x+BW/2}" y="${y+BH/2}" fill="${tc}" font-weight="${leaf?400:500}">
          ${lbl.replace(/</g,'&lt;').replace(/>/g,'&gt;')}${cnt ? ' ·'+cnt : ''}
        </text>
      </g>`;
    });

    s += '</svg>';
    wrap.innerHTML = s;
  }

  // ── Pan (drag to scroll) — wired ONCE at startup ─────
  function initPan() {
    const wrap = $('svg-wrap'); if (!wrap) return;
    let panning = false, startX, startY, scrollL, scrollT;

    wrap.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (e.target.closest && e.target.closest('.dnd')) return;
      panning = true;
      startX  = e.clientX;
      startY  = e.clientY;
      scrollL = wrap.scrollLeft;
      scrollT = wrap.scrollTop;
      wrap.classList.add('panning');
      e.preventDefault();
    });

    // Use document so fast drags don't lose tracking when mouse leaves wrap
    document.addEventListener('mousemove', e => {
      if (!panning) return;
      wrap.scrollLeft = scrollL - (e.clientX - startX);
      wrap.scrollTop  = scrollT - (e.clientY - startY);
    });

    document.addEventListener('mouseup', () => {
      if (!panning) return;
      panning = false;
      wrap.classList.remove('panning');
    });
  }

  function exportSVG() {
    const s = document.querySelector('#svg-wrap svg'); if (!s) { toast('No hay diagrama'); return; }
    // Export at base size (reset zoom in exported file)
    const blob = new Blob([s.outerHTML], {type:'image/svg+xml'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='clasificacion_textil.svg'; a.click();
    toast('SVG exportado ✓');
  }

  function render() { renderNav(); renderEditor(); renderDiagram(); }

  return {
    load, toPayload, addRoot, addChild, deleteNode, renameNode, setColor,
    selectNode, zoom, render, renderNav, renderDiagram, renderEditor, exportSVG,
    get nodes() { return nodes; },
    get roots() { return roots; },
    get sel()   { return sel; },
    allLeaves, pathOf, isLeaf, ancestors, topRoot
  };
})();
