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
    ok('first screen: headline, the phone in the header, free first meeting', await page.evaluate(() => ['#cover h1', '.top .top-call', '.hero2-note'].every(q => { const r = document.querySelector(q).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }) && /first meeting is free/i.test(document.querySelector('.hero2-note').textContent)));
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
    ok('five tabs on the first screen, each a picture with its name and a second line', await page.evaluate(() => { const t = [...document.querySelectorAll('.btabs .btab')]; return t.length === 5 && t.every(b => b.querySelector('img') && b.querySelector('small').textContent.trim().length > 3 && b.querySelector('b').textContent.trim().length > 3 && document.getElementById(b.getAttribute('aria-controls')) && b.getBoundingClientRect().bottom <= innerHeight); }));
    ok('the tabs are pictures of the work, not small icons', await page.evaluate(() => [...document.querySelectorAll('.btabs .btab')].every(b => { const r = b.getBoundingClientRect(); return r.width >= 140 && r.height >= 90; })));
    ok('how to reach is on the first screen: WhatsApp, email, Instagram, X, GitHub next to the headline', await page.evaluate(() => ['https://wa.me/19179436912', 'mailto:rustam.shb@gmail.com', 'https://www.instagram.com/kitchen4nyc/', 'https://x.com/dimklyn', 'https://github.com/rustamusa'].every(h => { const a = document.querySelector('#cover a[href="' + h + '"]'); if (!a) return false; const r = a.getBoundingClientRect(); return r.width > 30 && r.bottom <= innerHeight; }) && new Set([...document.querySelectorAll('#cover .hero4-soc a')].map(a => Math.round(a.getBoundingClientRect().height))).size === 1));
    ok('the first business shows who it is and its first pictures on the first screen', await page.evaluate(() => document.querySelector('#b-kitchen .bz-lede').getBoundingClientRect().bottom <= innerHeight && document.querySelector('#b-kitchen .sp-fig').getBoundingClientRect().top < innerHeight * .75));
    await page.click('#t-cab'); await page.waitForTimeout(1100);
    ok('a tab shows its business', await page.evaluate(() => { const d = document.querySelector('#deck').getBoundingClientRect(), c = document.querySelector('#b-cab').getBoundingClientRect(); return Math.abs(c.left - d.left) < 4 && document.querySelector('#t-cab').classList.contains('on') && !document.querySelector('#t-kitchen').classList.contains('on'); }));
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1100);
    ok('arrow key moves to the next business', await page.evaluate(() => document.querySelector('#t-sf').classList.contains('on') && Math.abs(document.querySelector('#b-sf').getBoundingClientRect().left - document.querySelector('#deck').getBoundingClientRect().left) < 4));
    await page.click('#t-kitchen'); await page.waitForTimeout(900);
    /* problem, fix, result */
    ok('five businesses, each with its story and its sub-projects as tiles', await page.evaluate(() => { const b = [...document.querySelectorAll('.bz')]; return b.length === 5 && b.every(x => x.querySelector('h3').textContent.trim().length > 8 && x.querySelector('.bz-lede .d-l').textContent.trim().length > 120 && x.querySelector('a.pill') && x.querySelectorAll('.subs .sp').length >= 4 && x.querySelectorAll('.subs .sp-lead').length === 1 && [...x.querySelectorAll('.subs .sp')].every(t => t.querySelector('.sp-pic img, .sp-chart') && t.querySelector('.sp-t').textContent.trim().length > 5 && t.querySelector('.sp-d').textContent.trim().length > 15 && document.getElementById(t.getAttribute('href').slice(1)))); }));
    ok('a card reads in plain type: three sizes at most, no struck or coloured words in the story', await page.evaluate(() => { const c = document.querySelector('#b-kitchen'); const sizes = new Set(); c.querySelectorAll('*').forEach(e => { if (e.offsetParent && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) sizes.add(Math.round(parseFloat(getComputedStyle(e).fontSize))); }); return sizes.size <= 3 && !document.querySelector('.bz s, .bz .bz-res, .bz .bz-lede b'); }));
    ok('no boxes and no frames laid over each other', await page.evaluate(() => [...document.querySelectorAll('.bz')].every(x => getComputedStyle(x).backgroundColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(x).backgroundImage === 'none' && getComputedStyle(x).borderTopWidth === '0px') && !document.querySelector('.bz-second, .bz-pair, .bz.alt, .deck .paper')));
    ok('websites are shown with their address', await page.evaluate(() => { const u = [...document.querySelectorAll('.bz-url')].map(e => e.textContent); return ['nykhdc.com', 'strikeforcesports.net', 'strikeforcenj.com', 'lbuildny.com'].every(d => u.includes(d)); }));
    ok('sub-project tiles are pictures, not icons', await page.evaluate(() => [...document.querySelectorAll('#b-kitchen .sp-pic')].every(e => { const r = e.getBoundingClientRect(); return r.width >= 220 && r.height >= 100; })));
    ok('results with numbers are drawn as charts', await page.evaluate(() => document.querySelectorAll('.deck .sp-chart .bars, .deck .sp-chart .stack').length >= 2 && [...document.querySelectorAll('.deck .bar-l b')].every(b => /\d/.test(b.textContent)) && [...document.querySelectorAll('.deck .stack i')].every(i => /^\d+/.test(i.textContent.trim())) && /August 9 to October 13/.test(document.querySelector('.deck .chart-cap').textContent)));
    ok('nothing about a leak, a former contractor or a team overseas; no church or donor blocks', await page.evaluate(() => !/leak|former|overseas|church|donor/i.test(document.querySelector('main').textContent)));
    ok('the nutrition app is named plainly, with no made-up result', await page.evaluate(() => { const h = document.querySelector('.view[data-view=home]').textContent; return /Nutrition app/.test(h) && /client from the gym/.test(h) && !/private client/i.test(h) && !/one app\s*$/.test(document.querySelector('#t-app b').textContent) && !/channels\s*$/.test(document.querySelector('#t-lb b').textContent.replace('website, channels, video', '')); }));
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
    for (const [old, v, id] of [['c1', 'nykhdc', null], ['c2', 'cns', null], ['c6', 'about', 'work-app'], ['faq', 'about', 'faq'], ['workshop', 'teaching', 'workshop'], ['skills', 'withai', 'ai-edge'], ['pages', 'nykhdc', null], ['builder', 'nykhdc', null], ['work', 'home', 'fixes'], ['what', 'home', 'fixes'], ['best', 'home', 'fixes']]) {
      await hash(page, old, 1500); const top = id ? await topOf(page, '#' + id) : 0;
      ok('link #' + old + ' opens ' + v + (id ? ' at ' + id : ''), await view(page) === v && (!id || Math.abs(top - 76) < 90 || await page.evaluate(() => innerHeight + scrollY >= document.documentElement.scrollHeight - 4)), [await view(page), top]); }
    /* About view: everything else */
    await hash(page, 'about', 900); ok('about view', await view(page) === 'about');
    ok('about: plain heading, no list of tools, the camera is shown, five questions with the price first', await page.evaluate(() => { const v = document.querySelector('.view[data-view=about]'); return v.querySelector('h1').textContent.trim() === 'About' && !v.querySelector('.chips, .give') && !!v.querySelector('.me-kit img') && document.querySelectorAll('.faq details').length === 5 && /cost/i.test(document.querySelector('.faq summary').textContent); }));
    await hash(page, 'ai-edge', 900);
    ok('With AI is its own short page: seven points, the tools in one line, five ways AI is kept in check', await view(page) === 'withai' && await page.evaluate(() => { const g = document.querySelectorAll('#ai-edge .edge'); return g.length === 2 && g[0].children.length === 7 && g[1].children.length === 5 && /ChatGPT, Claude and Grok/.test(document.querySelector('#ai-edge .vlede').textContent) && document.documentElement.scrollHeight / innerHeight < 1.6; }));
    await hash(page, 'how', 900);
    ok('Teaching is its own page: the first day, what stays with the owner, the workshop plan said honestly', await view(page) === 'teaching' && await page.evaluate(() => document.querySelectorAll('.view.on .steps li').length === 4 && document.querySelectorAll('.view.on .edge > div').length === 4 && document.querySelectorAll('.month2 .site').length === 4 && document.querySelectorAll('.month2 .shop').length === 1 && !document.querySelector('.cal, #cal-grid') && /No public workshop has been held yet/.test(document.querySelector('.plain-note').textContent)));
    await hash(page, 'words', 900);
    ok('Feedback is its own page: three owners named by business, no pink card', await view(page) === 'feedback' && await page.evaluate(() => { const c = [...document.querySelectorAll('.words .word figcaption')].map(e => e.textContent.trim()); return c.length === 3 && /NY Kitchen & Home Design Center/.test(c[0]) && /CNS Elevator Cabs/.test(c[1]) && /L-Construction Group/.test(c[2]) && !document.querySelector('.view[data-view=teaching] .paper, .view[data-view=feedback] .paper'); }));
    await hash(page, 'about', 900);
    await page.evaluate(() => { document.querySelectorAll('details.fold').forEach(d => { d.open = false; }); scrollTo({ top: 0, behavior: 'instant' }); }); await page.waitForTimeout(300);
    ok('about is a short list: three sections fold under their headings, under 4 screens, every plus in one column', await page.evaluate(() => { const f = [...document.querySelectorAll('.view[data-view=about] details.fold')]; const w = f.filter(d => d.offsetParent).map(d => Math.round(d.querySelector('summary').getBoundingClientRect().right)); return f.length === 3 && new Set(w).size === 1 && document.documentElement.scrollHeight / innerHeight < 4; }));
    await hash(page, 'faq', 1200);
    ok('a link to an About section opens it', await page.evaluate(() => document.querySelector('#faq details.fold').open && (Math.abs(document.querySelector('#faq').getBoundingClientRect().top - 76) < 90 || innerHeight + scrollY >= document.documentElement.scrollHeight - 4)));
    await hash(page, 'design', 900);
    ok('the gallery opens on kitchens, not on everything', await page.evaluate(() => { const b = document.querySelector('.dgal .filters button[aria-pressed=true]'); return !!b && /^Kitchens/.test(b.textContent); }));
    { const pub = path.join(__dirname, '..', '..', 'site'); ok('robots.txt, sitemap, icon and a light preview picture are in the site', ['robots.txt', 'sitemap.xml', 'favicon.ico', 'assets/og.jpg'].every(f => fs.existsSync(path.join(pub, f))) && fs.statSync(path.join(pub, 'assets/og.jpg')).size < 300000 && await page.evaluate(() => document.querySelector('meta[property="og:image"]').content.endsWith('/og.jpg'))); }
    ok('the description counts four businesses and a gym client, like the page', await page.evaluate(() => /Four businesses and a gym client/.test(document.querySelector('meta[name=description]').content) && /Five clients/.test(document.querySelector('.btabs-h').textContent) && /Four businesses and one gym client/.test(document.querySelector('.view[data-view=about]').textContent)));
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
    const hs = []; for (const t of ['kitchen', 'cab', 'sf', 'lb', 'app']) { await page.click('#t-' + t); await page.waitForTimeout(900); hs.push(await page.evaluate(() => +(document.documentElement.scrollHeight / innerHeight).toFixed(2))); }
    ok('laptop: every business fits in one and a half screens', hs.every(h => h <= 1.5), hs);
    await page.click('#t-kitchen'); await page.waitForTimeout(900);
    ok('laptop: the first row of sub-projects starts on the first screen', await page.evaluate(() => document.querySelector('#b-kitchen .sp:not(.sp-lead) .sp-pic').getBoundingClientRect().top < innerHeight - 60));
    ok('laptop: no sideways scroll', await noSide(page) <= 0, await noSide(page));
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
    await page.tap('#t-app'); await page.waitForTimeout(1400);
    ok('phone: the last tab lands on its business', await page.evaluate(() => document.querySelector('#t-app').classList.contains('on') && Math.abs(document.querySelector('#b-app').getBoundingClientRect().left - document.querySelector('#deck').getBoundingClientRect().left) < 4));
    ok('phone: tiles are two across with the main one full width', await page.evaluate(() => { const l = document.querySelector('#b-lb .sp-lead').getBoundingClientRect(), s = document.querySelector('#b-lb .sp:not(.sp-lead)').getBoundingClientRect(); return l.width > 300 && s.width > 150 && s.width < 200; }));
    await page.evaluate(() => document.querySelector('#deck').scrollTo({ left: 0, behavior: 'instant' })); await page.waitForTimeout(500);
    ok('phone: swiping the deck updates the tabs', await page.evaluate(() => document.querySelector('#t-kitchen').classList.contains('on')));
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
