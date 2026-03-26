// ── tags.js ──
const Tags = (() => {
  let tags = {};   // { techName: [nodeId, ...] }
  let flt = 'all';

  async function load()  { tags = await api('GET', '/api/tags'); }
  async function save()  { await api('PUT', '/api/tags', tags); }

  function addTag(techName, nodeId) {
    if (!tags[techName]) tags[techName] = [];
    if (!tags[techName].includes(nodeId)) { tags[techName].push(nodeId); App.markDirty(); }
  }
  function removeTag(techName, nodeId) {
    if (!tags[techName]) return;
    tags[techName] = tags[techName].filter(n => n !== nodeId);
    if (!tags[techName].length) delete tags[techName];
    App.markDirty();
  }
  function hasTags(nm)     { return !!(tags[nm] && tags[nm].length); }
  function getTagNodes(nm) { return (tags[nm]||[]).map(id => Tree.nodes[id]).filter(Boolean); }
  function setFilter(v)    { flt = v; renderFilters(); renderTechList(); }

  // ── Drop panel ────────────────────────────────────────
  function renderDropPanel() {
    const db = $('db'); if (!db) return;
    db.innerHTML = '';
    const leaves = Tree.allLeaves();
    if (!leaves.length) {
      db.innerHTML = '<div class="no-leaves">Define subcategorías hoja en ①</div>';
      return;
    }
    const byRoot = {};
    leaves.forEach(l => {
      const r = Tree.topRoot(l.id); if (!r) return;
      if (!byRoot[r.id]) byRoot[r.id] = [];
      byRoot[r.id].push(l);
    });
    Tree.roots.forEach(rid => {
      if (!byRoot[rid]) return;
      const rn = Tree.nodes[rid]; if (!rn) return;
      const hd = document.createElement('div');
      hd.className = 'dcat-hd';
      hd.innerHTML = `<span class="dot" style="background:${rn.color}"></span>${rn.name}`;
      db.appendChild(hd);
      byRoot[rid].forEach(leaf => {
        const asgnd = Object.entries(tags)
          .filter(([,arr]) => arr.includes(leaf.id))
          .map(([k]) => k);
        const dz = document.createElement('div');
        dz.className = 'dz'; dz.dataset.lid = leaf.id;
        // header
        const hdr = document.createElement('div');
        hdr.className = 'dz-nm';
        hdr.innerHTML = `<span style="background:${leaf.color};width:6px;height:6px;border-radius:50%;display:inline-block;flex-shrink:0"></span>${Tree.pathOf(leaf.id)}`;
        dz.appendChild(hdr);
        // assigned items
        if (asgnd.length) {
          asgnd.forEach(techName => {
            const row = document.createElement('div');
            row.className = 'mt';
            const span = document.createElement('span');
            span.className = 'mt-n'; span.textContent = techName;
            const btn = document.createElement('button');
            btn.className = 'mtrm'; btn.textContent = '✕';
            btn.addEventListener('click', () => { removeTag(techName, leaf.id); App.renderV2(); });
            row.appendChild(span); row.appendChild(btn);
            dz.appendChild(row);
          });
        } else {
          const em = document.createElement('div');
          em.className = 'dz-em'; em.textContent = 'Arrastra aquí';
          dz.appendChild(em);
        }
        dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('over'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('over'));
        dz.addEventListener('drop', e => {
          e.preventDefault(); dz.classList.remove('over');
          const nm = e.dataTransfer.getData('text'); if (!nm) return;
          addTag(nm, leaf.id);
          App.renderV2();
          toast(`✓ "${nm}" → ${leaf.name}`);
        });
        db.appendChild(dz);
      });
    });
  }

  // ── Filter chips ──────────────────────────────────────
  function renderFilters() {
    const fr = $('fr'); if (!fr) return;
    const leaves = Tree.allLeaves();
    fr.innerHTML = '';

    function chip(label, value, color) {
      const el = document.createElement('span');
      el.className = 'chip' + (flt === value ? ' on' : '');
      el.textContent = label;
      if (flt === value) {
        el.style.background = color || 'var(--text)';
        el.style.borderColor = color || 'var(--text)';
        el.style.color = '#fff';
      }
      el.addEventListener('click', () => setFilter(value));
      fr.appendChild(el);
    }
    chip('Todas',       'all',  null);
    chip('Sin clasificar', 'none', 'var(--a1)');
    leaves.forEach(l => chip(l.name, l.id, l.color));
  }

  // ── Stats ─────────────────────────────────────────────
  function renderStats(techs) {
    if (!techs || !techs.length) return;
    const tot  = techs.length;
    const asgn = techs.filter(t => hasTags(t.tecnica_norm)).length;
    const un   = tot - asgn;
    const pct  = Math.round(asgn / tot * 100);
    const pf = $('pf'); if (pf) pf.style.width = pct + '%';
    const pl = $('pl'); if (pl) pl.textContent = `${asgn} de ${tot} técnicas clasificadas (${pct}%)`;
    const sb = $('sbar');
    if (!sb) return;
    sb.innerHTML = '';
    [
      { v: tot,  l: 'Total',      col: null },
      { v: asgn, l: 'Clasificadas', col: 'var(--a2)' },
      { v: un,   l: 'Pendientes',   col: 'var(--a1)' },
    ].forEach(({v,l,col}) => {
      const d = document.createElement('div');
      d.className = 'sc';
      if (col) d.style.borderColor = col;
      d.innerHTML = `<div class="sc-v"${col?` style="color:${col}"`:''}>${v}</div><div class="sc-l">${l}</div>`;
      sb.appendChild(d);
    });
  }

  // ── Tech list ─────────────────────────────────────────
  function renderTechList(allTechs) {
    if (!allTechs) allTechs = App._techs || [];
    const q  = ($('srch')||{}).value || '';
    const ql = q.toLowerCase();
    let ts = allTechs;
    if (ql) ts = ts.filter(t =>
      (t.tecnica_norm||'').toLowerCase().includes(ql) ||
      (t.estados||'').toLowerCase().includes(ql)
    );
    if (flt === 'none')     ts = ts.filter(t => !hasTags(t.tecnica_norm));
    else if (flt !== 'all') ts = ts.filter(t => (tags[t.tecnica_norm]||[]).includes(flt));

    const cnt = $('tech-count'); if (cnt) cnt.textContent = ts.length;
    const el  = $('tl'); if (!el) return;
    el.innerHTML = '';

    if (!ts.length) {
      const p = document.createElement('p');
      p.style.cssText = 'font-size:.8rem;color:var(--muted);padding:9px';
      p.textContent = 'Sin resultados';
      el.appendChild(p);
      return;
    }

    ts.forEach(t => {
      const nm       = t.tecnica_norm;
      const tagNodes = getTagNodes(nm);
      const card     = document.createElement('div');
      card.className = 'tc' + (tagNodes.length ? ' has' : '');
      if (tagNodes.length) {
        card.style.background   = rgba(tagNodes[0].color, .06);
        card.style.borderColor  = rgba(tagNodes[0].color, .3);
      }
      card.draggable = true;
      card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text', nm);
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));

      // Info section
      const info = document.createElement('div');
      info.className = 'tc-info';
      const nameEl = document.createElement('div');
      nameEl.className = 'tn2'; nameEl.textContent = nm;
      const metaEl = document.createElement('div');
      metaEl.className = 'tm'; metaEl.textContent = t.estados || '—';
      info.appendChild(nameEl);
      info.appendChild(metaEl);

      // Tag pills
      if (tagNodes.length) {
        const pillRow = document.createElement('div');
        pillRow.className = 'tc-tags';
        tagNodes.forEach(n => {
          const pill = document.createElement('span');
          pill.className = 'tag-pill';
          pill.style.background = n.color;
          pill.textContent = n.name + ' ';
          const rm = document.createElement('button');
          rm.className = 'tag-pill-rm'; rm.textContent = '✕';
          rm.addEventListener('click', e => {
            e.stopPropagation();
            removeTag(nm, n.id);
            App.renderV2();
          });
          pill.appendChild(rm);
          pillRow.appendChild(pill);
        });
        info.appendChild(pillRow);
      }
      card.appendChild(info);

      // Action buttons
      const actions = document.createElement('div');
      actions.className = 'tc-actions';
      const fichaBtn = document.createElement('button');
      fichaBtn.className = 'tc-btn'; fichaBtn.title = 'Ver ficha'; fichaBtn.textContent = '📋';
      fichaBtn.addEventListener('click', () => Modal.open(nm));
      actions.appendChild(fichaBtn);
      card.appendChild(actions);

      el.appendChild(card);
    });
  }

  // ── Export JSON ───────────────────────────────────────
  function exportJSON() {
    const out = (App._techs||[]).map(t => ({
      tecnica: t.tecnica_norm,
      estados: t.estados,
      tags: getTagNodes(t.tecnica_norm).map(n => ({
        ruta: Tree.pathOf(n.id),
        hoja: n.name
      }))
    }));
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tecnicas_clasificadas.json';
    a.click();
    toast('JSON exportado ✓');
  }

  return {
    load, save, addTag, removeTag, hasTags, getTagNodes, setFilter,
    renderDropPanel, renderFilters, renderStats, renderTechList, exportJSON,
    get tags() { return tags; }
  };
})();
