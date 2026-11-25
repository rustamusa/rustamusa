/* ---------- content that changes in one line ----------
   PORTRAIT: path to a photo, e.g. 'assets/img/portrait.webp'. Empty = the photo spots stay hidden.
   REELS: video clips. One object per clip. shape is 'v' for a vertical clip, 'h' for a wide one.
   A clip goes on the public site only with the owner's OK. */
const PORTRAIT = '';
/*REELS*/
/* GOOGLE_REVIEW: the "write a review" link of the Google Business Profile. Empty = the button stays hidden. */
const GOOGLE_REVIEW = '';

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const GROUPS = {
  nykhdc: [['site', 'Live site'], ['pages', 'Client pages'], ['studio', 'Kitchen Studio 3D'], ['drawings', 'Drawings'], ['builder', 'Builder in 3D'], ['renders', 'Client renders']],
  cns: [['renders', 'Renders'], ['sheets', 'Sheets']], sf: [['site', 'Sites']], lb: [['site', 'Site']]
};
const byKey = Object.fromEntries(M.map(m => [m.k, m]));
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- picture viewer: zoom, swipe, and Back closes it ---------- */
const lb = $('#lb'), lbImg = $('#lb-img'), lbStage = $('#lb-stage'), lbZoom = $('#lb-zoom'); let view = [], idx = 0, zoomed = false, lbTouch = 0;
const lbSrc = it => 'assets/img/' + it.k + '.webp';
/* zoom keeps the frame as it is and pans inside it; cx, cy = the point to keep under the finger */
function zoom(on, cx, cy){
  if (on === zoomed) return; zoomed = on;
  if (on) { const r = lbImg.getBoundingClientRect(), sw = lbStage.clientWidth, sh = lbStage.clientHeight, fx = cx == null ? .5 : (cx - r.left) / r.width, fy = cy == null ? .5 : (cy - r.top) / r.height;
    const z = Math.min(3, Math.max(1.8, lbImg.naturalWidth / r.width)), w = r.width * z, h = r.height * z;
    lbStage.style.width = sw + 'px'; lbStage.style.height = sh + 'px'; lbStage.classList.add('zoomed'); lbImg.style.width = w + 'px'; lbImg.style.height = h + 'px';
    lbStage.scrollLeft = Math.max(0, fx * w - sw / 2); lbStage.scrollTop = Math.max(0, fy * h - sh / 2); }
  else { lbStage.classList.remove('zoomed'); lbStage.style.width = lbStage.style.height = lbImg.style.width = lbImg.style.height = ''; }
  lbZoom.textContent = on ? '\u2212' : '+'; lbZoom.setAttribute('aria-pressed', on); lbZoom.setAttribute('aria-label', on ? 'Zoom out' : 'Zoom in');
}
function showLB(){ const it = view[idx]; zoom(false); if (lbImg.getAttribute('src') !== lbSrc(it)) lb.classList.add('wait'); lbImg.alt = it.cap; lbImg.src = lbSrc(it);
  $('#lb-cap').textContent = (idx + 1) + ' / ' + view.length + '  ' + it.cap;
  $('#lb-prev').hidden = $('#lb-next').hidden = view.length < 2;
  /* the pictures on both sides are ready before they are asked for */
  [-1, 1].forEach(d => { const n = view[(idx + d + view.length) % view.length]; if (n && n !== it) { const i = new Image(); i.src = lbSrc(n); } }); }
