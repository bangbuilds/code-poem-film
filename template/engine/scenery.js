// Scenery kit: things painted once into tiles (ridges, cliffs, banks) and things drawn every frame
// (sky, sun, moon, clouds, water, weather, birds), plus a few buildings and trees.
// Everything is seeded: the same arguments always paint the same picture.
(function () {
  const QZ = window.QZ;
  const { W, H, C, rgba, mix, clamp, lerp, prog, ease, hash, rng, vnoise, fbm, inkLine, wash } = QZ;
  const SC = (QZ.scenery = {});
  const sstep = (a, b, x) => ease.sm(clamp((x - a) / (b - a)));
  SC.sstep = sstep;

  // ── ridge painting ──
  // hs: Float32Array of heights (px above `base`) per x. o: base, bottom, color, aTop, aBot, depth, seed,
  // outline {w, a, color}, tex {kind: "slope" | "vertical", n, len, a, color}, moss (count)
  function paintRidge(ctx, hs, o) {
    const w = hs.length - 1;
    const step = 3;
    for (let x = 0; x < w; x += step) {
      const top = o.base - hs[x];
      if (hs[x] <= 0.5) continue;
      const g = ctx.createLinearGradient(0, top, 0, top + o.depth);
      g.addColorStop(0, rgba(o.color, o.aTop));
      g.addColorStop(1, rgba(o.color, o.aBot));
      ctx.fillStyle = g;
      ctx.fillRect(x, top, step + 0.6, o.bottom - top);
    }
    const r = rng(o.seed * 13 + 5);
    if (o.tex) {
      for (let i = 0; i < o.tex.n; i++) {
        const x = r() * w;
        const hx = hs[Math.floor(x)];
        if (hx < 30) continue;
        const top = o.base - hx;
        const y0 = top + 6 + r() * hx * 0.35;
        const len = (o.tex.len || 120) * (0.4 + r());
        const slope = o.tex.kind === "slope" ? (hs[Math.min(w, Math.floor(x) + 12)] - hs[Math.max(0, Math.floor(x) - 12)]) / 24 : 0;
        const dx = o.tex.kind === "slope" ? (slope > 0 ? -1 : 1) * len * 0.45 : (r() - 0.5) * 14;
        inkLine(ctx, [[x, y0], [x + dx * 0.4 + (r() - 0.5) * 6, y0 + len * 0.5], [x + dx, y0 + len]], {
          w: 1.4 + r() * 2.6,
          color: o.tex.color || C.ink,
          alpha: (o.tex.a || 0.16) * (0.5 + r()),
          taper: "end",
          seed: i,
        });
      }
    }
    if (o.outline) {
      const pts = [];
      for (let x = 0; x <= w; x += 14) pts.push([x, o.base - hs[x] + 1]);
      // break the outline where the ridge is flat on the ground
      let run = [];
      const flush = () => {
        if (run.length > 3) inkLine(ctx, run, { w: o.outline.w, color: o.outline.color || C.ink, alpha: o.outline.a, taper: "none", rough: 0.75, seed: o.seed, seg: 0 });
        run = [];
      };
      for (const p of pts) {
        if (o.base - p[1] > 2) run.push(p);
        else flush();
      }
      flush();
    }
    if (o.moss) {
      for (let i = 0; i < o.moss; i++) {
        const x = r() * w;
        const hx = hs[Math.floor(x)];
        if (hx < 40) continue;
        const top = o.base - hx;
        const k = 2 + Math.floor(r() * 4);
        for (let j = 0; j < k; j++) {
          ctx.fillStyle = rgba(C.ink, 0.35 + r() * 0.3);
          ctx.beginPath();
          ctx.ellipse(x + (r() - 0.5) * 26, top + 2 + r() * 22, 2 + r() * 3.2, 1.4 + r() * 1.8, r(), 0, 7);
          ctx.fill();
        }
      }
    }
  }
  SC.paintRidge = paintRidge;

  function miniPine(ctx, x, y, s, a) {
    inkLine(ctx, [[x, y], [x + 2 * s, y - 20 * s], [x + 1 * s, y - 40 * s]], { w: 3 * s, color: C.ink, alpha: a, taper: "end" });
    for (let k = 0; k < 3; k++) {
      const yy = y - (16 + k * 11) * s;
      const ww = (20 - k * 5) * s;
      ctx.fillStyle = rgba(C.pine, a * 0.95);
      ctx.beginPath();
      ctx.ellipse(x + 1 * s, yy, ww, 4.6 * s, 0, 0, 7);
      ctx.fill();
    }
  }
  SC.miniPine = miniPine;

  // ── tile builders ──
  // All return a canvas with `.hs` (the height profile), so things can be stood on the ridge line.
  // Repeating tiles (ridgeTile, cliffTile, bankTile) wrap seamlessly; draw them with SC.drawTile.

  // rolling to jagged mountains. sharp: 1.2 soft hills … 2.0 needle peaks. floor: lowest valley as a share of amp.
  SC.ridgeTile = (o) => {
    const w = o.w || 3072;
    const h = o.h;
    const c = QZ.canvas(w, h);
    const x = c.getContext("2d");
    const hs = new Float32Array(w + 1);
    const j = o.jitter || { amp: 8, f: 0.06, seed: 3 };
    for (let i = 0; i <= w; i++) hs[i] = o.amp * (o.floor + (1 - o.floor) * Math.pow(fbm((i / w) * o.freq, o.seed, 4, o.freq), o.sharp)) + j.amp * vnoise(i * j.f, j.seed, Math.round(w * j.f));
    paintRidge(x, hs, { base: h, bottom: h, ...o.paint });
    c.hs = hs;
    return c;
  };

  // a gorge wall: tall plateaus with columnar faces, ochre near the water, small pines along the top
  SC.cliffTile = (o) => {
    const w = o.w || 4096;
    const h = o.h;
    const c = QZ.canvas(w, h);
    const x = c.getContext("2d");
    const hs = new Float32Array(w + 1);
    for (let i = 0; i <= w; i++) {
      const u = i / w;
      const n = fbm(u * o.freq, o.seed, 3, o.freq);
      const plate = sstep(o.plate[0], o.plate[1], n);
      const col = vnoise(i / 46, o.seed + 14, Math.round(w / 46));
      hs[i] = o.amp * (o.floor + (1 - o.floor) * (0.72 * plate + 0.28 * n)) + 46 * (col - 0.5) + 10 * vnoise(i * 0.09, 6, Math.round(w * 0.09));
    }
    paintRidge(x, hs, { base: h, bottom: h, ...o.paint });
    // warmth low on the rock, and a paler mist line where it meets the water
    x.globalCompositeOperation = "source-atop";
    const g = x.createLinearGradient(0, h - 330, 0, h);
    g.addColorStop(0, rgba(C.ochre, 0));
    g.addColorStop(0.7, rgba(C.ochre, 0.3));
    g.addColorStop(1, rgba(C.paperHi, 0.55));
    x.fillStyle = g;
    x.fillRect(0, h - 330, w, 330);
    x.globalCompositeOperation = "source-over";
    const r = rng(o.pineSeed || 41);
    for (let i = 0; i < (o.pines === undefined ? 46 : o.pines); i++) {
      const px = r() * w;
      const hh = hs[Math.floor(px)];
      miniPine(x, px, h - hh + 4, 0.9 + r() * 0.9, 0.8);
    }
    c.hs = hs;
    return c;
  };

  // the near bank, in front of the lens: low rocks and reeds with gaps between, lightly smeared sideways
  SC.bankTile = (o) => {
    const w = o.w || 4096;
    const h = o.h || 300;
    const raw = QZ.canvas(w, h);
    const x = raw.getContext("2d");
    const hs = new Float32Array(w + 1);
    for (let i = 0; i <= w; i++) {
      const n = fbm((i / w) * o.freq, o.seed, 3, o.freq);
      hs[i] = Math.max(0, n - 0.55) * 2.2 * o.amp + (n > 0.53 ? 12 * vnoise(i * 0.08, 9, Math.round(w * 0.08)) : 0);
    }
    paintRidge(x, hs, { base: h, bottom: h, color: [46, 62, 56], aTop: 0.96, aBot: 0.96, depth: 300, seed: 4, outline: { w: 4, a: 0.7 }, ...o.paint });
    const r = rng(o.reedSeed || 88);
    for (let i = 0; i < (o.reeds === undefined ? 260 : o.reeds); i++) {
      const px = r() * w;
      const hh = hs[Math.floor(px)];
      if (hh < 14) continue;
      const top = h - hh;
      const lean = (r() - 0.25) * 70;
      const len = 50 + r() * 110;
      inkLine(x, [[px, top + 10], [px + lean * 0.4, top - len * 0.55], [px + lean, top - len]], { w: 3.4 + r() * 2.6, color: [52, 76, 60], alpha: 0.95, taper: "end", seed: i });
    }
    const c = QZ.canvas(w, h);
    const y = c.getContext("2d");
    const blur = o.smear === undefined ? 3 : o.smear;
    for (let k = -blur; k <= blur; k++) {
      y.globalAlpha = blur ? 0.3 : 1;
      y.drawImage(raw, k * 6, 0);
    }
    c.hs = hs;
    return c;
  };

  // a ridge that does not repeat and dies away at its right end — for wide views where the mountains
  // slide off and leave open water. `taper` = how many px before the end it starts to fall.
  SC.fadingRidge = (o) => {
    const w = o.w || 4300;
    const h = o.h || 620;
    const c = QZ.canvas(w, h);
    const x = c.getContext("2d");
    const hs = new Float32Array(w + 1);
    for (let k = 0; k <= w; k++) {
      const env = sstep(w - 30, w - o.taper, k);
      hs[k] = env * o.amp * (o.floor + (1 - o.floor) * Math.pow(fbm(k / o.scale, o.seed, 4), o.sharp)) + env * 8 * vnoise(k * 0.06, o.jitterSeed || 0);
    }
    paintRidge(x, hs, { base: h, bottom: h, ...o.paint });
    // mist at the foot, kept inside the ridge's own shape
    x.globalCompositeOperation = "source-atop";
    const m = x.createLinearGradient(0, h - 90, 0, h);
    m.addColorStop(0, rgba(C.paperHi, 0));
    m.addColorStop(1, rgba(C.paperHi, o.mist === undefined ? 0.5 : o.mist));
    x.fillStyle = m;
    x.fillRect(0, h - 90, w, 90);
    x.globalCompositeOperation = "source-over";
    c.hs = hs;
    return c;
  };

  // a grassy bank to stand on: a long strip whose top edge is the ground line (y = `top` inside the tile)
  SC.groundTile = (o) => {
    const w = o.w || 3072;
    const h = o.h || 420;
    const top = o.top || 40;
    const c = QZ.canvas(w, h);
    const x = c.getContext("2d");
    const r = rng(o.seed || 7);
    const P = Math.round(w / 180);
    const edge = [];
    for (let i = 0; i <= w; i += 24) edge.push([i, top + 7 * Math.sin((i / w) * Math.PI * 2 * 5) + 10 * (vnoise((i / w) * P, o.seed || 7, P) - 0.5)]);
    x.beginPath();
    x.moveTo(0, h);
    edge.forEach((p) => x.lineTo(p[0], p[1]));
    x.lineTo(w, h);
    x.closePath();
    const g = x.createLinearGradient(0, top, 0, h);
    g.addColorStop(0, rgba(o.color || [66, 90, 78], 0.95));
    g.addColorStop(0.5, rgba([104, 120, 108], 0.8));
    g.addColorStop(1, rgba([84, 80, 68], 0.9));
    x.fillStyle = g;
    x.fill();
    x.save();
    x.clip();
    const gg = x.createLinearGradient(0, top - 10, 0, top + 70);
    gg.addColorStop(0, rgba([128, 160, 118], 0.9));
    gg.addColorStop(1, rgba([128, 160, 118], 0));
    x.fillStyle = gg;
    x.fillRect(0, 0, w, top + 90);
    for (let i = 0; i < 400; i++) {
      const px = r() * w;
      const py = top + 30 + r() * (h - top - 40);
      const len = 40 + r() * 120;
      inkLine(x, [[px, py], [px + (r() - 0.5) * 14, py + len]], { w: 1.6 + r() * 3, color: C.ink, alpha: 0.07 + r() * 0.12, taper: "end", seg: 0 });
    }
    x.restore();
    inkLine(x, edge, { w: 5, color: C.ink, alpha: 0.72, taper: "none", rough: 0.8, seed: 3, seg: 0 });
    for (let i = 0; i < 60; i++) {
      const px = r() * w;
      const py = top + 7 * Math.sin((px / w) * Math.PI * 2 * 5);
      for (let j = 0; j < 3; j++) inkLine(x, [[px + j * 5, py + 2], [px + j * 5 + (j - 1) * 5, py - 12 - r() * 12]], { w: 2.4, color: C.pine, alpha: 0.85, taper: "end", seg: 0 });
    }
    c.top = top;
    return c;
  };

  // paper, tooth and the scratch sheet every film needs
  SC.init = () => {
    SC.paper = QZ.makePaper();
    SC.tooth = QZ.makeTooth();
    SC.scratch = QZ.canvas(W, H);
  };

  // ── per-frame layers ──
  // a horizontally repeating tile; ox = how far the layer has scrolled, bottom = where the tile's bottom sits
  function drawTile(ctx, tile, ox, bottom, a, x0 = -260, x1 = W + 260) {
    if (a <= 0.003) return;
    const tw = tile.width;
    let sx = -(((ox % tw) + tw) % tw);
    while (sx + tw < x0) sx += tw;
    ctx.globalAlpha = a;
    for (; sx < x1; sx += tw) ctx.drawImage(tile, sx, bottom - tile.height);
    ctx.globalAlpha = 1;
  }
  SC.drawTile = drawTile;

  // the tile mirrored into water below the line wy (squashed and faint)
  SC.reflect = (ctx, tile, ox, wy, a, depth = 170) => {
    if (a <= 0.003) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-300, wy, W + 600, depth);
    ctx.clip();
    ctx.translate(0, wy);
    ctx.scale(1, -0.24);
    ctx.translate(0, -wy);
    drawTile(ctx, tile, ox, wy, a);
    ctx.restore();
  };

  // sky washes. kind: "dawn" (peach, blush, lilac) | "dusk" (gold, ochre) | "night" (deep slate, drawn over the paper)
  SC.sky = (ctx, kind, a = 1) => {
    if (a <= 0) return;
    if (kind === "night") {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgba([38, 52, 78], 0.92 * a));
      g.addColorStop(0.6, rgba([62, 80, 104], 0.86 * a));
      g.addColorStop(1, rgba([96, 112, 128], 0.8 * a));
      ctx.fillStyle = g;
      ctx.fillRect(-300, -300, W + 600, H + 600);
    } else if (kind === "dusk") {
      wash(ctx, 1400, 420, 1100, 560, C.gold, 0.3 * a);
      wash(ctx, 500, 240, 1000, 420, C.ochre, 0.16 * a);
      wash(ctx, 1000, 80, 1200, 300, C.lilac, 0.14 * a);
    } else {
      wash(ctx, 1500, 260, 900, 520, C.peach, 0.3 * a);
      wash(ctx, 700, 120, 1000, 380, C.blush, 0.2 * a);
      wash(ctx, 240, 420, 700, 420, C.lilac, 0.16 * a);
    }
  };

  SC.sun = (ctx, x, y, r, a) => {
    wash(ctx, x, y, r * 4.6, r * 4.0, C.gold, 0.2 * a);
    wash(ctx, x, y, r * 2.2, r * 2.2, C.peach, 0.34 * a);
    QZ.blob(ctx, x, y, r, r, 5, 0.025);
    ctx.fillStyle = rgba([240, 200, 116], 0.95 * a);
    ctx.fill();
  };

  // phase: 1 full … 0.3 a crescent (lit side on the right)
  SC.moon = (ctx, x, y, r, a = 1, phase = 1) => {
    wash(ctx, x, y, r * 4.2, r * 4.2, C.paperHi, 0.26 * a);
    wash(ctx, x, y, r * 2.0, r * 2.0, C.paperHi, 0.34 * a);
    ctx.save();
    QZ.blob(ctx, x, y, r, r, 5, 0.02);
    ctx.clip();
    ctx.fillStyle = rgba([250, 246, 228], 0.97 * a);
    ctx.fillRect(x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4);
    if (phase < 0.98) {
      // the dark of the moon: an offset disc in the sky's colour
      ctx.beginPath();
      ctx.arc(x - r * 2 * phase, y - r * 0.08, r * 1.06, 0, 7);
      ctx.fillStyle = rgba([58, 74, 100], 0.96 * a);
      ctx.fill();
    } else {
      wash(ctx, x - r * 0.3, y + r * 0.2, r * 0.5, r * 0.4, C.inkPale, 0.22 * a);
      wash(ctx, x + r * 0.35, y - r * 0.3, r * 0.3, r * 0.26, C.inkPale, 0.18 * a);
    }
    ctx.restore();
  };

  // seeded stars that twinkle a little; region: [x0, y0, x1, y1]
  SC.stars = (ctx, t, n = 60, a = 1, region = [0, 0, W, H * 0.55], seed = 5) => {
    for (let i = 0; i < n; i++) {
      const x = lerp(region[0], region[2], hash(seed * 977 + i * 31));
      const y = lerp(region[1], region[3], Math.pow(hash(seed * 577 + i * 17), 1.4));
      const tw = 0.55 + 0.45 * Math.sin(t * (1.5 + hash(i) * 2.5) + i);
      const r = 1.6 + hash(i * 7) * 2.4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 7);
      ctx.fillStyle = rgba(C.paperHi, a * tw);
      ctx.fill();
    }
  };

  // 祥云: puffs in one path, a curl at the head, wisps behind
  SC.cloud = (ctx, x, y, s, col, a, flip) => {
    if (a <= 0.004 || s <= 0.01) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip ? -s : s, s);
    ctx.globalAlpha = a;
    const puffs = [[-84, 12, 34], [-40, -8, 48], [14, -20, 58], [70, -4, 46], [112, 14, 30]];
    ctx.beginPath();
    for (const p of puffs) {
      ctx.moveTo(p[0] + p[2], p[1]);
      ctx.arc(p[0], p[1], p[2], 0, Math.PI * 2);
    }
    ctx.rect(-96, 6, 216, 38);
    ctx.save();
    ctx.clip();
    const g = ctx.createLinearGradient(0, -80, 0, 50);
    g.addColorStop(0, rgba(C.paperHi, 1));
    g.addColorStop(0.55, rgba(mix(col, C.paperHi, 0.35), 1));
    g.addColorStop(1, rgba(col, 1));
    ctx.fillStyle = g;
    ctx.fillRect(-140, -90, 300, 150);
    ctx.restore();
    const dark = mix(col, C.inkMid, 0.45);
    // curl at the head
    const curl = [];
    for (let k = 0; k <= 26; k++) {
      const th = -0.4 + (k / 26) * Math.PI * 2.5;
      const rr = 30 - k * 0.95;
      curl.push([72 + Math.cos(th) * rr, 6 + Math.sin(th) * rr * 0.9]);
    }
    inkLine(ctx, curl, { w: 4.6, color: dark, alpha: 0.85, taper: "end", seg: 0 });
    inkLine(ctx, [[-86, -6], [-60, -42], [-22, -48]], { w: 3.6, color: dark, alpha: 0.6, taper: "both" });
    inkLine(ctx, [[-20, -58], [16, -80], [56, -62]], { w: 3.6, color: dark, alpha: 0.6, taper: "both" });
    // tail
    inkLine(ctx, [[-96, 34], [-150, 40], [-214, 30]], { w: 9, color: mix(col, C.paperHi, 0.2), alpha: 1, taper: "end" });
    inkLine(ctx, [[-70, 46], [-130, 56], [-176, 52]], { w: 6, color: mix(col, C.paperHi, 0.2), alpha: 1, taper: "end" });
    ctx.restore();
  };

  // a river seen from its bank: from the water line wy down, wavelets scrolling with the camera.
  // speed (world px/s) stretches and flattens the wavelets.
  SC.water = (ctx, camX, wy, t, a, speed, tint) => {
    if (a <= 0.003 || wy > H + 10) return;
    ctx.save();
    ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(0, wy, 0, wy + 420);
    const c0 = tint ? tint[0] : [196, 214, 204];
    const c1 = tint ? tint[1] : [150, 186, 180];
    const c2 = tint ? tint[2] : [104, 150, 150];
    g.addColorStop(0, rgba(c0, 0.9));
    g.addColorStop(0.2, rgba(c1, 0.92));
    g.addColorStop(1, rgba(c2, 0.96));
    ctx.fillStyle = g;
    ctx.fillRect(-300, wy, W + 600, H - wy + 300);
    // wavelets, bigger and faster toward the lens
    const sp = clamp((speed || 0) / 2200);
    for (let row = 0; row < 7; row++) {
      const k = row / 6;
      const y = wy + 16 + Math.pow(k, 1.35) * 330;
      const par = 0.62 + k * 0.95;
      const cell = 150 + k * 170;
      const off = camX * par;
      const first = Math.floor((off - 400) / cell);
      const last = Math.ceil((off + W + 400) / cell);
      for (let i = first; i <= last; i++) {
        const h1 = hash(i * 31 + row * 977);
        if (h1 < 0.22) continue;
        const sx = i * cell - off + h1 * cell * 0.6;
        const yy = y + (hash(i * 57 + row) - 0.5) * 22 + Math.sin(t * (2.2 + k) + i * 1.7) * (3 + k * 4);
        const len = (46 + k * 70) * (0.7 + hash(i * 91 + row * 3) * 0.7) * (1 + sp * 1.6);
        const amp = (5 + k * 7) * (1 - sp * 0.55);
        inkLine(ctx, [[sx, yy], [sx + len * 0.25, yy - amp], [sx + len * 0.5, yy], [sx + len * 0.75, yy + amp * 0.7], [sx + len, yy]], {
          w: 2.2 + k * 2.6,
          color: h1 > 0.62 ? C.paperHi : [58, 96, 100],
          alpha: h1 > 0.62 ? 0.75 : 0.42,
          taper: "both",
        });
      }
    }
    // bright seam where water meets the far bank
    const s = ctx.createLinearGradient(0, wy - 6, 0, wy + 26);
    s.addColorStop(0, rgba(C.paperHi, 0));
    s.addColorStop(0.35, rgba(C.paperHi, 0.75));
    s.addColorStop(1, rgba(C.paperHi, 0));
    ctx.fillStyle = s;
    ctx.fillRect(-300, wy - 6, W + 600, 32);
    ctx.restore();
  };

  // open water seen from high up: a pale plane from the horizon hz to the bottom of the frame.
  // Draw it first, then the far shore, then SC.ripples on top.
  SC.openWater = (ctx, hz) => {
    const g = ctx.createLinearGradient(0, hz, 0, H);
    g.addColorStop(0, rgba([222, 226, 208], 0.75));
    g.addColorStop(0.25, rgba([176, 204, 194], 0.85));
    g.addColorStop(1, rgba([122, 166, 164], 0.92));
    ctx.fillStyle = g;
    ctx.fillRect(0, hz, W, H - hz);
  };
  // the sun's (or moon's) path on open water, a ladder of bright dashes under x
  SC.glint = (ctx, x, hz, t, color) => {
    for (let i = 0; i < 16; i++) {
      const y = hz + 14 + i * 24;
      const wv = 30 + i * 9;
      const xx = x + Math.sin(t * 2 + i * 1.7) * 10;
      inkLine(ctx, [[xx - wv, y], [xx, y - 2], [xx + wv, y]], { w: 4 + i * 0.3, color: color || [246, 214, 140], alpha: 0.6 - i * 0.03, taper: "both" });
    }
  };
  // ripples on open water; drift = seconds of sliding (they move faster toward the lens)
  SC.ripples = (ctx, hz, drift) => {
    for (let row = 0; row < 6; row++) {
      const k = row / 5;
      const y = hz + 30 + Math.pow(k, 1.3) * 380;
      const cell = 190 + k * 170;
      const off = drift * (120 + k * 520) + 4000;
      for (let i = Math.floor(off / cell) - 1; i <= Math.ceil((off + W) / cell); i++) {
        const h1 = hash(i * 23 + row * 131);
        if (h1 < 0.35) continue;
        const x = i * cell - off + h1 * 90;
        const len = (40 + k * 80) * (0.6 + h1);
        inkLine(ctx, [[x, y], [x + len * 0.5, y - 3 - k * 3], [x + len, y]], { w: 2 + k * 2.4, color: h1 > 0.7 ? C.paperHi : [70, 112, 112], alpha: h1 > 0.7 ? 0.8 : 0.4, taper: "both" });
      }
    }
  };

  // a small flock, each bird a brushed "v" that flaps; (x, y) is the leader
  SC.birds = (ctx, x, y, t, n = 5, a = 0.75) => {
    for (let i = 0; i < n; i++) {
      const bx = x + i * 58 + (i % 2) * 20;
      const by = y - i * 22 + (i % 2) * 30 + Math.sin(t * 3 + i) * 4;
      const fl = Math.sin(t * 9 + i * 1.3) * 9;
      inkLine(ctx, [[bx - 17, by - fl], [bx, by], [bx + 17, by - fl]], { w: 3.4, color: C.ink, alpha: a, taper: "both", seg: 0 });
    }
  };

  // slanting rain. density ≈ number of strokes on screen; wind = px of lean per 100 px of fall
  SC.rain = (ctx, t, a = 0.7, density = 140, wind = 22) => {
    for (let i = 0; i < density; i++) {
      const speed = 1500 + hash(i * 13) * 700;
      const span = H + 300;
      const y = ((hash(i * 7) * span + t * speed) % span) - 150;
      const x = hash(i * 31 + 5) * (W + 400) - 200 - (y / 100) * wind;
      const len = 46 + hash(i * 3) * 50;
      inkLine(ctx, [[x, y], [x - (len / 100) * wind, y + len]], { w: 2.8, color: mix(C.inkMid, C.slate, 0.4), alpha: a * (0.5 + hash(i) * 0.5), taper: "both", seg: 0 });
    }
  };

  // slow snow: paper-white flakes drifting down and sideways
  SC.snow = (ctx, t, a = 0.9, density = 110) => {
    for (let i = 0; i < density; i++) {
      const speed = 90 + hash(i * 13) * 120;
      const span = H + 80;
      const y = ((hash(i * 7) * span + t * speed) % span) - 40;
      const x = hash(i * 31 + 5) * (W + 200) - 100 + Math.sin(t * (0.6 + hash(i) * 0.8) + i) * 26;
      const r = 2.4 + hash(i * 3) * 4.2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 7);
      ctx.fillStyle = rgba(C.paperHi, a * (0.5 + hash(i * 5) * 0.5));
      ctx.fill();
    }
  };

  // a band of mist: soft blobs along y, h tall; drift slides it sideways. color defaults to the paper's highlight
  SC.mist = (ctx, y, h, a, drift = 0, seed = 3, color) => {
    if (a <= 0.005) return;
    const n = 12;
    const span = W + 900;
    for (let i = 0; i < n; i++) {
      const x = ((((i / n) * span + hash(seed * 31 + i) * 160 + drift * (0.6 + hash(seed + i) * 0.8)) % span) + span) % span - 450;
      const yy = y + (hash(seed * 17 + i) - 0.5) * h * 0.7;
      wash(ctx, x, yy, 280 + hash(seed * 7 + i) * 260, h * (0.5 + hash(seed * 3 + i) * 0.5), color || C.paperHi, a * (0.55 + hash(seed * 11 + i) * 0.45), 0.5);
    }
  };

  // long rollers on a big river: rows of crests with foam caps, travelling with `drift` (px). wy = the water line
  SC.swells = (ctx, camX, wy, t, a, drift, color) => {
    if (a <= 0.01) return;
    for (let row = 0; row < 3; row++) {
      const k = row / 2;
      const y = wy + 58 + k * k * 250 + row * 34;
      const cell = 560 + row * 260;
      const off = camX * (0.7 + k * 0.6) - drift * (0.5 + k * 0.5);
      const first = Math.floor((off - 600) / cell);
      const last = Math.ceil((off + W + 600) / cell);
      for (let i = first; i <= last; i++) {
        const h1 = hash(i * 41 + row * 211);
        const sx = i * cell - off + h1 * cell * 0.5;
        const len = (300 + k * 220) * (0.7 + h1 * 0.6);
        const lift = (16 + k * 20) * (0.7 + 0.3 * Math.sin(t * 1.7 + i * 2.3 + row));
        const pts = [[sx, y], [sx + len * 0.3, y - lift * 0.7], [sx + len * 0.55, y - lift], [sx + len * 0.78, y - lift * 0.5], [sx + len, y + 2]];
        inkLine(ctx, pts.map((p) => [p[0], p[1] + 7 + k * 5]), { w: 5 + k * 5, color: color || [70, 116, 120], alpha: 0.5 * a, taper: "both" });
        inkLine(ctx, pts, { w: 4 + k * 4.5, color: C.paperHi, alpha: 0.92 * a, taper: "both" });
        for (let j = 0; j < 4; j++) {
          ctx.beginPath();
          ctx.arc(sx + len * (0.5 + j * 0.09) + Math.sin(t * 5 + j + i) * 3, y - lift - 4 - hash(i * 7 + j) * 8, 3 + k * 2.4 + hash(j + i) * 2, 0, 7);
          ctx.fillStyle = rgba(C.paperHi, 0.9 * a);
          ctx.fill();
        }
      }
    }
  };

  // a rock needle (乱石穿空): foot centred at (x, y), w wide at the foot, h tall, leaning `lean` px at the tip
  SC.spire = (ctx, x, y, w, h, seed, color, lean = 0) => {
    const col = color || [120, 88, 68];
    const n = 14;
    const L = [];
    const Rr = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const half = (w / 2) * Math.pow(1 - u, 0.72) + 3;
      const cx = x + lean * u * u;
      const jag = (k) => (fbm(u * 5 + k * 9, seed + k, 3) - 0.5) * w * 0.26 * (1 - u * 0.6);
      L.push([cx - half + jag(1), y - u * h]);
      Rr.push([cx + half + jag(2), y - u * h]);
    }
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(L[0][0], L[0][1]);
      for (const p of L) ctx.lineTo(p[0], p[1]);
      for (let i = n; i >= 0; i--) ctx.lineTo(Rr[i][0], Rr[i][1]);
      ctx.closePath();
    };
    path();
    const g = ctx.createLinearGradient(0, y - h, 0, y);
    g.addColorStop(0, rgba(mix(col, C.ink, 0.35)));
    g.addColorStop(0.6, rgba(col));
    g.addColorStop(1, rgba(mix(col, C.paperHi, 0.3)));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    path();
    ctx.clip();
    // the shaded side, and cracks running down the rock
    ctx.fillStyle = rgba(C.ink, 0.22);
    ctx.beginPath();
    ctx.moveTo(x + lean, y - h);
    for (let i = n; i >= 0; i--) ctx.lineTo(Rr[i][0] + 4, Rr[i][1]);
    ctx.lineTo(x + w * 0.08, y);
    ctx.closePath();
    ctx.fill();
    // rock, not bark: a few lit and shaded blocks, broken strata, jagged cracks
    const r = rng(seed * 19 + 3);
    for (let i = 0; i < 4 + h / 110; i++) {
      const u = r() * 0.85;
      const px = x + lean * u * u + (r() - 0.6) * w * (1 - u) * 0.7;
      const py = y - u * h;
      const bw = w * (0.2 + r() * 0.3) * (1 - u * 0.6);
      const bh = 50 + r() * 130;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + bw, py + (r() - 0.5) * 20);
      ctx.lineTo(px + bw + (r() - 0.5) * 16, py + bh);
      ctx.lineTo(px + (r() - 0.5) * 16, py + bh * 0.85);
      ctx.closePath();
      ctx.fillStyle = r() > 0.5 ? rgba(C.ink, 0.06 + r() * 0.08) : rgba(mix(col, C.paperHi, 0.7), 0.1 + r() * 0.12);
      ctx.fill();
    }
    for (let i = 0; i < 3 + h / 130; i++) {
      const u = 0.06 + r() * 0.8;
      const half = (w / 2) * Math.pow(1 - u, 0.72);
      const cx = x + lean * u * u;
      const py = y - u * h;
      inkLine(ctx, [[cx - half * (0.3 + r() * 0.7), py + (r() - 0.5) * 8], [cx, py + (r() - 0.5) * 12], [cx + half * (0.3 + r() * 0.7), py + (r() - 0.5) * 8]], { w: 1.6 + r() * 2.4, color: C.ink, alpha: 0.16 + r() * 0.16, taper: "both" });
    }
    for (let i = 0; i < 8 + h / 60; i++) {
      const u = r() * 0.9;
      const px = x + lean * u * u + (r() - 0.5) * w * (1 - u) * 0.8;
      const py = y - u * h;
      const pts = [[px, py]];
      for (let j = 1; j <= 3; j++) pts.push([pts[j - 1][0] + (r() - 0.5) * 26, py + j * (20 + r() * 34)]);
      inkLine(ctx, pts, { w: 1.6 + r() * 3, color: C.ink, alpha: 0.14 + r() * 0.2, taper: "end", seg: 0 });
    }
    ctx.restore();
    inkLine(ctx, L.concat(Rr.slice().reverse()), { w: 4.2, color: C.ink, alpha: 0.72, taper: "none", rough: 0.7, seed, seg: 0 });
  };

  // an abandoned fort (故垒): broken rammed-earth walls, a fallen gate, a leaning pole. Origin: middle of its foot; about 620 wide
  SC.ruin = (ctx, x, y, s = 1) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    const stone = [182, 168, 142];
    const r = rng(733);
    const wall = (x0, x1, top, broken) => {
      ctx.beginPath();
      ctx.moveTo(x0 - 6, 4);
      ctx.lineTo(x0, -top * 0.5);
      const n = 9;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const cren = i % 2 ? 0 : 16;
        const fall = broken ? Math.pow(Math.abs(u - broken) < 0.26 ? 1 - Math.abs(u - broken) / 0.26 : 0, 0.7) * top * 0.55 : 0;
        ctx.lineTo(lerp(x0, x1, u), -top - cren + fall + (r() - 0.5) * 8);
        if (i < n) ctx.lineTo(lerp(x0, x1, u + 0.5 / n), -top - cren + fall + (r() - 0.5) * 8);
      }
      ctx.lineTo(x1 + 6, 4);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -top - 20, 0, 4);
      g.addColorStop(0, rgba(stone));
      g.addColorStop(1, rgba(mix(stone, [110, 104, 88], 0.6)));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = rgba(C.ink, 0.62);
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.stroke();
      for (let k = 0; k < 4; k++) inkLine(ctx, [[x0 + 8, -top * (0.2 + k * 0.2)], [(x0 + x1) / 2, -top * (0.2 + k * 0.2) + 2], [x1 - 8, -top * (0.2 + k * 0.2)]], { w: 1.4, color: C.inkMid, alpha: 0.3, taper: "both" });
      for (let k = 0; k < 6; k++) {
        const px = lerp(x0, x1, r());
        inkLine(ctx, [[px, -top * (0.3 + r() * 0.6)], [px + (r() - 0.5) * 20, -4]], { w: 1.8, color: C.ink, alpha: 0.22, taper: "end", seg: 0 });
      }
    };
    wall(-300, -110, 96, 0.72);
    wall(84, 300, 110, 0.22);
    // what is left of the gate between them: a broken arch and rubble
    ctx.beginPath();
    ctx.moveTo(-112, 4);
    ctx.lineTo(-108, -128);
    ctx.quadraticCurveTo(-70, -150, -34, -112);
    ctx.lineTo(-40, -70);
    ctx.quadraticCurveTo(-66, -96, -78, -60);
    ctx.lineTo(-74, 4);
    ctx.closePath();
    ctx.fillStyle = rgba(mix(stone, [110, 104, 88], 0.35));
    ctx.fill();
    ctx.strokeStyle = rgba(C.ink, 0.62);
    ctx.lineWidth = 3;
    ctx.stroke();
    for (let k = 0; k < 9; k++) {
      QZ.blob(ctx, -60 + r() * 150, -6 - r() * 12, 12 + r() * 20, 8 + r() * 10, k + 3, 0.2);
      ctx.fillStyle = rgba(mix(stone, [110, 104, 88], r()));
      ctx.fill();
      ctx.strokeStyle = rgba(C.ink, 0.5);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // a dead tree, and grass taking the walls back
    inkLine(ctx, [[196, -108], [206, -170], [190, -226], [204, -270]], { w: 9, color: C.wood, taper: "end", rough: 0.5 });
    inkLine(ctx, [[204, -170], [236, -206], [262, -212]], { w: 5, color: C.wood, taper: "end" });
    inkLine(ctx, [[194, -214], [166, -244], [150, -246]], { w: 4.5, color: C.wood, taper: "end" });
    for (let i = 0; i < 46; i++) {
      const px = -310 + r() * 620;
      const base = r() > 0.6 ? -r() * 90 : 2;
      for (let j = 0; j < 3; j++) inkLine(ctx, [[px + j * 5, base], [px + j * 5 + (j - 1) * 6, base - 14 - r() * 16]], { w: 2.4, color: C.pine, alpha: 0.85, taper: "end", seg: 0 });
    }
    ctx.restore();
  };

  // the mounting of a hand scroll around a picture at (x, y, w, h): silk borders and two rollers. a fades it in
  SC.scrollMount = (ctx, x, y, w, h, a = 1) => {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha *= a;
    const b = 44; // silk border above and below
    const side = 70;
    ctx.fillStyle = rgba(C.ink, 0.2);
    ctx.fillRect(x - side + 10, y - b + 14, w + side * 2, h + b * 2);
    ctx.fillStyle = rgba([222, 214, 188]);
    ctx.fillRect(x - side, y - b, w + side * 2, b);
    ctx.fillRect(x - side, y + h, w + side * 2, b);
    ctx.fillRect(x - side, y, side, h);
    ctx.fillRect(x + w, y, side, h);
    // a small woven figure in the silk
    for (let i = 0; i < Math.floor((w + side * 2) / 46); i++) {
      for (const yy of [y - b / 2, y + h + b / 2]) {
        const px = x - side + 23 + i * 46;
        ctx.strokeStyle = rgba([180, 168, 132], 0.7);
        ctx.lineWidth = 2;
        ctx.strokeRect(px - 8, yy - 8, 16, 16);
        ctx.strokeRect(px - 3, yy - 3, 6, 6);
      }
    }
    ctx.strokeStyle = rgba(C.ink, 0.75);
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba(C.ink, 0.5);
    ctx.strokeRect(x - side, y - b, w + side * 2, h + b * 2);
    // rollers
    for (const rx of [x - side - 26, x + w + side - 8]) {
      const g = ctx.createLinearGradient(rx, 0, rx + 34, 0);
      g.addColorStop(0, rgba([92, 66, 46]));
      g.addColorStop(0.45, rgba([150, 112, 78]));
      g.addColorStop(1, rgba([70, 50, 36]));
      ctx.fillStyle = g;
      ctx.fillRect(rx, y - b - 30, 34, h + b * 2 + 60);
      ctx.strokeStyle = rgba(C.ink, 0.7);
      ctx.lineWidth = 2.5;
      ctx.strokeRect(rx, y - b - 30, 34, h + b * 2 + 60);
      ctx.fillStyle = rgba([58, 42, 32]);
      ctx.fillRect(rx - 4, y - b - 44, 42, 16);
      ctx.fillRect(rx - 4, y + h + b + 28, 42, 16);
    }
    ctx.restore();
  };

  // ── buildings and trees (paint them into a prop canvas once, or straight to the frame) ──
  // an upturned Chinese roof as a path: eave line at yEave, ridge `rise` above it
  SC.roofPath = (ctx, cx, yEave, halfW, rise, topHalf, up) => {
    ctx.beginPath();
    ctx.moveTo(cx - halfW - 14, yEave - up);
    ctx.quadraticCurveTo(cx - halfW * 0.72, yEave + 6, cx - halfW * 0.45, yEave + 4);
    ctx.lineTo(cx + halfW * 0.45, yEave + 4);
    ctx.quadraticCurveTo(cx + halfW * 0.72, yEave + 6, cx + halfW + 14, yEave - up);
    ctx.quadraticCurveTo(cx + halfW * 0.5, yEave - rise * 0.45, cx + topHalf, yEave - rise);
    ctx.lineTo(cx - topHalf, yEave - rise);
    ctx.quadraticCurveTo(cx - halfW * 0.5, yEave - rise * 0.45, cx - halfW - 14, yEave - up);
    ctx.closePath();
  };

  // one storey of a timber hall between x0..x1, floor at y0, eave at y1 (y1 < y0): posts and paper windows
  SC.hall = (ctx, x0, x1, y0, y1) => {
    ctx.fillStyle = rgba([124, 96, 70]);
    ctx.fillRect(x0, y1, x1 - x0, y0 - y1);
    const n = Math.round((x1 - x0) / 42);
    for (let k = 0; k <= n; k++) {
      const xx = lerp(x0, x1, k / n);
      inkLine(ctx, [[xx, y0], [xx, y1]], { w: 5, color: C.wood, alpha: 0.9, taper: "none", seg: 0 });
    }
    ctx.fillStyle = rgba(C.paperHi, 0.75);
    for (let k = 0; k < n; k++) ctx.fillRect(lerp(x0, x1, (k + 0.22) / n), y1 + (y0 - y1) * 0.25, ((x1 - x0) / n) * 0.56, (y0 - y1) * 0.5);
  };

  // a tiled roof over a hall: fills, outlines, and a few tile lines
  SC.roof = (ctx, cx, yEave, halfW, rise, topHalf, up = 20) => {
    SC.roofPath(ctx, cx, yEave, halfW, rise, topHalf, up);
    ctx.fillStyle = rgba([60, 74, 80]);
    ctx.fill();
    ctx.strokeStyle = rgba(C.ink, 0.8);
    ctx.lineWidth = 3.5;
    ctx.stroke();
    for (let k = -4; k <= 4; k++) {
      const u = k / 4.6;
      inkLine(ctx, [[cx + u * topHalf, yEave - rise + 3], [cx + u * (halfW * 0.5 + topHalf * 0.5), yEave - rise * 0.4], [cx + u * halfW * 0.92, yEave + 1]], { w: 1.8, color: C.paperHi, alpha: 0.28, taper: "none" });
    }
  };

  // a city gate: a battered stone wall with an arch and battlements, and a two-storey tower on top.
  // (gx, 0) is the middle of the wall's foot. About 370 wide and 400 tall.
  SC.gateTower = (ctx, gx) => {
    const stone = [200, 190, 168];
    ctx.beginPath();
    ctx.moveTo(gx - 184, 4);
    ctx.lineTo(gx - 170, -120);
    ctx.lineTo(gx + 170, -120);
    ctx.lineTo(gx + 184, 4);
    ctx.closePath();
    ctx.fillStyle = rgba(stone);
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let row = 0; row < 5; row++) {
      const yy = -120 + row * 25 + 12;
      inkLine(ctx, [[gx - 190, yy], [gx, yy + 1], [gx + 190, yy]], { w: 1.6, color: C.inkMid, alpha: 0.4, taper: "none" });
      for (let k = -8; k < 9; k++) {
        const xx = gx + k * 42 + (row % 2) * 21;
        inkLine(ctx, [[xx, yy], [xx + 1, yy + 25]], { w: 1.4, color: C.inkMid, alpha: 0.3, taper: "none", seg: 0 });
      }
    }
    ctx.restore();
    for (let k = -6; k <= 6; k++) {
      ctx.fillStyle = rgba(stone);
      ctx.fillRect(gx + k * 27 - 9, -134, 18, 16);
      ctx.strokeStyle = rgba(C.ink, 0.6);
      ctx.lineWidth = 2;
      ctx.strokeRect(gx + k * 27 - 9, -134, 18, 16);
    }
    inkLine(ctx, [[gx - 184, 4], [gx - 170, -120], [gx + 170, -120], [gx + 184, 4]], { w: 4, color: C.ink, alpha: 0.75, taper: "none", seg: 0, rough: 0.6 });
    ctx.beginPath();
    ctx.moveTo(gx - 36, 4);
    ctx.lineTo(gx - 36, -50);
    ctx.arc(gx, -50, 36, Math.PI, 0);
    ctx.lineTo(gx + 36, 4);
    ctx.closePath();
    ctx.fillStyle = rgba(C.ink, 0.86);
    ctx.fill();
    SC.hall(ctx, gx - 124, gx + 124, -134, -204);
    SC.roofPath(ctx, gx, -204, 156, 58, 96, 20);
    ctx.fillStyle = rgba([60, 74, 80]);
    ctx.fill();
    ctx.strokeStyle = rgba(C.ink, 0.8);
    ctx.lineWidth = 3.5;
    ctx.stroke();
    SC.hall(ctx, gx - 76, gx + 76, -262, -314);
    SC.roofPath(ctx, gx, -314, 110, 60, 52, 20);
    ctx.fillStyle = rgba([60, 74, 80]);
    ctx.fill();
    ctx.stroke();
    for (const [cx0, ey, hw, rise, th] of [[gx, -204, 156, 58, 96], [gx, -314, 110, 60, 52]]) {
      for (let k = -4; k <= 4; k++) {
        const u = k / 4.6;
        inkLine(ctx, [[cx0 + u * th, ey - rise + 3], [cx0 + u * (hw * 0.5 + th * 0.5), ey - rise * 0.4], [cx0 + u * hw * 0.92, ey + 1]], { w: 1.8, color: C.paperHi, alpha: 0.28, taper: "none" });
      }
    }
    inkLine(ctx, [[gx - 56, -376], [gx, -380], [gx + 56, -376]], { w: 7, color: C.ink, alpha: 0.9, taper: "both" });
    ctx.fillStyle = rgba(C.gold);
    ctx.beginPath();
    ctx.arc(gx, -392, 8, 0, 7);
    ctx.fill();
    ctx.strokeStyle = rgba(C.ink, 0.8);
    ctx.lineWidth = 2.5;
    ctx.stroke();
  };

  // a many-storeyed tower (楼 / 塔): `floors` halls of shrinking width stacked on a stone base at (cx, 0)
  SC.pagoda = (ctx, cx, floors = 3, w0 = 150) => {
    ctx.fillStyle = rgba([200, 190, 168]);
    ctx.fillRect(cx - w0 - 26, -34, (w0 + 26) * 2, 38);
    ctx.strokeStyle = rgba(C.ink, 0.7);
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - w0 - 26, -34, (w0 + 26) * 2, 38);
    let y = -34;
    let hw = w0;
    for (let f = 0; f < floors; f++) {
      const hh = 70 - f * 5;
      SC.hall(ctx, cx - hw * 0.8, cx + hw * 0.8, y, y - hh);
      SC.roof(ctx, cx, y - hh, hw + 22, 46, hw * 0.55, 18);
      y -= hh + 46;
      hw *= 0.8;
    }
    inkLine(ctx, [[cx, y + 4], [cx, y - 34]], { w: 6, color: C.ink, alpha: 0.9, taper: "end", seg: 0 });
    ctx.fillStyle = rgba(C.gold);
    ctx.beginPath();
    ctx.arc(cx, y - 2, 7, 0, 7);
    ctx.fill();
  };

  // a leaning pine with flat needle pads; the foot of the trunk is at (x, y), it leans toward +x
  SC.pine = (ctx, x, y, s = 1) => {
    ctx.save();
    ctx.translate(x - 112 * s, y - 4 * s);
    ctx.scale(s, s);
    inkLine(ctx, [[112, 4], [118, -60], [140, -118], [182, -160], [236, -176]], { w: 20, color: C.wood, alpha: 0.96, taper: "end", rough: 0.5 });
    inkLine(ctx, [[136, -110], [112, -150], [78, -168]], { w: 9, color: C.wood, alpha: 0.96, taper: "end" });
    inkLine(ctx, [[160, -142], [176, -200], [168, -232]], { w: 8, color: C.wood, alpha: 0.96, taper: "end" });
    for (const p of [[70, -180, 78, 20], [170, -246, 70, 19], [250, -190, 86, 21], [150, -196, 54, 15]]) {
      QZ.blob(ctx, p[0], p[1], p[2], p[3], p[0], 0.1);
      ctx.fillStyle = rgba(C.pine, 0.96);
      ctx.fill();
      for (let k = 0; k < 9; k++) {
        const xx = p[0] - p[2] * 0.8 + (k / 8) * p[2] * 1.6;
        inkLine(ctx, [[xx, p[1] + p[3] * 0.5], [xx - 4, p[1] + p[3] * 0.5 + 12]], { w: 2.4, color: mix(C.pine, C.ink, 0.5), alpha: 0.8, taper: "end", seg: 0 });
      }
      inkLine(ctx, [[p[0] - p[2] * 0.8, p[1] - p[3] * 0.5], [p[0], p[1] - p[3] * 1.05], [p[0] + p[2] * 0.8, p[1] - p[3] * 0.45]], { w: 3, color: [150, 180, 140], alpha: 0.6, taper: "both" });
    }
    ctx.restore();
  };

  // a weeping willow: trunk at (x, y), about 300·s tall; the strands sway with t
  SC.willow = (ctx, x, y, s = 1, t = 0) => {
    inkLine(ctx, [[x, y], [x - 10 * s, y - 110 * s], [x + 14 * s, y - 210 * s], [x + 50 * s, y - 280 * s]], { w: 22 * s, color: C.wood, alpha: 0.95, taper: "end", rough: 0.5 });
    inkLine(ctx, [[x + 4 * s, y - 170 * s], [x - 50 * s, y - 250 * s], [x - 96 * s, y - 270 * s]], { w: 9 * s, color: C.wood, alpha: 0.95, taper: "end" });
    for (let i = 0; i < 22; i++) {
      const u = i / 21;
      const ax = x + lerp(-120, 150, u) * s;
      const ay = y - (250 + 40 * Math.sin(u * Math.PI)) * s;
      const len = (130 + hash(i * 7) * 110) * s;
      const sway = Math.sin(t * 1.3 + i * 0.6) * 14 * s;
      inkLine(ctx, [[ax, ay], [ax + sway * 0.4 + (u - 0.5) * 30 * s, ay + len * 0.5], [ax + sway + (u - 0.5) * 44 * s, ay + len]], { w: 3.2 * s, color: [96, 140, 96], alpha: 0.9, taper: "end" });
    }
  };

  // a triangular pennant on a pole whose foot is at (sx, sy); ph offsets the flutter
  SC.pennant = (ctx, sx, sy, t, ph = 0, a = 1, color) => {
    inkLine(ctx, [[sx, sy + 10], [sx, sy - 74]], { w: 4, color: C.wood, alpha: a, taper: "none", seg: 0 });
    const f = (k) => Math.sin(t * 5 + k * 1.3 + ph) * 5 * k;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 74);
    ctx.quadraticCurveTo(sx + 26, sy - 78 + f(1), sx + 58, sy - 62 + f(2));
    ctx.quadraticCurveTo(sx + 26, sy - 58 + f(1), sx, sy - 44);
    ctx.closePath();
    ctx.fillStyle = rgba(color || C.gold, a);
    ctx.fill();
    ctx.strokeStyle = rgba(C.ink, 0.7 * a);
    ctx.lineWidth = 2;
    ctx.stroke();
  };
})();
