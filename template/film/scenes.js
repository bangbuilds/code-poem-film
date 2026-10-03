// This film's scenes. The stage (cover, caption slip, the last line written with the voice, the seal) is in
// engine/stage.js; here is only what this poem looks like and what the dot does in it.
//
// The starter is a walk along a scroll. It runs for any poem.json, so you can see the whole pipeline working
// before drawing anything — then replace `drawWorld`, the `stations`, and the dot's path with the poem's own
// images. Every frame must be a pure function of film time t: no clocks, no Math.random (use QZ.hash / QZ.rng).
(function () {
  const QZ = window.QZ;
  const T = window.TIMING;
  const P = window.POEM;
  const V = window.VOICE;
  const { W, H, C, rgba, mix, clamp, lerp, prog, ease, kf, hash, inkLine, bumpAt } = QZ;
  const SC = QZ.scenery;
  const ST = QZ.stage;
  const A = QZ.actors;

  const R = ST.R; // the dot's radius
  const GROUND = 700; // screen y of the ground the dot stands on
  const STRIDE = 150; // world px per hop
  const MOOD = P.mood || "dawn"; // "dawn" | "dusk" | "night"
  const tiles = {};

  // ── the dot's path: drops in, then hops to the right until it leaves to write ──
  const walked = (t) => clamp((t - T.walk0) / T.step, 0, T.steps.length) * STRIDE; // the walk, smoothed (for the camera)
  function dotAt(t) {
    const s = { x: 0, y: -R, sx: 1, sy: 1, rot: 0, air: 0 };
    const m = A.mover(t, s, R);
    if (m.dropIn(T, T.walk0)) return s;
    const k = Math.min(Math.floor((t - T.walk0) / T.step), T.steps.length);
    s.x = k * STRIDE;
    if (k >= T.steps.length) return s; // the walk is over; it waits for the leap
    const t0 = T.walk0 + k * T.step;
    if (!m.hop(t0, T.step * 0.7, 46, k * STRIDE, (k + 1) * STRIDE)) {
      m.squash(t0 + T.step * 0.7, T.step * 0.3, 0.35);
      s.x = (k + 1) * STRIDE;
    }
    return s;
  }
  // the face: eyes pop open, blink now and then, look at each prop as its line begins
  function face(t) {
    const f = { eye: ease.outBack(prog(t, T.eyes, T.eyes + 0.24)), open: 1, lx: 0, ly: 0, mood: "plain" };
    for (let b = T.blink; b < T.hop; b += 2.3) f.open = Math.min(f.open, 1 - bumpAt(t, b, 0.15));
    f.lx = kf(t, [[2.5, 0], [2.78, -1, ease.io2], [2.95, -1], [3.1, 1, ease.io2]]);
    if (t >= T.bloom + 0.05 && t < T.bloom + 1.0) f.mood = "wow";
    if (t >= T.walk0) f.mood = "happy";
    T.v.forEach((v) => {
      if (t > v - 0.2 && t < v + 0.9) {
        f.mood = "wow";
        f.lx = 0.9;
        f.ly = -0.8;
      }
    });
    if (t > T.hop - 0.4) f.mood = "set";
    return f;
  }
  // the camera keeps the dot a little left of centre once it is walking
  const camera = (t) => ({ x: walked(t) + 260 * ease.io2(prog(t, T.walk0, T.walk0 + 1.6)), y: 0, z: 1 });
  const dotScreen = (t, cam) => {
    const d = dotAt(t);
    return [d.x - cam.x + W / 2, GROUND + d.y, d];
  };

  // ── one prop per captioned line, standing where the dot will be as that line is spoken ──
  // Replace these with the poem's own images.
  const PROPS = ["pine", "tower", "pagoda", "willow"];
  const stations = T.v.map((v, i) => ({ x: walked(v + V.lines[i].d * 0.5) + 330, kind: PROPS[i % PROPS.length] }));
  function drawProp(c, kind, sx, t) {
    if (sx < -500 || sx > W + 500) return;
    c.save();
    c.translate(sx, GROUND);
    if (kind === "pine") SC.pine(c, 0, 4, 1);
    else if (kind === "willow") SC.willow(c, 0, 4, 1.05, t);
    else if (kind === "tower") {
      c.scale(0.62, 0.62);
      SC.gateTower(c, 0);
    } else {
      c.scale(0.8, 0.8);
      SC.pagoda(c, 0, 3, 150);
    }
    c.restore();
  }

  // ── the world behind the dot ──
  const clouds = [
    { x: 420, y: 190, s: 1.0, c: C.lilac, f: 1 },
    { x: 1180, y: 150, s: 1.15, c: mix(C.gold, C.paperHi, 0.25) },
    { x: 1640, y: 330, s: 0.85, c: C.blush },
  ];
  function drawWorld(c, cam, t) {
    SC.sky(c, MOOD, 1);
    if (MOOD === "night") {
      SC.stars(c, t, 70);
      SC.moon(c, 1380 - cam.x * 0.02, 250, 72);
    } else SC.sun(c, 1420 - cam.x * 0.02, MOOD === "dusk" ? 480 : 300, 64, 1);
    SC.drawTile(c, tiles.far, cam.x * 0.08 + 300, 640, 1);
    clouds.forEach((k, i) => {
      const pop = ease.outBack(prog(t, T.bloom + 0.25 + i * 0.1, T.bloom + 0.7 + i * 0.1));
      SC.cloud(c, k.x - cam.x * 0.2 + Math.sin(t * 0.5 + i) * 8, k.y, k.s * pop, k.c, MOOD === "night" ? 0.5 : 0.95, k.f);
    });
    SC.drawTile(c, tiles.mid, cam.x * 0.22 + 900, GROUND + 6, 1);
    stations.forEach((s) => drawProp(c, s.kind, s.x - cam.x + W / 2, t));
    SC.drawTile(c, tiles.bank, cam.x, GROUND - tiles.bank.top + tiles.bank.height, 1);
    // a river in front of the bank, its wavelets sliding past faster than the ground
    SC.water(c, cam.x * 1.25, GROUND + 104, t, 1, 0, MOOD === "night" ? [[92, 112, 132], [70, 92, 116], [48, 68, 92]] : null);
  }

  function scene(ctx, t) {
    const cam = camera(t);
    const [dsx, dsy, d] = dotScreen(t, cam);
    const bloom = prog(t, T.bloom, T.bloom + 1.3);
    // from T.hop the scene sinks back behind the last line (the stage draws the dot from then on)
    const fade = lerp(1, 0.2, ease.io2(prog(t, T.hop + 0.05, T.hop + 1.0)));
    const sink = 150 * ease.io2(prog(t, T.hop, T.hop + 1.0));
    if (bloom > 0 && bloom < 1) ST.bloom(ctx, (c) => drawWorld(c, cam, t), dsx, dsy + 40, bloom); // soaks out from the dot
    else if (bloom >= 1 && fade >= 1) drawWorld(ctx, cam, t);
    else if (bloom >= 1) ST.faded(ctx, (c) => drawWorld(c, cam, t), fade, sink);
    if (t < T.drop || t >= T.hop) return;
    A.shadow(ctx, dsx, GROUND + 4, R * (1.25 - 0.5 * d.air) * d.sx, 1 - 0.6 * d.air);
    A.dot(ctx, dsx, dsy, { r: R, sx: d.sx, sy: d.sy, rot: d.rot, ...face(t) });
    A.ticks(ctx, dsx, GROUND, prog(t, T.land1, T.land1 + 0.32), 9, 62, 46, 11);
    A.ticks(ctx, dsx, GROUND, prog(t, T.land2, T.land2 + 0.24), 6, 56, 26, 23);
  }

  // ── the cover picture: the first prop, with the dot standing large in front of it ──
  function cover(c, time) {
    const first = stations[0] ? stations[0].x : 600;
    const cam = { x: first - 150 + time * 30, y: 0, z: 1 };
    drawWorld(c, cam, 60 + time);
    const k = 1.7;
    A.shadow(c, 520, GROUND + 6, R * k * 1.25, 1);
    A.dot(c, 520, GROUND - R * k, { r: R * k, eye: 1, open: 1, lx: 0.85, ly: -0.6, mood: "wow" });
  }

  ST.run({
    build() {
      tiles.far = SC.ridgeTile({
        w: 3072,
        h: 440,
        seed: 61,
        freq: 7,
        amp: 330,
        floor: 0.1,
        sharp: 1.9,
        paint: { color: C.slate, aTop: 0.5, aBot: 0.0, depth: 250, seed: 1, outline: { w: 2.2, a: 0.22, color: mix(C.slate, C.ink, 0.5) } },
      });
      tiles.mid = SC.ridgeTile({
        w: 3072,
        h: 520,
        seed: 43,
        freq: 5,
        amp: 400,
        floor: 0.16,
        sharp: 1.5,
        jitter: { amp: 10, f: 0.05, seed: 5 },
        paint: { color: [86, 116, 120], aTop: 0.7, aBot: 0.04, depth: 400, seed: 2, outline: { w: 3, a: 0.36 }, tex: { kind: "slope", n: 240, len: 90, a: 0.12 }, moss: 60 },
      });
      tiles.bank = SC.groundTile({ w: 3072, h: 420, top: 40, seed: 7 });
    },
    scene,
    cover,
    titleFrom() {
      const [x, y] = dotScreen(T.hop, camera(T.hop));
      return { x, y, r: R };
    },
    debug: { camera, dotAt, stations },
  });
})();