['load', 'error'].forEach(ev => lbImg.addEventListener(ev, () => lb.classList.remove('wait')));
/* opening adds a step to the history, so Back closes the picture and stays on the page */
function openLB(list, i){ view = list; idx = i; showLB(); if (!lb.open) { lb.showModal(); history.pushState(Object.assign({}, history.state, { lb: 1 }), ''); } }
lb.addEventListener('close', () => { zoom(false); if (history.state && history.state.lb) history.back(); });
addEventListener('popstate', () => { if (lb.open && !(history.state && history.state.lb)) lb.close(); });
const lbGo = d => { idx = (idx + d + view.length) % view.length; showLB(); };
$('#lb-prev').onclick = () => lbGo(-1);
$('#lb-next').onclick = () => lbGo(1);
$('#lb-close').onclick = () => lb.close();
lbZoom.onclick = () => zoom(!zoomed);
lbImg.addEventListener('dblclick', e => { if (Date.now() - lbTouch > 700) zoom(!zoomed, e.clientX, e.clientY); });
lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
document.addEventListener('keydown', e => { if (!lb.open) return; const k = e.key;
  if (k === 'ArrowLeft') lbGo(-1); else if (k === 'ArrowRight') lbGo(1);
  else if (k === 'Home') { idx = 0; showLB(); } else if (k === 'End') { idx = view.length - 1; showLB(); }
  else if (k === '+' || k === '=') zoom(true); else if (k === '-') zoom(false); });
$$('[data-open]').forEach(f => f.addEventListener('click', () => { const it = byKey[f.dataset.open]; if (!it) return; const set = M.filter(m => m.biz === it.biz && m.grp === it.grp); openLB(set, set.indexOf(it)); }));
/* touch: swipe sideways for the next picture, swipe down to close, tap twice to zoom; two fingers are left to the browser */
(function(){ let x0 = null, y0 = 0, multi = false, tap = 0, tx = 0, ty = 0;
  lb.addEventListener('touchstart', e => { multi = e.touches.length > 1; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  lb.addEventListener('touchmove', e => { if (e.touches.length > 1) multi = true; }, { passive: true });
  lb.addEventListener('touchend', e => { lbTouch = Date.now(); if (x0 === null) return; const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
    if (multi || (window.visualViewport && visualViewport.scale > 1.02)) return;
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) { const now = Date.now();
      if (e.target === lbImg && now - tap < 320 && Math.abs(t.clientX - tx) < 32 && Math.abs(t.clientY - ty) < 32) { tap = 0; zoom(!zoomed, t.clientX, t.clientY); }
      else { tap = now; tx = t.clientX; ty = t.clientY; }
      return; }
    if (zoomed) return;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2 && view.length > 1) lbGo(dx < 0 ? 1 : -1);
    else if (dy > 80 && dy > Math.abs(dx) * 1.5) lb.close(); }); })();

/* ---------- galleries on the business pages ---------- */
const PAGE = 6;
$$('.gal').forEach(g => {
  const biz = g.dataset.biz, groups = GROUPS[biz];
  const all = groups.flatMap(([k]) => M.filter(m => m.biz === biz && m.grp === k));
  let cur = 'all', shown = PAGE;
  const filters = document.createElement('div'); filters.className = 'filters'; filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', 'Filter pictures');
  const wall = document.createElement('div'); wall.className = 'wall' + (biz === 'cns' ? ' sheets' : '');
  const more = document.createElement('div'); more.className = 'more-btn';
  const list = () => cur === 'all' ? all : all.filter(m => m.grp === cur);
  function render(){
    const l = list(); wall.textContent = '';
    l.slice(0, shown).forEach((it, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Open: ' + it.cap);
      b.innerHTML = '<img loading="lazy" decoding="async" width="' + it.w + '" height="' + it.h + '" src="assets/thumb/' + it.k + '.webp" alt=""><span class="c"></span>';
      b.querySelector('.c').textContent = it.cap; b.onclick = () => openLB(l, i); wall.append(b);
    });
    more.textContent = '';
    if (l.length > shown) { const m = document.createElement('button'); m.type = 'button'; m.className = 'pill small'; m.innerHTML = '<span></span>'; m.firstChild.textContent = 'Show all ' + l.length; m.style.paddingRight = '18px'; m.onclick = () => { shown = 1e9; render(); }; more.append(m); }
  }
  if (groups.length > 1 || all.length > 6) {
    [['all', 'All']].concat(groups).forEach(([k, name]) => {
      const n = k === 'all' ? all.length : all.filter(m => m.grp === k).length; if (!n) return;
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-pressed', k === cur);
      b.innerHTML = name + '<small>' + n + '</small>';
      b.onclick = () => { cur = k; shown = PAGE; $$('button', filters).forEach(x => x.setAttribute('aria-pressed', x === b)); render(); };
      filters.append(b);
    });
    g.append(filters);
  }
  g.append(wall, more); render();
});

