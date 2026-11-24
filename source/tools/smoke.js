// usage: node source/tools/smoke.js [siteDir] [reels|noreels]
// Behaviour checks for the built site on desktop and phone. The public build has no video wall: run it with noreels.
// PLAYWRIGHT and CHROME point at the playwright module and the browser when they are not in the default places.
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const SITE = process.argv[2] || path.join(__dirname, '../../site'), REELS = process.argv[3] || 'noreels';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, ''); let f = path.join(SITE, p || 'index.html');
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { r.writeHead(404); r.end('nf'); return; }
  const st = fs.statSync(f), range = q.headers.range;
  if (range) { const m = /bytes=(\d+)-(\d*)/.exec(range); const s = +m[1], e = m[2] ? +m[2] : st.size - 1; r.writeHead(206, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Content-Range': `bytes ${s}-${e}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': e - s + 1 }); fs.createReadStream(f, { start: s, end: e }).pipe(r); return; }
  r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Content-Length': st.size, 'Accept-Ranges': 'bytes' }); fs.createReadStream(f).pipe(r);
});
let pass = 0; const fails = [];
const ok = (name, cond, extra) => { if (cond) pass++; else fails.push(name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); };
const B = 'http://127.0.0.1:8793/';
(async () => {
  await new Promise(res => srv.listen(8793, res));
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const errs = [], missing = [];
  const open = async (opts) => { const ctx = await browser.newContext(opts); const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(B)) missing.push(r.status() + ' ' + r.url().replace(B, '')); });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => /fonts\.googleapis\.com/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'text/css', body: '' }) : r.abort()); return { ctx, page }; };
  const hash = async (page, h, wait = 900) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(wait); };
  const view = page => page.evaluate(() => document.querySelector('.view.on').dataset.view);
  const shown = page => page.evaluate(() => [...document.querySelectorAll('.case')].filter(c => !c.hidden).map(c => c.id).join(','));
  const noSide = page => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const topOf = (page, sel) => page.evaluate(s => Math.round(document.querySelector(s).getBoundingClientRect().top), sel);

  /* ================= desktop ================= */
  { const { ctx, page } = await open({ viewport: { width: 1440, height: 900 } });
    await page.goto(B, { waitUntil: 'load' }); await page.waitForTimeout(600);
    ok('home view is on', await view(page) === 'home');
    ok('headline says what this is', (await page.textContent('.hero h1')).replace(/\s+/g, ' ').trim() === 'Hands-on AI help for small businesses in New York.');
    ok('page title carries the same line', /hands-on AI help for small businesses in New York/i.test(await page.title()));
    ok('first screen holds headline, call button and results', await page.evaluate(() => ['.hero h1', '.hero-acts .pill.solid', '.proof'].every(q => { const r = document.querySelector(q).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })));
    ok('one main action on the first screen', await page.evaluate(() => document.querySelectorAll('.hero .pill.solid').length === 1 && document.querySelector('.hero .pill.solid').getAttribute('href') === 'tel:+19179436912'));
    ok('results card has four rows', await page.evaluate(() => document.querySelectorAll('.proof li a').length === 4));
    ok('no kitchen on the first screen', await page.evaluate(() => !document.querySelector('.hero canvas, .hero #stage3d') && !window.__hero && !window.THREE));
    ok('six kinds of work, each tied to a job', await page.evaluate(() => { const l = [...document.querySelectorAll('.svc li')]; return l.length === 6 && l.every(li => { const a = li.querySelector('a[href^="#"]'); return a && document.getElementById(a.getAttribute('href').slice(1)); }); }));
    ok('five common questions', await page.evaluate(() => document.querySelectorAll('.faq details').length === 5));
    ok('every in-page link has a target', await page.evaluate(() => { const views = [...document.querySelectorAll('.view')].map(v => v.dataset.view); return [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href').slice(1)).filter(h => h && !views.includes(h) && !document.getElementById(h)); }).then(b => b.length === 0 || (fails.push('dead links ' + b.join(',')), false)));
    const fam = await page.evaluate(() => { const set = new Set(), up = []; document.querySelectorAll('body *').forEach(e => { if (!e.childNodes.length || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return; const c = getComputedStyle(e); set.add(c.fontFamily.split(',')[0].replace(/["']/g, '').trim()); if (c.textTransform === 'uppercase') up.push(e.textContent.trim().slice(0, 20)); }); return { fams: [...set], up: up.slice(0, 5) }; });
    ok('one typeface on every page', fam.fams.length === 1 && fam.fams[0] === 'Geist', fam.fams);
    ok('no capitalised labels', fam.up.length === 0, fam.up);
    ok('typeface file is loaded', await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('600 20px Geist'); }));
    ok('footer has no leftover wording', await page.evaluate(() => !/\bSheets\b/.test(document.querySelector('.foot').textContent)));
    ok('no first-person copy', await page.evaluate(() => { const t = [...document.querySelectorAll('main *:not(blockquote):not(script)')].filter(e => !e.closest('blockquote') && e.children.length === 0).map(e => e.textContent).join(' \n '); return !/(^|[^A-Za-z])(I|I'm|I've|my|me|we|our)([^A-Za-z]|$)/.test(t.replace(/My CV/g, '')); }));
    /* the kitchen lives in job 1: it loads when the job is near, and draws only once it is on screen */
    await page.evaluate(() => { const r = document.querySelector('#stage3d').getBoundingClientRect(); scrollTo({ top: scrollY + r.top - innerHeight - 260, behavior: 'instant' }); });
    await page.waitForFunction(() => window.__hero, null, { timeout: 15000 }).catch(() => {});
    ok('kitchen loads as its job comes near', await page.evaluate(() => !!window.__hero && !!document.querySelector('#stage3d canvas')));
    await page.waitForTimeout(6500);
    ok('kitchen waits while it is off screen', await page.evaluate(() => +document.querySelector('#scrub').value === 0 && !document.querySelector('#stage').classList.contains('priced')), await page.evaluate(() => document.querySelector('#scrub').value));
    await page.evaluate(() => document.querySelector('#stage3d').scrollIntoView({ block: 'center', behavior: 'instant' })); await page.waitForTimeout(1500);
    ok('kitchen starts drawing once it is on screen', await page.evaluate(() => { const v = +document.querySelector('#scrub').value; return v > 0 && v < 1000; }), await page.evaluate(() => document.querySelector('#scrub').value));
    await page.waitForTimeout(5200);
    ok('kitchen finishes and shows the estimate', await page.evaluate(() => +document.querySelector('#scrub').value === 1000 && document.querySelector('#stage').classList.contains('priced')));
    await page.evaluate(() => window.__hero && window.__hero.set(1)); await page.waitForTimeout(500);
    ok('estimate card shows when built', await page.evaluate(() => document.querySelector('#stage').classList.contains('priced')));
    await page.evaluate(() => window.__hero && window.__hero.set(0.1)); await page.waitForTimeout(400);
    ok('estimate card hides on the plan', await page.evaluate(() => !document.querySelector('#stage').classList.contains('priced')));
    ok('scrub follows', await page.evaluate(() => +document.querySelector('#scrub').value === 100));
    ok('one job visible at start', await shown(page) === 'c1', await shown(page));
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(300);
    await page.click('.proof a[href="#c3"]'); await page.waitForTimeout(1400);
    ok('results row opens job 3', await shown(page) === 'c3', await shown(page));
    ok('tab 3 selected', await page.getAttribute('#t3', 'aria-selected') === 'true');
    ok('job strip scrolled into view', Math.abs(await topOf(page, '#tabs') - 76) < 60, await topOf(page, '#tabs'));
    await page.click('#t5'); await page.waitForTimeout(300); ok('tab click opens job 5', await shown(page) === 'c5');
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300); ok('arrow key moves to job 6', await shown(page) === 'c6');
    ok('focus follows the tab', await page.evaluate(() => document.activeElement.id === 't6'));
    await page.click('#case-next'); await page.waitForTimeout(500); ok('next wraps to job 1', await shown(page) === 'c1');
    ok('counter', (await page.textContent('#case-count')).trim() === '1 / 6');
    ok('next label names the next job', (await page.textContent('#case-next')).includes('Cab drawings'));
    await page.click('#t2'); await page.waitForTimeout(2400);
    ok('picture resolved from dots', await page.evaluate(() => { const s = document.querySelector('#c2 .shot'); return !s.classList.contains('raw') && s.classList.contains('done'); }));
    await page.click('#c2 .shot'); await page.waitForTimeout(400);
    ok('lightbox opens', await page.evaluate(() => document.querySelector('#lb').open));
    const s1 = await page.getAttribute('#lb-img', 'src'); ok('lightbox shows the picture', /cns-r3-01/.test(s1), s1);
    await page.click('#lb-next'); await page.waitForTimeout(200); ok('lightbox next', await page.getAttribute('#lb-img', 'src') !== s1);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300); ok('lightbox closes', await page.evaluate(() => !document.querySelector('#lb').open));
    await page.click('#t1'); await page.waitForTimeout(400);
    ok('kitchen is still there after switching jobs', await page.evaluate(() => { const c = document.querySelector('#stage3d canvas'); return !!c && c.getBoundingClientRect().width > 200; }));
    await page.click('#c1 .case-links a[href="#builder"]'); await page.waitForTimeout(1300);
    ok('try the builder scrolls to it', Math.abs(await topOf(page, '#builder') - 76) < 120, await topOf(page, '#builder'));
    await page.click('#stage-load'); await page.waitForTimeout(700);
    ok('live builder loads in a frame', await page.evaluate(() => { const f = document.querySelector('#stage-view iframe'); return !!f && /planner\/index\.html$/.test(f.src); }));
    await hash(page, 'pages', 1200); ok('client pages anchor', Math.abs(await topOf(page, '#pages')) < 90, await topOf(page, '#pages'));
    ok('five client pages', await page.evaluate(() => document.querySelectorAll('#pages-row .page').length === 5));
    const sl = await page.evaluate(() => document.querySelector('#pages-row').scrollLeft); await page.click('#pages-next'); await page.waitForTimeout(700);
    ok('pages arrow scrolls the row', await page.evaluate(() => document.querySelector('#pages-row').scrollLeft) > sl);
    await page.click('#pages-row .page:nth-child(2) .shot'); await page.waitForTimeout(300);
    ok('client page opens large', /cp-proposal-table/.test(await page.getAttribute('#lb-img', 'src'))); await page.click('#lb-close');
    for (const id of ['what', 'how', 'work', 'where', 'workshop', 'skills', 'words', 'about', 'faq', 'contact']) { await hash(page, id, 1100); ok('anchor #' + id, Math.abs(await topOf(page, '#' + id) - 76) < 90 || await page.evaluate(() => innerHeight + scrollY >= document.documentElement.scrollHeight - 4), await topOf(page, '#' + id)); }
    ok('map lists five places', await page.evaluate(() => document.querySelectorAll('.places li').length === 5));
    ok('calendar: 4 site days, 1 workshop', await page.evaluate(() => document.querySelectorAll('.cal-grid .site').length === 4 && document.querySelectorAll('.cal-grid .shop').length === 1));
    ok('nine skills', await page.evaluate(() => document.querySelectorAll('.skills li').length === 9));
    await hash(page, 'faq', 900); await page.click('.faq details:nth-child(2) summary'); await page.waitForTimeout(200);
    ok('a question opens', await page.evaluate(() => { const d = document.querySelector('.faq details:nth-child(2)'); return d.open && d.querySelector('p').getBoundingClientRect().height > 10; }));
    ok('form controls on pink cards are light', await page.evaluate(() => getComputedStyle(document.querySelector('#shopform input[type=radio]')).colorScheme.includes('light')));
    await hash(page, 'workshop', 900); await page.click('#shopform button[type=submit]'); await page.waitForTimeout(200);
    ok('workshop form asks for the missing fields', (await page.textContent('#shopmsg')).includes('fill in'));
    await hash(page, 'review', 900); ok('review link opens the form', await page.evaluate(() => document.querySelector('#review').open));
    await page.click('#revform button[type=submit]'); await page.waitForTimeout(200); ok('review form asks for the missing fields', (await page.textContent('#revmsg')).includes('fill in'));
    await hash(page, 'c6', 1200); ok('#c6 opens the client app job', await shown(page) === 'c6');
    ok('client initials are not in the page', await page.evaluate(() => !/\bDZ\b/.test(document.documentElement.innerHTML)));
    await hash(page, 'contact', 1000); await page.click('[data-copy="917-943-6912"]'); await page.waitForTimeout(200);
    ok('copy button confirms', ['Copied', '917-943-6912'].includes((await page.textContent('[data-copy="917-943-6912"]')).trim()));
    ok('call key dials', await page.getAttribute('#tact', 'href') === 'tel:+19179436912');
    const reels = await page.evaluate(() => document.querySelectorAll('.reel').length);
    if (REELS === 'reels') { ok('four clips', reels === 4, reels); ok('video section and nav link show', await page.evaluate(() => !document.querySelector('#reel').hidden && !document.querySelector('#nav-reel').hidden));
      await hash(page, 'reel', 1000); await page.click('.reel button'); await page.waitForTimeout(900); ok('a clip plays on tap', await page.evaluate(() => { const v = document.querySelector('.reel video'); return !!v.src && document.querySelector('.reel').classList.contains('playing'); }));
    } else { ok('no clips in the public build', reels === 0, reels); ok('video section and nav link stay hidden', await page.evaluate(() => document.querySelector('#reel').hidden && document.querySelector('#nav-reel').hidden)); ok('no clip file names in the page', !/reel-(countertop|cabinet-shop|elevator-cab|build-expo)/.test(fs.readFileSync(path.join(SITE, 'index.html'), 'utf8'))); }
    ok('home: no sideways scroll', await noSide(page) <= 0, await noSide(page));
    for (const [v, min] of [['nykhdc', 6], ['cns', 6], ['strikeforce', 3], ['lconstruction', 3]]) {
      await hash(page, v, 900); ok('page ' + v, await view(page) === v);
      ok(v + ': gallery has pictures', await page.evaluate(() => document.querySelectorAll('.view.on .wall button').length) >= min);
      ok(v + ': problem, fix, result', await page.evaluate(() => document.querySelectorAll('.view.on .pdc3 > div').length === 3 && !!document.querySelector('.view.on .pdc3 .now')));
      ok(v + ': no sideways scroll', await noSide(page) <= 0, await noSide(page)); ok(v + ': starts at the top', await page.evaluate(() => scrollY) < 5);
    }
    await hash(page, 'nykhdc', 700); const n0 = await page.evaluate(() => document.querySelectorAll('.view.on .wall button').length);
    await page.click('.view.on .filters button:nth-child(2)'); await page.waitForTimeout(200); ok('gallery filter narrows', await page.evaluate(() => document.querySelectorAll('.view.on .wall button').length) < n0);
    await page.click('.view.on .wall button'); await page.waitForTimeout(300); ok('gallery picture opens', await page.evaluate(() => document.querySelector('#lb').open)); await page.click('#lb-close');
    await page.click('.view.on .back'); await page.waitForTimeout(1000); ok('back returns to the overview', await view(page) === 'home');
    await hash(page, 'design', 900); ok('renders page', await view(page) === 'design');
    const d0 = await page.evaluate(() => document.querySelectorAll('.dgal .grid button').length); ok('renders page has pictures', d0 > 20, d0);
    await page.click('.dgal .filters button:nth-child(2)'); await page.waitForTimeout(200); ok('renders filter narrows', await page.evaluate(() => document.querySelectorAll('.dgal .grid button').length) < d0);
    ok('elevator cabs lead the renders', await page.evaluate(() => /cab/i.test(document.querySelector('.dgal .filters button:nth-child(2)').textContent)));
    for (const [old, want] of [['best', 'work'], ['services', 'skills'], ['firstday', 'how'], ['contact-home', 'contact'], ['volunteer', 'about']]) { await hash(page, old, 1800); ok('old link #' + old, await view(page) === 'home' && (Math.abs(await topOf(page, '#' + want) - 76) < 90 || await page.evaluate(() => innerHeight + scrollY >= document.documentElement.scrollHeight - 4))); }
    await hash(page, 'nothing-here', 700); ok('unknown link shows the not-found page', await view(page) === 'nf');
    await page.click('.nf a'); await page.waitForTimeout(800); ok('not-found leads home', await view(page) === 'home');
    ok('every local file answered', missing.length === 0, missing.slice(0, 5));
    await ctx.close(); }

  /* ================= desktop, reduced motion, pictures ================= */
  { const { ctx, page } = await open({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    await page.goto(B, { waitUntil: 'load' }); await page.waitForTimeout(400); await page.evaluate(() => document.querySelector('#stage3d').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForFunction(() => window.__hero, null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(900);
    ok('calm: pictures are not held as dots', await page.evaluate(() => document.querySelectorAll('.dots.raw').length === 0));
    ok('calm: kitchen is already built', await page.evaluate(() => document.querySelector('#stage').classList.contains('priced')));
    const bad = await page.evaluate(async () => { const out = []; for (const id of ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']) { location.hash = id; await new Promise(r => setTimeout(r, 250)); }
      const imgs = [...document.querySelectorAll('.view[data-view=home] img')].filter(i => i.getAttribute('src') && !i.closest('[hidden]')); imgs.forEach(i => { i.loading = 'eager'; });
      await Promise.all(imgs.map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 4000); })));
      imgs.forEach(i => { if (!i.naturalWidth) out.push(i.getAttribute('src')); }); return out; });
    ok('every home picture loads', bad.length === 0, bad);
    await ctx.close(); }

  /* ================= phone ================= */
  { const { ctx, page } = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(B, { waitUntil: 'load' }); await page.waitForTimeout(700);
    ok('phone: no sideways scroll', await noSide(page) <= 0, await noSide(page));
    ok('phone: headline and call button fit the first screen', await page.evaluate(() => { const d = document.querySelector('.dock').getBoundingClientRect().top; return ['.hero h1', '.hero-acts .pill.solid'].every(q => { const r = document.querySelector(q).getBoundingClientRect(); return r.top >= 0 && r.bottom <= d; }); }));
    ok('phone: dock is on screen', await page.evaluate(() => getComputedStyle(document.querySelector('.dock')).display !== 'none'));
    ok('phone: header nav is folded', await page.evaluate(() => getComputedStyle(document.querySelector('.nav')).display === 'none'));
    await page.tap('#menu-open'); await page.waitForTimeout(300); ok('phone: menu opens', await page.evaluate(() => document.querySelector('#sheetnav').classList.contains('on')));
    await page.tap('#sheetnav a[href="#where"]'); await page.waitForTimeout(1300);
    ok('phone: menu link closes the menu', await page.evaluate(() => !document.querySelector('#sheetnav').classList.contains('on') && document.body.style.overflow === ''));
    ok('phone: menu link goes to the section', Math.abs(await topOf(page, '#where') - 76) < 90, await topOf(page, '#where'));
    await hash(page, 'c1', 1200); await page.waitForFunction(() => window.__hero, null, { timeout: 15000 }).catch(() => {});
    ok('phone: kitchen loads in its job', await page.evaluate(() => !!document.querySelector('#stage3d canvas')));
    await page.evaluate(() => window.__hero && window.__hero.set(1)); await page.waitForTimeout(700);
    ok('phone: estimate sits under the kitchen, not over it', await page.evaluate(() => { const t = document.querySelector('.ticket').getBoundingClientRect(), g = document.querySelector('#stage3d').getBoundingClientRect(); return t.top >= g.bottom - 1 && t.width > 250 && getComputedStyle(document.querySelector('.ticket')).opacity === '1'; }));
    await hash(page, 'work', 1000); await page.tap('#t4'); await page.waitForTimeout(400); ok('phone: tab opens job 4', await shown(page) === 'c4');
    ok('phone: job strip scrolls sideways inside itself', await page.evaluate(() => { const t = document.querySelector('#tabs'); return t.scrollWidth > t.clientWidth; }));
    ok('phone: tap targets are big enough', await page.evaluate(() => [...document.querySelectorAll('.view.on a.pill, .view.on button.pill, .dock a, #menu-open, .tabs button, .chip, .rb')].filter(e => e.offsetParent).every(e => e.getBoundingClientRect().height >= 40)));
    for (const v of ['nykhdc', 'cns', 'strikeforce', 'lconstruction', 'design']) { await hash(page, v, 800); ok('phone ' + v + ': no sideways scroll', await noSide(page) <= 0, await noSide(page)); }
    await hash(page, 'home', 600);
    const small = await page.evaluate(() => { const out = []; document.querySelectorAll('.view.on *').forEach(e => { if (!e.offsetParent || e.children.length || !e.textContent.trim()) return; const f = parseFloat(getComputedStyle(e).fontSize); if (f < 10.5) out.push(e.tagName + ':' + f + ':' + e.textContent.trim().slice(0, 20)); }); return out.slice(0, 6); });
    ok('phone: no text under 10.5px', small.length === 0, small);
    await ctx.close(); }

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(`${pass} passed, ${fails.length} failed`); fails.forEach(f => console.log('  FAIL ' + f));
  await browser.close(); srv.close(); process.exit(fails.length ? 1 : 0);
})();
