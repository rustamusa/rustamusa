// usage: node source/tools/card.js [outDir] [fileName]
// Draws the link preview (site/assets/<fileName>, default og-rs-1.jpg) and, into outDir, a square avatar and a 16:9 cover for social profiles.
// The preview gets a new file name whenever it changes (/assets is cached for a day); the name is set in the page's og:image.
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SITE = path.join(__dirname, '../../site'), CARD = path.join(__dirname, 'card.html'), OUT = process.argv[2] || require('os').tmpdir(), NAME = process.argv[3] || 'og-rs-1.jpg';
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = u === '/card.html' ? CARD : path.join(SITE, u); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : f.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
(async () => { await new Promise(r => srv.listen(8790, r)); const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const [k, w, h, out, scale] of [['og', 1200, 630, path.join(SITE, 'assets', NAME), 1], ['avatar', 512, 512, path.join(OUT, 'rs-avatar.png'), 2], ['cover', 1600, 900, path.join(OUT, 'rs-cover.png'), 1]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale }); await p.goto(`http://127.0.0.1:8790/card.html?k=${k}&w=${w}&h=${h}`); await p.evaluate(() => document.fonts.ready);
    await p.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {})))); await p.waitForTimeout(300);
    await p.screenshot(out.endsWith('.jpg') ? { path: out, type: 'jpeg', quality: 86 } : { path: out }); console.log('saved', out); await p.close(); }
  await b.close(); srv.close(); })();