/* ---------- design gallery: renders and drawings, by category ---------- */
const CATS = [["cabs", "Elevator cabs", "Elevator cab interiors for CNS, rendered from the same model as the approval drawings."], ["drawings", "Shop drawings", "Dimensioned plans and elevations with cabinet codes, ready for the supplier."], ["kitchens", "Kitchens", "Full kitchens in 3D: layout, cabinets, island, colors. The client sees the finished room before the order goes in."], ["closets", "Closets and built-ins", "Closets, wardrobes and built-ins sized to the space."], ["countertops", "Countertops", "Stone layouts and shop drawings: pieces, seams, cut-outs and square footage."], ["doors", "Doors", "Entry, patio and interior doors drawn in place, with sizes and finishes the factory can build from."]];
const DES = CATS.flatMap(c => M.filter(m => m.cat === c[0]));
(function(){
  const g = $('.dgal'); if (!g) return;
  let cur = DES.some(m => m.cat === 'kitchens') ? 'kitchens' : 'all';
  const filters = document.createElement('div'); filters.className = 'filters'; filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', 'Pick a category');
  const note = document.createElement('p'); note.className = 'catnote';
  const grid = document.createElement('div'); grid.className = 'grid';
  const list = () => cur === 'all' ? DES : DES.filter(m => m.cat === cur);
  function render(){
    const l = list(); grid.textContent = '';
    const c = CATS.find(x => x[0] === cur); note.textContent = c ? c[2] : 'Every picture is from a real job. Client names, addresses and prices are removed.';
    l.forEach((it, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Open large: ' + it.cap);
      b.innerHTML = '<img loading="lazy" decoding="async" src="assets/thumb/' + it.k + '.webp" alt=""><span></span>';
      b.querySelector('span').textContent = it.cap; b.onclick = () => openLB(l, i); grid.append(b);
    });
  }
  [['all', 'All', '']].concat(CATS).forEach(([k, name]) => {
    const n = k === 'all' ? DES.length : DES.filter(m => m.cat === k).length; if (!n) return;
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-pressed', k === cur);
    b.innerHTML = name + '<small>' + n + '</small>';
    b.onclick = () => { cur = k; $$('button', filters).forEach(x => x.setAttribute('aria-pressed', x === b)); render(); };
    filters.append(b);
  });
  g.append(filters, note, grid); render();
})();

/* ---------- dot-matrix reveal: a picture starts as amber dots and resolves into itself ---------- */
function reveal(el){ el.classList.remove('raw'); setTimeout(() => { if (!el.classList.contains('raw')) el.classList.add('done'); }, 1500); }
function replay(el){ if (!el || calm) return; el.classList.remove('done'); el.classList.add('cut', 'raw'); void el.offsetWidth; el.classList.remove('cut'); requestAnimationFrame(() => requestAnimationFrame(() => reveal(el))); }
(function(){
  const all = $$('.dots.raw');
  if (calm || !('IntersectionObserver' in window)) { all.forEach(el => { el.classList.remove('raw'); el.classList.add('done'); }); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); reveal(e.target); } }), { threshold: .3 });
  all.forEach(el => io.observe(el));
})();

/* ---------- client pages: arrows for a mouse ---------- */
(function(){
  const row = $('#pages-row'); if (!row) return;
  const step = d => row.scrollBy({ left: d * (row.firstElementChild.offsetWidth + 16), behavior: calm ? 'auto' : 'smooth' });
  $('#pages-prev').addEventListener('click', () => step(-1)); $('#pages-next').addEventListener('click', () => step(1));
})();

