// ── app.js ──
const App = (() => {
  let _techs = [];
  let _dirty = false;
  let _autoTimer = null;
  let _currentTab = 0;

  // ── Save state indicator ─────────────────────────────
  function markDirty() {
    _dirty = true;
    const s = $('save-status');
    if (s) { s.textContent = '● Sin guardar'; s.className = 'save-status dirty'; }
  }
  function markSaved() {
    _dirty = false;
    const now = new Date();
    const hm = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
    const s = $('save-status');
    if (s) { s.textContent = `✓ Guardado ${hm}`; s.className = 'save-status'; }
  }

  // ── Save ─────────────────────────────────────────────
  async function saveAll() {
    if (!_dirty) { toast('Sin cambios pendientes'); return; }
    const s = $('save-status');
    if (s) { s.textContent = '⟳ Guardando…'; s.className = 'save-status saving'; }
    try {
      await api('PUT', '/api/tree', Tree.toPayload());
      await Tags.save();
      markSaved();
      toast('✓ Todo guardado');
    } catch(e) {
      if (s) { s.textContent = '✗ Error'; s.className = 'save-status dirty'; }
      toast('Error al guardar: ' + e.message);
    }
  }

  function startAutosave() {
    _autoTimer = setInterval(() => { if (_dirty) saveAll(); }, 60000);
  }

  // ── Data loading ─────────────────────────────────────
  async function loadTechs() {
    try { _techs = await api('GET', '/api/tecnicas'); }
    catch(e) { toast('Error cargando técnicas: ' + e.message); _techs = []; }
    if (_currentTab === 1) renderV2();
  }

  // ── Tab switching ────────────────────────────────────
  function goTab(i) {
    _currentTab = i;
    document.querySelectorAll('.tab').forEach((b,j) => b.classList.toggle('on', i===j));
    $('v1').classList.toggle('on', i===0);
    $('v2').classList.toggle('on', i===1);
    if (i === 1) renderV2();
    else Tree.render();
  }

  // ── Render V2 ────────────────────────────────────────
  function renderV2() {
    Tags.renderDropPanel();
    Tags.renderFilters();
    Tags.renderStats(_techs);
    Tags.renderTechList(_techs);
    Tree.renderNav();          // refresh tag counts in tree
  }

  // ── Export ───────────────────────────────────────────
  async function downloadExport() {
    toast('Generando CSV…');
    if (_dirty) await saveAll();
    const a = document.createElement('a');
    a.href = '/api/export';
    a.download = 'tecnicas_clasificadas.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ── Init ─────────────────────────────────────────────
  async function init() {
    // Resize handles — col-tree expands right, col-diag and drop-col expand left
    initResizeHandle('rh-tree', 'col-tree', 'ltr');
    initResizeHandle('rh-diag', 'col-diag', 'rtl');
    initResizeHandle('rh-drop', 'drop-col', 'rtl');

    // Header buttons
    $('btn-save').addEventListener('click', saveAll);
    $('btn-add-root').addEventListener('click', () => Tree.addRoot());
    $('btn-add-root-2').addEventListener('click', () => Tree.addRoot());

    // Diagram zoom buttons
    const btnZoomIn  = $('btn-zoom-in');
    const btnZoomOut = $('btn-zoom-out');
    if (btnZoomIn)  btnZoomIn.addEventListener('click',  () => Tree.zoom(1.25));
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => Tree.zoom(0.8));

    // Search
    $('srch').addEventListener('input', () => Tags.renderTechList(_techs));

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveAll(); }
      if (e.key === 'Escape') Modal.closeModal();
    });

    // Load data
    await Tree.load();
    await Tags.load();
    await loadTechs();

    startAutosave();
    markSaved();
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    goTab, saveAll, markDirty, markSaved, loadTechs, renderV2, downloadExport,
    get _techs() { return _techs; },
    set _techs(v) { _techs = v; }
  };
})();
