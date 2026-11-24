/* ---------- the kitchen job: a sample kitchen that draws itself as a floor plan, then stands up in 3D ----------
   three.js is the copy that already ships with the planner; it loads only when this job comes near the screen.
   Units are inches. x runs along the back wall, z comes toward the viewer, y is up. */
(function(){
  const host = $('#stage3d'), stage = $('#stage'), range = $('#scrub'); if (!host) return;
  let booted = false;
  /* no WebGL, or the script did not arrive: show the finished kitchen as a picture */
  function still(){ if ($('img', host)) return; const im = new Image(); im.src = 'assets/img/hero-kitchen.webp'; im.alt = ''; host.append(im); stage.classList.add('priced'); const s = range && range.closest('.scrub'); if (s) s.hidden = true; }
  function boot(){
    if (booted) return; booted = true;
    if (window.THREE) return make();
    const s = document.createElement('script'); s.src = 'planner/js/three.min.js'; s.async = true; s.onload = make; s.onerror = still; document.head.append(s);
  }
  if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); boot(); } }, { rootMargin: '500px' }); io.observe(host); } else boot();

  function make(){
    const T = window.THREE; let R;
    try { R = new T.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return still(); }
    R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    R.outputEncoding = T.sRGBEncoding; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
    host.prepend(R.domElement);
    const scene = new T.Scene(), cam = new T.PerspectiveCamera(26, 1, 10, 3000);

    /* colours come from the --k-* tokens in the stylesheet; they are sRGB and the renderer works in linear light */
    const css = getComputedStyle(document.documentElement);
    const lin = n => new T.Color(css.getPropertyValue('--k-' + n).trim() || '#888888').convertSRGBToLinear();
    scene.add(new T.HemisphereLight(lin('sky'), lin('ground'), .66));
    const sun = new T.DirectionalLight(lin('sun'), .78); sun.position.set(210, 300, 260); sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536); sun.shadow.bias = -.0006; sun.shadow.radius = 5;
    const sc = sun.shadow.camera; sc.left = -200; sc.right = 200; sc.top = 200; sc.bottom = -200; sc.near = 20; sc.far = 900;
    sun.target.position.set(75, 0, 55); scene.add(sun, sun.target);
    const fill = new T.DirectionalLight(lin('sky'), .2); fill.position.set(-140, 120, 200); scene.add(fill);

    const std = (c, r, m) => new T.MeshStandardMaterial({ color: lin(c), roughness: r === undefined ? .85 : r, metalness: m || 0 });
    const M = { cream: std('base'), wood: std('tall', .7), isle: std('island', .7), stone: std('stone', .5), brass: std('handle', .34, .3), dark: std('dark', .3, .1), steel: std('steel', .4, .35), wall: std('wall', .95), glass: new T.MeshBasicMaterial({ color: lin('glass') }) };
    const edge = new T.LineBasicMaterial({ color: lin('edge'), transparent: true, opacity: .34 });
    const brassLine = new T.LineBasicMaterial({ color: lin('line'), transparent: true, opacity: .95 });
    const brassDash = new T.LineDashedMaterial({ color: lin('line'), transparent: true, opacity: .85, dashSize: 3.2, gapSize: 2.4 });
    const dimLine = new T.LineBasicMaterial({ color: lin('line'), transparent: true, opacity: .95 });

    const kit = new T.Group(); scene.add(kit);
    /* the drawing sheet the kitchen stands on: see-through, so the page is the paper. It only catches shadows. */
    const X0 = -38, X1 = 180, Z0 = -36, Z1 = 140;
    const shade = new T.Mesh(new T.PlaneGeometry(X1 - X0, Z1 - Z0), new T.ShadowMaterial({ opacity: .34 })); shade.rotation.x = -Math.PI / 2; shade.position.set((X0 + X1) / 2, -.2, (Z0 + Z1) / 2); shade.receiveShadow = true; kit.add(shade);
    const tintMat = new T.MeshBasicMaterial({ color: lin('sheet'), transparent: true, opacity: .5, depthWrite: false }), gridMat = new T.LineBasicMaterial({ color: lin('grid'), transparent: true, opacity: .05 }), frameMat = new T.LineBasicMaterial({ color: lin('line'), transparent: true, opacity: .45 });
    const tint = new T.Mesh(new T.PlaneGeometry(X1 - X0, Z1 - Z0), tintMat); tint.rotation.x = -Math.PI / 2; tint.position.set((X0 + X1) / 2, -.4, (Z0 + Z1) / 2); kit.add(tint);
    (function(){
      const p = [];
      for (let x = X0 + 14; x < X1; x += 12) p.push(x, 0, Z0, x, 0, Z1);
      for (let z = Z0 + 12; z < Z1; z += 12) p.push(X0, 0, z, X1, 0, z);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
      kit.add(new T.LineSegments(g, gridMat));
      const b = [X0, 0, Z0, X1, 0, Z0, X1, 0, Z0, X1, 0, Z1, X1, 0, Z1, X0, 0, Z1, X0, 0, Z1, X0, 0, Z0];
      const gb = new T.BufferGeometry(); gb.setAttribute('position', new T.Float32BufferAttribute(b, 3));
      kit.add(new T.LineSegments(gb, frameMat));
    })();

    const parts = [], solid = [], dash = [], dims = []; let cabinets = 0;
    const rect = (a, x, z, w, d) => a.push(x, z, x + w, z, x + w, z, x + w, z + d, x + w, z + d, x, z + d, x, z + d, x, z);
    const ring = (a, cx, cz, r) => { for (let i = 0; i < 20; i++){ const u = i / 20 * 6.2832, v = (i + 1) / 20 * 6.2832; a.push(cx + Math.cos(u) * r, cz + Math.sin(u) * r, cx + Math.cos(v) * r, cz + Math.sin(v) * r); } };
    /* a cabinet or slab. x,z = the near-left corner of its footprint; face says which way the doors look */
    function unit(x, z, w, d, h, y0, m, t0, kind, face){
      const g = new T.Group(); g.position.set(x + w / 2, y0, z + d / 2);
      const run = face === 'x' ? d : w, dep = face === 'x' ? w : d;
      if (face === 'x') g.rotation.y = Math.PI / 2;
      const geo = new T.BoxGeometry(run, h, dep); geo.translate(0, h / 2, 0);
      const body = new T.Mesh(geo, m); body.castShadow = body.receiveShadow = true; g.add(body);
      if (kind !== 'plain') g.add(new T.LineSegments(new T.EdgesGeometry(geo), edge));
      const f = dep / 2 + .08, p = [];
      const bar = (cx, cy, bw, bh) => { const b = new T.Mesh(new T.BoxGeometry(bw, bh, 1), M.brass); b.position.set(cx, cy, f + .5); g.add(b); };
      if (kind === 'base'){ p.push(-run / 2, h - 6.5, f, run / 2, h - 6.5, f); bar(0, h - 3.3, Math.min(8, run * .3), .7);
        if (run >= 30){ p.push(0, 0, f, 0, h - 6.5, f); bar(-2.4, h - 13, .7, 5.5); bar(2.4, h - 13, .7, 5.5); } else bar(run / 2 - 3, h - 13, .7, 5.5); }
      if (kind === 'drawers'){ [h - 6.5, h - 16, h - 25.5].forEach(y => p.push(-run / 2, y, f, run / 2, y, f)); [h - 3.3, h - 11.2, h - 20.7, h - 30].forEach(y => bar(0, y, Math.min(9, run * .32), .7)); }
      if (kind === 'wall'){ if (run >= 30){ p.push(0, 0, f, 0, h, f); bar(-2.4, 5, .7, 5.5); bar(2.4, 5, .7, 5.5); } else bar(run / 2 - 3, 5, .7, 5.5); }
      if (kind === 'tall'){ p.push(-run / 2, h * .62, f, run / 2, h * .62, f, 0, 0, f, 0, h, f); [-1, 1].forEach(s => { bar(2.4 * s, h * .62 - 9, .7, 10); bar(2.4 * s, h * .62 + 9, .7, 10); }); }
      if (kind === 'dw') bar(0, h - 5, run * .72, .9);
      if (p.length){ const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.add(new T.LineSegments(lg, edge)); }
      kit.add(g); parts.push({ g, t0 });
      if (kind === 'base' || kind === 'drawers' || kind === 'wall' || kind === 'tall') cabinets++;
      return g;
    }
    const B = 34.5;
    /* walls first */
    unit(-4, -4, 159.5, 4, 96, 0, M.wall, 0, 'plain'); unit(-4, 0, 4, 118, 96, 0, M.wall, .03, 'plain');
    rect(solid, -4, -4, 159.5, 4); rect(solid, -4, 0, 4, 118);
    /* back run */
    [[0, 36, 'base', M.cream], [36, 30, 'base', M.cream], [66, 24, 'dw', M.steel], [90, 30, 'drawers', M.cream], [120, 30, 'drawers', M.cream]].forEach((c, i) => { unit(c[0], 0, c[1], 24, B, 0, c[3], .08 + i * .05, c[2], 'z'); rect(solid, c[0], 0, c[1], 24); });
    /* left run and the tall pantry */
    unit(0, 24, 24, 36, B, 0, M.cream, .16, 'base', 'x'); rect(solid, 0, 24, 24, 36);
    unit(0, 60, 24, 24, B, 0, M.cream, .22, 'drawers', 'x'); rect(solid, 0, 60, 24, 24);
    unit(0, 84, 26, 30, 88, 0, M.wood, .3, 'tall', 'x'); rect(solid, 0, 84, 26, 30);
    /* island with two stools */
    unit(70, 72, 28, 30, B, 0, M.isle, .36, 'base', 'z'); unit(98, 72, 28, 30, B, 0, M.isle, .4, 'base', 'z'); rect(solid, 70, 72, 56, 30);
    [84, 112].forEach((sx, i) => { const g = unit(sx - 1, 111, 2, 2, 24, 0, M.brass, .78 + i * .04, 'plain'); const seat = new T.Mesh(new T.CylinderGeometry(7.5, 7.5, 2, 28), M.isle); seat.position.y = 25; seat.castShadow = true; g.add(seat); ring(solid, sx, 112, 7.5); });
    /* stone tops, sink, cooktop */
    unit(0, 0, 151.5, 25.5, 1.5, B, M.stone, .46, 'top'); unit(0, 25.5, 25.5, 58.5, 1.5, B, M.stone, .5, 'top'); unit(66, 68, 64, 40, 1.5, B, M.stone, .54, 'top');
    rect(solid, 66, 68, 64, 40);
    unit(39, 4.5, 24, 16, .3, B + 1.52, M.dark, .58, 'plain'); rect(solid, 39, 4.5, 24, 16);
    const tap = unit(50.2, 1.6, 1.6, 1.6, 9, B + 1.5, M.brass, .6, 'plain'); const spout = new T.Mesh(new T.BoxGeometry(1.2, 1.2, 7), M.brass); spout.position.set(0, 8.6, 3.2); tap.add(spout);
    unit(93, 3.5, 24, 18, .35, B + 1.52, M.dark, .58, 'plain'); rect(solid, 93, 3.5, 24, 18);
    [[99, 8], [111, 8], [99, 17], [111, 17]].forEach(c => ring(solid, c[0], c[1], 3.1));
    /* wall cabinets (dashed on the plan, as on a real one), window, hood */
    [[0, 36], [66, 24], [120, 30]].forEach((c, i) => { unit(c[0], 0, c[1], 13, 34, 54, M.wood, .62 + i * .05, 'wall', 'z'); rect(dash, c[0], 0, c[1], 13); });
    unit(0, 24, 13, 36, 34, 54, M.wood, .68, 'wall', 'x'); rect(dash, 0, 24, 13, 36);
    unit(0, 60, 13, 24, 34, 54, M.wood, .72, 'wall', 'x'); rect(dash, 0, 60, 13, 24);
    unit(39, -.4, 24, 1, 30, 54, M.cream, .56, 'plain'); unit(40.5, -.2, 21, 1, 27, 55.5, M.glass, .57, 'plain').children[0].castShadow = false;
    unit(92, 0, 26, 17, 5, 60, M.steel, .74, 'top'); unit(99, 0, 12, 10, 25, 65, M.steel, .76, 'plain'); rect(dash, 92, 0, 26, 17);
    /* dimension lines with slashes at the ends */
    (function(){
      const dimX = (x0, x1, z) => { dims.push(x0, z, x1, z, x0 - 2, z + 2, x0 + 2, z - 2, x1 - 2, z + 2, x1 + 2, z - 2, x0, z - 4, x0, z + 4, x1, z - 4, x1, z + 4); };
      const dimZ = (z0, z1, x) => { dims.push(x, z0, x, z1, x - 2, z0 + 2, x + 2, z0 - 2, x - 2, z1 + 2, x + 2, z1 - 2, x - 4, z0, x + 4, z0, x - 4, z1, x + 4, z1); };
      dimX(0, 151.5, -20); dimZ(0, 114, -20);
    })();
    const toGeo = a => { const p = []; for (let i = 0; i < a.length; i += 2) p.push(a[i], .2, a[i + 1]); const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); return g; };
    const planSolid = new T.LineSegments(toGeo(solid), brassLine), planDash = new T.LineSegments(toGeo(dash), brassDash); planDash.computeLineDistances();
    const planDims = new T.LineSegments(toGeo(dims), dimLine);
    kit.add(planSolid, planDash, planDims);
    const nSolid = solid.length / 2, nDash = dash.length / 2;

    const tkc = $('#tk-cab'); if (tkc) tkc.textContent = cabinets;
    const tags = [['12′ 7½″', 75.75, -20], ['9′ 6″', -20, 57]].map(t => { const el = document.createElement('span'); el.className = 'dimtag'; el.textContent = t[0]; el.setAttribute('aria-hidden', 'true'); host.append(el); return { el, v: new T.Vector3(t[1], .2, t[2]) }; });

    /* ---- timeline ---- */
    const sm = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const out = t => 1 - Math.pow(1 - t, 3);
    let p = calm ? 1 : 0, auto = !calm, t0 = 0, dragA = 0, dragB = 0, W = 1, H = 1, seen = !('IntersectionObserver' in window), begun = seen, tick = 0;
    const P0 = .3, toV = x => Math.round(Math.max(0, (x - P0) / (1 - P0)) * 1000);   /* the slider runs from the finished plan to the finished room */
    if (range) range.value = toV(p);
    const beside = matchMedia('(min-width:641px)');   /* on wide screens the estimate lies over the right corner, so the room moves a little left as it stands up */
    const tmp = new T.Vector3();
    function fit(){ W = host.clientWidth; H = host.clientHeight; if (!W || !H) return; R.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); }
    function frame(now){
      requestAnimationFrame(frame); if (!seen) return; if (!W || !H) { fit(); return; }
      if (auto && begun){ if (!t0) t0 = now + 350; const u = Math.min(1, Math.max(0, (now - t0) / 5200)); p = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; if (range) range.value = toV(p); if (u >= 1) auto = false; }
      const draw = sm(p, 0, .3), c = out(sm(p, .26, .78)), up = sm(p, .3, .44);
      planSolid.geometry.setDrawRange(0, Math.floor(nSolid * draw / 2) * 2); planDash.geometry.setDrawRange(0, Math.floor(nDash * sm(p, .12, .3) / 2) * 2);
      brassLine.opacity = .95 - .5 * sm(p, .5, .9); brassDash.opacity = .85 - .6 * sm(p, .5, .9); dimLine.opacity = .95 * sm(p, .16, .28) * (1 - up);
      const paper = 1 - sm(p, .34, .62); tintMat.opacity = .5 * paper; gridMat.opacity = .05 * paper; frameMat.opacity = .45 * paper;   /* the sheet is only a sheet while it is a plan */
      for (const it of parts){ const a = .3 + it.t0 * .46, q = out(sm(p, a, a + .15)); it.g.visible = q > .001; it.g.scale.y = Math.max(q, .001); }
      const narrow = Math.max(1, 1.2 / cam.aspect), sway = calm ? 0 : Math.sin(now / 4200) * .07 * c;
      const phi = .035 + (.98 + dragB) * c, th = (.62 + dragA) * c + sway, r = (455 + 20 * c) * narrow;
      const cx = 71 - 1 * c, cy = 26 * c, cz = 52 - 2 * c;
      cam.position.set(cx + r * Math.sin(phi) * Math.sin(th), cy + r * Math.cos(phi), cz + r * Math.sin(phi) * Math.cos(th)); cam.lookAt(cx, cy, cz);
      const skew = beside.matches ? 3.3 * sm(p, .6, .95) : 0; if (Math.abs(cam.filmOffset - skew) > .001) { cam.filmOffset = skew; cam.updateProjectionMatrix(); }
      R.render(scene, cam);
      const tagO = draw * (1 - up);
      for (const t of tags){ tmp.copy(t.v).project(cam); t.el.style.opacity = tagO.toFixed(3); if (tagO > .01) t.el.style.transform = 'translate(' + ((tmp.x * .5 + .5) * W).toFixed(1) + 'px,' + ((-tmp.y * .5 + .5) * H).toFixed(1) + 'px) translate(-50%,-50%)'; }
      if (!tick++) stage.classList.add('live');
      stage.classList.toggle('priced', p > .93);
    }
    fit(); addEventListener('resize', fit); if ('ResizeObserver' in window) new ResizeObserver(fit).observe(host);
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { const e = es[es.length - 1]; seen = e.isIntersecting; if (e.intersectionRatio >= .4) begun = true; }, { threshold: [0, .4] }).observe(host);
    if (range) range.addEventListener('input', () => { auto = false; p = P0 + (1 - P0) * range.value / 1000; });
    /* drag to turn: sideways on touch (the page still scrolls), both ways with a mouse */
    let down = null;
    host.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, a: dragA, b: dragB, m: e.pointerType === 'mouse' }; host.setPointerCapture && host.setPointerCapture(e.pointerId); });
    host.addEventListener('pointermove', e => { if (!down) return; dragA = Math.min(.95, Math.max(-1.25, down.a - (e.clientX - down.x) * .006)); if (down.m) dragB = Math.min(.32, Math.max(-.55, down.b - (e.clientY - down.y) * .004)); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => host.addEventListener(n, () => { down = null; }));
    window.__hero = { set: v => { auto = false; p = v; if (range) range.value = toV(v); }, turn: (a, b) => { dragA = a; dragB = b || 0; }, snap: () => { R.render(scene, cam); return R.domElement.toDataURL('image/png'); } };
    requestAnimationFrame(frame);
  }
})();