/* ---------- six jobs, one on screen at a time ---------- */
const jobs = (function(){
  const strip = $('#tabs'); if (!strip) return null;
  const tabs = $$('[role=tab]', strip), panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));
  const count = $('#case-count'), next = $('#case-next'); let cur = 0;
  function show(i, by){
    cur = (i + tabs.length) % tabs.length;
    tabs.forEach((t, j) => { const on = j === cur; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; panels[j].hidden = !on; });
    if (count) count.textContent = (cur + 1) + ' / ' + tabs.length;
    if (next) next.firstElementChild.textContent = 'Next: ' + tabs[(cur + 1) % tabs.length].querySelector('b').textContent;
    if (strip.scrollWidth > strip.clientWidth) strip.scrollTo({ left: tabs[cur].offsetLeft - strip.offsetLeft - 20, behavior: calm ? 'auto' : 'smooth' });
    if (by) replay($('.dots', panels[cur]));
    if (by === 'key') tabs[cur].focus({ preventScroll: true });
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(i, 'tap'));
    t.addEventListener('keydown', e => { const k = e.key; if (k === 'ArrowRight' || k === 'ArrowDown') { e.preventDefault(); show(cur + 1, 'key'); } else if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); show(cur - 1, 'key'); } else if (k === 'Home') { e.preventDefault(); show(0, 'key'); } else if (k === 'End') { e.preventDefault(); show(tabs.length - 1, 'key'); } });
  });
  if (next) next.addEventListener('click', () => { show(cur + 1, 'tap'); const top = strip.getBoundingClientRect().top; if (top < 70 || top > innerHeight * .6) strip.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' }); });
  show(0);
  return { open: id => { const i = panels.findIndex(p => p.id === id); if (i < 0) return false; show(i, 'tap'); return true; }, ids: panels.map(p => p.id) };
})();

/* ---------- the live builder loads when asked ---------- */
(function(){
  const btn = $('#stage-load'); if (!btn) return;
  const v = $('#stage-view'), vid = $('#stage-video');
  btn.addEventListener('click', () => {
    const f = document.createElement('iframe'); f.src = 'planner/index.html'; f.title = 'Kitchen and countertop builder, live 3D';
    v.textContent = ''; v.classList.add('live'); v.append(f);
  });
  /* the recorded session plays only while it is on screen */
  if (vid && !calm && 'IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => { if (!vid.isConnected) return; if (e.isIntersecting) vid.play().catch(() => {}); else vid.pause(); }), { threshold: .35 }).observe(vid);
  else if (vid) vid.controls = true;
})();

/* ---------- loupe on drawings, for a mouse ---------- */
if (matchMedia('(hover: hover) and (pointer: fine)').matches) $$('[data-loupe]').forEach(el => {
  const img = $('img', el), lens = document.createElement('span'); lens.className = 'loupe'; lens.setAttribute('aria-hidden', 'true'); el.append(lens);
  const Z = 2.4;
  el.addEventListener('mousemove', e => {
    const r = img.getBoundingClientRect(), b = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height || el.classList.contains('raw')) { lens.style.display = 'none'; return; }
    lens.style.display = 'block'; lens.style.backgroundImage = 'url(' + el.dataset.loupe + ')';
    lens.style.backgroundSize = (r.width * Z) + 'px ' + (r.width * Z * img.naturalHeight / img.naturalWidth) + 'px';
    lens.style.backgroundPosition = (105 - x * Z) + 'px ' + (105 - y * Z) + 'px';
    lens.style.left = (e.clientX - b.left - 105) + 'px'; lens.style.top = (e.clientY - b.top - 105) + 'px';
  });
  el.addEventListener('mouseleave', () => { lens.style.display = 'none'; });
});

