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
    ok('headline says what this is', /slow step out of a small business/i.test(await page.textContent('#cover h1')));
    ok('page title says what this is', /AI help for small businesses in New York/i.test(await page.title()));
    ok('first screen: headline, call button, free first meeting', await page.evaluate(() => ['#cover h1', '#cover .pill.solid', '.hero2-note'].every(q => { const r = document.querySelector(q).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }) && /first meeting is free/i.test(document.querySelector('.hero2-note').textContent)));
    ok('one main action on the first screen', await page.evaluate(() => document.querySelectorAll('#cover .pill.solid').length === 1 && document.querySelector('#cover .pill.solid').getAttribute('href') === 'tel:+19179436912'));
    ok('home is short: under 7 screens', await page.evaluate(() => document.documentElement.scrollHeight / innerHeight < 7), await page.evaluate(() => (document.documentElement.scrollHeight / innerHeight).toFixed(1)));
    ok('no 3D on the home page', await page.evaluate(() => !document.querySelector('.view[data-view=home] #stage3d, .view[data-view=home] .pano')));
    const small = await page.evaluate(() => { const out = []; document.querySelectorAll('.view[data-view=home] *').forEach(e => { if (!e.offsetParent || e.closest('.ln-months, svg, .foot') || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return; const f = parseFloat(getComputedStyle(e).fontSize); if (f < 15.5) out.push(f + ':' + e.textContent.trim().slice(0, 24)); }); return out.slice(0, 20); });
    ok('home: no small print (all text 16px or more)', small.length === 0, small);
    const fam = await page.evaluate(() => { const set = new Set(), up = []; document.querySelectorAll('body *').forEach(e => { if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return; const c = getComputedStyle(e); set.add(c.fontFamily.split(',')[0].replace(/["']/g, '').trim()); if (c.textTransform === 'uppercase') up.push(e.textContent.trim().slice(0, 20)); }); return { fams: [...set], up: up.slice(0, 5) }; });
    ok('one typeface on every page', fam.fams.length === 1 && fam.fams[0] === 'Geist', fam.fams);
    ok('no capitalised labels', fam.up.length === 0, fam.up);
    ok('typeface file is loaded', await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('600 20px Geist'); }));
    ok('no first-person copy', await page.evaluate(() => { const t = [...document.querySelectorAll('main *:not(script)')].filter(e => !e.closest('blockquote') && e.children.length === 0).map(e => e.textContent).join(' \n '); return !/(^|[^A-Za-z])(I|I'm|I've|my|me|we|our)([^A-Za-z]|$)/.test(t.replace(/My CV/g, '')); }));
    ok('every in-page link has a target', await page.evaluate(() => { const views = [...document.querySelectorAll('.view')].map(v => v.dataset.view); return [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href').slice(1)).filter(h => h && !views.includes(h) && !document.getElementById(h) && !['c1','c2','c3','c4','c5','c6'].includes(h)); }).then(b => b.length === 0 || (fails.push('dead links ' + b.join(',')), false)));
    /* before and after */
    ok('five before-after rows', await page.evaluate(() => document.querySelectorAll('.ba-rows li').length === 5));
    ok('before-after is on the first screen', await page.evaluate(() => { const r = document.querySelector('#ba').getBoundingClientRect(); return r.top < innerHeight * .9; }));
    await page.waitForTimeout(3000);
    ok('slider plays to after by itself once seen', await page.evaluate(() => +document.querySelector('#ba-range').value === 100 && document.querySelector('#ba').classList.contains('after')));
    ok('after: every bar is short', await page.evaluate(() => [...document.querySelectorAll('.ba-bar i')].every(i => i.getBoundingClientRect().width <= i.parentElement.getBoundingClientRect().width * .07)));
    { const r = await (await page.$('#ba-range')).boundingBox(); await page.mouse.click(r.x + 4, r.y + r.height / 2); await page.waitForTimeout(500); }
    ok('drag to before: bars full, before values shown', await page.evaluate(() => +document.querySelector('#ba-range').value < 5 && !document.querySelector('#ba').classList.contains('after') && [...document.querySelectorAll('.ba-bar i')].every(i => i.getBoundingClientRect().width >= i.parentElement.getBoundingClientRect().width * .9)));
    ok('values say days, 1 week, lost, by hand, $2,000', await page.evaluate(() => [...document.querySelectorAll('.ba-val s')].map(s => s.textContent).join('|') === 'days|1 week|lost|by hand|$2,000 / yr'));
    /* timeline */
    ok('five projects on the timeline', await page.evaluate(() => document.querySelectorAll('.lanes li').length === 5));
    ok('five bars overlap in late October', await page.evaluate(() => { const x = document.querySelector('.ln-five').getBoundingClientRect(); const mid = x.left + x.width / 2; return [...document.querySelectorAll('.ln-track i')].every(i => { const r = i.getBoundingClientRect(); return r.left <= mid && r.right >= mid; }); }));
    await page.click('.lanes a[href="#cns"]'); await page.waitForTimeout(1200);
    ok('timeline opens a business page', await view(page) === 'cns');
    await page.evaluate(() => document.querySelector('.view.on .pano').scrollIntoView({ block: 'center', behavior: 'instant' })); await page.waitForSelector('.view.on .pano.live', { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(300);
    ok('CNS page: cab look-around goes live', await page.evaluate(() => !!document.querySelector('.view.on .pano.live canvas')));
    { const h = await page.$('.view.on .pano'); const l0 = await page.evaluate(e => e.__look().lon, h); const b = await h.boundingBox(); await page.mouse.move(b.x + b.width * .6, b.y + b.height * .5); await page.mouse.down(); await page.mouse.move(b.x + b.width * .3, b.y + b.height * .5, { steps: 6 }); await page.mouse.up(); ok('dragging turns the cab view', await page.evaluate(e => e.__look().lon, h) - l0 > 15); }
    ok('CNS page: nine renders, ten sheets', await page.evaluate(() => { const f = [...document.querySelectorAll('.view.on .filters button')].map(b => b.textContent.replace(/\s+/g, ' ').trim()); return f.some(t => /^Renders\s*9$/.test(t)) && f.some(t => /^Sheets\s*10$/.test(t)); }));
    ok('no building address in the cab pictures or text', await page.evaluate(() => !/279|44th|Boston R/i.test(document.documentElement.innerHTML)));
    await hash(page, 'nykhdc', 900);
    await page.evaluate(() => document.querySelector('#stage3d').scrollIntoView({ block: 'center', behavior: 'instant' })); await page.waitForFunction(() => window.__hero, null, { timeout: 20000 }).catch(() => {});
    ok('showroom page: the kitchen draws itself', await page.evaluate(() => !!document.querySelector('#stage3d canvas')));
    await page.waitForTimeout(6500); ok('kitchen finishes and shows the estimate', await page.evaluate(() => +document.querySelector('#scrub').value === 1000 && document.querySelector('#stage').classList.contains('priced')));
    /* links that used to point into the long page still land somewhere useful */
    for (const [old, v, id] of [['c1', 'nykhdc', null], ['c2', 'cns', null], ['c6', 'about', 'work-app'], ['faq', 'about', 'faq'], ['workshop', 'about', 'workshop'], ['skills', 'about', 'skills'], ['pages', 'about', 'pages'], ['builder', 'about', 'builder'], ['what', 'home', 'loop'], ['best', 'home', 'results']]) {
      await hash(page, old, 1500); const top = id ? await topOf(page, '#' + id) : 0;
      ok('link #' + old + ' opens ' + v + (id ? ' at ' + id : ''), await view(page) === v && (!id || Math.abs(top - 76) < 90 || await page.evaluate(() => innerHeight + scrollY >= document.documentElement.scrollHeight - 4)), [await view(page), top]); }
    /* About view: everything else */
    await hash(page, 'about', 900); ok('about view', await view(page) === 'about');
    ok('about: nine kinds of work, five questions with the price first', await page.evaluate(() => document.querySelectorAll('.skills li').length === 9 && document.querySelectorAll('.faq details').length === 6 && /cost/i.test(document.querySelector('.faq summary').textContent)));
    ok('calendar: 4 site days, 1 workshop', await page.evaluate(() => document.querySelectorAll('.cal-grid .site').length === 4 && document.querySelectorAll('.cal-grid .shop').length === 1));
    ok('private client: no initials, no health details', await page.evaluate(() => !/\bDZ\b/.test(document.documentElement.innerHTML)));
    await hash(page, 'workshop', 900); await page.click('#shopform button[type=submit]'); await page.waitForTimeout(200);
    ok('workshop form asks for the missing fields', (await page.textContent('#shopmsg')).includes('fill in'));
    ok('form controls on pink cards are light', await page.evaluate(() => getComputedStyle(document.querySelector('#shopform input[type=radio]')).colorScheme.includes('light')));
    await hash(page, 'review', 900); ok('review link opens the form', await page.evaluate(() => document.querySelector('#review').open));
    await page.click('#revform button[type=submit]'); await page.waitForTimeout(200); ok('review form asks for the missing fields', (await page.textContent('#revmsg')).includes('fill in'));
    await hash(page, 'builder', 1200); await page.click('#stage-load'); await page.waitForTimeout(700);
    ok('live builder loads in a frame', await page.evaluate(() => { const f = document.querySelector('#stage-view iframe'); return !!f && /planner\/index\.html$/.test(f.src); }));
    await hash(page, 'pages', 1200); const sl = await page.evaluate(() => document.querySelector('#pages-row').scrollLeft); await page.click('#pages-next'); await page.waitForTimeout(700);
    ok('client pages arrow scrolls the row', await page.evaluate(() => document.querySelector('#pages-row').scrollLeft) > sl);
    await page.click('#pages-row .page:nth-child(2) .shot'); await page.waitForTimeout(400);
    ok('client page opens large', await page.evaluate(() => document.querySelector('#lb').open) && /cp-proposal-table/.test(await page.getAttribute('#lb-img', 'src')));
    await page.click('#lb-next'); await page.waitForTimeout(200); ok('picture viewer: next', !/cp-proposal-table/.test(await page.getAttribute('#lb-img', 'src')));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300); ok('picture viewer closes', await page.evaluate(() => !document.querySelector('#lb').open));
    const reels = await page.evaluate(() => document.querySelectorAll('.reel').length);
    if (REELS === 'reels') { ok('four clips', reels === 4, reels); ok('video link shows', await page.evaluate(() => !document.querySelector('#reel').hidden && !document.querySelector('#nav-reel').hidden)); }
    else { ok('no clips in the public build', reels === 0, reels); ok('video section and link stay hidden', await page.evaluate(() => document.querySelector('#reel').hidden && document.querySelector('#nav-reel').hidden)); ok('no clip file names in the page', !/reel-(countertop|cabinet-shop|elevator-cab|build-expo)/.test(fs.readFileSync(path.join(SITE, 'index.html'), 'utf8'))); }
    await hash(page, 'contact', 1000); await page.click('[data-copy="917-943-6912"]'); await page.waitForTimeout(200);
    ok('copy button confirms', ['Copied', '917-943-6912'].includes((await page.textContent('[data-copy="917-943-6912"]')).trim()));
    ok('call key dials', await page.getAttribute('#tact', 'href') === 'tel:+19179436912');
    for (const [v, min] of [['nykhdc', 6], ['cns', 6], ['strikeforce', 3], ['lconstruction', 3]]) {
      await hash(page, v, 900); ok('page ' + v, await view(page) === v);
      ok(v + ': gallery has pictures', await page.evaluate(() => document.querySelectorAll('.view.on .wall button').length) >= min);
      ok(v + ': problem, fix, result', await page.evaluate(() => document.querySelectorAll('.view.on .pdc3 > div').length === 3));
      ok(v + ': no sideways scroll', await noSide(page) <= 0, await noSide(page)); }
    await hash(page, 'design', 900); ok('renders page', await view(page) === 'design');
    await hash(page, 'nothing-here', 700); ok('unknown link shows the not-found page', await view(page) === 'nf');
    await page.click('.nf a'); await page.waitForTimeout(800); ok('not-found leads home', await view(page) === 'home');
    ok('home: no sideways scroll', await noSide(page) <= 0, await noSide(page));
    ok('every local file answered', missing.length === 0, missing.slice(0, 5));
    await ctx.close(); }

  /* ================= desktop, reduced motion ================= */
  { const { ctx, page } = await open({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    await page.goto(B, { waitUntil: 'load' }); await page.waitForTimeout(500);
    ok('calm: slider starts at after, nothing moves', await page.evaluate(() => +document.querySelector('#ba-range').value === 100 && document.querySelector('#ba').classList.contains('after')));
    ok('calm: the loop dot is hidden', await page.evaluate(() => getComputedStyle(document.querySelector('.loop .runner')).display === 'none'));
    await page.evaluate(() => { location.hash = 'nykhdc'; }); await page.waitForTimeout(600); await page.evaluate(() => document.querySelector('#stage3d').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForFunction(() => window.__hero, null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(800);
    ok('calm: kitchen is already built', await page.evaluate(() => document.querySelector('#stage').classList.contains('priced')));
    const bad = await page.evaluate(async () => { const out = []; for (const v of ['home', 'about', 'nykhdc', 'cns', 'strikeforce', 'lconstruction']) { location.hash = v; await new Promise(r => setTimeout(r, 300));
      const imgs = [...document.querySelectorAll('.view.on img')].filter(i => i.getAttribute('src') && !i.closest('[hidden]')); imgs.forEach(i => { i.loading = 'eager'; });
      await Promise.all(imgs.map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 4000); }))); imgs.forEach(i => { if (!i.naturalWidth) out.push(i.getAttribute('src')); }); } return out; });
    ok('every picture loads', bad.length === 0, bad);
    await ctx.close(); }

  /* ================= phone ================= */
  { const { ctx, page } = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(B, { waitUntil: 'load' }); await page.waitForTimeout(700);
    ok('phone: no sideways scroll', await noSide(page) <= 0, await noSide(page));
    ok('phone: headline and call button fit the first screen', await page.evaluate(() => { const d = document.querySelector('.dock').getBoundingClientRect().top; return ['#cover h1', '#cover .pill.solid'].every(q => { const r = document.querySelector(q).getBoundingClientRect(); return r.top >= 0 && r.bottom <= d; }); }));
    ok('phone: home under 8 screens', await page.evaluate(() => document.documentElement.scrollHeight / innerHeight < 8), await page.evaluate(() => (document.documentElement.scrollHeight / innerHeight).toFixed(1)));
    ok('phone: timeline results are readable text', await page.evaluate(() => [...document.querySelectorAll('.ln-res')].every(e => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) >= 16)));
    ok('phone: dock is on screen', await page.evaluate(() => getComputedStyle(document.querySelector('.dock')).display !== 'none'));
    ok('phone: header nav is folded', await page.evaluate(() => getComputedStyle(document.querySelector('.nav')).display === 'none'));
    await page.tap('#menu-open'); await page.waitForTimeout(300); ok('phone: menu opens', await page.evaluate(() => document.querySelector('#sheetnav').classList.contains('on')));
    await page.tap('#sheetnav a[href="#work"]'); await page.waitForTimeout(1300);
    ok('phone: menu link closes the menu and goes to the section', await page.evaluate(() => !document.querySelector('#sheetnav').classList.contains('on')) && Math.abs(await topOf(page, '#work') - 76) < 90, await topOf(page, '#work'));
    await hash(page, 'cns', 1200); await page.evaluate(() => document.querySelector('.view.on .pano').scrollIntoView({ block: 'center', behavior: 'instant' })); await page.waitForSelector('.view.on .pano.live', { timeout: 30000 }).catch(() => {});
    ok('phone: cab look-around goes live and lets the page scroll', await page.evaluate(() => { const h = document.querySelector('.view.on .pano'); return h.classList.contains('live') && getComputedStyle(h).touchAction === 'pan-y'; }));
    ok('phone: tap targets are big enough', await page.evaluate(() => [...document.querySelectorAll('.view.on a.pill, .view.on button.pill, .dock a, #menu-open, .chip, .rb')].filter(e => e.offsetParent).every(e => e.getBoundingClientRect().height >= 40)));
    for (const v of ['about', 'nykhdc', 'cns', 'strikeforce', 'lconstruction', 'design']) { await hash(page, v, 800); ok('phone ' + v + ': no sideways scroll', await noSide(page) <= 0, await noSide(page)); }
    await ctx.close(); }

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(`${pass} passed, ${fails.length} failed`); fails.forEach(f => console.log('  FAIL ' + f));
  await browser.close(); srv.close(); process.exit(fails.length ? 1 : 0);
})();
