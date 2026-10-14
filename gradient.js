/* Synapse Hive — animated hero gradient (WebGL2). Shape: Figma page “Gradienty”. */
const SynapseGradient = (() => {
  // Kształt z Figmy (strona „Gradienty”), w lokalnych współrzędnych przed obrotem.
  const PATH = "M155.918 30.6037 C285.001 -35.2324 446.423 8.43336 524.901 130.102 C553.721 174.849 568.199 224.327 570.093 273.535 L588.089 666.253 C592.554 763.317 643.971 852.271 725.831 904.724 L1047.74 1110.92 C1052.43 1113.6 1057.07 1116.42 1061.67 1119.4 C1111.23 1151.51 1147.72 1197.37 1169.08 1249.13 C1178.66 1272.18 1185 1295.95 1188.25 1319.87 C1196.08 1376.22 1187.36 1435.16 1159.9 1488.46 C1135.41 1535.78 1099.82 1573.09 1058.15 1599.31 L726.78 1811.29 C644.785 1863.6 593.368 1952.56 588.902 2049.62 L570.501 2443.02 C568.877 2487.76 556.565 2532.92 532.615 2574.42 C451.296 2714.88 268.36 2760.17 130.212 2670.81 C8.57145 2591.99 -34.4554 2430.44 31.8448 2301.75 C56.2 2254.43 91.9204 2217.12 133.595 2190.89 L465.367 1978.38 C547.363 1925.93 598.645 1836.97 603.11 1739.91 L603.381 1739.91 L620.594 1364.25 L602.431 975.967 C597.83 878.903 546.549 790.085 464.553 737.632 L464.553 737.497 L133.187 525.524 C95.1654 501.596 62.1506 468.474 38.2013 426.972 C-42.9825 286.377 9.38108 105.362 155.918 30.6037 Z";
  const HALF_W = 1358.42, H = 1191, PAD = 280, GAP = 131.5, COMP_H = 2645, DS = 0.4, BAND = 28;

  // Ścieżka -> łamana (krzywe Béziera spłaszczone), w pikselach tekstury.
  function polyline() {
    const t = PATH.match(/[MLCZ]|-?\d*\.?\d+/g); const pts = []; let i = 0, cmd, cur;
    const n = () => parseFloat(t[i++]);
    const tx = (x, y) => [(y + PAD) * DS, (H - x + PAD) * DS];
    while (i < t.length) {
      if (/[MLCZ]/.test(t[i])) { cmd = t[i++]; if (cmd === 'Z') continue; }
      if (cmd === 'M' || cmd === 'L') { cur = [n(), n()]; pts.push(tx(...cur)); }
      else if (cmd === 'C') {
        const p1 = [n(), n()], p2 = [n(), n()], p3 = [n(), n()], p0 = cur;
        for (let k = 1; k <= 32; k++) { const s = k / 32, a = 1 - s;
          pts.push(tx(a*a*a*p0[0] + 3*a*a*s*p1[0] + 3*a*s*s*p2[0] + s*s*s*p3[0], a*a*a*p0[1] + 3*a*a*s*p1[1] + 3*a*s*s*p2[1] + s*s*s*p3[1])); }
        cur = p3;
      }
    }
    return pts;
  }

  function buildSDF() {
    const W = Math.round((HALF_W * 2 + PAD * 2) * DS), Ht = Math.round((H + PAD * 2) * DS), n = W * Ht, INF = 1e20;
    const pts = polyline(), segs = pts.length;
    // 1) zgrubne pole odległości (EDT) z rasteryzacji — używane daleko od krawędzi
    const cv = document.createElement('canvas'); cv.width = W; cv.height = Ht;
    const ctx = cv.getContext('2d'); ctx.beginPath(); pts.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill();
    const img = ctx.getImageData(0, 0, W, Ht).data;
    const outer = new Float64Array(n), inner = new Float64Array(n);
    for (let i = 0; i < n; i++) { const a = img[i * 4 + 3] / 255;
      outer[i] = a === 1 ? 0 : a === 0 ? INF : Math.max(0, .5 - a) ** 2;
      inner[i] = a === 1 ? INF : a === 0 ? 0 : Math.max(0, a - .5) ** 2; }
    const m = Math.max(W, Ht), f = new Float64Array(m), d = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1);
    function edt1d(len) { let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < len; q++) { let s = ((f[q] + q*q) - (f[v[k]] + v[k]*v[k])) / (2*q - 2*v[k]);
        while (s <= z[k]) { k--; s = ((f[q] + q*q) - (f[v[k]] + v[k]*v[k])) / (2*q - 2*v[k]); }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF; }
      k = 0; for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; } }
    function edt(g) {
      for (let x = 0; x < W; x++) { for (let y = 0; y < Ht; y++) f[y] = g[y*W + x]; edt1d(Ht); for (let y = 0; y < Ht; y++) g[y*W + x] = d[y]; }
      for (let y = 0; y < Ht; y++) { for (let x = 0; x < W; x++) f[x] = g[y*W + x]; edt1d(W); for (let x = 0; x < W; x++) g[y*W + x] = d[x]; } }
    edt(outer); edt(inner);
    // 2) dokładna odległość do krzywej w pasie przy krawędzi — gładkie, niefalujące brzegi
    const band = BAND * DS, exact = new Float32Array(n).fill(INF);
    for (let k = 0; k < segs; k++) {
      const A = pts[k], B = pts[(k + 1) % segs], ex = B[0] - A[0], ey = B[1] - A[1], L2 = ex*ex + ey*ey || 1;
      const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0]) - band)), x1 = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0]) + band));
      const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1]) - band)), y1 = Math.min(Ht - 1, Math.ceil(Math.max(A[1], B[1]) + band));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + .5 - A[0], py = y + .5 - A[1], s = Math.max(0, Math.min(1, (px*ex + py*ey) / L2));
        const dx = px - s*ex, dy = py - s*ey, dd = dx*dx + dy*dy, i = y*W + x;
        if (dd < exact[i]) exact[i] = dd;
      }
    }
    const inside = (x, y) => { let c = false;
      for (let k = 0, j = segs - 1; k < segs; j = k++) { const a = pts[k], b = pts[j];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; }
      return c; };
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (exact[i] < band * band) {
        const dist = Math.sqrt(exact[i]), x = i % W + .5, y = (i / W | 0) + .5;
        const inn = dist < 2 ? inside(x, y) : img[i*4 + 3] >= 128;   // znak dokładny tuż przy krawędzi
        out[i] = (inn ? -dist : dist) / DS;
      } else out[i] = (Math.sqrt(outer[i]) - Math.sqrt(inner[i])) / DS;
    }
    return { data: out, w: W, h: Ht };
  }

  const VS = `#version 300 es
  in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
  const FS = `#version 300 es
  precision highp float;
  uniform vec2 uRes, uCenter; uniform float uScale, uGap, uSigma, uBlurLen, uNoise, uDpr, uH;
  uniform vec3 uA, uB, uBg; uniform vec4 uMap; uniform sampler2D uTex;
  uniform float uMode; uniform vec2 uTip;   // uMode 0: two shapes facing each other (desktop) · 1: one shape, tip at the right edge (mobile)
  out vec4 o;
  float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  float erfA(float x){ float x2 = x*x, a = .147; return sign(x) * sqrt(1. - exp(-x2 * (1.2732395 + a*x2) / (1. + a*x2))); }
  vec4 ramp(float t){
    vec4 c0 = vec4(.0706,.1686,.3294,1.), c1 = vec4(.1778,.2876,.4626,1.), c2 = vec4(.5285,.7918,.9261,.945), c3 = vec4(.902,.9843,1.,1.);
    if (t < .0817) return mix(c0, c1, t / .0817);
    if (t < .4038) return mix(c1, c2, (t - .0817) / .3221);
    return mix(c2, c3, (t - .4038) / .5962);
  }
  vec4 shape(vec2 p, vec3 s){
    float E = s.x, S = s.y;
    float w = 1. - smoothstep(-E, 650., p.y);
    float vs = p.y + E * w, us = p.x / S;
    vec2 tc = vec2((us + uMap.x + uMap.y) / uMap.z, (vs + uMap.y) / uMap.w);
    float d = texture(uTex, tc).r;
    float sig = max(uSigma * clamp(vs / uBlurLen, 0., 1.), .6 / uScale);
    float cov = .5 * (1. - erfA(d / (sig * 1.41421)));
    vec4 c = ramp(clamp(vs / uH, 0., 1.));
    return vec4(c.rgb, c.a * cov);
  }
  void main(){
    vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec3 col = uBg;
    if (uMode > .5) {
      // single shape: u runs down the page, v grows leftwards from the tip
      vec4 a = shape(vec2((fc.y - uTip.y) / uScale, (uTip.x - fc.x) / uScale), uA);
      col = mix(col, a.rgb, a.a);
    } else {
      vec2 d = (fc - uCenter) / uScale;
      vec4 a = shape(vec2(d.x,  d.y - uGap), uA);
      vec4 b = shape(vec2(d.x, -d.y - uGap), uB);
      col = mix(col, b.rgb, b.a);
      col = mix(col, a.rgb, a.a);
    }
    vec2 cell = floor(gl_FragCoord.xy / uDpr);
    col += (hash(cell) - .5) * uNoise * .25;          // ziarno na całości
    col += (hash(cell + 71.3) - .5) / 255.;            // dithering przeciw pasmom
    o = vec4(clamp(col, 0., 1.), 1.);
  }`;

  let sdfCache = null;
  const hex = h => { const x = parseInt(h.replace('#', ''), 16); return [(x >> 16 & 255) / 255, (x >> 8 & 255) / 255, (x & 255) / 255]; };

  function mount(el, userCfg = {}) {
    const cfg = Object.assign({ centerX: .66, scale: 1, scroll: 1, blur: 50, blurScroll: .85, noise: .12, bg: '#F4F8FB', intro: 1.8, introFrom: 1, apart: 0, mode: 'pair', size: .7, tipX: 1, centerY: .5, mobile: null }, userCfg);
    const base = Object.assign({}, cfg);
    const mq = matchMedia('(max-width: 720px)');
    const applyBp = () => { Object.assign(cfg, base, mq.matches && base.mobile ? base.mobile : {}); drawn = ''; };
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    el.appendChild(canvas);
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) { canvas.remove(); return { cfg, redraw(){}, destroy(){} }; }

    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(x); return x; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ['uRes','uCenter','uScale','uGap','uSigma','uBlurLen','uNoise','uDpr','uH','uA','uB','uBg','uMap','uTex','uMode','uTip'].forEach(k => U[k] = gl.getUniformLocation(pr, k));

    sdfCache = sdfCache || buildSDF();
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, sdfCache.w, sdfCache.h, 0, gl.RED, gl.FLOAT, sdfCache.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(U.uTex, 0); gl.uniform1f(U.uGap, GAP); gl.uniform1f(U.uBlurLen, H * .247); gl.uniform1f(U.uH, H);
    gl.uniform4f(U.uMap, HALF_W, PAD, sdfCache.w / DS, sdfCache.h / DS);

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, Hh = 0, dpr = 1, visible = true, raf = 0, last = performance.now(), drawn = '';
    const t0 = performance.now();
    mq.addEventListener('change', applyBp); applyBp();
    const st = { ext: GAP * .92, spread: .88, sharp: 1 };

    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = el.clientWidth; Hh = el.clientHeight;
      canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(Hh * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height); drawn = '';
      if (reduced) draw();
    }
    const ro = new ResizeObserver(resize); ro.observe(el);
    const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; if (visible) loop(); }); io.observe(el);

    function update(dt) {
      const r = el.getBoundingClientRect();
      // postęp = 1, gdy środek hero (czubki) dojdzie do górnej krawędzi okna
      let p = reduced ? 0 : Math.min(1, Math.max(0, -r.top / Math.max(1, r.height * .5)));
      // intro: on load play the full 'scroll up' (tips close & sharp -> open & blurred)
      if (!reduced && cfg.intro > 0) { const k = Math.min(1, (performance.now() - t0) / 1000 / cfg.intro); const e = (1 - (k < .5 ? 4*k*k*k : 1 - Math.pow(-2*k + 2, 3) / 2)) * cfg.introFrom; p = Math.max(p, e); }
      const single = cfg.mode === 'right';
      const ext = single ? 0 : -cfg.apart + p * (GAP * .92 + cfg.apart) * cfg.scroll;  // tips: 'apart' units further apart at rest, nearly touching at full scroll
      const spread = single ? 1 : 1 - .12 * p * cfg.scroll;           // kształty się zwężają
      const sharp = p * cfg.blurScroll;                  // im bliżej, tym mniej rozmycia
      const k = dt === 0 ? 0 : 1 - Math.exp(-dt * 6);
      st.ext += (ext - st.ext) * k; st.spread += (spread - st.spread) * k; st.sharp += (sharp - st.sharp) * k;
    }
    function draw() {
      const single = cfg.mode === 'right';
      // desktop: scale from the hero height · mobile: the shape's depth is cfg.size × the hero width (Figma "Instagram post" ref: 0.7)
      const scalePx = single ? W * cfg.size / H : Hh * 1.15 * cfg.scale / COMP_H;
      gl.uniform1f(U.uMode, single ? 1 : 0);
      gl.uniform2f(U.uTip, W * cfg.tipX * dpr, Hh * cfg.centerY * dpr);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform2f(U.uCenter, W * cfg.centerX * dpr, Hh / 2 * dpr);
      gl.uniform1f(U.uScale, scalePx * dpr);
      gl.uniform1f(U.uSigma, cfg.blur * (1 - st.sharp));
      gl.uniform1f(U.uNoise, cfg.noise); gl.uniform1f(U.uDpr, dpr);
      gl.uniform3f(U.uBg, ...hex(cfg.bg));
      gl.uniform3f(U.uA, st.ext, st.spread, 0); gl.uniform3f(U.uB, st.ext, st.spread, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function loop() {
      if (raf || reduced) return;
      const f = now => {
        raf = 0;
        if (!visible || document.hidden) return;
        const dt = Math.min(.05, (now - last) / 1000); last = now;
        update(dt);
        const key = [W, Hh, dpr, st.ext.toFixed(2), st.spread.toFixed(4), st.sharp.toFixed(4), JSON.stringify(cfg)].join('|');
        if (key !== drawn) { drawn = key; draw(); }      // rysuj tylko, gdy coś się zmieniło
        raf = requestAnimationFrame(f);
      };
      last = performance.now(); raf = requestAnimationFrame(f);
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });
    resize(); { const p0 = cfg.intro > 0 && !reduced ? cfg.introFrom : 0; st.sharp = p0 * cfg.blurScroll; const one = cfg.mode === 'right'; st.ext = one ? 0 : -cfg.apart + p0 * (GAP * .92 + cfg.apart) * cfg.scroll; st.spread = one ? 1 : 1 - .12 * p0 * cfg.scroll; } draw(); loop();

    return { cfg, redraw: () => { update(0); draw(); }, destroy() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); canvas.remove(); } };
  }
  return { mount };
})();