if (GOOGLE_REVIEW) { const g = $('#g-review'); g.href = GOOGLE_REVIEW; g.hidden = false; }

/* ---------- photo and video, when they exist ---------- */
if (PORTRAIT) {
  const w = $('#who'); w.querySelector('img').src = PORTRAIT; w.hidden = false;
  const p = $('#me-photo'); p.querySelector('img').src = PORTRAIT; p.hidden = false; $('#me').classList.remove('solo');
}
(function(){
  const sec = $('#reel'); if (!sec || !REELS.length) return;
  const all = [];
  REELS.forEach(r => {
    const fig = document.createElement('figure'); fig.className = 'reel'; fig.style.setProperty('--ar', r.shape === 'h' ? '16/9' : '720/1278');
    const v = document.createElement('video'); v.poster = r.poster || ''; v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none'; v.setAttribute('aria-label', r.title);
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Play: ' + r.title);
    b.innerHTML = '<span class="cap"><span class="play" aria-hidden="true"></span><span></span></span>'; b.querySelector('.cap span:last-child').textContent = r.title;
    b.addEventListener('click', () => {
      if (!v.src) v.src = r.src;
      if (v.paused) { all.forEach(o => { if (o.v !== v) { o.v.pause(); o.fig.classList.remove('playing'); } }); v.play().then(() => { fig.classList.add('playing'); b.setAttribute('aria-label', 'Pause: ' + r.title); }).catch(() => {}); }
      else { v.pause(); fig.classList.remove('playing'); b.setAttribute('aria-label', 'Play: ' + r.title); }
    });
    fig.append(v, b); all.push({ v, fig }); $(r.shape === 'h' ? '#reels-h' : '#reels-v').append(fig);
  });
  sec.hidden = false; ['#nav-reel', '#sheet-reel'].forEach(q => { const el = $(q); if (el) el.hidden = false; });
})();

/* ---------- the call key: a few sparks when it is pressed ---------- */
(function(){
  const b = $('#tact'); if (!b || calm) return;
  b.addEventListener('pointerdown', e => {
    const r = b.getBoundingClientRect();
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('span'), a = Math.random() * 6.283, d = 46 + Math.random() * 74; s.className = 'spark';
      s.style.cssText = '--x:' + (e.clientX - r.left) + 'px;--y:' + (e.clientY - r.top) + 'px;--dx:' + (Math.cos(a) * d).toFixed(1) + 'px;--dy:' + (Math.sin(a) * d).toFixed(1) + 'px';
      b.append(s); setTimeout(() => s.remove(), 760);
    }
  });
})();

/* ---------- menu on small screens: a dialog that leaves the page where it was ---------- */
const sheet = $('#sheetnav'), menuBtn = $('#menu-open'); let menuY = 0;
const menu = (on, back) => { if (on === sheet.classList.contains('on')) return;
  if (on) menuY = scrollY;
  sheet.classList.toggle('on', on); menuBtn.setAttribute('aria-expanded', on); document.documentElement.classList.toggle('locked', on);
  if (on) $('#menu-close').focus({ preventScroll: true });
  else if (back) { scrollTo({ top: menuY, behavior: 'instant' }); menuBtn.focus({ preventScroll: true }); } };
menuBtn.addEventListener('click', () => menu(true));
$('#menu-close').addEventListener('click', () => menu(false, true));
sheet.addEventListener('click', e => { if (e.target.closest('a')) menu(false); });
document.addEventListener('keydown', e => { if (!sheet.classList.contains('on')) return;
  if (e.key === 'Escape') return menu(false, true);
  if (e.key !== 'Tab') return;
  const f = $$('a[href], button', sheet).filter(el => !el.hidden && el.offsetParent); if (!f.length) return;
  const first = f[0], last = f[f.length - 1], at = document.activeElement;
  if (e.shiftKey && (at === first || !sheet.contains(at))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (at === last || !sheet.contains(at))) { e.preventDefault(); first.focus(); } });

