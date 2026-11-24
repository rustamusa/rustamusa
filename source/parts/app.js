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

/* ---------- picture viewer ---------- */
const lb = $('#lb'); let view = [], idx = 0;
function openLB(list, i){ view = list; idx = i; showLB(); if (!lb.open) lb.showModal(); }
function showLB(){ const it = view[idx]; $('#lb-img').src = 'assets/img/' + it.k + '.webp'; $('#lb-img').alt = it.cap; $('#lb-cap').textContent = (idx + 1) + ' / ' + view.length + '  ' + it.cap; }
$('#lb-prev').onclick = () => { idx = (idx - 1 + view.length) % view.length; showLB(); };
$('#lb-next').onclick = () => { idx = (idx + 1) % view.length; showLB(); };
$('#lb-close').onclick = () => lb.close();
lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
document.addEventListener('keydown', e => { if (!lb.open) return; if (e.key === 'ArrowLeft') $('#lb-prev').click(); if (e.key === 'ArrowRight') $('#lb-next').click(); });
$$('[data-open]').forEach(f => f.addEventListener('click', () => { const it = byKey[f.dataset.open]; if (!it) return; const set = M.filter(m => m.biz === it.biz && m.grp === it.grp); openLB(set, set.indexOf(it)); }));
(function(){ let x0 = null; lb.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true }); lb.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) (dx < 0 ? $('#lb-next') : $('#lb-prev')).click(); x0 = null; }); })();

/* ---------- galleries on the business pages ---------- */
const PAGE = 18;
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
  let cur = 'all';
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

/* ---------- the month: four days on site, one workshop ---------- */
(function(){
  const g = $('#cal-grid'); if (!g) return;
  const site = [2, 9, 16, 23], shop = 25; let h = '';
  for (let d = 1; d <= 35; d++) {
    if (d > 31) { h += '<span></span>'; continue; }
    h += site.includes(d) ? '<span class="site">' + d + '<em>On site</em></span>' : d === shop ? '<span class="shop">' + d + '<em>Workshop</em></span>' : '<span>' + d + '</span>';
  }
  g.innerHTML = h;
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

/* ---------- menu on small screens ---------- */
const sheet = $('#sheetnav');
const menu = on => { sheet.classList.toggle('on', on); document.body.style.overflow = on ? 'hidden' : ''; if (on) $('#menu-close').focus(); };
$('#menu-open').addEventListener('click', () => menu(true));
$('#menu-close').addEventListener('click', () => { menu(false); $('#menu-open').focus(); });
sheet.addEventListener('click', e => { if (e.target.closest('a')) menu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheet.classList.contains('on')) { menu(false); $('#menu-open').focus(); } });

/* ---------- pages and anchors ---------- */
const VIEWS = ['home', 'about', 'design', 'nykhdc', 'cns', 'strikeforce', 'lconstruction'];
const OLD = { best: 'results', services: 'skills', 'contact-home': 'contact', volunteer: 'me-sec', firstday: 'how', what: 'loop', c1: 'nykhdc', c2: 'cns', c3: 'nykhdc', c4: 'strikeforce', c5: 'lconstruction', c6: 'work-app', stage: 'nykhdc', words: 'words' };
const NAV = { cover: 'loop', results: 'loop', nykhdc: 'work', cns: 'work', strikeforce: 'work', lconstruction: 'work', design: 'work', words: 'work' };
function mark(id){ const k = NAV[id] || id; $$('.nav a').forEach(a => { if (a.getAttribute('href') === '#' + k) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }); }
/* a link is a view (#cns) or any section inside a view (#faq opens About and scrolls there) */
function route(){
  let h = decodeURIComponent(location.hash.slice(1)); if (OLD[h]) h = OLD[h];
  let v, anchor = '';
  if (h === '' || h === 'home') v = 'home';
  else if (VIEWS.includes(h)) v = h;
  else { const el = document.getElementById(h), view = el && el.closest('.view'); if (view) { v = view.dataset.view; anchor = h; } else v = 'nf'; }
  const cur = $('.view.on'), same = cur && cur.dataset.view === v;
  const swap = () => $$('.view').forEach(el => el.classList.toggle('on', el.dataset.view === v));
  const land = () => {
    mark(anchor || v);
    if (anchor === 'review') $('#review').open = true;
    const el = anchor && anchor !== 'cover' ? document.getElementById(anchor) : null;
    if (el) { if (!same) window.scrollTo({ top: 0, behavior: 'instant' }); el.scrollIntoView({ behavior: same && !calm ? 'smooth' : 'instant', block: 'start' }); }
    else window.scrollTo({ top: 0, behavior: same && !calm ? 'smooth' : 'instant' });
  };
  if (same) return land();
  if (document.startViewTransition && cur && !calm) { const vt = document.startViewTransition(swap); vt.ready.catch(() => {}); vt.finished.catch(() => {}); vt.updateCallbackDone.then(land, () => { swap(); land(); }); } else { swap(); land(); }
}
addEventListener('hashchange', route); route();
/* keep the header link in step with what is on screen */
if ('IntersectionObserver' in window) {
  const spy = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && $('.view.on').dataset.view === 'home') mark(e.target.id); }), { rootMargin: '-45% 0px -50% 0px' });
  ['cover', 'results', 'loop', 'work', 'words', 'contact'].forEach(id => { const el = document.getElementById(id); if (el) spy.observe(el); });
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
    } catch (err) { msg.textContent = 'It did not send. Please call or text 917-943-6912.'; }
    btn.disabled = false;
  });
}
wire($('#revform'), $('#revmsg'), ['name', 'review'], d => ({ name: d.get('name'), business: d.get('business') || '', rating: (d.get('rating') || '5') + ' / 5', review: d.get('review'), ok_to_publish: d.get('ok_to_publish') ? 'yes' : 'no', _subject: 'New review on mycv4u.com' }), 'Thank you. The review is on its way.');
wire($('#shopform'), $('#shopmsg'), ['name', 'contact'], d => ({ name: d.get('name'), business: d.get('business') || '', contact: d.get('contact'), would_fix_first: d.get('problem') || '', language: d.get('language') || 'English', _subject: 'Workshop sign-up on mycv4u.com' }), 'Saved. The date and place will come by text.');

/* ---------- before and after: one slider moves every row ---------- */
(function(){
  const box = $('#ba'), r = $('#ba-range'); if (!box || !r) return;
  const rows = $$('.ba-rows li', box).map(li => ({ li, bar: $('.ba-bar i', li), b: +li.dataset.b, a: +li.dataset.a }));
  const set = t => { box.style.setProperty('--t', t); box.classList.toggle('after', t > .5);
    rows.forEach(o => { o.bar.style.width = (Math.max(o.b + (o.a - o.b) * t, 0) * 100).toFixed(2) + '%'; }); };
  r.addEventListener('input', () => { played = true; set(r.value / 100); });
  let played = false; set(0);
  /* once, when it comes into view: slide to after by itself, so the point is made without a touch */
  if (!calm && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (!es[0].isIntersecting || played) return; io.disconnect(); played = true;
      const t0 = performance.now() + 900, D = 1800; const step = now => { const u = Math.min(1, Math.max(0, (now - t0) / D)), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; r.value = Math.round(e * 100); set(e); if (u < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }, { threshold: .3 });
    io.observe(box);
  } else { r.value = 100; set(1); }
})();
