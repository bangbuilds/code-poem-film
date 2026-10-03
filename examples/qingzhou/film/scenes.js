// 《早发白帝城》的场景。舞台（封面、题签、末句书写、印章）在 engine/stage.js，这里只有这首诗自己的东西：
// 白帝城的山崖和城楼、彩云、小舟、三峡、猿、万重山，以及红点怎么演。
// Scenes for 早发白帝城. Every frame is a pure function of film time t.
(function () {
  const QZ = window.QZ;
  const T = window.TIMING;
  const { W, H, C, rgba, mix, clamp, lerp, prog, ease, kf, hash, rng, vnoise, inkLine, wash, bumpAt, decay } = QZ;
  const SC = QZ.scenery;
  const ST = QZ.stage;
  const A = QZ.actors;

  const R = ST.R; // the dot
  const BOAT0 = 640; // where the boat waits (world x)
  const RIVER_Y = 1500; // world y of the water line
  const CAM_RIVER = 1340; // camera y that puts the water line at screen y 700
  const WATER_SY = 700;
  const SEAT = [-46, -40]; // the dot's seat in the boat
  const tiles = {};

  // ── boat travel: speed keys integrated once into a distance table ──
  const speedKeys = [
    [T.launch, 0],
    [T.launch + 0.28, 2900, ease.out2],
    [T.launch + 1.1, 1900, ease.io2],
    [T.jump, 2150, ease.lin],
    [T.gate, 2700, ease.in2],
    [T.cut + 0.6, 2700],
  ];
  const speedAt = (t) => kf(t, speedKeys);
  const DT = 1 / 240;
  const tab = [];
  for (let i = 0, x = 0; i * DT <= T.cut + 1; i++) {
    tab.push(x);
    x += speedAt(i * DT) * DT;
  }
  const travel = (t) => {
    const f = clamp(t / DT, 0, tab.length - 1.001);
    const i = Math.floor(f);
    return lerp(tab[i], tab[i + 1], f - i);
  };
  const pull = (t) => kf(t, [[T.pull, 0], [T.launch, -54, ease.out2], [T.launch + 0.12, 0, ease.out2]]);
  const boatX = (t) => BOAT0 + pull(t) + travel(t);
  const boatScreenX = (t) => kf(t, [[T.boatLand, 700], [T.launch, 700], [T.launch + 0.5, 1080, ease.out2], [T.launch + 1.9, 640, ease.io2], [T.jump, 640], [T.gate, 780, ease.io2]]);

  // ── the dot's path on land and through the air (world coords) ──
  function dotLand(t) {
    const s = { x: 0, y: -R, sx: 1, sy: 1, rot: 0, air: 0 };
    const m = A.mover(t, s, R);
    const { hop, squash } = m;
    if (m.dropIn(T, T.bow1)) {
    } else if (hop(T.bow1, 0.24, 46)) {
    } else if (squash(T.bow1 + 0.24, 0.07, 0.3)) {
    } else if (hop(T.bow2, 0.24, 46)) {
    } else if (squash(T.bow2 + 0.24, 0.07, 0.3)) {
    } else if (t < T.roll) {
    } else if (hop(T.roll, 0.2, 40, 0, 104)) {
    } else if (hop(T.roll + 0.2, 0.2, 40, 104, 208)) {
    } else if (t < T.leap) {
      s.x = 208;
      const k = ease.out2(prog(t, T.crouch, T.leap - 0.03));
      s.sy = 1 - 0.4 * k;
      s.sx = 1 + 0.34 * k;
      s.y = -R * s.sy;
    } else {
      s.x = kf(t, [[T.leap, 208], [T.leap + 0.5, 520, ease.out2], [T.boatLand, BOAT0 + SEAT[0], ease.io2]]);
      s.y = kf(t, [[T.leap, -R], [T.leap + 0.3, -330, ease.out2], [T.boatLand, RIVER_Y + SEAT[1], ease.in2]]);
      const v = prog(t, T.leap + 0.3, T.boatLand);
      const up = 1 - prog(t, T.leap, T.leap + 0.3);
      s.sy = 1 + 0.3 * Math.max(v, up);
      s.sx = 1 - 0.18 * Math.max(v, up);
      s.rot = 0.5 * up - 0.12 * v;
      s.air = 1;
    }
    return s;
  }
  // face: eye pop, blink, gaze and mood by time
  function face(t) {
    const f = { eye: ease.outBack(prog(t, T.eyes, T.eyes + 0.24)), open: 1, lx: 0, ly: 0, mood: "plain" };
    for (const b of [T.blink, 4.25, 8.05, 9.3, 15.1, 16.5]) f.open = Math.min(f.open, 1 - bumpAt(t, b, 0.15));
    f.lx = kf(t, [[2.5, 0], [2.78, -1, ease.io2], [2.92, -1], [3.08, 1, ease.io2], [3.3, 1], [3.55, -0.9, ease.io2], [T.roll - 0.05, -0.9], [T.roll + 0.1, 1, ease.out2], [T.leap + 0.25, 1], [T.leap + 0.6, 0.2], [T.boatLand + 0.5, 0], [T.sail - 0.1, 0.5], [T.pull, 1, ease.out2]]);
    f.ly = kf(t, [[3.3, 0], [3.55, -0.5, ease.io2], [4.5, -0.5], [4.7, 0], [T.leap, -0.4], [T.leap + 0.35, 1, ease.io2], [T.boatLand, 1], [T.boatLand + 0.3, 0], [T.sail - 0.1, -1, ease.out2], [T.sail + 0.5, -1], [T.pull, 0]]);
    if (t >= T.bloom + 0.05 && t < T.bloom + 1.0) f.mood = "wow";
    if (t >= T.bow1 - 0.05 && t < T.roll) f.mood = "happy";
    if (t >= T.roll && t < T.leap + 0.25) f.mood = "set";
    if (t >= T.leap + 0.25 && t < T.boatLand - 0.03) f.mood = "wow";
    if (t >= T.boatLand - 0.03 && t < T.boatLand + 0.28) f.mood = "squint";
    if (t >= T.boatLand + 0.28 && t < T.sail - 0.05) f.mood = "happy";
    if (t >= T.sail - 0.05 && t < T.sail + 0.55) f.mood = "wow";
    if (t >= T.pull && t < T.launch + 0.5) f.mood = "set";
    if (t >= T.launch + 0.5 && t < T.cut) {
      f.mood = "happy";
      // watch whichever gibbon is calling
      for (const g of gibbons) {
        if (g.t0 && t > g.t0 - 0.35 && t < g.t0 + 0.75) {
          f.mood = "wow";
          f.lx = 0.8;
          f.ly = -0.9;
        }
      }
      if (t > T.jump - 0.1 && t < T.splash2) {
        f.mood = "wow";
        f.ly = 0.4;
      }
      if (t >= T.splash2 && t < T.splash2 + 0.25) f.mood = "squint";
      if (t >= T.gate - 0.25) {
        f.mood = "set";
        f.lx = 1;
        f.ly = 0;
      }
    }
    return f;
  }

  // ── camera ──
  function camera(t) {
    const d = dotLand(t);
    let x;
    if (t < T.boatLand) x = kf(t, [[T.bloom, 0], [T.bloom + 1.5, -150, ease.io2], [T.roll, -150], [T.leap, -80, ease.io2], [T.boatLand, BOAT0 + 260, ease.io2]]);
    else x = boatX(t) - (boatScreenX(t) - 960);
    let y = -160;
    if (t > T.leap + 0.2) y = t < T.boatLand ? lerp(-160, d.y - 120, ease.io2(prog(t, T.leap + 0.2, T.leap + 0.62))) : CAM_RIVER;
    const z = kf(t, [[T.bloom, 1], [T.bloom + 1.5, 0.9, ease.io2], [T.leap, 0.9], [T.boatLand - 0.1, 1, ease.io2]]);
    // knocks
    let shy = 0;
    for (const [t0, amp] of [[T.land1, 9], [T.boatLand, 14], [T.launch, 10], [T.splash2, 12]]) shy += decay(t, t0, 11, 46) * amp;
    return { x, y, z, shx: 0, shy };
  }
  // ── clouds ──
  const seaClouds = [
    { x: -1280, y: 330, s: 1.9, c: C.lilac },
    { x: -880, y: 215, s: 1.5, c: C.blush, f: 1 },
    { x: -560, y: 370, s: 2.0, c: C.peach },
    { x: -150, y: 235, s: 1.5, c: C.lilac, f: 1 },
    { x: 130, y: 395, s: 1.9, c: C.blush },
    { x: 540, y: 250, s: 1.7, c: C.peach, f: 1 },
    { x: 880, y: 400, s: 2.1, c: C.lilac },
    { x: 1260, y: 270, s: 1.6, c: C.blush },
    { x: 720, y: 830, s: 2.2, c: C.blush, f: 1 },
    { x: 250, y: 1020, s: 1.8, c: C.peach },
  ];
  const skyClouds = [
    { x: 1230, y: 196, s: 1.0, c: mix(C.gold, C.paperHi, 0.25) },
    { x: 1640, y: 440, s: 0.85, c: C.blush },
    { x: 380, y: 168, s: 0.95, c: C.lilac, f: 1 },
  ];
  const pop = (t, i) => ease.outBack(prog(t, T.bloom + 0.2 + i * 0.085, T.bloom + 0.65 + i * 0.085));

  // ── gibbons: placed so each is where the eye wants it at the moment it calls ──
  const gibbons = [
    { t0: T.hoot1, sx: 1290, s: 1.25, par: 0.5, kind: "tree", ph: 0.3 },
    { t0: T.hoot2, sx: 1180, s: 1.12, par: 0.5, kind: "tree", ph: 1.9 },
    { t0: null, after: 1, dx: 330, s: 0.92, par: 0.5, kind: "tree", ph: 4.1 },
    { t0: T.hoot3, sx: 1010, s: 2.0, par: 0.74, kind: "vine", ph: 2.6 },
  ];
  const cliffTopAt = (wx) => {
    const tw = tiles.cliffs.width;
    const tx = (((Math.round(wx) + 2660) % tw) + tw) % tw; // layer x → tile x: screen x = wx - cam.x/2 + 960, and the tile is drawn scrolled by cam.x/2 + 1700
    return WATER_SY + 4 - tiles.cliffs.hs[tx];
  };
  const COVER_CAM = 5200;
  const coverG = { cover: true, sx: 1130, s: 1.45, par: 0.5, kind: "tree", ph: 1.2 };
  function placeGibbons() {
    for (const g of gibbons.concat(coverG)) {
      if (g.cover) g.wx = g.sx - 960 + COVER_CAM * g.par;
      else if (g.t0) g.wx = g.sx - 960 + camera(g.t0).x * g.par;
      else g.wx = gibbons[g.after].wx + g.dx;
      if (g.kind === "tree") {
        // slide to a stretch of cliff low enough that the animal hangs against the sky
        let best = g.wx;
        let score = 1e9;
        for (let d = -260; d <= 260; d += 20) {
          const top = cliffTopAt(g.wx + d + 90);
          const sc = Math.abs(top - 400) + Math.abs(d) * 0.25;
          if (sc < score) {
            score = sc;
            best = g.wx + d;
          }
        }
        g.wx = best;
        g.baseY = cliffTopAt(g.wx + 90);
        g.y = Math.max(150, g.baseY - 170 * g.s);
      }
    }
  }
  // a leaning tree off the cliff top, for a gibbon to hang from at (sx, g.y)
  function drawTree(c, sx, g) {
    const gy = g.y;
    const bx = sx + 90;
    const by = g.baseY;
    inkLine(c, [[bx + 14, by + 26], [bx - 6, lerp(by, gy, 0.55)], [sx, gy], [sx - 78 * g.s, gy - 26 * g.s]], { w: 15 * g.s, color: [52, 42, 34], taper: "end", rough: 0.5 });
    inkLine(c, [[bx - 10, lerp(by, gy, 0.7)], [bx + 46, gy - 8], [bx + 96, gy - 30]], { w: 8 * g.s, color: [52, 42, 34], taper: "end" });
    for (const [lx, ly, rw] of [[-60, -40, 58], [18, -34, 46], [108, -46, 52], [-112, -22, 40]]) {
      QZ.blob(c, sx + lx * g.s, gy + ly * g.s, rw * g.s, 15 * g.s, lx + 200, 0.1);
      c.fillStyle = rgba(C.pine, 0.95);
      c.fill();
    }
  }
  function hootState(g, t) {
    let mouth = 0;
    const rings = [];
    if (g.t0) {
      for (const d of [0, 0.2, 0.4]) {
        mouth = Math.max(mouth, bumpAt(t, g.t0 + d - 0.03, 0.2));
        rings.push(prog(t, g.t0 + d, g.t0 + d + 0.5));
      }
    }
    return { mouth, rings };
  }
  function drawGibbons(c, cam, t, par, boatS) {
    for (const g of gibbons) {
      if (g.par !== par) continue;
      const sx = g.wx - cam.x * g.par + W / 2;
      if (sx < -500 || sx > W + 500) continue;
      const hs = hootState(g, t);
      let gx = sx;
      let gy = g.y;
      let swing;
      if (g.kind === "tree") {
        drawTree(c, sx, g);
        swing = Math.sin(t * 3.4 + g.ph) * 0.2;
      } else {
        // a long vine from above the frame
        const len = 330;
        const th = Math.sin(t * 2.7 + g.ph) * 0.34;
        gx = sx + Math.sin(th) * len;
        gy = -30 + Math.cos(th) * len;
        wash(c, gx - 30, gy + 150, 280, 250, C.paperHi, 0.3);
        inkLine(c, [[sx, -40], [lerp(sx, gx, 0.5) + Math.sin(th) * 14, lerp(-40, gy, 0.5)], [gx, gy]], { w: 9, color: [56, 72, 52], taper: "none", rough: 0.4 });
        for (let k = 1; k < 5; k++) {
          const u = k / 5;
          c.beginPath();
          c.ellipse(lerp(sx, gx, u) + (k % 2 ? 14 : -14), lerp(-40, gy, u), 17, 7, k % 2 ? 0.6 : -0.6, 0, 7);
          c.fillStyle = rgba(C.pine, 0.95);
          c.fill();
        }
        swing = th * 0.8;
      }
      A.gibbon(c, gx, gy, { scale: g.s, flip: true, swing, wave: Math.sin(t * 9 + g.ph), hoot: hs.mouth, t });
      // rings aim at the boat
      const mx = gx + Math.cos(swing) * -37 * g.s - Math.sin(swing) * 58 * g.s;
      const my = gy + Math.sin(swing) * -37 * g.s + Math.cos(swing) * 58 * g.s;
      const dir = Math.atan2(boatS[1] - 60 - my, boatS[0] - mx);
      for (const p of hs.rings) A.hootRings(c, mx + Math.cos(dir) * 10, my + Math.sin(dir) * 10, dir, p, g.s);
    }
  }

  // ── boat state on the river ──
  function boatState(t) {
    const sp = speedAt(t);
    const spn = clamp(sp / 2400);
    const b = { x: boatX(t), y: RIVER_Y, rot: 0, sx: 1, sy: 1, sail: 0, billow: 0, sp: spn, seat: 0 };
    // idle bob, tighter chop at speed
    b.y += Math.sin(t * 2.6) * 5 * (1 - spn) + Math.sin(t * 15) * 2.5 * spn;
    b.rot += Math.sin(t * 2.1 + 1) * 0.025 * (1 - spn) + Math.sin(t * 13 + 2) * 0.012 * spn;
    // the dot drops in
    b.y += decay(t, T.boatLand, 5.5, 15) * 30;
    b.rot += decay(t, T.boatLand, 5, 13) * -0.07;
    const sq = bumpAt(t, T.boatLand, 0.22);
    b.sy -= 0.14 * sq;
    b.sx += 0.1 * sq;
    b.sail = ease.outBack(prog(t, T.sail, T.sail + 0.35));
    b.billow = kf(t, [[T.sail + 0.2, 0], [T.pull, 0.25], [T.launch, 0.1, ease.io2], [T.launch + 0.25, 1, ease.out2]]);
    // slingshot
    const back = kf(t, [[T.pull, 0], [T.launch, 1, ease.out2], [T.launch + 0.1, 0, ease.out2]]);
    b.rot += -0.1 * back;
    b.sx -= 0.1 * back;
    b.sy += 0.06 * back;
    const surge = kf(t, [[T.launch, 0], [T.launch + 0.12, 1, ease.out2], [T.launch + 0.9, 0, ease.io2]]);
    b.sx += 0.2 * surge;
    b.sy -= 0.12 * surge;
    b.rot += -0.13 * surge - 0.04 * spn;
    // the rapid
    const jp = (t - T.jump) / (T.splash2 - T.jump);
    if (jp > 0 && jp < 1) {
      b.y -= 200 * 4 * jp * (1 - jp);
      b.rot += lerp(-0.34, 0.26, ease.io2(jp));
      b.seat = -30 * Math.sin(Math.PI * jp);
    }
    b.y += decay(t, T.splash2, 6, 16) * 26;
    const sq2 = bumpAt(t, T.splash2, 0.2);
    b.sy -= 0.16 * sq2;
    b.sx += 0.12 * sq2;
    return b;
  }

  // everything behind the actors on the river, into context c
  function drawWorld(c, cam, t, boatS) {
    const gorge = prog(t, T.launch + 0.6, T.launch + 2.2);
    drawRiverWorld(c, cam, t, {
      dawn: 1 - 0.5 * gorge,
      sun: 1,
      far: 1,
      mid: 1,
      cliffs: 1,
      water: 1,
      baidi: 1,
      gorgeShade: gorge,
      speed: speedAt(t),
      sky: (cc) => {
        skyClouds.forEach((k, i) => {
          SC.cloud(cc, k.x - (cam.x + 150) * 0.25 + Math.sin(t * 0.5 + i) * 8, k.y - (cam.y + 160) * 0.2, k.s * pop(t, i + 3), k.c, 0.95, k.f);
        });
      },
      behind: (cc) => drawGibbons(cc, cam, t, 0.5, boatS),
    });
    seaClouds.forEach((k, i) => {
      const [sx, sy] = ST.toScreen(cam, k.x + Math.sin(t * 0.45 + i * 1.3) * 12, k.y + Math.sin(t * 0.8 + i) * 4);
      if (sy < -260 || sy > H + 260 || sx < -500 || sx > W + 500) return;
      SC.cloud(c, sx, sy, k.s * pop(t, i), k.c, 0.96, k.f);
    });
  }

  function streaks(c, t, cam, sp) {
    if (sp < 0.2) return;
    for (let i = 0; i < 16; i++) {
      const span = W + 900;
      const x = W + 300 - ((cam.x * (1.6 + hash(i) * 1.2) + i * 431) % span);
      const y = 90 + hash(i * 7 + 3) * 560;
      const len = (140 + hash(i * 3) * 260) * sp;
      inkLine(c, [[x, y], [x + len, y + 2]], { w: 3.2, color: i % 3 ? C.paperHi : C.inkPale, alpha: (i % 3 ? 0.6 : 0.3) * sp, taper: "both", seg: 0 });
    }
  }

  // the cliff that sweeps across the lens and hides the cut to the wide view
  function gateWipe(c, t) {
    const p = prog(t, T.gate, T.cut + 0.42);
    if (p <= 0 || p >= 1) return;
    const xl = lerp(W + 160, -3700, p);
    const wide = 3200;
    const shape = (dx) => {
      c.beginPath();
      c.moveTo(xl + dx + 260 * QZ.fbm(-20 / 240, 61, 3), -20);
      for (let y = -20; y <= H + 20; y += 60) c.lineTo(xl + dx + 260 * QZ.fbm(y / 240, 61, 3), y);
      for (let y = H + 20; y >= -20; y -= 60) c.lineTo(xl + dx + wide - 260 * QZ.fbm(y / 240, 67, 3), y);
      c.closePath();
    };
    c.save();
    // smeared edges first, then the body
    // a soft, speed-blurred edge, then the body
    shape(0);
    c.shadowColor = rgba([52, 64, 60], 0.95);
    c.shadowBlur = 120;
    c.fillStyle = rgba([52, 64, 60], 1);
    c.fill();
    c.shadowBlur = 0;
    c.shadowColor = "rgba(0,0,0,0)";
    shape(0);
    const g = c.createLinearGradient(xl, 0, xl + wide, 0);
    g.addColorStop(0, rgba([70, 86, 80], 0.97));
    g.addColorStop(0.5, rgba([38, 44, 42], 0.99));
    g.addColorStop(1, rgba([70, 86, 80], 0.97));
    c.fillStyle = g;
    c.fill();
    c.clip();
    for (let i = 0; i < 70; i++) {
      const y = hash(i * 17) * H;
      const x0 = xl + hash(i * 5) * wide;
      inkLine(c, [[x0, y], [x0 + 400 + hash(i) * 700, y + 4]], { w: 4 + hash(i * 3) * 12, color: i % 3 ? C.ink : [120, 138, 128], alpha: i % 3 ? 0.3 : 0.22, taper: "both", seg: 0 });
    }
    c.restore();
  }

  // ── scenes A–D: paper → 白帝城 → the river ──
  function sceneRiver(ctx, t) {
    const cam = camera(t);
    const d = dotLand(t);
    const f = face(t);
    const b = boatState(t);
    const boatS = ST.toScreen(cam, b.x, b.y);
    const bloom = prog(t, T.bloom, T.bloom + 1.3);
    const [dsx, dsy] = ST.toScreen(cam, d.x, d.y);

    if (bloom > 0 && bloom < 1) {
      // the world soaks outward from the dot like ink into wet paper
      const [mx, my] = ST.zoomed(cam, dsx, dsy);
      ST.bloom(
        ctx,
        (c) => {
          c.save();
          ST.view(c, cam);
          drawWorld(c, cam, t, boatS);
          c.restore();
        },
        mx,
        my + 40,
        bloom,
      );
    }
    ctx.save();
    ST.view(ctx, cam);
    if (bloom >= 1) drawWorld(ctx, cam, t, boatS);

    // the rapid: a hump of white water the boat takes off from
    if (t > T.jump - 1.2 && t < T.splash2 + 0.6) {
      const [rx, ry] = ST.toScreen(cam, boatX(T.jump) - 90, RIVER_Y);
      ctx.save();
      ctx.translate(rx, ry + 10);
      ctx.scale(1, 0.5);
      A.crest(ctx, 0, 0, 3.0, 0.55, t);
      ctx.restore();
    }

    if (t < T.boatLand) {
      // boat waiting below
      if (boatS[1] < H + 300) A.boat(ctx, boatS[0], boatS[1], { rot: b.rot, sail: 0, t, speed: 0 });
      // on land / in the air
      if (t >= T.drop) {
        if (t < T.leap + 0.2) A.shadow(ctx, dsx, 0 - cam.y + H / 2 + 4, R * (1.25 - 0.5 * d.air) * (d.sx || 1), 1 - 0.6 * d.air);
        if (t < T.land1) {
          // a streak behind the falling dot
          for (const k of [-1, 0, 1]) inkLine(ctx, [[dsx + k * 22, dsy - 70], [dsx + k * 22, dsy - 70 - 150 + Math.abs(k) * 50]], { w: 5, color: C.inkPale, alpha: 0.5 * prog(t, T.drop + 0.1, T.land1), taper: "end", seg: 0 });
        }
        if (t > T.leap + 0.45 && t < T.boatLand) {
          for (let i = 0; i < 7; i++) {
            const lx = dsx + (hash(i * 9) - 0.5) * 520;
            const ly = ((hash(i * 5) * 900 - t * 2600) % 900 + 900) % 900 + 60;
            inkLine(ctx, [[lx, ly], [lx + 2, ly - 170]], { w: 4, color: C.paperHi, alpha: 0.8, taper: "both", seg: 0 });
          }
        }
        A.dot(ctx, dsx, dsy, { r: R, sx: d.sx, sy: d.sy, rot: d.rot, ...f });
        A.ticks(ctx, dsx, 0 - cam.y + H / 2, prog(t, T.land1, T.land1 + 0.32), 9, 62, 46, 11);
        A.ticks(ctx, dsx, 0 - cam.y + H / 2, prog(t, T.land2, T.land2 + 0.24), 6, 56, 26, 23);
        if (t > T.leap) A.ticks(ctx, 208 - cam.x + W / 2, 0 - cam.y + H / 2, prog(t, T.leap, T.leap + 0.26), 7, 50, 34, 37);
      }
    } else {
      const sp = b.sp;
      A.wake(ctx, boatS[0], RIVER_Y - cam.y + H / 2, sp * (t > T.jump && t < T.splash2 ? 0 : 1), t);
      A.boat(ctx, boatS[0], boatS[1], {
        rot: b.rot,
        sx: b.sx,
        sy: b.sy,
        sail: b.sail,
        billow: b.billow,
        speed: sp,
        t,
        dot: (c) => {
          const sq = bumpAt(t, T.boatLand, 0.2) + bumpAt(t, T.splash2, 0.2);
          A.dot(c, SEAT[0], SEAT[1] + b.seat + 14 * sq, { r: R, sx: 1 + 0.3 * sq, sy: 1 - 0.3 * sq, ...f });
        },
      });
      const wy = RIVER_Y - cam.y + H / 2;
      A.splash(ctx, boatS[0] - 10, wy, prog(t, T.boatLand, T.boatLand + 0.75), 22, 560, 100);
      A.splash(ctx, ST.toScreen(cam, boatX(T.splash2), 0)[0] + 20, wy, prog(t, T.splash2, T.splash2 + 0.7), 26, 640, 300);
      A.ticks(ctx, boatS[0] - 60, wy - 30, prog(t, T.launch, T.launch + 0.3), 7, 60, 60, 51, C.paperHi);
      drawGibbons(ctx, cam, t, 0.74, boatS);
      streaks(ctx, t, cam, sp);
      const fgA = prog(t, T.launch + 0.9, T.launch + 1.5);
      if (fgA > 0) SC.drawTile(ctx, tiles.fg, cam.x * 1.7 + 600, H + 24, fgA);
    }
    ctx.restore();
  }
  // ── scene E: 万重山, seen from far off ──
  const wideEnd = (i, s) => lerp(2500 + i * 420, [900, 660, 400, 100, -220, -560][i], ease.io2(prog(s, -0.9, 2.9)));
  const wideBoat = (t) => {
    const s = t - T.cut;
    return [kf(s, [[0, 540], [3.2, 1090, ease.out2]]) + Math.max(0, s - 3.2) * 110, 852 + Math.sin(t * 2.4) * 3];
  };
  function sceneWide(c, t, withDot) {
    const s = t - T.cut;
    wash(c, 1400, 470, 1150, 560, C.peach, 0.36);
    wash(c, 560, 220, 1000, 420, C.blush, 0.16);
    SC.sun(c, 1380, 520, 64, 1 - prog(t, T.hop, T.hop + 0.7));
    // water plane, with the sun's path on it
    const hz = 652;
    SC.openWater(c, hz);
    SC.glint(c, 1380, hz, t);
    // ridges, far to near; each stops short on the right and slides off left
    for (let i = 0; i < 6; i++) {
      const tile = tiles.wide[i];
      const end = wideEnd(i, s);
      const base = 664 + i * 30;
      if (end < -40) continue;
      c.drawImage(tile, end - (tile.width - 30), base - tile.height);
    }
    SC.ripples(c, hz, s);
    SC.birds(c, 980 + s * 46, 250 - s * 10, t, 5, 0.75);
    // the boat, small now, with a long wake
    const [bx, by] = wideBoat(t);
    const sp = kf(s, [[0, 1], [3.2, 0.3, ease.out2]]);
    A.wake(c, bx, by, sp, t, 0.5);
    A.boat(c, bx, by, {
      scale: 0.5,
      rot: -0.03 + Math.sin(t * 2.2) * 0.02 + bumpAt(t, T.hop - 0.02, 0.3) * 0.08,
      sail: 1,
      billow: 0.5 + 0.5 * sp,
      speed: sp,
      t,
      dot: withDot
        ? (cc) => {
            const look = prog(t, T.lookBack, T.lookBack + 0.25) * (1 - prog(t, T.hop - 0.5, T.hop - 0.3));
            const k = ease.out2(prog(t, T.hop - 0.16, T.hop - 0.02));
            A.dot(cc, SEAT[0], SEAT[1] + 14 * k, { r: R, sx: 1 + 0.26 * k, sy: 1 - 0.3 * k, eye: 1, open: 1 - bumpAt(t, 15.1, 0.15) - bumpAt(t, 16.5, 0.15), lx: lerp(0.6, -1, look), ly: lerp(-0.2, -0.3, look), mood: t > T.hop - 0.4 ? "set" : t > T.lookBack + 0.9 || t < T.cut + 0.9 ? "happy" : "wow" });
          }
        : null,
    });
  }

  // ── the world, painted once ──
  const BX = 1500; // canvas x of world x = 0 on the 白帝城 sheet
  const BY = 460; // canvas y of world y = 0
  function buildBaidi() {
    const cw = 1960;
    const chh = 2300;
    const c = QZ.canvas(cw, chh);
    const x = c.getContext("2d");
    x.translate(BX, BY);
    const r = rng(2024);
    // cliff silhouette (world coords)
    const top = [];
    for (let wx = -1500; wx <= 236; wx += 28) top.push([wx, 6 * Math.sin(wx * 0.011) + 9 * (vnoise(wx * 0.02, 4) - 0.5)]);
    const face = [
      [262, 4],
      [292, 56],
      [306, 140],
      [280, 262],
      [246, 420],
      [226, 600],
      [200, 780],
      [214, 960],
      [246, 1120],
      [296, 1280],
      [352, 1420],
      [400, 1510],
      [428, 1840],
    ];
    const edge = QZ.catmull(face, 10).map((p, i) => [p[0] + 14 * (vnoise(i * 0.35, 8) - 0.5), p[1]]);
    x.beginPath();
    x.moveTo(-1500, 1840);
    top.forEach((p) => x.lineTo(p[0], p[1]));
    edge.forEach((p) => x.lineTo(p[0], p[1]));
    x.closePath();
    let g = x.createLinearGradient(0, 0, 0, 1700);
    g.addColorStop(0, rgba([66, 90, 78], 0.95));
    g.addColorStop(0.16, rgba([84, 104, 96], 0.86));
    g.addColorStop(0.42, rgba([120, 134, 124], 0.66));
    g.addColorStop(0.7, rgba([104, 110, 98], 0.82));
    g.addColorStop(1, rgba([84, 80, 68], 0.95));
    x.fillStyle = g;
    x.fill();
    // rock strokes down the face
    x.save();
    x.clip();
    for (let i = 0; i < 900; i++) {
      const yy = 20 + r() * 1700;
      const k = clamp(yy / 1500);
      const ex = lerp(300, 380, k);
      const px = ex - Math.pow(r(), 1.7) * 1300;
      const len = 80 + r() * 260;
      inkLine(x, [[px, yy], [px + (r() - 0.5) * 16, yy + len * 0.5], [px + (r() - 0.5) * 24, yy + len]], { w: 1.6 + r() * 3.4, color: C.ink, alpha: 0.08 + r() * 0.16, taper: "end", seed: i });
    }
    // grass along the top
    g = x.createLinearGradient(0, -6, 0, 70);
    g.addColorStop(0, rgba([128, 160, 118], 0.9));
    g.addColorStop(1, rgba([128, 160, 118], 0));
    x.fillStyle = g;
    x.fillRect(-1500, -20, 1900, 100);
    x.restore();
    // outline
    inkLine(x, top.concat(edge), { w: 5, color: C.ink, alpha: 0.72, taper: "none", rough: 0.8, seed: 3, seg: 0 });
    // grass tufts and moss
    for (let i = 0; i < 70; i++) {
      const wx = -1480 + r() * 1700;
      const wy = 6 * Math.sin(wx * 0.011);
      for (let j = 0; j < 3; j++) inkLine(x, [[wx + j * 5, wy + 2], [wx + j * 5 + (j - 1) * 5, wy - 12 - r() * 12]], { w: 2.4, color: C.pine, alpha: 0.85, taper: "end", seg: 0 });
    }
    // the gate tower and the leaning pine come from the kit
    SC.gateTower(x, -470);
    SC.pine(x, 112, 4, 1);
    tiles.baidi = c;
  }
  function build() {
    tiles.far = SC.ridgeTile({
      w: 3072,
      h: 440,
      seed: 11,
      freq: 7,
      amp: 330,
      floor: 0.1,
      sharp: 1.9,
      jitter: { amp: 8, f: 0.06, seed: 3 },
      paint: { color: C.slate, aTop: 0.5, aBot: 0.0, depth: 250, seed: 1, outline: { w: 2.2, a: 0.22, color: mix(C.slate, C.ink, 0.5) } },
    });
    tiles.mid = SC.ridgeTile({
      w: 3072,
      h: 580,
      seed: 23,
      freq: 5,
      amp: 470,
      floor: 0.16,
      sharp: 1.5,
      jitter: { amp: 10, f: 0.05, seed: 5 },
      paint: { color: [86, 116, 120], aTop: 0.7, aBot: 0.04, depth: 430, seed: 2, outline: { w: 3, a: 0.36 }, tex: { kind: "slope", n: 260, len: 90, a: 0.12 }, moss: 70 },
    });
    tiles.cliffs = SC.cliffTile({
      w: 4096,
      h: 760,
      seed: 37,
      freq: 6,
      amp: 640,
      floor: 0.42,
      plate: [0.34, 0.6],
      paint: { color: [72, 90, 84], aTop: 0.92, aBot: 0.6, depth: 560, seed: 3, outline: { w: 4, a: 0.55 }, tex: { kind: "vertical", n: 900, len: 200, a: 0.17 }, moss: 150 },
    });
    tiles.fg = SC.bankTile({ w: 4096, h: 300, seed: 71, freq: 6, amp: 250 });
    // 万重山 — six receding ridges, each ending in open water on the right
    tiles.wide = [];
    for (let i = 0; i < 6; i++) {
      tiles.wide.push(
        SC.fadingRidge({
          w: 4300,
          h: 620,
          amp: 360 + i * 56,
          scale: 430 + i * 36,
          seed: 100 + i * 17,
          floor: 0.2,
          sharp: 1.25,
          taper: 760 + i * 50,
          jitterSeed: i,
          paint: {
            color: mix(C.slate, [62, 86, 76], i / 5),
            aTop: 0.4 + i * 0.1,
            aBot: 0.02 + i * 0.02,
            depth: 240 + i * 40,
            seed: 20 + i,
            outline: { w: 2 + i * 0.4, a: 0.2 + i * 0.07 },
            tex: i > 1 ? { kind: "slope", n: 120 + i * 50, len: 70 + i * 10, a: 0.1 } : null,
            moss: i > 2 ? 30 + i * 14 : 0,
          },
        }),
      );
    }
    buildBaidi();
    placeGibbons();
  }

  // the scene around 白帝城 and down the gorge, everything except the actors.
  // cam: {x, y}; o: per-layer alphas and hooks (sky: behind the middle mountains, behind: on the far bank)
  function drawRiverWorld(ctx, cam, t, o) {
    const dy = CAM_RIVER - cam.y; // how far the camera is above river level
    SC.sky(ctx, "dawn", o.dawn);
    if (o.sun > 0) SC.sun(ctx, o.sunX === undefined ? 1470 - cam.x * 0.02 : o.sunX, 290 + dy * 0.03, 64, o.sun);
    SC.drawTile(ctx, tiles.far, cam.x * 0.08 + 300, 585 + dy * 0.12, o.far);
    if (o.sky) o.sky(ctx);
    SC.drawTile(ctx, tiles.mid, cam.x * 0.22 + 900, 648 + dy * 0.3, o.mid);
    if (o.gorgeShade > 0) {
      const g = ctx.createLinearGradient(0, 0, 0, 520);
      g.addColorStop(0, rgba([70, 92, 100], 0.34 * o.gorgeShade));
      g.addColorStop(1, rgba([70, 92, 100], 0));
      ctx.fillStyle = g;
      ctx.fillRect(-300, -200, W + 600, 720);
    }
    const wy = RIVER_Y - cam.y + H / 2;
    const cliffBottom = WATER_SY + dy * 0.55;
    SC.drawTile(ctx, tiles.cliffs, cam.x * 0.5 + 1700, cliffBottom + 4, o.cliffs);
    if (o.behind) o.behind(ctx);
    // water, with the far bank reflected in it
    if (wy < H + 200) {
      SC.water(ctx, cam.x, wy, t, o.water, o.speed || 0);
      SC.reflect(ctx, tiles.cliffs, cam.x * 0.5 + 1700, wy, 0.2 * o.cliffs * o.water);
    }
    // 白帝城 cliff, with pennants on the wall
    const bx = -cam.x + W / 2 - BX;
    const by = -cam.y + H / 2 - BY;
    if (bx + tiles.baidi.width > -300 && o.baidi > 0) {
      ctx.globalAlpha = o.baidi;
      ctx.drawImage(tiles.baidi, bx, by);
      ctx.globalAlpha = 1;
      for (const [fx, fy, ph] of [[-296, -132, 0], [-644, -132, 1.7]]) SC.pennant(ctx, fx - cam.x + W / 2, fy - cam.y + H / 2, t, ph, o.baidi);
    }
  }

  // ── the cover picture: the gorge, the boat close up, a gibbon calling ──
  function cover(c, time) {
    const tt = time + 30;
    const cam = { x: COVER_CAM + time * 60, y: CAM_RIVER };
    const z = 1 + 0.03 * ease.out2(clamp(time / T.intro));
    const boatS = [620, WATER_SY + Math.sin(tt * 2.6) * 4];
    c.translate(W * 0.34, H * 0.64);
    c.scale(z, z);
    c.translate(-W * 0.34, -H * 0.64);
    drawRiverWorld(c, cam, tt, {
      dawn: 1,
      sun: 1,
      sunX: 1296,
      far: 1,
      mid: 1,
      cliffs: 1,
      water: 1,
      baidi: 0,
      gorgeShade: 0.12,
      speed: 900,
      sky: (cc) => {
        SC.cloud(cc, 300 + time * 8, 150, 1.25, C.blush, 0.96, true);
        SC.cloud(cc, 900 - time * 6, 96, 1.0, mix(C.gold, C.paperHi, 0.25), 0.96);
      },
      behind: (cc) => {
        const g = coverG;
        const sx = g.wx - cam.x * g.par + W / 2;
        drawTree(cc, sx, g);
        const swing = Math.sin(tt * 3.4 + g.ph) * 0.2;
        A.gibbon(cc, sx, g.y, { scale: g.s, flip: true, swing, wave: Math.sin(tt * 9), hoot: 0.9, t: tt });
        const mx = sx + Math.cos(swing) * -37 * g.s - Math.sin(swing) * 58 * g.s;
        const my = g.y + Math.sin(swing) * -37 * g.s + Math.cos(swing) * 58 * g.s;
        const dir = Math.atan2(boatS[1] - 120 - my, boatS[0] - mx);
        A.hootRings(cc, mx + Math.cos(dir) * 12, my + Math.sin(dir) * 12, dir, 0.3 + ((time * 0.9) % 0.5), g.s);
      },
    });
    A.wake(c, boatS[0], WATER_SY, 0.5, tt, 1.6);
    A.boat(c, boatS[0], boatS[1], {
      scale: 1.6,
      rot: -0.05 + Math.sin(tt * 2.1) * 0.015,
      sail: 1,
      billow: 0.8,
      speed: 0.5,
      t: tt,
      dot: (cc) => A.dot(cc, SEAT[0], SEAT[1], { r: R, eye: 1, open: 1, lx: 0.85, ly: -0.7, mood: "wow" }),
    });
  }

  QZ.stage.run({
    build,
    // the river until the cliff sweeps past; then the wide view, which sinks back behind the last line
    scene(ctx, t) {
      if (t < T.cut) return sceneRiver(ctx, t);
      const fade = lerp(1, 0.2, ease.io2(prog(t, T.hop + 0.05, T.hop + 1.0)));
      const sink = 150 * ease.io2(prog(t, T.hop, T.hop + 1.0));
      if (fade >= 1) sceneWide(ctx, t, t < T.hop);
      else ST.faded(ctx, (c) => sceneWide(c, t, false), fade, sink);
    },
    front: gateWipe,
    cover,
    titleFrom() {
      const from = wideBoat(T.hop);
      return { x: from[0] + SEAT[0] * 0.5, y: from[1] + SEAT[1] * 0.5, r: 22 };
    },
    debug: { camera, boatX, speedAt, gibbons },
  });
})();