/* ---------- pages and anchors ---------- */
const VIEWS = ['home', 'withai', 'teaching', 'feedback', 'about', 'design', 'nykhdc', 'cns', 'strikeforce', 'lconstruction'];
const OLD = { best: 'fixes', services: 'ai-edge', work: 'fixes', pages: 'nykhdc', builder: 'nykhdc', where: 'contact', skills: 'ai-edge', 'contact-home': 'contact', volunteer: 'me-sec', firstday: 'how', what: 'fixes', loop: 'fixes', c1: 'nykhdc', c2: 'cns', c3: 'nykhdc', c4: 'strikeforce', c5: 'lconstruction', c6: 'fixes', stage: 'nykhdc', words: 'words' };
const NAV = { cover: 'fixes', results: 'fixes', nykhdc: 'fixes', cns: 'fixes', strikeforce: 'fixes', lconstruction: 'fixes', design: 'fixes', 'me-sec': 'about', withai: 'ai-edge', 'ai-care': 'ai-edge', teaching: 'how', workshop: 'how', feedback: 'words', 'review-sec': 'words', review: 'words', faq: 'about', contact: 'about' };
function mark(id){ const k = NAV[id] || id; $$('.nav a').forEach(a => { if (a.getAttribute('href') === '#' + k) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }); }
/* a link is a view (#cns) or any section inside a view (#faq opens About and scrolls there).
   Every page has its own title. Back and Forward return to the place the visitor left. */
const TITLES = { nykhdc: 'NY Kitchen & Home Design Center', cns: 'CNS Elevator Cabs', strikeforce: 'Strike Force', lconstruction: 'L-Construction Group', withai: 'With AI', teaching: 'Teaching', feedback: 'Feedback', about: 'About', design: 'Renders and drawings', nf: 'Page not found' };
const HOME_TITLE = document.title;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
/* where each step of the history was left, kept for the tab's life */
const mem = (() => { let m = {}; try { m = JSON.parse(sessionStorage.getItem('rs-scroll') || '{}'); } catch (e) {}
  return { get: i => m[i], set: (i, y) => { m[i] = Math.round(y); try { sessionStorage.setItem('rs-scroll', JSON.stringify(m)); } catch (e) {} } }; })();
