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
  /* a real finger: touch events sent through the browser, the way a phone sends them. With lift:false the finger stays down and the session is returned. */
  const line = (x0, y0, x1, y1, n = 10) => Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);
  const finger = async (page, pts, { ms = 16, lift = true } = {}) => { const c = await page.context().newCDPSession(page);
    await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
    for (const [x, y] of pts.slice(1)) { await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await page.waitForTimeout(ms); }
    if (!lift) return c; await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await c.detach().catch(() => {}); };

  /* ================= desktop ================= */
  { const { ctx, page } = await open({ viewport: { width: 1440, height: 900 } });
    await page.goto(B, { waitUntil: 'load' }); await page.waitForTimeout(600);
    ok('home view is on', await view(page) === 'home');
    ok('the headline of the page is the four businesses', (await page.textContent('#cover h1')).trim() === 'Four businesses, served at the same time');
    ok('page title says what this is', /AI help for small businesses in New York/i.test(await page.title()));
    ok('first screen: the headline and the phone in the header; no slogan and no offer line anywhere on the site', await page.evaluate(() => ['#cover h1', '.top .top-call'].every(q => { const r = document.querySelector(q).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }) && !document.querySelector('.hero2-note') && !/first meeting|slow step out of/i.test(document.documentElement.innerHTML)));
    ok('the phone number is on the home page once, in the header', await page.evaluate(() => [...document.querySelectorAll('a[href^="tel:"]')].filter(a => a.offsetParent && !a.closest('.view:not(.on)')).length === 1 && !!document.querySelector('.top a[href="tel:+19179436912"]') && !document.querySelector('.mega, #tact')));
    ok('the person is named on the first screen, with a photo', await page.evaluate(() => { const w = document.querySelector('#cover .hero4-who'), i = w.querySelector('img'); return /Rustam Shabanov/.test(w.textContent) && i.complete && i.naturalWidth > 100 && w.getBoundingClientRect().bottom <= innerHeight && /Rustam Shabanov/.test(document.title); }));
    ok('home fits in one and a half screens, no long scroll', await page.evaluate(() => document.documentElement.scrollHeight / innerHeight <= 1.5), await page.evaluate(() => (document.documentElement.scrollHeight / innerHeight).toFixed(1)));
    ok('no 3D on the home page', await page.evaluate(() => !document.querySelector('.view[data-view=home] #stage3d, .view[data-view=home] .pano')));
    const small = await page.evaluate(() => { const out = []; document.querySelectorAll('.view[data-view=home] *').forEach(e => { if (!e.offsetParent || e.closest('.ln-months, svg, .foot') || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return; const f = parseFloat(getComputedStyle(e).fontSize); if (f < 15.5) out.push(f + ':' + e.textContent.trim().slice(0, 24)); }); return out.slice(0, 20); });
    ok('home: no small print (all text 16px or more)', small.length === 0, small);
    const fam = await page.evaluate(() => { const set = new Set(), up = []; document.querySelectorAll('body *').forEach(e => { if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return; const c = getComputedStyle(e); set.add(c.fontFamily.split(',')[0].replace(/["']/g, '').trim()); if (c.textTransform === 'uppercase') up.push(e.textContent.trim().slice(0, 20)); }); return { fams: [...set], up: up.slice(0, 5) }; });
    ok('one typeface on every page', fam.fams.length === 1 && fam.fams[0] === 'Geist', fam.fams);
    ok('no capitalised labels', fam.up.length === 0, fam.up);
    ok('typeface file is loaded', await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('600 20px Geist'); }));
    ok('no first-person copy', await page.evaluate(() => { const t = [...document.querySelectorAll('main *:not(script)')].filter(e => !e.closest('blockquote') && e.children.length === 0).map(e => e.textContent).join(' \n '); return !/(^|[^A-Za-z])(I|I'm|I've|my|me|we|our)([^A-Za-z]|$)/.test(t.replace(/My CV/g, '')); }));
    ok('every in-page link has a target', await page.evaluate(() => { const views = [...document.querySelectorAll('.view')].map(v => v.dataset.view); return [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href').slice(1)).filter(h => h && !views.includes(h) && !document.getElementById(h) && !['c1','c2','c3','c4','c5','c6'].includes(h)); }).then(b => b.length === 0 || (fails.push('dead links ' + b.join(',')), false)));
    /* first screen: real work */
    ok('no sliders on the home page', await page.evaluate(() => !document.querySelector('.view[data-view=home] input[type=range]')));
    ok('four tabs on the first screen, each a picture with its name and a second line', await page.evaluate(() => { const t = [...document.querySelectorAll('.btabs .btab')]; return t.length === 4 && t.every(b => b.querySelector('img') && b.querySelector('small').textContent.trim().length > 3 && b.querySelector('b').textContent.trim().length > 3 && document.getElementById(b.getAttribute('aria-controls')) && b.getBoundingClientRect().bottom <= innerHeight); }));
    ok('the tabs are pictures of the work, not small icons', await page.evaluate(() => [...document.querySelectorAll('.btabs .btab')].every(b => { const r = b.getBoundingClientRect(); return r.width >= 140 && r.height >= 90; })));
    ok('how to reach is on the first screen: WhatsApp, email, Instagram, X, GitHub next to the headline', await page.evaluate(() => ['https://wa.me/19179436912', 'mailto:rustam.shb@gmail.com', 'https://www.instagram.com/kitchen4nyc/', 'https://x.com/dimklyn', 'https://github.com/rustamusa'].every(h => { const a = document.querySelector('#cover a[href="' + h + '"]'); if (!a) return false; const r = a.getBoundingClientRect(); return r.width > 30 && r.bottom <= innerHeight; }) && new Set([...document.querySelectorAll('#cover .hero4-soc a')].map(a => Math.round(a.getBoundingClientRect().height))).size === 1));
    ok('the first business shows who it is and its first pictures on the first screen', await page.evaluate(() => document.querySelector('#b-kitchen .bz-lede').getBoundingClientRect().bottom <= innerHeight && document.querySelector('#b-kitchen .sp-fig').getBoundingClientRect().top < innerHeight * .75));
    await page.click('#t-cab'); await page.waitForTimeout(1100);
    ok('a tab shows its business', await page.evaluate(() => { const d = document.querySelector('#deck').getBoundingClientRect(), c = document.querySelector('#b-cab').getBoundingClientRect(); return Math.abs(c.left - d.left) < 4 && document.querySelector('#t-cab').classList.contains('on') && !document.querySelector('#t-kitchen').classList.contains('on'); }));
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1100);
    ok('arrow key moves to the next business', await page.evaluate(() => document.querySelector('#t-sf').classList.contains('on') && Math.abs(document.querySelector('#b-sf').getBoundingClientRect().left - document.querySelector('#deck').getBoundingClientRect().left) < 4));
    await page.click('#t-kitchen'); await page.waitForTimeout(900);
    ok('one business is on show; the others wait out of sight, and the deck is not a scroll box', await page.evaluate(() => { const d = document.querySelector('#deck'), c = [...d.children], cs = getComputedStyle(d); return c.filter(x => getComputedStyle(x).visibility === 'visible').length === 1 && c.filter(x => x.classList.contains('cur')).length === 1 && c[0].classList.contains('cur') && !['auto', 'scroll'].includes(cs.overflowX) && cs.touchAction === 'pan-y' && !d.style.height && !c.some(x => x.style.transform); }));
    await page.focus('#t-kitchen'); await page.keyboard.press('End'); await page.waitForTimeout(1000);
    const atEnd = await page.evaluate(() => document.querySelector('#t-lb').classList.contains('on') && document.querySelector('#b-lb').classList.contains('cur') && document.activeElement.id === 't-lb');
    await page.keyboard.press('Home'); await page.waitForTimeout(1000);
    ok('End and Home go to the last and the first business', atEnd && await page.evaluate(() => document.querySelector('#t-kitchen').classList.contains('on') && document.querySelector('#b-kitchen').classList.contains('cur') && document.activeElement.id === 't-kitchen'));
    await page.click('#t-cab'); await page.waitForTimeout(120);
    const sl = await page.evaluate(() => { const d = document.querySelector('#deck'), a = document.querySelector('#b-kitchen').getBoundingClientRect(), b = document.querySelector('#b-cab').getBoundingClientRect(); return { on: d.classList.contains('sliding'), gap: Math.round(b.left - a.right), both: getComputedStyle(document.querySelector('#b-cab')).visibility === 'visible' }; });
    await page.waitForTimeout(900);
    ok('a click on a tab slides the next business in with clear space between the two, and the deck ends as tall as the new card', sl.on && sl.both && sl.gap >= 30 && await page.evaluate(() => { const d = document.querySelector('#deck'), c = document.querySelector('#b-cab'); return c.classList.contains('cur') && !d.classList.contains('sliding') && Math.abs(d.getBoundingClientRect().height - c.getBoundingClientRect().height) < 2; }), sl);
    await page.click('#t-kitchen'); await page.waitForTimeout(900);
    ok('the pictures of the other businesses are fetched ahead, so a card never slides in empty', await page.evaluate(() => [...document.querySelectorAll('#deck img')].every(i => i.loading !== 'lazy' && i.complete && i.naturalWidth > 0)));
    ok('wide screen: the tabs are pictures, their names sit on blurred glass', await page.evaluate(() => { const t = document.querySelector('.btab'); return getComputedStyle(t.querySelector('img')).display !== 'none' && getComputedStyle(t.querySelector('.t-l')).display !== 'none' && getComputedStyle(t.querySelector('.t-s')).display === 'none' && /blur/.test(getComputedStyle(t.querySelector('span'), '::before').backdropFilter || ''); }));
    /* problem, fix, result */
    ok('four businesses, each with its story and its sub-projects as tiles', await page.evaluate(() => { const b = [...document.querySelectorAll('.bz')]; return b.length === 4 && b.every(x => x.querySelector('h3').textContent.trim().length > 8 && x.querySelector('.bz-lede .d-l').textContent.trim().length > 120 && x.querySelector('a.pill') && x.querySelectorAll('.subs .sp').length >= 4 && x.querySelectorAll('.subs .sp-lead').length === 1 && [...x.querySelectorAll('.subs .sp')].every(t => t.querySelector('.sp-pic img, .sp-chart') && t.querySelector('.sp-t').textContent.trim().length > 5 && t.querySelector('.sp-d').textContent.trim().length > 15 && document.getElementById(t.getAttribute('href').slice(1)))); }));
    ok('a card reads in plain type: three sizes at most, no struck or coloured words in the story', await page.evaluate(() => { const c = document.querySelector('#b-kitchen'); const sizes = new Set(); c.querySelectorAll('*').forEach(e => { if (e.offsetParent && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) sizes.add(Math.round(parseFloat(getComputedStyle(e).fontSize))); }); return sizes.size <= 3 && !document.querySelector('.bz s, .bz .bz-res, .bz .bz-lede b'); }));
    ok('no boxes and no frames laid over each other', await page.evaluate(() => [...document.querySelectorAll('.bz')].every(x => getComputedStyle(x).backgroundColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(x).backgroundImage === 'none' && getComputedStyle(x).borderTopWidth === '0px') && !document.querySelector('.bz-second, .bz-pair, .bz.alt, .deck .paper')));
    ok('websites are named by their address on the business pages, as links', await page.evaluate(() => { const u = [...document.querySelectorAll('.plinks a')].map(e => e.textContent.trim()); return ['nykhdc.com', 'strikeforcesports.net', 'strikeforcenj.com', 'lbuildny.com'].every(d => u.includes(d)); }));
    ok('sub-project tiles are pictures, not icons', await page.evaluate(() => [...document.querySelectorAll('#b-kitchen .sp-pic')].every(e => { const r = e.getBoundingClientRect(); return r.width >= 220 && r.height >= 100; })));
    ok('results with numbers are drawn as charts', await page.evaluate(() => document.querySelectorAll('.deck .sp-chart .bars, .deck .sp-chart .stack').length >= 2 && [...document.querySelectorAll('.deck .bar-l b')].every(b => /\d/.test(b.textContent)) && [...document.querySelectorAll('.deck .stack i')].every(i => /^\d+/.test(i.textContent.trim())) && /August 9 to October 13/.test(document.querySelector('.deck .chart-cap').textContent)));
    ok('nothing about a leak, a former contractor or a team overseas; no church or donor blocks', await page.evaluate(() => !/leak|former|overseas|church|donor/i.test(document.querySelector('main').textContent)));
    ok('the nutrition app is off the site: four businesses, no fifth tab, no pictures of it', await page.evaluate(() => !/nutrition|gym client|client from the gym|private client/i.test(document.documentElement.innerHTML) && !document.querySelector('#t-app, #b-app, #work-app') && !/app-board|app-dish|app-menu|app-dinner/.test(document.documentElement.innerHTML) && !/channels\s*$/.test(document.querySelector('#t-lb b').textContent.replace('website, channels, video', '')))); 
    await page.click('#b-kitchen .sp-lead'); await page.waitForTimeout(1300);
    ok('a tile opens its sub-project on the business page', await view(page) === 'nykhdc' && Math.abs(await topOf(page, '#sp-nk-studio') - 92) < 60, [await view(page), await topOf(page, '#sp-nk-studio')]);
    await hash(page, 'home', 900);
    ok('the bottom of the home page is a footer, not empty space', await page.evaluate(() => { const f = document.querySelector('.foot'), d = document.querySelector('#deck'), c = document.querySelector('#b-kitchen'); return getComputedStyle(f).display !== 'none' && f.querySelectorAll('a').length >= 5 && Math.abs(d.getBoundingClientRect().height - c.getBoundingClientRect().height) < 4 && f.getBoundingClientRect().top - d.getBoundingClientRect().bottom < 60; }));
    ok('no Russian text and no first name inside the quotes', await page.evaluate(() => !/[\u0400-\u04FF]/.test(document.body.innerText) && !/Russian/.test(document.body.innerText) && [...document.querySelectorAll('.word blockquote')].every(q => !/Rustam/.test(q.textContent))));
    ok('no Slava; feedback is signed by role, without names', await page.evaluate(() => !/Slava/.test(document.documentElement.innerHTML) && !/Stanley|Steven|Lubomir/.test(document.querySelector('.words').textContent) && document.querySelectorAll('.words .word figcaption a').length === 3));
    ok('no tables on the home page', await page.evaluate(() => !document.querySelector('.view[data-view=home] table, .view[data-view=home] .fx')));
    ok('no diagram that explains business', await page.evaluate(() => !document.querySelector('.loop, #loop')));
    /* no timeline, no repeated sections */
    ok('no timeline, and the menu says Work, With AI, Feedback, About', await page.evaluate(() => !document.querySelector('.lanes, #work, #skills, #where, #pages, #builder') && [...document.querySelectorAll('.nav a')].filter(a => !a.hidden).map(a => a.textContent.trim()).filter(t => t !== 'Video').join('|') === 'Work|With AI|Teaching|Feedback|About'));
    await hash(page, 'cns', 1200);
    ok('a business page opens', await view(page) === 'cns');
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
    for (const [old, v, id] of [['c1', 'nykhdc', null], ['c2', 'cns', null], ['c6', 'home', 'fixes'], ['faq', 'about', 'faq'], ['workshop', 'teaching', 'workshop'], ['skills', 'withai', 'ai-edge'], ['pages', 'nykhdc', null], ['builder', 'nykhdc', null], ['work', 'home', 'fixes'], ['what', 'home', 'fixes'], ['best', 'home', 'fixes']]) {
      await hash(page, old, 1500); const top = id ? await topOf(page, '#' + id) : 0;
      ok('link #' + old + ' opens ' + v + (id ? ' at ' + id : ''), await view(page) === v && (!id || Math.abs(top - 76) < 90 || await page.evaluate(() => innerHeight + scrollY >= document.documentElement.scrollHeight - 4)), [await view(page), top]); }
    /* About view: everything else */
    await hash(page, 'about', 900); ok('about view', await view(page) === 'about');
    ok('about: plain heading, no list of tools, the camera is shown, five questions with the price first', await page.evaluate(() => { const v = document.querySelector('.view[data-view=about]'); return v.querySelector('h1').textContent.trim() === 'About' && !v.querySelector('.chips, .give') && !!v.querySelector('.me-kit img') && document.querySelectorAll('.faq details').length === 5 && /cost/i.test(document.querySelector('.faq summary').textContent); }));
    await hash(page, 'ai-edge', 900);
    ok('With AI is its own short page: seven points, the tools in one line, five ways AI is kept in check', await view(page) === 'withai' && await page.evaluate(() => { const g = document.querySelectorAll('#ai-edge .edge'); return g.length === 2 && g[0].children.length === 7 && g[1].children.length === 5 && /ChatGPT, Claude and Grok/.test(document.querySelector('#ai-edge .vlede').textContent) && !document.querySelector('.edge > div:only-child') && document.documentElement.scrollHeight / innerHeight < 1.6 && document.querySelector('#ai-edge h1').textContent.trim() === 'What became possible with AI'; }));
    await hash(page, 'how', 900);
    ok('Teaching is its own page: the first day, what stays with the owner, the workshop plan said honestly', await view(page) === 'teaching' && await page.evaluate(() => document.querySelectorAll('.view.on .steps li').length === 4 && document.querySelectorAll('.view.on .edge > div').length === 4 && document.querySelectorAll('.month2 .site').length === 4 && document.querySelectorAll('.month2 .shop').length === 1 && !document.querySelector('.cal, #cal-grid') && /No public workshop has been held yet/.test(document.querySelector('.plain-note').textContent)));
    await hash(page, 'words', 900);
    ok('Feedback is its own page: three owners named by business, no pink card', await view(page) === 'feedback' && await page.evaluate(() => { const c = [...document.querySelectorAll('.words .word figcaption')].map(e => e.textContent.trim()); return c.length === 3 && /NY Kitchen & Home Design Center/.test(c[0]) && /CNS Elevator Cabs/.test(c[1]) && /L-Construction Group/.test(c[2]) && !document.querySelector('.view[data-view=teaching] .paper, .view[data-view=feedback] .paper'); }));
    await hash(page, 'about', 900);
    await page.evaluate(() => { document.querySelectorAll('details.fold').forEach(d => { d.open = false; }); scrollTo({ top: 0, behavior: 'instant' }); }); await page.waitForTimeout(300);
    ok('about is a short list: two sections fold under their headings, under 4 screens, every plus in one column', await page.evaluate(() => { const f = [...document.querySelectorAll('.view[data-view=about] details.fold')]; const w = f.filter(d => d.offsetParent).map(d => Math.round(d.querySelector('summary').getBoundingClientRect().right)); return f.length === 2 && new Set(w).size === 1 && document.documentElement.scrollHeight / innerHeight < 4; }));
    await hash(page, 'faq', 1200);
    ok('a link to an About section opens it', await page.evaluate(() => document.querySelector('#faq details.fold').open && (Math.abs(document.querySelector('#faq').getBoundingClientRect().top - 76) < 90 || innerHeight + scrollY >= document.documentElement.scrollHeight - 4)));
    await hash(page, 'design', 900);
    ok('the gallery opens on kitchens, not on everything', await page.evaluate(() => { const b = document.querySelector('.dgal .filters button[aria-pressed=true]'); return !!b && /^Kitchens/.test(b.textContent); }));
    { const pub = path.join(__dirname, '..', '..', 'site'); ok('robots.txt, sitemap, icon and a light preview picture are in the site', ['robots.txt', 'sitemap.xml', 'favicon.ico', '404.html', 'assets/og-rs-1.jpg'].every(f => fs.existsSync(path.join(pub, f))) && fs.statSync(path.join(pub, 'assets/og-rs-1.jpg')).size < 300000 && await page.evaluate(() => document.querySelector('meta[property="og:image"]').content.endsWith('/og-rs-1.jpg'))); }
    ok('one count everywhere: four businesses; the description and the share card say the same thing', await page.evaluate(() => { const d = document.querySelector('meta[name=description]').content, o = document.querySelector('meta[property="og:description"]').content; return d === o && /Rustam Shabanov/.test(d) && !/five|gym/i.test(d) && /Four businesses/.test(document.querySelector('#cover h1').textContent) && /Four businesses so far/.test(document.querySelector('.view[data-view=about]').textContent) && !/Five clients|five businesses|five clients/.test(document.body.textContent); }));
    await hash(page, 'about', 900);
    ok('private client: no initials, no health details', await page.evaluate(() => !/\bDZ\b/.test(document.documentElement.innerHTML)));
    await hash(page, 'workshop', 900); await page.click('#shopform button[type=submit]'); await page.waitForTimeout(200);
    ok('workshop form asks for the missing fields', (await page.textContent('#shopmsg')).includes('fill in'));
    ok('the workshop form is on the page, not on a pink card', await page.evaluate(() => !!document.querySelector('.view.on #shopform input[name=name]') && !document.querySelector('.view.on .paper')));
    await hash(page, 'review', 900); ok('review link opens the form', await page.evaluate(() => document.querySelector('#review').open));
    await page.click('#revform button[type=submit]'); await page.waitForTimeout(200); ok('review form asks for the missing fields', (await page.textContent('#revmsg')).includes('fill in'));
    await hash(page, 'nykhdc', 1000); await page.evaluate(() => document.querySelector('.view.on .wall button').scrollIntoView({ block: 'center', behavior: 'instant' })); await page.waitForTimeout(300); await page.click('.view.on .wall button'); await page.waitForTimeout(400);
    const lb0 = await page.getAttribute('#lb-img', 'src');
    ok('a gallery picture opens large', await page.evaluate(() => document.querySelector('#lb').open) && /assets\/img\//.test(lb0));
    await page.click('#lb-next'); await page.waitForTimeout(200); ok('picture viewer: next', lb0 !== await page.getAttribute('#lb-img', 'src'));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300); ok('picture viewer closes', await page.evaluate(() => !document.querySelector('#lb').open));
    const reels = await page.evaluate(() => document.querySelectorAll('.reel').length);
    if (REELS === 'reels') { ok('four clips', reels === 4, reels); ok('video link shows', await page.evaluate(() => !document.querySelector('#reel').hidden && !document.querySelector('#nav-reel').hidden)); }
    else { ok('no clips in the public build', reels === 0, reels); ok('video section and link stay hidden', await page.evaluate(() => document.querySelector('#reel').hidden && document.querySelector('#nav-reel').hidden)); ok('no clip file names in the page', !/reel-(countertop|cabinet-shop|elevator-cab|build-expo)/.test(fs.readFileSync(path.join(SITE, 'index.html'), 'utf8'))); }
    await hash(page, 'contact', 1000); await page.click('[data-copy="917-943-6912"]'); await page.waitForTimeout(200);
    ok('copy button confirms', ['Copied', '917-943-6912'].includes((await page.textContent('[data-copy="917-943-6912"]')).trim()));
    ok('the contact band does not repeat the phone number', await page.evaluate(() => !document.querySelector('#tact') && [...document.querySelectorAll('a[href^="tel:"]')].filter(a => a.offsetParent && !a.closest('.view:not(.on)')).length === 1));
    for (const [v, min] of [['nykhdc', 6], ['cns', 6], ['strikeforce', 0], ['lconstruction', 0]]) {
      await hash(page, v, 900); ok('page ' + v, await view(page) === v);
      ok(v + ': gallery has pictures', await page.evaluate(() => document.querySelectorAll('.view.on .wall button').length) >= min);
      ok(v + ': opens with its story, then its sub-projects; no pink summary card', await page.evaluate(() => document.querySelector('.view.on .phead .meta').textContent.trim().length > 120 && document.querySelectorAll('.view.on .subs.all .sp').length >= 5 && !document.querySelector('.view.on .pdc3, .view.on .cta.paper') && document.querySelector('.view.on .phead').nextElementSibling.querySelector('.subs.all')));
      ok(v + ': no sideways scroll', await noSide(page) <= 0, await noSide(page)); }
    await hash(page, 'design', 900); ok('renders page', await view(page) === 'design');
    await hash(page, 'nothing-here', 700); ok('unknown link shows the not-found page', await view(page) === 'nf');
    await page.click('.nf a'); await page.waitForTimeout(800); ok('not-found leads home', await view(page) === 'home');
    ok('home: no sideways scroll', await noSide(page) <= 0, await noSide(page));
    ok('every local file answered', missing.length === 0, missing.slice(0, 5));
    await ctx.close(); }

  /* ================= a 13-inch laptop window ================= */
  { const { ctx, page } = await open({ viewport: { width: 1230, height: 685 } });
    await page.goto(B, { waitUntil: 'load' }); await page.waitForTimeout(700);
    const hs = []; for (const t of ['kitchen', 'cab', 'sf', 'lb']) { await page.click('#t-' + t); await page.waitForTimeout(900); hs.push(await page.evaluate(() => +(document.documentElement.scrollHeight / innerHeight).toFixed(2))); }
    ok('laptop: every business fits in one and a half screens', hs.every(h => h <= 1.5), hs);
    await page.click('#t-kitchen'); await page.waitForTimeout(900);
    ok('laptop: the first row of sub-projects starts on the first screen', await page.evaluate(() => document.querySelector('#b-kitchen .sp:not(.sp-lead) .sp-pic').getBoundingClientRect().top < innerHeight - 60));
    ok('laptop: no sideways scroll', await noSide(page) <= 0, await noSide(page));
    await ctx.close(); }

  /* ================= v15: the name, the share card, titles, the place kept by Back and the menu, the photo viewer ================= */
  { const { ctx, page } = await open({ viewport: { width: 1440, height: 900 } });
    await page.goto(B, { waitUntil: 'load' }); await page.waitForTimeout(700);
    ok('the name stands where "My CV" was: header, footer, menu', await page.evaluate(() => !/My CV/.test(document.documentElement.innerHTML) && document.querySelector('.top .brand').textContent.trim() === 'Rustam Shabanov' && /^Rustam Shabanov/.test(document.querySelector('.foot-row').textContent.trim()) && document.querySelector('#sheetnav .brand').textContent.trim() === 'Rustam Shabanov'));
    ok('share card: one picture, named in og and twitter tags, the file is there; no old card', await page.evaluate(() => { const o = document.querySelector('meta[property="og:image"]').content, t = document.querySelector('meta[name="twitter:image"]').content; return o === t && /og-rs-\d+\.jpg$/.test(o) && document.querySelector('meta[property="og:title"]').content === document.title && !!document.querySelector('meta[property="og:image:alt"]') && !!document.querySelector('link[rel="apple-touch-icon"]') && JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent).name === 'Rustam Shabanov'; }) && fs.existsSync(path.join(SITE, 'assets', 'og-rs-1.jpg')) && !fs.existsSync(path.join(SITE, 'assets', 'og.jpg')));
    ok('a real unknown address gets its own page', fs.existsSync(path.join(__dirname, '..', '..', 'site', '404.html')) && /Rustam Shabanov/.test(fs.readFileSync(path.join(__dirname, '..', '..', 'site', '404.html'), 'utf8')));
    ok('nothing is laid over a picture: no address pills, no window bar', await page.evaluate(() => !document.querySelector('.bz-url')));
    ok('wide laptop: the home page fits one and a half screens', await page.evaluate(() => document.documentElement.scrollHeight / innerHeight <= 1.5), await page.evaluate(() => +(document.documentElement.scrollHeight / innerHeight).toFixed(2)));
    ok('the story of a business reads in two short columns', await page.evaluate(() => { const s = [...document.querySelectorAll('#b-kitchen .bz-lede .d-l > span')].map(e => e.getBoundingClientRect()); return s.length === 2 && s[0].width < 640 && s[1].left > s[0].right && Math.abs(s[0].top - s[1].top) < 3; }));
    const titles = []; for (const h of ['', 'nykhdc', 'cns', 'strikeforce', 'lconstruction', 'ai-edge', 'how', 'words', 'about', 'design', 'nowhere']) { await hash(page, h, 700); titles.push(await page.title()); }
    ok('every page has its own title, with the name in it', new Set(titles).size === titles.length && titles.every(t => /Rustam Shabanov/.test(t)), titles);
    for (const h of ['nykhdc', 'ai-edge', 'how', 'words', 'about']) { await hash(page, h, 700);
      ok(h + ': one scale of type, seven sizes at most', await page.evaluate(() => { const v = document.querySelector('.view.on'); return new Set([...v.querySelectorAll('*')].filter(e => e.getBoundingClientRect().width > 0 && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).map(e => Math.round(parseFloat(getComputedStyle(e).fontSize) * 10))).size <= 7; })); }
    await hash(page, 'design', 700);
    ok('the renders page: no pink card, no second phone button', await page.evaluate(() => !document.querySelector('.view.on .paper, .view.on a[href^="tel:"]') && [...document.querySelectorAll('a[href^="tel:"]')].filter(a => a.offsetParent).length === 1));
    /* Back returns to the place that was left */
    await hash(page, 'nykhdc', 900); await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' })); await page.waitForTimeout(400);
    await hash(page, 'cns', 900); ok('a new page opens at its top', await page.evaluate(() => scrollY) < 5);
    await page.goBack(); await page.waitForTimeout(900);
    ok('Back returns to the same place on the page', await view(page) === 'nykhdc' && Math.abs(await page.evaluate(() => scrollY) - 1500) <= 5, await page.evaluate(() => scrollY));
    await page.goForward(); await page.waitForTimeout(900); ok('Forward works too', await view(page) === 'cns');
    await page.goBack(); await page.waitForTimeout(700);
    /* photo viewer: dark, zooms, Back closes it and stays on the page */
    await page.evaluate(() => document.querySelector('.view.on .wall button').scrollIntoView({ block: 'center', behavior: 'instant' })); await page.waitForTimeout(300);
    const y0 = await page.evaluate(() => scrollY); await page.click('.view.on .wall button'); await page.waitForTimeout(500);
    ok('photo viewer is dark, not pink', await page.evaluate(() => { const c = getComputedStyle(document.querySelector('#lb')).backgroundColor.match(/\d+/g).map(Number); return document.querySelector('#lb').open && c[0] < 60 && c[1] < 40 && c[2] < 70; }));
    const [w0, sw0, sh0] = await page.evaluate(() => [document.querySelector('#lb-img').getBoundingClientRect().width, document.querySelector('#lb-stage').clientWidth, document.querySelector('#lb-stage').clientHeight]);
    await page.click('#lb-zoom'); await page.waitForTimeout(300);
    ok('photo viewer zooms and the frame keeps its size', await page.evaluate(([w, sw, sh]) => { const i = document.querySelector('#lb-img').getBoundingClientRect(), s = document.querySelector('#lb-stage'); return i.width > w * 1.5 && Math.abs(s.clientWidth - sw) < 3 && Math.abs(s.clientHeight - sh) < 3 && s.classList.contains('zoomed') && (s.scrollWidth > s.clientWidth || s.scrollHeight > s.clientHeight); }, [w0, sw0, sh0]));
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300);
    ok('the next picture opens at normal size', await page.evaluate(() => !document.querySelector('#lb-stage').classList.contains('zoomed')));
    await page.goBack(); await page.waitForTimeout(600);
    ok('Back closes the picture and stays on the page', await page.evaluate(() => !document.querySelector('#lb').open) && await view(page) === 'nykhdc' && Math.abs(await page.evaluate(() => scrollY) - y0) < 5);
    await page.click('.view.on .wall button'); await page.waitForTimeout(400); await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    ok('Esc closes the picture and leaves no extra step in the history', await page.evaluate(() => !document.querySelector('#lb').open && !(history.state && history.state.lb)) && await view(page) === 'nykhdc');
    /* skip link */
    await page.goto(B, { waitUntil: 'load' }); await page.waitForTimeout(600); await page.keyboard.press('Tab');
    ok('the first Tab stop is a skip link that lands in the content', await page.evaluate(() => document.activeElement.id === 'skip') && (await page.keyboard.press('Enter'), await page.waitForTimeout(200), await page.evaluate(() => document.activeElement.id === 'main' && location.hash !== '#main')));
    await ctx.close(); }
  for (const [name, w, h] of [['MacBook 1512', 1512, 982], ['half window', 756, 900]]) { const { ctx, page } = await open({ viewport: { width: w, height: h } });
    await page.goto(B, { waitUntil: 'load' }); await page.waitForTimeout(700);
    ok(name + ': headline in three lines at most, no sideways scroll', await page.evaluate(() => { const h1 = document.querySelector('#cover h1'), r = document.createRange(); r.selectNodeContents(h1); return new Set([...r.getClientRects()].map(x => Math.round(x.top))).size <= 3 && h1.getBoundingClientRect().width >= 240; }) && await noSide(page) <= 0);
    if (w > 1200) ok(name + ': the home page fits one and a half screens', await page.evaluate(() => document.documentElement.scrollHeight / innerHeight <= 1.5));
    await ctx.close(); }
  for (const [name, w, h] of [['tablet', 768, 1024], ['phone sideways', 844, 390], ['small phone sideways', 667, 375], ['phone 375', 375, 667], ['phone 430', 430, 932], ['phone 320', 320, 640]]) {
    const { ctx, page } = await open({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(B, { waitUntil: 'load' }); await page.waitForTimeout(700);
    ok(name + ': the headline is not squeezed', await page.evaluate(() => { const h1 = document.querySelector('#cover h1'), r = document.createRange(); r.selectNodeContents(h1); const who = document.querySelector('.hero4-who').getBoundingClientRect(); return new Set([...r.getClientRects()].map(x => Math.round(x.top))).size <= 3 && h1.getBoundingClientRect().width >= 240 && who.width >= 150 && who.height <= 62; }));
    ok(name + ': the switch of four businesses fits the screen, no name cut', await page.evaluate(() => { const bs = [...document.querySelectorAll('.btabs .btab')], bar = document.querySelector('.btabs').getBoundingClientRect(); return bs.length === 4 && bar.left >= 0 && bar.right <= innerWidth && bs.every(b => { const r = b.getBoundingClientRect(), l = b.querySelector('.t-s').getBoundingClientRect(); return r.left >= bar.left && r.right <= bar.right && l.width > 20 && l.left >= r.left - .5 && l.right <= r.right + .5 && r.height >= 44; }); }));
    for (const v of ['home', 'nykhdc', 'cns', 'strikeforce', 'lconstruction', 'ai-edge', 'how', 'words', 'about', 'design']) { await hash(page, v, 450); const o = await noSide(page); ok(name + ' ' + v + ': no sideways scroll', o <= 0, o); }
    if (w <= 640) { await hash(page, 'about', 500);
      ok(name + ': bar buttons are equal and nothing in them is cut', await page.evaluate(() => { const a = [...document.querySelectorAll('.dock a')]; const ws = a.map(x => Math.round(x.getBoundingClientRect().width)); return a.length === 3 && Math.max(...ws) - Math.min(...ws) <= 2 && a.every(x => x.scrollWidth <= x.clientWidth + 1); }));
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })); await page.waitForTimeout(300);
      ok(name + ': the last line of the page sits above the bar', await page.evaluate(() => { const l = [...document.querySelectorAll('.foot-row a')].pop().getBoundingClientRect(); return l.bottom <= document.querySelector('.dock').getBoundingClientRect().top + 1; })); }
    if (h <= 500) ok(name + ': the header scrolls away and the bar is hidden', await page.evaluate(() => getComputedStyle(document.querySelector('.top')).position === 'static' && getComputedStyle(document.querySelector('.dock')).display === 'none' && [...document.querySelectorAll('a[href^="tel:"]')].filter(a => a.offsetParent).length === 1));
    if (name === 'phone 375') {
      await hash(page, 'nykhdc', 700);
      ok('phone: every button and chip is 44 px or more', await page.evaluate(() => [...document.querySelectorAll('a, button, summary')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (e.closest('.view.on') || e.closest('.top') || e.closest('.dock') || e.closest('.foot')) && getComputedStyle(e).display !== 'inline'; }).every(e => Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height) >= 43.5)), await page.evaluate(() => [...document.querySelectorAll('a, button, summary')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (e.closest('.view.on') || e.closest('.top') || e.closest('.dock') || e.closest('.foot')) && getComputedStyle(e).display !== 'inline' && Math.min(r.width, r.height) < 43.5; }).slice(0, 4).map(e => e.textContent.trim().slice(0, 16) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))));
      await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' })); await page.waitForTimeout(300);
      const at = async q => { const r = await page.evaluate(s => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, q); await page.touchscreen.tap(r.x, r.y); };
      await at('#menu-open'); await page.waitForTimeout(300);
      ok('phone: the menu is a dialog and says it is open', await page.evaluate(() => document.querySelector('#menu-open').getAttribute('aria-expanded') === 'true' && document.querySelector('#sheetnav').getAttribute('role') === 'dialog'));
      await at('#menu-close'); await page.waitForTimeout(300);
      ok('phone: closing the menu leaves the page where it was', Math.abs(await page.evaluate(() => scrollY) - 1200) <= 2 && await page.evaluate(() => document.querySelector('#menu-open').getAttribute('aria-expanded') === 'false'), await page.evaluate(() => scrollY));
      await page.evaluate(() => document.querySelector('.view.on .wall button').scrollIntoView({ block: 'center', behavior: 'instant' })); await page.waitForTimeout(300); await page.tap('.view.on .wall button'); await page.waitForTimeout(900);
      const pw = await page.evaluate(() => document.querySelector('#lb-img').getBoundingClientRect().width);
      const box = await page.evaluate(() => { const r = document.querySelector('#lb-img').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      await page.touchscreen.tap(box.x, box.y); await page.waitForTimeout(40); await page.touchscreen.tap(box.x, box.y); await page.waitForTimeout(600);
      ok('phone: two taps zoom the picture', await page.evaluate(w => document.querySelector('#lb-img').getBoundingClientRect().width > w * 1.5, pw));
      await page.goBack(); await page.waitForTimeout(500);
      ok('phone: Back closes the picture', await page.evaluate(() => !document.querySelector('#lb').open) && await view(page) === 'nykhdc'); }
    await ctx.close(); }

  /* ================= desktop, reduced motion ================= */
  { const { ctx, page } = await open({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    await page.goto(B, { waitUntil: 'load' }); await page.waitForTimeout(500);
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
    ok('phone: the headline fits the first screen and the call button is in the bar at the bottom', await page.evaluate(() => { const d = document.querySelector('.dock').getBoundingClientRect().top; const r = document.querySelector('#cover h1').getBoundingClientRect(); return r.top >= 0 && r.bottom <= d && !!document.querySelector('.dock a[href="tel:+19179436912"]') && !!document.querySelector('.dock a[href^="https://wa.me/"]') && !!document.querySelector('.dock a[href^="mailto:"]') && [...document.querySelectorAll('a[href^="tel:"]')].filter(a => a.offsetParent).length === 1; }));
    ok('phone: home fits in one and a half screens', await page.evaluate(() => document.documentElement.scrollHeight / innerHeight <= 1.5), await page.evaluate(() => (document.documentElement.scrollHeight / innerHeight).toFixed(1)));
    ok('phone: socials sit by the headline, big enough to tap, nothing doubled with the bar', await page.evaluate(() => { const c = [...document.querySelectorAll('#cover .hero4-soc a')].filter(x => x.offsetParent); return c.length === 3 && c.every(x => { const r = x.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.bottom <= innerHeight; }) && !c.some(x => /wa\.me|mailto/.test(x.href)); }));
    await page.tap('#t-lb'); await page.waitForTimeout(1100);
    ok('phone: tapping a tab shows its business', await page.evaluate(() => document.querySelector('#t-lb').classList.contains('on') && Math.abs(document.querySelector('#b-lb').getBoundingClientRect().left - document.querySelector('#deck').getBoundingClientRect().left) < 4));
    ok('phone: tiles are two across with the main one full width', await page.evaluate(() => { const l = document.querySelector('#b-lb .sp-lead').getBoundingClientRect(), s = document.querySelector('#b-lb .sp:not(.sp-lead)').getBoundingClientRect(); return l.width > 300 && s.width > 150 && s.width < 200; }));
    ok('phone: the four businesses are one switch that fits the screen, nothing cut off', await page.evaluate(() => { const bs = [...document.querySelectorAll('.btabs .btab')], t = bs.map(b => b.getBoundingClientRect()), bar = document.querySelector('.btabs'); return t.length === 4 && t.every(r => r.left >= 0 && r.right <= innerWidth && r.height >= 44 && Math.abs(r.top - t[0].top) < 1 && Math.abs(r.width - t[0].width) < 1.5) && bar.scrollWidth <= bar.clientWidth + 1 && bs.every((b, i) => { const l = b.querySelector('.t-s').getBoundingClientRect(); return l.width > 20 && l.left >= t[i].left && l.right <= t[i].right && getComputedStyle(b.querySelector('img')).display === 'none'; }); }));
    ok('phone: nothing on the home page is a sideways scroll box', await page.evaluate(() => [...document.querySelectorAll('.view[data-view=home] *')].every(e => { const o = getComputedStyle(e).overflowX; return !((o === 'auto' || o === 'scroll') && e.scrollWidth > e.clientWidth + 1); })));
    ok('phone: the header, the switch, the bar at the bottom and the menu are glass', await page.evaluate(() => ['.top', '.btabs', '.dock', '.sheetnav'].every(q => { const c = getComputedStyle(document.querySelector(q)); return /blur/.test(c.backdropFilter || c.webkitBackdropFilter || ''); }) && getComputedStyle(document.querySelector('.dock')).borderRadius !== '0px'));
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(250);
    const dY = await page.evaluate(() => Math.round(document.querySelector('#deck').getBoundingClientRect().top + 110));
    await finger(page, line(60, dY, 330, dY + 4)); await page.waitForTimeout(750);
    ok('phone: a swipe to the right brings the business before', await page.evaluate(() => document.querySelector('#t-sf').classList.contains('on') && document.querySelector('#b-sf').classList.contains('cur') && Math.abs(document.querySelector('#b-sf').getBoundingClientRect().left) < 2 && !document.querySelector('#deck').style.height));
    await finger(page, line(330, dY, 60, dY - 3)); await page.waitForTimeout(750);
    ok('phone: a swipe to the left brings the next one', await page.evaluate(() => document.querySelector('#t-lb').classList.contains('on') && document.querySelector('#b-lb').classList.contains('cur')));
    await finger(page, line(330, dY, 60, dY)); await page.waitForTimeout(750);
    ok('phone: at the last business a swipe gives a little and comes back', await page.evaluate(() => document.querySelector('#t-lb').classList.contains('on') && Math.abs(document.querySelector('#b-lb').getBoundingClientRect().left) < 2 && !document.querySelector('#b-lb').style.transform));
    await finger(page, line(100, dY, 140, dY, 6), { ms: 70 }); await page.waitForTimeout(700);
    ok('phone: a short slow drag springs back', await page.evaluate(() => document.querySelector('#t-lb').classList.contains('on') && document.querySelector('#b-lb').classList.contains('cur') && getComputedStyle(document.querySelector('#b-sf')).visibility === 'hidden'));
    const held = await finger(page, line(100, dY, 258, dY, 8), { lift: false }); await page.waitForTimeout(90);
    const mid = await page.evaluate(() => { const r = q => document.querySelector(q).getBoundingClientRect(), sf = document.querySelector('#b-sf'); return { gap: Math.round(r('#b-lb h3').left - r('#b-sf .subs').right), peer: sf.classList.contains('peer') && getComputedStyle(sf).visibility === 'visible', p: parseFloat(document.querySelector('.btabs').style.getPropertyValue('--p')), drag: document.querySelector('#deck').classList.contains('drag') }; });
    await held.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await held.detach().catch(() => {}); await page.waitForTimeout(750);
    ok('phone: while two businesses slide there is clear space between them, and the switch follows the finger', mid.peer && mid.drag && mid.gap >= 32 && mid.p > 2.4 && mid.p < 2.9, mid);
    ok('phone: letting go past a third of the way finishes the slide', await page.evaluate(() => document.querySelector('#t-sf').classList.contains('on') && document.querySelector('#b-sf').classList.contains('cur')));
    const y0 = await page.evaluate(() => scrollY); await finger(page, line(200, dY + 200, 214, dY - 60, 12)); await page.waitForTimeout(600);
    ok('phone: a drag up scrolls the page and does not move the cards', await page.evaluate(y => scrollY > y + 30 && document.querySelector('#t-sf').classList.contains('on') && !document.querySelector('#deck').classList.contains('drag') && !document.querySelector('#b-sf').style.transform, y0), [y0, await page.evaluate(() => scrollY)]);
    await page.evaluate(() => scrollTo(0, 0)); await page.tap('#t-kitchen'); await page.waitForTimeout(900);
    ok('phone: a tap on the switch goes straight to that business', await page.evaluate(() => document.querySelector('#t-kitchen').classList.contains('on') && document.querySelector('#b-kitchen').classList.contains('cur')));
    ok('phone: dock is on screen', await page.evaluate(() => getComputedStyle(document.querySelector('.dock')).display !== 'none'));
    ok('phone: header nav is folded', await page.evaluate(() => getComputedStyle(document.querySelector('.nav')).display === 'none'));
    await page.tap('#menu-open'); await page.waitForTimeout(300); ok('phone: menu opens', await page.evaluate(() => document.querySelector('#sheetnav').classList.contains('on')));
    await page.tap('#sheetnav a[href="#ai-edge"]'); await page.waitForTimeout(1300);
    ok('phone: menu link closes the menu and opens the page', await page.evaluate(() => !document.querySelector('#sheetnav').classList.contains('on')) && await view(page) === 'withai');
    await hash(page, 'cns', 1200); await page.evaluate(() => document.querySelector('.view.on .pano').scrollIntoView({ block: 'center', behavior: 'instant' })); await page.waitForSelector('.view.on .pano.live', { timeout: 30000 }).catch(() => {});
    ok('phone: cab look-around goes live and lets the page scroll', await page.evaluate(() => { const h = document.querySelector('.view.on .pano'); return h.classList.contains('live') && getComputedStyle(h).touchAction === 'pan-y'; }));
    ok('phone: tap targets are big enough', await page.evaluate(() => [...document.querySelectorAll('.view.on a.pill, .view.on button.pill, .dock a, #menu-open, .chip, .rb')].filter(e => e.offsetParent).every(e => e.getBoundingClientRect().height >= 40)));
    for (const v of ['about', 'nykhdc', 'cns', 'strikeforce', 'lconstruction', 'design']) { await hash(page, v, 800); ok('phone ' + v + ': no sideways scroll', await noSide(page) <= 0, await noSide(page)); }
    await ctx.close(); }

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(`${pass} passed, ${fails.length} failed`); fails.forEach(f => console.log('  FAIL ' + f));
  await browser.close(); srv.close(); process.exit(fails.length ? 1 : 0);
})();
