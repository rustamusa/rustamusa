// usage: node source/tools/card.js [outDir]
// Draws the link preview (site/assets/og.png) and, into outDir, a square avatar and a 16:9 cover for social profiles.
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SITE = path.join(__dirname, '../../site'), CARD = path.join(__dirname, 'card.html'), OUT = process.argv[2] || require('os').tmpdir();
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = u === '/card.html' ? CARD : path.join(SITE, u); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : f.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
(async () => { await new Promise(r => srv.listen(8790, r)); const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const [k, w, h, out, scale] of [['og', 1200, 630, SITE + '/assets/og.png', 1], ['avatar', 512, 512, path.join(OUT, 'mycv-avatar.png'), 2], ['cover', 1600, 900, path.join(OUT, 'mycv-cover.png'), 1]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale }); await p.goto(`http://127.0.0.1:8790/card.html?k=${k}&w=${w}&h=${h}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300); await p.screenshot({ path: out }); console.log('saved', out); await p.close(); }
  await b.close(); srv.close(); })();