let hereI = null, hereHash = null, seq = Date.now() % 1e9, stk, booted = false;
addEventListener('scroll', () => { clearTimeout(stk); stk = setTimeout(() => { if (hereI !== null && location.hash === hereHash && !document.documentElement.classList.contains('locked')) mem.set(hereI, scrollY); }, 120); }, { passive: true });
function route(){
  let h = decodeURIComponent(location.hash.slice(1)); if (OLD[h]) h = OLD[h];
  let v, anchor = '';
  if (h === '' || h === 'home') v = 'home';
  else if (VIEWS.includes(h)) v = h;
  else { const el = document.getElementById(h), view = el && el.closest('.view'); if (view) { v = view.dataset.view; anchor = h; } else v = 'nf'; }
  /* a step that already has a number is one the visitor came back to */
  const st = history.state, back = !!(st && st.i != null), i = back ? st.i : ++seq;
  if (!back) history.replaceState(Object.assign({}, st, { i }), '');
  const y = back ? mem.get(i) : undefined;
  hereI = i; hereHash = location.hash;
  const cur = $('.view.on'), same = cur && cur.dataset.view === v;
  const swap = () => $$('.view').forEach(el => el.classList.toggle('on', el.dataset.view === v));
  const land = () => {
    mark(anchor || v); document.title = TITLES[v] ? TITLES[v] + ' | Rustam Shabanov' : HOME_TITLE;
    if (anchor === 'review') $('#review').open = true;
    const el = anchor && anchor !== 'cover' ? document.getElementById(anchor) : null;
    if (y != null) window.scrollTo({ top: y, behavior: 'instant' });
    else if (el) { if (!same) window.scrollTo({ top: 0, behavior: 'instant' }); el.scrollIntoView({ behavior: same && !calm ? 'smooth' : 'instant', block: 'start' }); }
    else window.scrollTo({ top: 0, behavior: same && !calm ? 'smooth' : 'instant' });
    /* a keyboard or a screen reader starts from the top of the new page */
    if (booted && !same) { const t = $('.view.on h1') || $('#main'); if (t) { t.tabIndex = -1; t.focus({ preventScroll: true }); } }
    booted = true;
  };
  if (same) return land();
  if (document.startViewTransition && cur && !calm) { const vt = document.startViewTransition(swap); vt.ready.catch(() => {}); vt.finished.catch(() => {}); vt.updateCallbackDone.then(land, () => { swap(); land(); }); } else { swap(); land(); }
}
addEventListener('hashchange', route); route();
/* skip link: straight to the content, without changing the address */
$('#skip').addEventListener('click', e => { e.preventDefault(); const m = $('#main'); m.focus({ preventScroll: true }); m.scrollIntoView({ block: 'start', behavior: 'instant' }); });
/* the bar at the bottom of a phone steps aside while a field is being filled */
document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('input:not([type=radio]):not([type=checkbox]), textarea')) document.body.classList.add('typing'); });
document.addEventListener('focusout', () => document.body.classList.remove('typing'));
/* keep the header link in step with what is on screen */
if ('IntersectionObserver' in window) {
  const spy = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && $('.view.on').dataset.view === 'home') mark(e.target.id); }), { rootMargin: '-45% 0px -50% 0px' });
  ['cover', 'fixes'].forEach(id => { const el = document.getElementById(id); if (el) spy.observe(el); });
}

/* ---------- copy phone or email ---------- */
$$('[data-copy]').forEach(b => { const label = b.textContent; b.onclick = async () => { const v = b.dataset.copy; try { await navigator.clipboard.writeText(v); b.textContent = 'Copied'; } catch (e) { b.textContent = v; } setTimeout(() => { b.textContent = label; }, 1800); }; });

/* ---------- forms go to email through FormSubmit; nothing is published automatically ---------- */
function wire(form, msg, need, build, done){
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const d = new FormData(form);
    if (need.some(k => !String(d.get(k) || '').trim())) { msg.textContent = 'Please fill in the fields above.'; return; }
    if (d.get('_honey')) return;
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true; msg.textContent = 'Sending…';
    try {
      const r = await fetch('https://formsubmit.co/ajax/rustam.shb@gmail.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(Object.assign({ _template: 'table', _captcha: 'false' }, build(d))) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && String(j.success) !== 'false') { form.reset(); msg.textContent = done; } else throw new Error('send');
    } catch (err) { msg.textContent = 'It did not send. Please use Call or WhatsApp.'; }
    btn.disabled = false;
  });
}
wire($('#revform'), $('#revmsg'), ['name', 'review'], d => ({ name: d.get('name'), business: d.get('business') || '', rating: (d.get('rating') || '5') + ' / 5', review: d.get('review'), ok_to_publish: d.get('ok_to_publish') ? 'yes' : 'no', _subject: 'New review on mycv4u.com' }), 'Thank you. The review is on its way.');
wire($('#shopform'), $('#shopmsg'), ['name', 'contact'], d => ({ name: d.get('name'), business: d.get('business') || '', contact: d.get('contact'), would_fix_first: d.get('problem') || '', language: d.get('language') || 'English', _subject: 'Workshop sign-up on mycv4u.com' }), 'Saved. The date and place will come by text.');

