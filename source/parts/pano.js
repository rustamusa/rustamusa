/* ---------- look-around: one photoreal panorama on the inside of a sphere, drag to turn ----------
   The picture is a panorama rendered for an elevator cab walk-through. three.js is the planner's copy and loads only
   when a look-around comes near the screen. Until it is ready, and where WebGL is missing, the first frame stays as a picture. */
(function(){
  const hosts = [...document.querySelectorAll('[data-pano]')]; if (!hosts.length) return;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches, SRC = 'planner/js/three.min.js';
  let lib;
  const three = () => lib || (lib = new Promise((res, rej) => {
    if (window.THREE) return res(window.THREE);
    let s = document.querySelector('script[src="' + SRC + '"]');
    if (!s) { s = document.createElement('script'); s.src = SRC; s.async = true; document.head.append(s); }
    s.addEventListener('load', () => res(window.THREE)); s.addEventListener('error', rej);
  }));
  hosts.forEach(host => {
    let booted = false;
    const boot = () => { if (booted) return; booted = true; three().then(T => make(T, host)).catch(() => {}); };
    if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); boot(); } }, { rootMargin: '300px' }); io.observe(host); } else boot();
  });

  function make(T, host){
    let R; try { R = new T.WebGLRenderer({ antialias: true }); } catch (e) { return; }
    R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const lite = R.capabilities.maxTextureSize < 4096 || !!(navigator.connection && navigator.connection.saveData);
    const scene = new T.Scene(), cam = new T.PerspectiveCamera(70, 1, .1, 100), rad = T.MathUtils.degToRad;
    const geo = new T.SphereGeometry(10, 72, 44); geo.scale(-1, 1, 1);          /* seen from inside, not mirrored */
    const start = 180 + (+host.dataset.yaw || 0);                                /* 180 = the middle of the picture */
    let lon = start, lat = 0, W = 0, H = 0, seen = !('IntersectionObserver' in window), used = false, dirty = true, t0 = 0, down = null;
    const touch = () => { if (!used) { used = true; host.classList.add('used'); } };
    let ready = false;
    function draw(){ const p = rad(90 - lat), th = rad(lon); cam.lookAt(Math.sin(p) * Math.cos(th), Math.cos(p), Math.sin(p) * Math.sin(th)); R.render(scene, cam); dirty = false; }
    /* a resize empties the canvas, so it is drawn again at once: the canvas never shows black over the first frame */
    function fit(){ const w = host.clientWidth, h = host.clientHeight; if (!w || !h || (w === W && h === H)) return; W = w; H = h; R.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); if (ready) draw(); }
    function frame(now){
      requestAnimationFrame(frame); if (!seen) return; if (!W || !H) { fit(); return; }
      if (!used && !calm) { if (!t0) t0 = now; lon = start + 14 * Math.sin((now - t0) / 3600); dirty = true; }   /* a slow sway says: this turns */
      if (dirty) draw();
    }
    new T.TextureLoader().load(host.dataset[lite ? 'panoS' : 'pano'], tex => {
      tex.anisotropy = Math.min(8, R.capabilities.getMaxAnisotropy());
      scene.add(new T.Mesh(geo, new T.MeshBasicMaterial({ map: tex })));
      host.append(R.domElement); ready = true; fit(); draw(); requestAnimationFrame(frame);
      requestAnimationFrame(() => requestAnimationFrame(() => host.classList.add('live')));
    }, undefined, () => {});
    addEventListener('resize', fit); if ('ResizeObserver' in window) new ResizeObserver(fit).observe(host);
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { seen = es[es.length - 1].isIntersecting; dirty = true; }).observe(host);
    /* drag to turn: sideways on touch (the page still scrolls), both ways with a mouse; arrow keys too */
    const perPx = () => 2 * Math.atan(Math.tan(rad(35)) * cam.aspect) * 180 / Math.PI / (W || 1);
    host.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, lon, lat, m: e.pointerType === 'mouse' }; touch(); host.setPointerCapture && host.setPointerCapture(e.pointerId); });
    host.addEventListener('pointermove', e => { if (!down) return; const k = perPx(); lon = down.lon - (e.clientX - down.x) * k; if (down.m) lat = Math.max(-55, Math.min(55, down.lat + (e.clientY - down.y) * k)); dirty = true; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => host.addEventListener(n, () => { down = null; }));
    host.addEventListener('keydown', e => { const d = { ArrowLeft: -12, ArrowRight: 12 }[e.key]; if (!d) return; e.preventDefault(); touch(); lon += d; dirty = true; });
    host.__look = (a, b) => { if (a !== undefined) { touch(); lon = a; lat = b || 0; dirty = true; } return { lon, lat }; };
  }
})();
