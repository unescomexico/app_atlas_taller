const express = require('express');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const TECNICAS_CSV  = path.join(DATA_DIR, 'tecnicas.csv');
const TAGS_CSV      = path.join(DATA_DIR, 'tags.csv');
const TREE_JSON     = path.join(DATA_DIR, 'tree.json');
const EDITS_JSON    = path.join(DATA_DIR, 'edits.json');
const EXPORT_CSV    = path.join(DATA_DIR, 'export.csv');

app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function readCSV(fp) {
  if (!fs.existsSync(fp)) return [];
  const txt = fs.readFileSync(fp, 'utf8').replace(/^\uFEFF/, '');
  return Papa.parse(txt, { header: true, skipEmptyLines: true }).data;
}
function writeCSV(fp, rows) {
  if (!rows.length) { fs.writeFileSync(fp, '', 'utf8'); return; }
  fs.writeFileSync(fp, '\uFEFF' + Papa.unparse(rows), 'utf8');
}
function readJSON(fp, def) {
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return def; }
}
function writeJSON(fp, data) {
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
}

function initDefaults() {
  if (!fs.existsSync(TREE_JSON)) {
    const tree = { roots: [], nodes: {} };
    function mk(nm, col, par) {
      const id = 'n' + Math.random().toString(36).slice(2, 8);
      tree.nodes[id] = { id, name: nm, color: col, parentId: par, children: [] };
      if (par) tree.nodes[par].children.push(id); else tree.roots.push(id);
      return id;
    }
    const man = mk('Manufactura','#c0385a',null);
    const bor = mk('Bordado','#c0385a',man);
    mk('Bordado a mano','#c0385a',bor); mk('Bordado a máquina','#c0385a',bor);
    const tej = mk('Tejido','#2a8a7e',man);
    mk('Tejido a mano','#2a8a7e',tej);
    const tel = mk('Telar','#1a6fa8',tej);
    mk('Telar de cintura','#1a6fa8',tel); mk('Telar de pedal','#1a6fa8',tel);
    const ten = mk('Teñido','#d4650a',null);
    mk('Plantas','#2a8a7e',ten); mk('Animales','#d4650a',ten); mk('Minerales','#1a6fa8',ten);
    writeJSON(TREE_JSON, tree);
  }
  if (!fs.existsSync(TAGS_CSV)) writeCSV(TAGS_CSV, []);
  if (!fs.existsSync(EDITS_JSON)) writeJSON(EDITS_JSON, {});
}
initDefaults();

app.get('/api/tecnicas', (req, res) => {
  const rows = readCSV(TECNICAS_CSV);
  const edits = readJSON(EDITS_JSON, {});
  res.json(rows.map(r => {
    const key = r.tecnica_norm || r.Tecnica || '';
    return edits[key] ? { ...r, ...edits[key], _edited: true } : r;
  }));
});

app.patch('/api/tecnicas/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const edits = readJSON(EDITS_JSON, {});
  edits[name] = { ...(edits[name] || {}), ...req.body, _lastEdited: new Date().toISOString() };
  delete edits[name]._edited;
  writeJSON(EDITS_JSON, edits);
  rebuildExportCSV();
  res.json({ ok: true });
});

app.get('/api/tree', (req, res) => res.json(readJSON(TREE_JSON, { roots: [], nodes: {} })));

app.put('/api/tree', (req, res) => {
  writeJSON(TREE_JSON, req.body);
  rebuildExportCSV();
  res.json({ ok: true, saved: new Date().toISOString() });
});

app.get('/api/tags', (req, res) => {
  const rows = readCSV(TAGS_CSV);
  const map = {};
  rows.forEach(r => {
    if (!r.tecnica || !r.node_id) return;
    if (!map[r.tecnica]) map[r.tecnica] = [];
    if (!map[r.tecnica].includes(r.node_id)) map[r.tecnica].push(r.node_id);
  });
  res.json(map);
});

app.put('/api/tags', (req, res) => {
  const rows = [];
  Object.entries(req.body || {}).forEach(([tecnica, nodeIds]) => {
    (nodeIds || []).forEach(node_id => rows.push({ tecnica, node_id }));
  });
  writeCSV(TAGS_CSV, rows);
  rebuildExportCSV();
  res.json({ ok: true, saved: new Date().toISOString() });
});

app.get('/api/export', (req, res) => {
  rebuildExportCSV();
  if (!fs.existsSync(EXPORT_CSV)) return res.status(500).json({ error: 'No se pudo generar el CSV' });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tecnicas_clasificadas.csv"');
  res.send(fs.readFileSync(EXPORT_CSV));
});

function rebuildExportCSV() {
  try {
    const rows = readCSV(TECNICAS_CSV);
    const edits = readJSON(EDITS_JSON, {});
    const tree = readJSON(TREE_JSON, { roots: [], nodes: {} });
    const tagsRows = readCSV(TAGS_CSV);
    const tagsMap = {};
    tagsRows.forEach(r => {
      if (!r.tecnica || !r.node_id) return;
      if (!tagsMap[r.tecnica]) tagsMap[r.tecnica] = [];
      tagsMap[r.tecnica].push(r.node_id);
    });
    function getPath(nodeId) {
      if (!tree.nodes[nodeId]) return '';
      const parts = []; let n = tree.nodes[nodeId];
      while (n) { parts.unshift(n.name); n = n.parentId ? tree.nodes[n.parentId] : null; }
      return parts.join(' > ');
    }
    function getRootName(nodeId) {
      if (!tree.nodes[nodeId]) return '';
      let n = tree.nodes[nodeId];
      while (n.parentId && tree.nodes[n.parentId]) n = tree.nodes[n.parentId];
      return n.name;
    }
    const out = rows.map(r => {
      const key = r.tecnica_norm || r.Tecnica || '';
      const merged = edits[key] ? { ...r, ...edits[key] } : { ...r };
      delete merged._edited; delete merged._lastEdited;
      const nodeIds = tagsMap[key] || [];
      merged.clasificacion_raices = [...new Set(nodeIds.map(getRootName))].join(' | ');
      merged.clasificacion_rutas  = nodeIds.map(getPath).join(' | ');
      merged.clasificacion_hojas  = nodeIds.map(id => tree.nodes[id]?.name || '').filter(Boolean).join(' | ');
      return merged;
    });
    writeCSV(EXPORT_CSV, out);
  } catch(e) { console.error('rebuildExportCSV:', e.message); }
}

app.listen(PORT, () => {
  console.log(`\n✅  Taller de Técnicas Textiles`);
  console.log(`   Abre en: http://localhost:${PORT}\n`);
});
