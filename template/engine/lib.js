// Shared drawing kit: easing, seeded noise, brush lines, washes, paper, glyph strokes.
(function () {
  const QZ = (window.QZ = {});
  const W = (QZ.W = 1920);
  const H = (QZ.H = 1080);

  // ── palette ── (the vermilion dot is the only pure red in the film)
  const C = (QZ.C = {
    paper: [238, 228, 206],
    paperHi: [247, 241, 226],
    ink: [31, 27, 24],
    inkMid: [88, 82, 74],
    inkPale: [160, 152, 138],
    cyan: [96, 142, 138], // 石青
    green: [112, 146, 118], // 石绿
    pine: [58, 88, 72],
    slate: [108, 130, 150], // 黛蓝
    ochre: [181, 139, 90], // 赭石
    gold: [233, 185, 90], // 藤黄
    blush: [236, 170, 156], // 胭脂（淡）
    peach: [240, 190, 140],
    lilac: [186, 168, 200],
    wood: [70, 52, 40],
    red: [214, 62, 40], // 朱红
    redHi: [240, 112, 78],
    redLo: [168, 40, 28],
  });
  const rgba = (QZ.rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`);
  QZ.mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map(Math.round);

  // ── math ──
  const clamp = (QZ.clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x));
  const lerp = (QZ.lerp = (a, b, t) => a + (b - a) * t);
  QZ.prog = (t, a, b) => clamp((t - a) / (b - a));
  const ease = (QZ.ease = {
    lin: (t) => t,
    in2: (t) => t * t,
    out2: (t) => 1 - (1 - t) * (1 - t),
    io2: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    in3: (t) => t * t * t,
    out3: (t) => 1 - Math.pow(1 - t, 3),
    io3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    out4: (t) => 1 - Math.pow(1 - t, 4),
    in4: (t) => t * t * t * t,
    outBack: (t) => {
      const s = 1.9;
      const u = t - 1;
      return 1 + (s + 1) * u * u * u + s * u * u;
    },
    outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -9 * t) * Math.sin(((t * 9 - 0.75) * 2 * Math.PI) / 3) + 1),
    sm: (t) => t * t * (3 - 2 * t),
  });
  // keys: [time, value, easeIntoThisKey]
  QZ.kf = (t, keys) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const a = keys[i - 1];
        const b = keys[i];
        return lerp(a[1], b[1], (b[2] || ease.io2)(clamp((t - a[0]) / (b[0] - a[0]))));
      }
    }
    return keys[keys.length - 1][1];
  };
  // a pulse that rises and falls around t0
  QZ.bump = (t, t0, up, down) => (t < t0 ? ease.out2(clamp((t - (t0 - up)) / up)) : 1 - ease.io2(clamp((t - t0) / down)));
  // one half-sine hump lasting d seconds from t0 (a blink, a squash, a nod); 0 outside it
  QZ.bumpAt = (t, t0, d) => {
    const p = (t - t0) / d;
    return p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p);
  };
  // a ring-down after an impact at t0: 1 at the hit, oscillating at `freq` and dying at `rate`
  QZ.decay = (t, t0, rate, freq) => (t < t0 ? 0 : Math.exp(-(t - t0) * rate) * Math.cos((t - t0) * freq));

  const hash = (QZ.hash = (n) => {
    let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
    x ^= x >>> 13;
    x = Math.imul(x, 0xc2b2ae35);
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  });
  QZ.rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  // value noise in 0..1; `period` (lattice units) makes it wrap for seamless tiles
  const vnoise = (QZ.vnoise = (x, seed = 0, period = 0) => {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    const w = (k) => (period ? ((k % period) + period) % period : k);
    return lerp(hash(w(i) * 7919 + seed * 104729), hash(w(i + 1) * 7919 + seed * 104729), u);
  });
  QZ.fbm = (x, seed = 0, oct = 4, period = 0) => {
    let s = 0;
    let a = 0.5;
    let n = 0;
    for (let o = 0; o < oct; o++) {
      s += a * vnoise(x * (1 << o), seed + o * 31, period ? period * (1 << o) : 0);
      n += a;
      a *= 0.5;
    }
    return s / n;
  };

  QZ.canvas = (w, h) => {
    const c = document.createElement("canvas");
    c.width = Math.ceil(w);
    c.height = Math.ceil(h);
    return c;
  };

  // ── brush line: a ribbon with a width profile, slightly irregular like a loaded brush ──
  function catmull(pts, seg) {
    if (pts.length < 3) return pts.slice();
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let s = 0; s < seg; s++) {
        const t = s / seg;
        const t2 = t * t;
        const t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  QZ.catmull = catmull;

  // opts: w, color, alpha, p (0..1 drawn), taper: "both" | "end" | "start" | "none", seed, rough, seg
  QZ.inkLine = (ctx, pts, opts = {}) => {
    const w = opts.w || 4;
    const p = opts.p === undefined ? 1 : opts.p;
    if (p <= 0) return;
    const P = opts.seg === 0 ? pts : catmull(pts, opts.seg || 6);
    const n = P.length;
    if (n < 2) return;
    const cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const total = cum[n - 1];
    const stop = total * p;
    const taper = opts.taper || "both";
    const rough = opts.rough === undefined ? 0.3 : opts.rough;
    const seed = opts.seed || 1;
    const L = [];
    const R = [];
    for (let i = 0; i < n; i++) {
      let x = P[i][0];
      let y = P[i][1];
      let d = cum[i];
      const a = P[Math.max(0, i - 1)];
      const b = P[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0];
      let ty = b[1] - a[1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      let last = false;
      if (d > stop) {
        const back = (d - stop) / (d - cum[i - 1] || 1);
        x = lerp(x, P[i - 1][0], back);
        y = lerp(y, P[i - 1][1], back);
        d = stop;
        last = true;
      }
      const u = d / total; // position along the full path
      const v = stop > 0 ? d / stop : 0; // position along the drawn part
      let prof = 1;
      if (taper === "both") prof = Math.pow(Math.sin(Math.PI * clamp(u, 0.02, 0.98)), 0.55);
      else if (taper === "end") prof = Math.min(1, u / 0.06 + 0.35) * (1 - 0.82 * Math.pow(u, 1.6));
      else if (taper === "start") prof = 0.25 + 0.75 * Math.pow(u, 0.7);
      if (p < 1) prof *= Math.min(1, (1 - v) * 9 + 0.45); // a rounded live tip
      const ww = Math.max(0.3, w * 0.5 * prof * (1 - rough * 0.5 + rough * vnoise(d * 0.045, seed)));
      L.push([x - ty * ww, y + tx * ww]);
      R.push([x + ty * ww, y - tx * ww]);
      if (last) break;
    }
    ctx.beginPath();
    ctx.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < L.length; i++) ctx.lineTo(L[i][0], L[i][1]);
    for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath();
    ctx.fillStyle = rgba(opts.color || C.ink, opts.alpha === undefined ? 1 : opts.alpha);
    ctx.fill();
  };

  // soft elliptical wash
  QZ.wash = (ctx, x, y, rx, ry, color, a, core = 0.35) => {
    if (a <= 0) return;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, rgba(color, a));
    g.addColorStop(core, rgba(color, a * 0.85));
    g.addColorStop(1, rgba(color, 0));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // closed hand-wobbled blob
  QZ.blob = (ctx, cx, cy, rx, ry, seed, wob = 0.06, n = 40) => {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 + wob * (QZ.fbm((i / n) * 6, seed, 2, 6) - 0.5) * 2;
      const x = cx + Math.cos(a) * rx * k;
      const y = cy + Math.sin(a) * ry * k;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  // ── rice paper ──
  QZ.makePaper = () => {
    const c = QZ.canvas(W, H);
    const x = c.getContext("2d");
    x.fillStyle = rgba(C.paper);
    x.fillRect(0, 0, W, H);
    const r = QZ.rng(77);
    for (let i = 0; i < 90; i++) {
      const light = r() > 0.5;
      QZ.wash(x, r() * W, r() * H, 180 + r() * 420, 120 + r() * 300, light ? C.paperHi : [214, 198, 166], 0.1 + r() * 0.12);
    }
    // fibres
    x.lineCap = "round";
    for (let i = 0; i < 2600; i++) {
      const px = r() * W;
      const py = r() * H;
      const a = r() * Math.PI;
      const l = 6 + r() * 34;
      x.strokeStyle = r() > 0.45 ? rgba([150, 130, 96], 0.05 + r() * 0.08) : rgba([255, 252, 240], 0.1 + r() * 0.16);
      x.lineWidth = 0.6 + r() * 1.1;
      x.beginPath();
      x.moveTo(px, py);
      x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + (r() - 0.5) * 8, py + Math.sin(a) * l * 0.5 + (r() - 0.5) * 8, px + Math.cos(a) * l, py + Math.sin(a) * l);
      x.stroke();
    }
    // speckle
    const img = x.getImageData(0, 0, W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (r() - 0.5) * 13;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n * 0.9;
    }
    x.putImageData(img, 0, 0);
    // edges a touch darker, like an old sheet
    const g = x.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
    g.addColorStop(0, "rgba(120,96,60,0)");
    g.addColorStop(1, "rgba(120,96,60,0.26)");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    return c;
  };
  // tooth: multiplied over the finished frame so every colour sinks into the paper
  QZ.makeTooth = () => {
    const c = QZ.canvas(W / 2, H / 2);
    const x = c.getContext("2d");
    const img = x.createImageData(c.width, c.height);
    const d = img.data;
    const r = QZ.rng(909);
    for (let i = 0; i < d.length; i += 4) {
      const n = 255 - Math.pow(r(), 2.2) * 46;
      d[i] = n;
      d[i + 1] = n;
      d[i + 2] = n - 3;
      d[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  };

  // ── glyph strokes (hanzi-writer-data: 1024 box, y up, baseline at 900) ──
  const gcache = {};
  function glyph(ch) {
    if (gcache[ch]) return gcache[ch];
    const g = window.GLYPHS[ch];
    if (!g) throw new Error(`no stroke data for 「${ch}」 — add it to "glyphs" in poem.json and run: python3 tools/film.py glyphs`);
    const med = g.m.map((m) => {
      // extend both ends a little so the round cap fully covers the stroke's ends
      const a = m[0];
      const b = m[1];
      const y = m[m.length - 1];
      const z = m[m.length - 2];
      const la = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
      const lz = Math.hypot(y[0] - z[0], y[1] - z[1]) || 1;
      const pts = [[a[0] + ((a[0] - b[0]) / la) * 90, a[1] + ((a[1] - b[1]) / la) * 90], ...m, [y[0] + ((y[0] - z[0]) / lz) * 90, y[1] + ((y[1] - z[1]) / lz) * 90]];
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      return { pts, cum, total: cum[cum.length - 1] };
    });
    return (gcache[ch] = { paths: g.s.map((s) => new Path2D(s)), med });
  }
  QZ.glyph = glyph;
  function medPoint(m, f) {
    const d = m.total * clamp(f);
    for (let i = 1; i < m.pts.length; i++) {
      if (d <= m.cum[i]) {
        const k = (d - m.cum[i - 1]) / (m.cum[i] - m.cum[i - 1] || 1);
        return [lerp(m.pts[i - 1][0], m.pts[i][0], k), lerp(m.pts[i - 1][1], m.pts[i][1], k)];
      }
    }
    return m.pts[m.pts.length - 1];
  }
  // screen position of a stroke's tip at fraction f, for a glyph whose box top-left is (x, y)
  QZ.strokeTip = (ch, si, f, x, y, size) => {
    const m = glyph(ch).med[si];
    // skip the invisible lead-in/lead-out extensions
    const lead = 90 / m.total;
    const p = medPoint(m, lerp(lead, 1 - lead, f));
    return [x + (p[0] * size) / 1024, y + ((900 - p[1]) * size) / 1024];
  };
  // fn(si) → 0..1 drawn fraction of stroke si; omitted = fully drawn
  QZ.drawGlyph = (ctx, ch, x, y, size, color, fn) => {
    const g = glyph(ch);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 1024, -size / 1024);
    ctx.translate(0, -900);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    for (let si = 0; si < g.paths.length; si++) {
      const f = fn ? fn(si) : 1;
      if (f <= 0) continue;
      if (f >= 1) {
        ctx.fill(g.paths[si]);
        continue;
      }
      const m = g.med[si];
      ctx.save();
      ctx.clip(g.paths[si]);
      ctx.lineWidth = 230;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const stopAt = 90 + (m.total - 180) * f; // same mapping as strokeTip, so the dot rides the ink's tip
      ctx.beginPath();
      ctx.moveTo(m.pts[0][0], m.pts[0][1]);
      for (let i = 1; i < m.pts.length; i++) {
        if (m.cum[i] <= stopAt) ctx.lineTo(m.pts[i][0], m.pts[i][1]);
        else {
          const k = (stopAt - m.cum[i - 1]) / (m.cum[i] - m.cum[i - 1] || 1);
          ctx.lineTo(lerp(m.pts[i - 1][0], m.pts[i][0], k), lerp(m.pts[i - 1][1], m.pts[i][1], k));
          break;
        }
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  };
  // a run of glyphs written one after another; p = 0..1 over the whole run
  QZ.drawText = (ctx, text, x, y, size, pitch, color, p, vertical) => {
    const chars = [...text];
    chars.forEach((ch, i) => {
      if (ch === " ") return;
      const a = i / chars.length;
      const b = (i + 1) / chars.length;
      const f = clamp((p - a) / (b - a));
      if (f <= 0) return;
      const n = glyph(ch).paths.length;
      QZ.drawGlyph(ctx, ch, vertical ? x : x + i * pitch, vertical ? y + i * pitch : y, size, color, f >= 1 ? null : (si) => clamp(f * n - si));
    });
  };
})();