/* HOME: the businesses as tabs. Tap a tab or swipe the deck sideways. */
(() => { const deck = $('#deck'); if (!deck) return; const tabs = $$('.btabs .btab'), cards = [...deck.children], strip = $('.btabs'); let cur = 0, tk, hold = 0, busy = 0;
  const now = () => performance.now();
  /* the deck is as tall as the business on show, so nothing empty hangs under a shorter one */
  const fit = () => { const h = cards[cur].offsetHeight; if (h) deck.style.height = h + 'px'; };
  const set = i => { const moved = i !== cur; cur = i; tabs.forEach((t, k) => { t.classList.toggle('on', k === i); t.setAttribute('aria-selected', k === i ? 'true' : 'false'); t.tabIndex = k === i ? 0 : -1; }); fit();
    if (moved && strip.scrollWidth > strip.clientWidth + 2) strip.scrollTo({ left: tabs[i].offsetLeft - (strip.clientWidth - tabs[i].offsetWidth) / 2, behavior: calm ? 'instant' : 'smooth' }); };
  /* after a resize or a rotation the deck goes back to the business on show, never in the middle of a swipe */
  const anchor = () => { const w = deck.clientWidth; if (!w || now() < busy) return; if (Math.abs(deck.scrollLeft - cur * w) > 2) { hold = now() + 300; deck.scrollTo({ left: cur * w, behavior: 'instant' }); } };
  const go = (i, smooth) => { i = Math.max(0, Math.min(cards.length - 1, i)); set(i); const fly = smooth && !calm; busy = now() + (fly ? 800 : 0); hold = 0; deck.scrollTo({ left: i * deck.clientWidth, behavior: fly ? 'smooth' : 'instant' }); };
  tabs.forEach((t, i) => { t.addEventListener('click', () => go(i, true));
    t.addEventListener('keydown', e => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; e.preventDefault(); const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; go(n, true); tabs[n].focus(); }); });
  deck.addEventListener('scroll', () => { if (now() < hold) return; clearTimeout(tk); tk = setTimeout(() => { const w = deck.clientWidth; if (!w || now() < hold) return; const x = deck.scrollLeft / w, n = Math.round(x); if (Math.abs(x - n) > .04 && now() >= busy) return anchor(); set(n); }, 90); }, { passive: true });
  ['touchstart', 'touchmove', 'wheel', 'pointerdown'].forEach(ev => deck.addEventListener(ev, () => { busy = now() + 600; }, { passive: true }));
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(() => { anchor(); fit(); setTimeout(anchor, 350); }); ro.observe(deck); cards.forEach(c => ro.observe(c)); }
  addEventListener('load', fit); fit();
  const byHash = () => { const i = cards.findIndex(c => '#' + c.id === location.hash); if (i >= 0) go(i, false); };
  addEventListener('hashchange', byHash); byHash();
})();

/* ABOUT: every long section folds under its heading. A link to a section opens it. */
(() => { const v = $('.view[data-view=about]'); if (!v) return;
  const NAMES = { 'review-sec': 'Leave a review' };
  $$(':scope > section', v).forEach(sec => { if (!sec.id || sec.id === 'me-sec' || sec.id === 'contact') return;
    const h = sec.querySelector('h2'), box = sec.querySelector(':scope > .wrap') || sec, name = NAMES[sec.id] || (h && h.textContent.trim()); if (!name) return;
    const d = document.createElement('details'), s = document.createElement('summary'), body = document.createElement('div');
    d.className = 'fold'; body.className = 'fold-body'; s.textContent = name; while (box.firstChild) body.append(box.firstChild); d.append(s, body); box.append(d); sec.classList.add('folded');
    if (h && h.textContent.trim() === name) h.hidden = true; });
  const open = () => { const el = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1))); if (!el || !v.contains(el)) return;
    const inside = el.closest('details.fold'), f = inside || (el.matches('section') ? el.querySelector('details.fold') : null); if (!f || f.open) return; f.open = true;
    requestAnimationFrame(() => scrollTo({ top: el.getBoundingClientRect().top + scrollY - (inside ? 76 : 0), behavior: 'instant' })); };
  addEventListener('hashchange', open); open();
})();
