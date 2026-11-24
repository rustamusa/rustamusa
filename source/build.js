// Assembles site/index.html from source/parts.   usage: node source/build.js [dest] [--reels]
// --reels adds the video wall. It needs parts/reels.private.js, which is not in the repository:
// a clip goes on the public site only with the business owner's OK. Without it the wall stays hidden.
const fs = require('fs'), path = require('path');
const P = f => fs.readFileSync(path.join(__dirname, 'parts', f), 'utf8');
const args = process.argv.slice(2);
const dest = args.find(a => !a.startsWith('--')) || path.join(__dirname, '..', 'site', 'index.html');
const reelsFile = path.join(__dirname, 'parts', 'reels.private.js');
const withReels = args.includes('--reels') && fs.existsSync(reelsFile);
const app = P('app.js').replace('/*REELS*/', withReels ? fs.readFileSync(reelsFile, 'utf8').trim() : 'const REELS = [];');
const out = P('head.html') + P('header.html') + P('home.html') + P('pages.html')
  + '\n<script>\n' + P('manifest.js').trim() + '\n' + app + '\n' + P('hero3d.js') + P('pano.js') + '</script>\n</body>\n</html>\n';
fs.writeFileSync(dest, out);
console.log('wrote', dest, (out.length / 1024).toFixed(1) + ' KB', withReels ? '(with the video wall)' : '(no video wall)');
