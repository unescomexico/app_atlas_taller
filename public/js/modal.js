// ── modal.js ──
const Modal = (() => {
  let _charts = [], _tech = null;

  // ── Close ─────────────────────────────────────────────
  function closeModal() {
    const ov = $('modal-overlay'); if (!ov) return;
    ov.classList.remove('open');
    _charts.forEach(c => { try { c.destroy(); } catch(_){} });
    _charts = []; _tech = null;
  }

  // ── Open ─────────────────────────────────────────────
  async function open(techName) {
    const tech = (App._techs || []).find(t => t.tecnica_norm === techName);
    if (!tech) { toast('Técnica no encontrada: ' + techName); return; }
    _tech = tech;
    _charts.forEach(c => { try { c.destroy(); } catch(_){} });
    _charts = [];
    const ov = $('modal-overlay');
    if (ov) ov.classList.add('open');
    $('modal-inner').innerHTML = buildShell(tech);
    // Wire close button now that it exists in DOM
    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    // Wire save-edits button
    const saveBtn = document.getElementById('btn-save-edits');
    if (saveBtn) saveBtn.addEventListener('click', () => saveEdits(tech.tecnica_norm));
    // Render dynamic sections
    renderCharts(tech);
    renderTagSection(tech);
  }

  // ── Shell HTML (tabs + pane containers) ──────────────
  function buildShell(t) {
    return `
      <div class="modal-hd">
        <div>
          <div class="modal-title">${escHtml(t.tecnica_norm)}</div>
          <div class="modal-subtitle">${escHtml(t.estados || '—')}</div>
          ${t._edited ? '<span class="edited-badge">✏️ Datos editados</span>' : ''}
        </div>
        <button class="modal-close" id="modal-close-btn" title="Cerrar (Esc)">✕</button>
      </div>
      <div class="modal-tabs">
        <button class="modal-tab on"  onclick="Modal.switchTab(this,'ficha')">Ficha</button>
        <button class="modal-tab"     onclick="Modal.switchTab(this,'graficas')">Gráficas</button>
        <button class="modal-tab"     onclick="Modal.switchTab(this,'clasificacion')">Clasificación</button>
        <button class="modal-tab"     onclick="Modal.switchTab(this,'editar')">Editar datos</button>
      </div>
      <div class="modal-pane on" id="pane-ficha">${buildFicha(t)}</div>
      <div class="modal-pane"    id="pane-graficas">${buildGraficasShell(t)}</div>
      <div class="modal-pane"    id="pane-clasificacion"><div id="tag-section-wrap"></div></div>
      <div class="modal-pane"    id="pane-editar">${buildEditar(t)}</div>
    `;
  }

  function switchTab(btn, pane) {
    document.querySelectorAll('.modal-tab').forEach(b => b.classList.remove('on'));
    document.querySelectorAll('.modal-pane').forEach(p => p.classList.remove('on'));
    btn.classList.add('on');
    $('pane-' + pane).classList.add('on');
    if (pane === 'clasificacion' && _tech) renderTagSection(_tech);
    if (pane === 'graficas') {
      if (!_charts.length && _tech) renderCharts(_tech);
      setTimeout(() => _charts.forEach(c => c && c.update && c.update()), 80);
    }
  }

  // ── Helpers ───────────────────────────────────────────
  function escHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fv(x) { return (x===''||x==null) ? '—' : x; }
  function fp(x) { return parseFloat(x) > 0 ? x : null; }

  // ── Ficha tab ─────────────────────────────────────────
  function buildFicha(t) {
    const aprendio = [
      ['Madre',t.n_aprendio_madre],['Abuela',t.n_aprendio_abuela],
      ['Tía',t.n_aprendio_tia],['Hermana',t.n_aprendio_hermana],
      ['Cuñada',t.n_aprendio_cunada],['Instructor/a',t.n_aprendio_instructor],
      ['Padre',t.n_aprendio_padre],['Otro',t.n_aprendio_otro]
    ].filter(([,x])=>fp(x)).map(([k,x])=>`${k}(${parseInt(x)})`).join(', ') || '—';

    const ensenado = [
      ['Hijas',t.n_ens_hijas],['Hijos',t.n_ens_hijos],
      ['Nietos/as',t.n_ens_nietos],['Sobrinos/as',t.n_ens_sobrinos],
      ['Pareja',t.n_ens_pareja],['Estudiantes',t.n_ens_estudiantes],['Otra',t.n_ens_otra]
    ].filter(([,x])=>fp(x)).map(([k,x])=>`${k}(${parseInt(x)})`).join(', ') || '—';

    function stat(label, val, style='') {
      return `<div class="ficha-stat">
        <span class="ficha-stat-lbl">${label}</span>
        <span class="ficha-stat-val"${style?` style="${style}"`:''}>${escHtml(String(fv(val)))}</span>
      </div>`;
    }
    return `
      <div class="ficha-grid">
        <div class="ficha-card"><h5>Datos generales</h5>
          ${stat('Fichas', t.n_fichas)}
          ${stat('Mujeres', t.n_mujeres)}
          ${stat('Hombres', t.n_hombres)}
          ${stat('Edad promedio', t.edad_prom ? parseFloat(t.edad_prom).toFixed(1) : null)}
          ${stat('Estados', t.estados, 'font-size:.74rem;text-align:right;max-width:62%')}
        </div>
        <div class="ficha-card"><h5>Contexto de uso</h5>
          ${stat('Ceremonia principal', t.ceremonia_principal, 'font-size:.75rem;text-align:right;max-width:62%')}
          ${stat('Prenda principal', t.prenda_principal, 'font-size:.75rem;text-align:right;max-width:62%')}
        </div>
        <div class="ficha-card"><h5>Transmisión del conocimiento</h5>
          ${stat('Aprendió de', aprendio, 'font-size:.73rem;text-align:right')}
          ${stat('Ha enseñado a', ensenado, 'font-size:.73rem;text-align:right')}
          ${stat('No ha enseñado', t.n_no_ha_ensenado)}
        </div>
        <div class="ficha-card"><h5>Teñido (# practicantes)</h5>
          ${stat('Plantas', t.n_tenido_plantas)}
          ${stat('Minerales', t.n_tenido_minerales)}
          ${stat('Animales', t.n_tenido_animales)}
          ${stat('Otro', t.n_tenido_otro)}
        </div>
      </div>
      ${t.Materiales_concat_clean ? `<div class="ficha-card" style="margin-bottom:12px">
        <h5>Materiales reportados</h5>
        <p style="font-size:.82rem;line-height:1.65">${escHtml(t.Materiales_concat_clean)}</p>
      </div>` : ''}
      ${t.prendas_resumen ? `<div class="ficha-card">
        <h5>Prendas registradas</h5>
        <p style="font-size:.8rem;line-height:1.65">${escHtml(t.prendas_resumen)}</p>
      </div>` : ''}
    `;
  }

  // ── Gráficas tab ──────────────────────────────────────
  function buildGraficasShell(t) {
    const f = v => parseFloat(v)||0;
    const hasGen   = f(t.n_mujeres)+f(t.n_hombres) > 0;
    const hasMan   = [t.n_man_mano,t.n_man_pedal,t.n_man_telar,t.n_man_mixta,t.n_man_otra,t.n_man_tejido,t.n_man_telar_pedal].some(v=>f(v)>0);
    const hasTrans = [t.n_aprendio_madre,t.n_aprendio_abuela,t.n_aprendio_tia,t.n_aprendio_hermana,t.n_aprendio_instructor,t.n_aprendio_padre,t.n_aprendio_cunada,t.n_aprendio_otro].some(v=>f(v)>0);
    if (!hasGen && !hasMan && !hasTrans) {
      return '<p style="font-size:.85rem;color:var(--muted);padding:20px">Sin datos numéricos para esta técnica</p>';
    }
    return `
      ${hasGen   ? '<div class="chart-wrap"><h5>Género de practicantes</h5><canvas id="chart-gen" height="160"></canvas></div>' : ''}
      ${hasMan   ? '<div class="chart-wrap"><h5>Herramienta / manufactura (# practicantes)</h5><canvas id="chart-man" height="180"></canvas></div>' : ''}
      ${hasTrans ? '<div class="chart-wrap"><h5>¿De quién aprendió? (# practicantes)</h5><canvas id="chart-trans" height="180"></canvas></div>' : ''}
    `;
  }

  function renderCharts(t) {
    const f = v => parseFloat(v)||0;
    const base = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position:'bottom', labels:{ font:{size:11}, boxWidth:12, padding:10 } } }
    };
    const bar = {
      ...base,
      plugins: { legend:{ display:false } },
      scales: {
        y: { beginAtZero:true, ticks:{ stepSize:1, font:{size:11} }, grid:{ color:'#e8e0d0' } },
        x: { ticks:{ font:{size:11} }, grid:{ display:false } }
      }
    };

    const gc = $('chart-gen');
    if (gc && f(t.n_mujeres)+f(t.n_hombres)>0) {
      _charts.push(new Chart(gc, { type:'doughnut', data:{
        labels:['Mujeres','Hombres'],
        datasets:[{ data:[f(t.n_mujeres),f(t.n_hombres)], backgroundColor:['#c0385a','#1a6fa8'], borderWidth:0 }]
      }, options:base }));
    }

    const mc = $('chart-man');
    if (mc) {
      const md = [
        {l:'A mano',v:f(t.n_man_mano)},{l:'Pedal',v:f(t.n_man_pedal)},
        {l:'Telar',v:f(t.n_man_telar)},{l:'T.pedal',v:f(t.n_man_telar_pedal)},
        {l:'Tejido',v:f(t.n_man_tejido)},{l:'Mixta',v:f(t.n_man_mixta)},{l:'Otra',v:f(t.n_man_otra)}
      ].filter(d=>d.v>0);
      if (md.length) _charts.push(new Chart(mc, { type:'bar', data:{
        labels:md.map(d=>d.l),
        datasets:[{data:md.map(d=>d.v),backgroundColor:'#2a8a7e',borderRadius:4,borderSkipped:false}]
      }, options:bar }));
    }

    const tc = $('chart-trans');
    if (tc) {
      const td = [
        {l:'Madre',v:f(t.n_aprendio_madre)},{l:'Abuela',v:f(t.n_aprendio_abuela)},
        {l:'Tía',v:f(t.n_aprendio_tia)},{l:'Hermana',v:f(t.n_aprendio_hermana)},
        {l:'Instructor/a',v:f(t.n_aprendio_instructor)},{l:'Padre',v:f(t.n_aprendio_padre)},
        {l:'Cuñada',v:f(t.n_aprendio_cunada)},{l:'Otro',v:f(t.n_aprendio_otro)}
      ].filter(d=>d.v>0);
      if (td.length) _charts.push(new Chart(tc, { type:'bar', data:{
        labels:td.map(d=>d.l),
        datasets:[{data:td.map(d=>d.v),backgroundColor:'#d4650a',borderRadius:4,borderSkipped:false}]
      }, options:bar }));
    }
  }

  // ── Clasificación tab ─────────────────────────────────
  function renderTagSection(tech) {
    const wrap = $('tag-section-wrap'); if (!wrap) return;
    const nm       = tech.tecnica_norm;
    const leaves   = Tree.allLeaves();
    const currIds  = Tags.tags[nm] || [];

    wrap.innerHTML = '';

    // Current tags
    const sec1 = document.createElement('div'); sec1.className = 'tags-section';
    const h1 = document.createElement('h5'); h1.textContent = 'Clasificaciones actuales';
    const cloud = document.createElement('div'); cloud.className = 'tags-cloud';
    if (currIds.length) {
      currIds.forEach(id => {
        const n = Tree.nodes[id]; if (!n) return;
        const pill = document.createElement('span');
        pill.className = 'tag-pill'; pill.style.background = n.color;
        pill.textContent = Tree.pathOf(id) + ' ';
        const rm = document.createElement('button');
        rm.className = 'tag-pill-rm'; rm.textContent = '✕';
        rm.addEventListener('click', () => { Tags.removeTag(nm, id); Modal.open(nm); App.renderV2(); });
        pill.appendChild(rm); cloud.appendChild(pill);
      });
    } else {
      const empty = document.createElement('span');
      empty.style.cssText = 'font-size:.78rem;color:var(--muted)';
      empty.textContent = 'Sin clasificación aún';
      cloud.appendChild(empty);
    }
    sec1.appendChild(h1); sec1.appendChild(cloud);
    wrap.appendChild(sec1);

    // Add new tags
    const available = leaves.filter(l => !currIds.includes(l.id));
    const sec2 = document.createElement('div'); sec2.className = 'tags-section';
    const h2 = document.createElement('h5'); h2.textContent = 'Agregar clasificación';
    const row = document.createElement('div'); row.className = 'tag-add-row';
    if (available.length) {
      available.forEach(l => {
        const btn = document.createElement('button');
        btn.className = 'tag-add-btn';
        btn.style.borderColor = l.color; btn.style.color = l.color;
        btn.textContent = '+ ' + Tree.pathOf(l.id);
        btn.addEventListener('click', () => { Tags.addTag(nm, l.id); Modal.open(nm); App.renderV2(); });
        row.appendChild(btn);
      });
    } else {
      const p = document.createElement('p');
      p.style.cssText = 'font-size:.78rem;color:var(--muted)';
      p.textContent = 'Todas las categorías ya están asignadas';
      row.appendChild(p);
    }
    sec2.appendChild(h2); sec2.appendChild(row);
    wrap.appendChild(sec2);
  }

  // ── Editar tab ────────────────────────────────────────
  function buildEditar(t) {
    const s = v => escHtml(v == null ? '' : String(v));
    return `
      <div class="edit-grid">
        <div class="edit-fld"><label>Nombre normalizado</label><input data-field="tecnica_norm" value="${s(t.tecnica_norm)}"></div>
        <div class="edit-fld"><label>Estados</label><input data-field="estados" value="${s(t.estados)}"></div>
        <div class="edit-fld"><label>Fichas (#)</label><input type="number" data-field="n_fichas" value="${s(t.n_fichas)}"></div>
        <div class="edit-fld"><label>Mujeres (#)</label><input type="number" data-field="n_mujeres" value="${s(t.n_mujeres)}"></div>
        <div class="edit-fld"><label>Hombres (#)</label><input type="number" data-field="n_hombres" value="${s(t.n_hombres)}"></div>
        <div class="edit-fld"><label>Edad promedio</label><input type="number" step="0.1" data-field="edad_prom" value="${s(t.edad_prom)}"></div>
        <div class="edit-fld"><label>Ceremonia principal</label><input data-field="ceremonia_principal" value="${s(t.ceremonia_principal)}"></div>
        <div class="edit-fld"><label>Prenda principal</label><input data-field="prenda_principal" value="${s(t.prenda_principal)}"></div>
        <div class="edit-fld full"><label>Materiales</label><textarea data-field="Materiales_concat_clean">${s(t.Materiales_concat_clean)}</textarea></div>
        <div class="edit-fld full"><label>Prendas (resumen)</label><textarea data-field="prendas_resumen">${s(t.prendas_resumen)}</textarea></div>
        <div class="edit-fld full"><label>Ceremonias (resumen)</label><textarea data-field="ceremonias_resumen">${s(t.ceremonias_resumen)}</textarea></div>
      </div>
      <div class="edit-save-row">
        <button class="btn btn-p" id="btn-save-edits">💾 Guardar cambios</button>
        <button class="btn btn-s" onclick="Modal.closeModal()">Cancelar</button>
      </div>
    `;
  }

  async function saveEdits(techName) {
    const inputs = document.querySelectorAll('#pane-editar [data-field]');
    const patch = {};
    inputs.forEach(inp => { patch[inp.dataset.field] = inp.value; });
    try {
      await api('PATCH', '/api/tecnicas/' + encodeURIComponent(techName), patch);
      const idx = (App._techs||[]).findIndex(t => t.tecnica_norm === techName);
      if (idx !== -1) App._techs[idx] = { ...App._techs[idx], ...patch, _edited: true };
      _tech = idx !== -1 ? App._techs[idx] : _tech;
      toast('✓ Cambios guardados');
      App.renderV2();
    } catch(e) { toast('Error al guardar: ' + e.message); }
  }

  // Overlay click → close
  document.addEventListener('DOMContentLoaded', () => {
    const ov = $('modal-overlay');
    if (ov) ov.addEventListener('click', e => { if (e.target === ov) closeModal(); });
  });

  return { open, closeModal, switchTab, renderTagSection, saveEdits };
})();
