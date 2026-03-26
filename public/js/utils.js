// ── utils.js ──
const $ = id => document.getElementById(id);

const toast = (() => {
  let _t;
  return (m, dur = 2200) => {
    const el = $('toast');
    el.textContent = m; el.classList.add('show');
    clearTimeout(_t);
    _t = setTimeout(() => el.classList.remove('show'), dur);
  };
})();

const rgba = (h, a) => {
  const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
};

const PAL = ['#c0385a','#2a8a7e','#1a6fa8','#d4650a','#6b45a8','#2e7d32','#b07a00','#006d6d','#7a3f2a','#445e6a'];

async function api(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

// Drag-to-resize panels
function initResizeHandle(handleId, targetId, direction) {
  const handle = $(handleId), target = $(targetId);
  if (!handle || !target) return;
  let startX, startW;
  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    startX = e.clientX;
    startW = target.offsetWidth;
    handle.classList.add('dragging');
    const move = e => {
      const dx = e.clientX - startX;
      const nw = direction === 'rtl' ? startW - dx : startW + dx;
      const min = parseInt(getComputedStyle(target).minWidth) || 160;
      const max = parseInt(getComputedStyle(target).maxWidth) || 700;
      target.style.width = Math.min(max, Math.max(min, nw)) + 'px';
    };
    const up = () => {
      handle.classList.remove('dragging');
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}
