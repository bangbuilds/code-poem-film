// 《念奴娇·赤壁怀古》的场景。舞台（封面、题签、末句书写、印章）在 engine/stage.js，这里只有这首词自己的东西：
// 白天的大江和赤壁 → 入暮，雾里遥想周郎火烧连环船 → 月夜，举杯酹江月。
// Scenes for 念奴娇·赤壁怀古. One river, three times of day. Every frame is a pure function of film time t.
(function () {
  const QZ = window.QZ;
  const T = window.TIMING;
  const { W, H, C, rgba, mix, clamp, lerp, prog, ease, kf, hash, rng, vnoise, inkLine, wash, bumpAt, decay } = QZ;
  const SC = QZ.scenery;
  const ST = QZ.stage;
  const A = QZ.actors;

  const R = ST.R; // the dot
  const S = T.v; // when each line starts
  // screen heights when the camera is level
  const WATER = 640; // the far edge of the river
  const ROCK = 700; // top of the rock the dot lands on
  const FLOAT = 812; // where the skiff rides — nearer the lens than the rock's water line, so it passes in front of it
  const SEAT = [52, -42]; // the dot's seat in the skiff
  const BOAT0 = 190; // where the skiff waits beside the rock (world x)
  const MOON = [1340, 230];
  const tiles = {};
  const props = {};

  // ── the skiff's travel: speed keys (px/s) integrated once into a distance table ──
  const speedKeys = [
    [T.boatGo, 0],
    [T.boatGo + 0.9, 720, ease.out2], // a strong current: the cliff must be out of sight until its line
    [S[5] - 0.4, 720],
    [S[5] + 0.9, 90, ease.io2], // slows under the cliff
    [S[6] - 0.1, 110],
    [S[6] + 0.7, 330, ease.in2], // the rapids among the rocks
    [T.slam - 0.1, 340],
    [T.slam + 0.25, 60, ease.out2], // thrown into the air
    [T.tossLand + 0.4, 440, ease.io2], // carried on, out into open water
    [S[9], 320],
    [T.frame1, 160],
    [T.pushIn1, 70],
    [T.night, 40],
    [T.dur + 2, 40],
  ];
  const speedAt = (t) => kf(t, speedKeys);
  const DT = 1 / 120;
  const tab = [];
  for (let i = 0, x = 0; i * DT <= T.dur + 2; i++) {
    tab.push(x);
    x += speedAt(i * DT) * DT;
  }
  const travel = (t) => {
    const f = clamp(t / DT, 0, tab.length - 1.001);
    const i = Math.floor(f);
    return lerp(tab[i], tab[i + 1], f - i);
  };
  // before it carries the dot away the skiff drifts in from the left and noses up to the rock
  const boatX = (t) => (t < T.boatGo ? kf(t, [[T.skiffIn, -820], [T.boatLand - 0.3, BOAT0, ease.out2]]) : BOAT0 + travel(t));

  // ── camera: x follows the skiff, `up` tilts the view, z zooms about (fx, fy) ──
  const CAM0 = 330; // how far the view has slid right once the river is revealed
  const boatSX = (t) =>
    kf(t, [
      [T.boatGo, BOAT0 - CAM0 + 960],
      [T.boatGo + 2.2, 700, ease.io2],
      [S[5] - 0.2, 680],
      [S[5] + 1.1, 500, ease.io2], // left, so the cliff fills the right
      [S[6], 500],
      [T.slam, 620, ease.io2],
      [T.tossLand, 700],
      [T.frame1, 820, ease.io2],
      [T.pushIn0, 820],
      [T.pushIn1, 470, ease.io2], // lower left: it watches the past play out above the river
      [S[20] - 0.5, 470],
      [S[20] + 1.4, 620, ease.io2],
    ]);
  function camera(t) {
    const x = t < T.boatGo ? kf(t, [[T.pull0, 0], [T.pull1, CAM0, ease.io2]]) : boatX(t) - (boatSX(t) - 960);
    const up = kf(t, [
      [T.tiltUp, 0],
      [S[5] + 1.0, 250, ease.io2], // looking up the cliff
      [S[6] + 0.2, 250],
      [S[6] + 1.0, 280, ease.io2],
      [T.waveRise, 280],
      [T.waveRise + 0.7, 40, ease.io2], // back down to the water for the wave
      [T.tossLand + 0.5, 0, ease.io2],
      [T.pushIn0, 0],
      [T.pushIn1, 70, ease.io2],
      [T.night, 70],
      [T.wake + 0.8, 0, ease.io2],
      [S[20] - 0.4, 0],
      [S[20] + 1.4, 110, ease.io2], // room for the moon
    ]);
    const z = kf(t, [
      [T.pull0, 1],
      [T.pull1, 0.82, ease.io2], // the river is wide
      [T.boatGo, 0.82],
      [T.boatGo + 1.6, 0.9, ease.io2],
      [S[5], 0.9],
      [S[5] + 1.0, 0.86, ease.io2],
      [T.waveRise + 0.7, 0.9, ease.io2],
      [T.tossLand + 0.6, 1, ease.io2],
      [T.wake - 0.2, 1],
      [T.wake + 1.0, 1.55, ease.io2], // close on the skiff
      [S[20] - 0.5, 1.55],
      [S[20] + 1.4, 1.1, ease.io2],
    ]);
    const close = clamp((z - 1) / 0.55);
    let shy = 0;
    for (const [t0, amp] of [[T.land1, 9], [T.boatLand, 10], [T.slam, 26], [T.tossLand, 12], [T.collapse, 12]]) shy += decay(t, t0, 10, 44) * amp;
    return { x, up, z, fx: lerp(960, boatSX(t) + 40, close), fy: lerp(540, FLOAT - 96, close), shx: decay(t, T.slam, 9, 37) * 14, shy };
  }
  const view = (c, cm) => {
    c.translate(W / 2 + cm.shx, H / 2 + cm.shy);
    c.scale(cm.z, cm.z);
    c.translate(-cm.fx, -cm.fy);
  };
  const finalXY = (cm, x, y) => [(x - cm.fx) * cm.z + W / 2, (y - cm.fy) * cm.z + H / 2];
  // the far bank scrolls at three quarters of the camera's speed: layer x ↔ screen x.
  // Things on it are placed by where they should be on screen at the moment their line is spoken.
  const BP = 0.75;
  const bankSX = (lx, cm) => lx - cm.x * BP + 960;
  const lxAt = (sx, t) => sx - 960 + camera(t).x * BP;
  const fortLX = lxAt(1250, S[3] + 0.8);
  const cliffLX = lxAt(1150 - 600, S[5] + 1.3); // left edge of the cliff sheet; 赤壁 is written 600 px in
  const spireLX = Math.max(cliffLX + 1040, lxAt(870, T.slam)); // the rocks: mid-frame when the wave breaks on them
  const SPIRES = [
    [0, 560, 150, 20],
    [120, 900, 170, -14],
    [250, 660, 150, 30],
    [370, 1040, 190, 10],
    [510, 780, 170, -24],
    [640, 600, 150, 18],
    [760, 420, 130, -10],
  ]; // x from the first one, height, width, lean
  const impactLX = spireLX + 300; // where the great wave breaks

  // ── light: the sun goes down through the first half, dusk holds for the vision, then night ──
  const sunSet = (t) => kf(t, [[T.bloom, 0], [S[9], 0.5], [T.pushIn0, 0.62], [T.pushIn1, 1, ease.io2]]);
  const duskK = (t) => kf(t, [[S[9], 0], [T.pushIn1, 1, ease.io2]]);
  const nightK = (t) => ease.io2(prog(t, T.night - 0.4, T.night + 0.5));

  // ── the dot on its rock, and its leap into the skiff (x in world px, y relative to the rock top) ──
  function dotRock(t) {
    const s = { x: 0, y: -R, sx: 1, sy: 1, rot: 0, air: 0 };
    const m = A.mover(t, s, R);
    const t1 = T.boatLand - 0.62;
    const t2 = T.boatLand - 0.45;
    if (m.dropIn(T, t1)) return s;
    if (t < t2) {
      const k = ease.out2(prog(t, t1, t2));
      s.sy = 1 - 0.36 * k;
      s.sx = 1 + 0.3 * k;
      s.y = -R * s.sy;
      return s;
    }
    const p = prog(t, t2, T.boatLand);
    s.x = lerp(0, BOAT0 + SEAT[0], ease.io2(p));
    s.y = lerp(-R, FLOAT - ROCK + SEAT[1], p) - 150 * Math.sin(Math.PI * p);
    const v = Math.abs(Math.cos(Math.PI * p));
    s.sy = 1 + 0.2 * v;
    s.sx = 1 - 0.12 * v;
    s.rot = 0.4 * Math.sin(Math.PI * p);
    s.air = 1;
    return s;
  }

  // ── the skiff: where it is and how it sits on the water ──
  function skiffState(t) {
    const sp = clamp(speedAt(t) / 500);
    const b = { x: boatX(t), y: FLOAT, rot: 0, sx: 1, sy: 1, seat: 0 };
    // a great river: a slow heavy swell, livelier at speed
    b.y += Math.sin(t * 1.9) * 9 + Math.sin(t * 4.3 + 1) * 3 * sp;
    b.rot += Math.sin(t * 1.9 + 1.2) * 0.035 + Math.sin(t * 5 + 2) * 0.012 * sp;
    // the dot drops in
    b.y += decay(t, T.boatLand, 5.5, 15) * 26;
    b.rot += decay(t, T.boatLand, 5, 13) * 0.06;
    const sq = bumpAt(t, T.boatLand, 0.22) + bumpAt(t, T.tossLand, 0.22);
    b.sy -= 0.14 * sq;
    b.sx += 0.1 * sq;
    // lifted by the great wave, thrown by the slam, dropped back
    b.y -= kf(t, [[T.waveRise + 0.25, 0], [T.slam - 0.05, 170, ease.io2], [T.slam + 0.55, 390, ease.out2], [T.tossLand, 0, ease.in2]]);
    b.rot += kf(t, [[T.waveRise + 0.25, 0], [T.slam - 0.05, -0.3, ease.io2], [T.slam + 0.5, 0.36, ease.io2], [T.tossLand - 0.05, 0.12], [T.tossLand + 0.3, 0, ease.out2]]);
    b.seat = -36 * bumpAt(t, T.slam + 0.1, T.tossLand - T.slam - 0.1); // off its seat in mid-air
    b.y += decay(t, T.tossLand, 6, 16) * 30;
    // laughing at itself: three quick bobs
    for (let k = 0; k < 3; k++) b.seat -= 13 * bumpAt(t, T.laugh + k * 0.2, 0.2);
    return b;
  }

  // ── the face: where it looks and how it feels, by time ──
  const BLINKS = [T.blink, S[0] + 1.0, S[3] + 0.5, S[5] - 0.6, S[9] + 1.3, S[12] + 0.9, S[14] + 0.3, S[17] + 0.4, S[20] + 0.7, T.cup + 0.25];
  function face(t) {
    const f = { eye: ease.outBack(prog(t, T.eyes, T.eyes + 0.24)), open: 1, lx: 0, ly: 0, mood: "plain" };
    for (const b of BLINKS) f.open = Math.min(f.open, 1 - bumpAt(t, b, 0.15));
    const look = (lx, ly, mood) => {
      f.lx = lx;
      f.ly = ly;
      if (mood) f.mood = mood;
    };
    if (t < T.bloom) look(kf(t, [[2.5, 0], [2.78, -1, ease.io2], [2.9, -1], [3.0, 1, ease.io2]]), 0);
    else if (t < T.waveIn + 0.5) look(0.9, -0.1, t < T.bloom + 1.0 ? "wow" : "happy");
    else if (t < T.heroesOut + 1.0) look(kf(t, [[T.waveIn + 0.5, -1], [T.heroes, -1], [T.heroesOut + 0.8, 1, ease.io2]]), -0.7, "wow"); // follows the wave across
    else if (t < T.boatLand - 0.62) look(-0.6, 0.7, "happy"); // the skiff below
    else if (t < T.boatLand - 0.03) look(1, 0.6, "set");
    else if (t < T.boatLand + 0.26) look(0, 0, "squint");
    else if (t < S[3] - 0.1) look(0.9, -0.1, "happy");
    else if (t < T.birds) look(0.8, -0.5); // the old fort
    else if (t < T.tiltUp) look(0.5, -0.9, "wow"); // the birds
    else if (t < T.waveRise) look(0.7, -1, "wow"); // the cliff, the rocks
    else if (t < T.waveRise + 0.55) look(-1, -0.3, "wow"); // what is that behind us
    else if (t < T.slam) look(1, 0, "set");
    else if (t < T.slam + 0.3) look(0, 0, "squint");
    else if (t < T.tossLand - 0.04) look(0.2, 0.8, "wow");
    else if (t < T.tossLand + 0.3) look(0, 0, "squint");
    else if (t < T.flags) look(kf(t, [[T.tossLand + 0.3, 0], [S[9], -0.7, ease.io2], [S[9] + 1.1, 0.8, ease.io2]]), -0.3, "happy");
    else if (t < T.eyesShut) look(0.6, -0.6, "wow");
    else if (t < S[11] - 0.2) {
      look(0.4, -0.3);
      f.open = Math.min(f.open, 1 - ease.io2(prog(t, T.eyesShut, T.eyesShut + 0.3))); // eyes shut: 遥想
    } else if (t < T.qiao + 0.4) look(0.9, -0.7, "wow");
    else if (t < T.proud) look(0.9, -0.7, "happy");
    else if (t < T.flick) look(0.9, -0.7, t < T.fan ? "wow" : "plain");
    else if (t < T.ignite) look(kf(t, [[T.flick, 0.9], [T.ignite, 0.1, ease.io2]]), -0.9, "plain"); // follows the spark
    else if (t < T.collapse) look(0.1, -0.9, "wow");
    else if (t < T.collapse + 0.45) look(0, 0, "squint");
    else if (t < T.wake + 0.6) look(0.2, -0.7);
    else if (t < T.laugh - 0.05) look(0.5, -0.2);
    else if (t < T.hair) look(0.3, 0, "happy");
    else if (t < T.hair + 1.0) look(0, -1, "wow"); // what just grew up there
    else if (t < T.wide) look(0.2, -0.6, "happy");
    else if (t < T.cup) look(0.85, -0.85); // the moon
    else if (t < T.pour) look(0.9, -0.5, "happy");
    else if (t < T.hop - 0.35) look(0.9, 0.6, "happy"); // the wine in the river
    else look(0.2, -0.8, "set");
    return f;
  }

  // ── painted once ──
  function buildRock() {
    const c = QZ.canvas(660, 170);
    const x = c.getContext("2d");
    const r = rng(41);
    // the outline, left foot → flat top → right foot; the water line is y = 150
    const top = [];
    for (let i = 0; i <= 10; i++) top.push([178 + i * 29, 46 + 4 * Math.sin(i * 1.3) + 5 * (vnoise(i * 0.7, 4) - 0.5)]);
    const edge = [[14, 150], [50, 118], [96, 96], [128, 66]].concat(top, [[492, 62], [528, 92], [566, 104], [600, 132], [646, 150]]).map((p, i) => [p[0] + 5 * (vnoise(i * 0.9, 12) - 0.5), p[1]]);
    x.beginPath();
    edge.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
    x.closePath();
    const g = x.createLinearGradient(0, 40, 0, 150);
    g.addColorStop(0, rgba([122, 116, 100]));
    g.addColorStop(1, rgba([78, 78, 70]));
    x.fillStyle = g;
    x.fill();
    x.save();
    x.clip();
    for (let i = 0; i < 70; i++) {
      const px = 20 + r() * 620;
      const py = 50 + r() * 90;
      const len = 20 + r() * 60;
      inkLine(x, [[px, py], [px + (r() - 0.5) * 16, py + len * 0.5], [px + (r() - 0.5) * 26, py + len]], { w: 1.6 + r() * 3, color: C.ink, alpha: 0.1 + r() * 0.18, taper: "end", seed: i });
    }
    const gg = x.createLinearGradient(0, 38, 0, 84);
    gg.addColorStop(0, rgba([134, 156, 116], 0.9));
    gg.addColorStop(1, rgba([134, 156, 116], 0));
    x.fillStyle = gg;
    x.fillRect(0, 30, 660, 60);
    x.restore();
    inkLine(x, edge, { w: 5, color: C.ink, alpha: 0.75, taper: "none", rough: 0.8, seed: 5, seg: 0 });
    for (let i = 0; i < 12; i++) {
      const px = 190 + r() * 270;
      for (let j = 0; j < 3; j++) inkLine(x, [[px + j * 5, 50], [px + j * 5 + (j - 1) * 5, 36 - r() * 10]], { w: 2.4, color: C.pine, alpha: 0.85, taper: "end", seg: 0 });
    }
    props.rock = c; // the middle of its top is at (323, 46)
  }
  function buildCliff() {
    const cw = 1160;
    const chh = 1300;
    const c = QZ.canvas(cw, chh);
    const x = c.getContext("2d");
    const r = rng(1082);
    const left = QZ.catmull([[20, 1300], [64, 1010], [112, 700], [150, 420], [192, 210], [246, 112]], 8);
    const top = [];
    for (let px = 260; px <= 900; px += 30) top.push([px, 100 + 12 * Math.sin(px * 0.013) + 16 * (vnoise(px * 0.02, 7) - 0.5)]);
    const right = QZ.catmull([[930, 130], [980, 260], [1010, 420], [990, 700], [1022, 1000], [1080, 1300]], 8).map((p, i) => [p[0] + 12 * (vnoise(i * 0.4, 9) - 0.5), p[1]]);
    const edge = left.concat(top, right);
    x.beginPath();
    edge.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
    x.closePath();
    // 赤壁: rust and ochre, never the dot's vermilion
    const g = x.createLinearGradient(0, 90, 0, 1300);
    g.addColorStop(0, rgba([108, 76, 60]));
    g.addColorStop(0.35, rgba([146, 94, 70]));
    g.addColorStop(0.75, rgba([160, 108, 80]));
    g.addColorStop(1, rgba([176, 134, 104]));
    x.fillStyle = g;
    x.fill();
    x.save();
    x.clip();
    // rock, not bark: blocks of light and shade, broken strata, jagged cracks
    for (let k = 0; k < 60; k++) {
      const px = 40 + r() * 1000;
      const py = 120 + r() * 1100;
      const w = 70 + r() * 190;
      const h = 90 + r() * 260;
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px + w * (0.7 + r() * 0.3), py + (r() - 0.5) * 36);
      x.lineTo(px + w + (r() - 0.5) * 36, py + h);
      x.lineTo(px + (r() - 0.5) * 44, py + h * (0.8 + r() * 0.2));
      x.closePath();
      x.fillStyle = r() > 0.5 ? rgba(C.ink, 0.04 + r() * 0.08) : rgba([232, 196, 156], 0.06 + r() * 0.1);
      x.fill();
    }
    for (let k = 0; k < 26; k++) {
      const y0 = 150 + r() * 1100;
      let px = 30 + r() * 200;
      while (px < 1060) {
        const len = 70 + r() * 220;
        inkLine(x, [[px, y0 + (r() - 0.5) * 10], [px + len * 0.5, y0 + (r() - 0.5) * 16], [px + len, y0 + (r() - 0.5) * 10]], { w: 1.6 + r() * 2.6, color: C.ink, alpha: 0.1 + r() * 0.16, taper: "both" });
        px += len + 50 + r() * 200;
      }
    }
    const crack = (px, py, n, step, w, a) => {
      const pts = [[px, py]];
      for (let j = 1; j <= n; j++) pts.push([pts[j - 1][0] + (r() - 0.5) * 44, py + j * step * (0.6 + r() * 0.8)]);
      inkLine(x, pts, { w, color: C.ink, alpha: a, taper: "end", seg: 0 });
    };
    for (let k = 0; k < 150; k++) crack(40 + r() * 1040, 120 + r() * 1100, 3 + Math.floor(r() * 3), 40, 1.6 + r() * 3, 0.1 + r() * 0.2);
    for (let k = 0; k < 8; k++) crack(140 + r() * 800, 130 + r() * 500, 7 + Math.floor(r() * 5), 70, 5 + r() * 4, 0.34); // deep fissures
    // the side away from the light
    const gs = x.createLinearGradient(380, 0, 1100, 0);
    gs.addColorStop(0, rgba(C.ink, 0));
    gs.addColorStop(1, rgba(C.ink, 0.26));
    x.fillStyle = gs;
    x.fillRect(0, 0, cw, chh);
    // ledges where grass has taken hold
    for (let k = 0; k < 14; k++) {
      const px = 120 + r() * 800;
      const py = 200 + r() * 900;
      if (px > 400 && px < 800 && py > 440 && py < 980) continue; // not across the two characters
      const len = 50 + r() * 90;
      inkLine(x, [[px, py], [px + len * 0.5, py - 3], [px + len, py + 2]], { w: 5, color: C.ink, alpha: 0.4, taper: "both" });
      for (let j = 0; j < 5; j++) inkLine(x, [[px + (j / 4) * len, py], [px + (j / 4) * len + (r() - 0.5) * 10, py - 10 - r() * 14]], { w: 2.4, color: C.pine, alpha: 0.9, taper: "end", seg: 0 });
      if (r() > 0.55) SC.miniPine(x, px + len * 0.5, py - 2, 0.8 + r() * 0.5, 0.9);
    }
    // a smoother face for the two characters, a little paler
    wash(x, 600, 720, 250, 330, [196, 150, 116], 0.4, 0.6);
    // grass on the top, mist where it stands in the river
    const gt = x.createLinearGradient(0, 96, 0, 170);
    gt.addColorStop(0, rgba([120, 146, 108], 0.85));
    gt.addColorStop(1, rgba([120, 146, 108], 0));
    x.fillStyle = gt;
    x.fillRect(0, 80, cw, 100);
    const gm = x.createLinearGradient(0, 1150, 0, 1300);
    gm.addColorStop(0, rgba(C.paperHi, 0));
    gm.addColorStop(1, rgba(C.paperHi, 0.5));
    x.fillStyle = gm;
    x.fillRect(0, 1150, cw, 150);
    x.restore();
    inkLine(x, edge, { w: 6, color: C.ink, alpha: 0.75, taper: "none", rough: 0.8, seed: 3, seg: 0 });
    SC.pine(x, 420, 104, 0.62);
    SC.pine(x, 760, 100, 0.5);
    for (let i = 0; i < 12; i++) SC.miniPine(x, 270 + r() * 620, 104, 0.9 + r() * 0.8, 0.85);
    props.cliff = c;
    props.spires = SPIRES.map(([sx, h, w, lean], i) => {
      const sc = QZ.canvas(w + 160, h + 30);
      SC.spire(sc.getContext("2d"), (w + 160) / 2, h + 10, w, h, i + 11, [126, 88, 68], lean);
      return { canvas: sc, x: sx, h };
    });
  }
  function build() {
    tiles.huge = SC.ridgeTile({
      w: 3072,
      h: 620,
      seed: 211,
      freq: 4,
      amp: 540,
      floor: 0.1,
      sharp: 2.3,
      paint: { color: mix(C.slate, C.lilac, 0.45), aTop: 0.34, aBot: 0.0, depth: 420, seed: 9, outline: { w: 2, a: 0.14, color: mix(C.slate, C.ink, 0.4) } },
    });
    tiles.far = SC.ridgeTile({
      w: 3072,
      h: 440,
      seed: 131,
      freq: 7,
      amp: 330,
      floor: 0.1,
      sharp: 1.9,
      paint: { color: mix(C.slate, C.lilac, 0.25), aTop: 0.5, aBot: 0.0, depth: 250, seed: 1, outline: { w: 2.2, a: 0.22, color: mix(C.slate, C.ink, 0.5) } },
    });
    tiles.mid = SC.ridgeTile({
      w: 3072,
      h: 520,
      seed: 67,
      freq: 5,
      amp: 450,
      floor: 0.16,
      sharp: 1.5,
      jitter: { amp: 10, f: 0.05, seed: 5 },
      paint: { color: [92, 112, 110], aTop: 0.7, aBot: 0.04, depth: 400, seed: 2, outline: { w: 3, a: 0.36 }, tex: { kind: "slope", n: 240, len: 90, a: 0.12 }, moss: 60 },
    });
    tiles.bank = SC.ridgeTile({
      w: 3072,
      h: 240,
      seed: 29,
      freq: 6,
      amp: 150,
      floor: 0.22,
      sharp: 1.2,
      paint: { color: [84, 100, 86], aTop: 0.92, aBot: 0.5, depth: 200, seed: 6, outline: { w: 3.4, a: 0.5 }, tex: { kind: "slope", n: 200, len: 50, a: 0.12 }, moss: 90 },
    });
    buildRock();
    buildCliff();
    const fc = QZ.canvas(720, 330);
    SC.ruin(fc.getContext("2d"), 360, 318, 1);
    props.fort = fc;
    props.pic = QZ.canvas(W, H); // the frame as a picture, for 江山如画
  }

  // ── the river and everything behind it ──
  // o: {sun 0..1 (how far it has set), dusk, night, speed, swell, behind: fn(c) drawn on the far bank}
  const TINT_DAY = [[226, 212, 172], [176, 182, 152], [108, 138, 132]];
  const TINT_NIGHT = [[104, 124, 150], [70, 92, 124], [40, 58, 88]];
  const CLOUDS = [
    { x: 520, y: 170, s: 1.0, c: C.peach, f: 1 },
    { x: 1250, y: 120, s: 1.2, c: mix(C.gold, C.paperHi, 0.25) },
    { x: 1900, y: 250, s: 0.9, c: C.blush },
    { x: 2500, y: 150, s: 1.1, c: C.peach, f: 1 },
  ];
  function drawRiver(c, cm, t, o) {
    const up = cm.up;
    const night = o.night || 0;
    const dusk = o.dusk || 0;
    SC.sky(c, "dusk", 1 - night);
    if (dusk > 0 && night < 1) {
      wash(c, 960, 560 + up * 0.3, 1700, 420, [226, 140, 64], 0.26 * dusk * (1 - night));
      wash(c, 960, 40, 1700, 330, C.lilac, 0.3 * dusk * (1 - night));
    }
    if (night > 0) {
      SC.sky(c, "night", night);
      SC.stars(c, t, 90, night, [-300, -260, W + 300, 500 + up * 0.15]);
      SC.moon(c, MOON[0], MOON[1] + up * 0.12, 78, night, 1);
    }
    if (night < 1 && o.sun < 0.99) SC.sun(c, 400 - cm.x * 0.008, lerp(250, 640, o.sun) + up * 0.1, 62, (1 - night) * (1 - prog(o.sun, 0.8, 1)));
    // long streaks of evening cloud
    for (let i = 0; i < 6; i++) {
      const sx = ((((i * 520 + 140 - cm.x * 0.04 + t * 6) % 3000) + 3000) % 3000) - 500;
      wash(c, sx, 90 + i * 62 + (i % 2) * 40 + up * 0.08, 520 + (i % 3) * 160, 22 + (i % 2) * 12, i % 2 ? C.peach : C.lilac, (0.34 + 0.2 * dusk) * (1 - night), 0.6);
    }
    SC.drawTile(c, tiles.huge, cm.x * 0.03 + 1300, 590 + up * 0.4, 0.95 * (1 - 0.4 * night), -500, W + 500);
    SC.drawTile(c, tiles.far, cm.x * 0.06 + 300, 566 + up * 0.55, 1, -500, W + 500);
    for (const k of CLOUDS) {
      const sx = ((((k.x - cm.x * 0.1) % 2800) + 2800) % 2800) - 300;
      SC.cloud(c, sx + Math.sin(t * 0.4 + k.x) * 8, k.y + up * 0.1, k.s, k.c, 0.9 * (1 - night) * (1 - 0.5 * dusk), k.f);
    }
    SC.drawTile(c, tiles.mid, cm.x * 0.16 + 900, 622 + up * 0.78, 1, -500, W + 500);
    SC.drawTile(c, tiles.bank, cm.x * BP + 200, WATER + 6 + up, 1, -500, W + 500);
    if (o.behind) o.behind(c);
    const tint = TINT_DAY.map((d0, i) => mix(d0, TINT_NIGHT[i], night));
    SC.water(c, cm.x, WATER + up, t, 1, o.speed || 0, tint);
    SC.reflect(c, tiles.bank, cm.x * BP + 200, WATER + up, 0.16);
    SC.swells(c, cm.x, WATER + up, t, o.swell === undefined ? 1 : o.swell, t * 150, mix([70, 116, 120], [30, 44, 70], night));
    if (dusk > 0 && night < 1) {
      // the day going brown
      c.save();
      c.globalCompositeOperation = "multiply";
      c.fillStyle = rgba([196, 160, 128], 0.42 * dusk * (1 - night));
      c.fillRect(-500, -500, W + 1000, H + 1000);
      c.restore();
    }
    if (night > 0) {
      // night falls over the land and the water; the sky above is already dark
      c.save();
      c.globalCompositeOperation = "multiply";
      const g = c.createLinearGradient(0, 300 + up * 0.3, 0, 640 + up);
      g.addColorStop(0, rgba([64, 84, 124], 0));
      g.addColorStop(1, rgba([64, 84, 124], 0.72 * night));
      c.fillStyle = g;
      c.fillRect(-500, -500, W + 1000, H + 1000);
      c.restore();
      SC.glint(c, MOON[0], WATER + up, t, mix([250, 246, 228], C.paperHi, 0.3));
    }
  }

  // the old fort, the cliff with its two characters, the rocks that pierce the sky
  function bankFeatures(c, cm, t) {
    const base = WATER + 6 + cm.up;
    let sx = bankSX(fortLX, cm);
    if (sx > -800 && sx < W + 800) {
      c.drawImage(props.fort, sx - 360, base - 318);
      SC.pennant(c, sx - 190, base - 96, t, 0.6, 1, C.inkPale); // one faded pennant still on the wall
      const k = prog(t, T.birds, T.birds + 2.8);
      if (k > 0 && k < 1) SC.birds(c, sx + 150 + 420 * k, base - 280 - 300 * ease.out2(k), t, 6, 0.8 * Math.sin(Math.PI * Math.pow(k, 0.6)));
    }
    const px = bankSX(spireLX, cm);
    if (px > -1400 && px < W + 700) {
      props.spires.forEach((sp, i) => {
        const k = lerp(0.45, 1, ease.outBack(prog(t, T.spires + i * 0.07, T.spires + 0.55 + i * 0.07)));
        const cw = sp.canvas.width;
        const chh = sp.canvas.height;
        c.drawImage(sp.canvas, px + sp.x - cw / 2, base - (chh - 20) * k, cw, chh * k);
      });
    }
    sx = bankSX(cliffLX, cm);
    if (sx > -1400 && sx < W + 600) {
      c.drawImage(props.cliff, sx, base - props.cliff.height + 12);
      // 赤壁, cut into the rock as the two words are spoken
      const gy = base - props.cliff.height + 12;
      [["赤", T.carve1, 0.06, 500], ["壁", T.carve2, 0.032, 730]].forEach(([ch, t0, step, y0]) => {
        if (t < t0) return;
        const fn = (si) => prog(t, t0 + si * step, t0 + si * step + step * 1.6);
        QZ.drawGlyph(c, ch, sx + 503, gy + y0 + 4, 200, rgba([54, 34, 28], 0.9), fn);
        QZ.drawGlyph(c, ch, sx + 500, gy + y0, 200, rgba([244, 232, 208]), fn);
      });
      for (const [t0, y0] of [[T.carve1 + 0.45, 600], [T.carve2 + 0.55, 830]]) A.ticks(c, sx + 600, gy + y0 + 60, prog(t, t0, t0 + 0.3), 9, 120, 50, y0, [244, 232, 208]);
    }
  }

  // ── 浪淘尽，千古风流人物: a wave crosses the river carrying the shapes of those who are gone ──
  const HEROES = [
    { x: -176, s: 0.52, hat: "tall", prop: "staff", arm: 0.1 },
    { x: -74, s: 0.78, hat: "helm", prop: "spear", arm: 0.3 },
    { x: 24, s: 1.0, hat: "jin", prop: "fan", arm: 0.55 },
    { x: 116, s: 0.84, hat: "guan", prop: "sword", arm: 0.9 },
  ];
  function heroWave(c, cm, t) {
    if (t < T.waveIn || t > T.heroesOut + 1.7) return;
    const wx = -900 + 300 * (t - T.waveIn);
    const squash = 1 - 0.82 * ease.io2(prog(t, T.heroesOut + 0.5, T.heroesOut + 1.6));
    const a = 1 - prog(t, T.heroesOut + 1.0, T.heroesOut + 1.7);
    const y = WATER + cm.up + 150;
    const seen = ease.io2(prog(t, T.heroes, T.heroes + 0.5));
    const gone = ease.io2(prog(t, T.heroesOut, T.heroesOut + 0.8));
    A.bigWave(c, wx - 720 - cm.x + 960, y + 24, { s: 0.78, t: t + 3, a, squash });
    A.bigWave(c, wx - cm.x + 960, y, {
      s: 1.25,
      t,
      a,
      squash,
      inside: (cc) => {
        if (seen <= 0 || gone >= 1) return;
        HEROES.forEach((h, i) => A.figure(cc, h.x, -6 + gone * 30, { s: h.s, hat: h.hat, prop: h.prop, arm: h.arm, robe: [34, 64, 72], belt: [34, 64, 72], plume: [34, 64, 72], a: 0.58 * seen * (1 - gone), melt: gone, t, ph: i * 1.7, wind: 0.6 }));
      },
    });
    // where they stood, only foam
    if (gone > 0 && gone < 1) for (let i = 0; i < 14; i++) A.foamHeap(c, wx - cm.x + 960 + (-200 + i * 28) * 1.25, y - (90 + hash(i * 7) * 200) * (1 - gone * 0.4), 10 + hash(i * 3) * 16, i, Math.sin(Math.PI * gone) * 0.9, i);
  }

  // ── 惊涛拍岸，卷起千堆雪: the wave that lifts the skiff and breaks on the rocks ──
  const HEAPS = [];
  for (let i = 0; i < 46; i++) HEAPS.push({ vx: (hash(i * 13) - 0.5) * 1250, vy: -(520 + hash(i * 7) * 700), r: 22 + Math.pow(hash(i * 5), 1.6) * 66, spin: (hash(i * 3) - 0.5) * 3, front: i % 3 === 0 });
  function slamWave(c, cm, t) {
    if (t < T.waveRise || t > T.slam + 0.8) return;
    const hit = bankSX(impactLX, camera(T.slam));
    const x = kf(t, [[T.waveRise, boatSX(T.waveRise) - 1700], [T.slam, hit - 242 * 2.1 - 40, ease.in2], [T.slam + 0.8, hit - 242 * 2.1 + 60]]);
    const k = prog(t, T.slam, T.slam + 0.7);
    A.bigWave(c, x, WATER + cm.up + 176, { s: 2.1, t, a: 1 - k * k, squash: lerp(0.35, 1, ease.out2(prog(t, T.waveRise, T.waveRise + 0.6))) * (1 - 0.86 * ease.out2(k)) });
  }
  function foam(c, cm, t, front) {
    const tau = t - T.slam;
    if (tau < 0 || tau > 3.6) return;
    const x0 = bankSX(impactLX, cm);
    const y0 = WATER + cm.up - 10;
    if (!front) {
      A.splash(c, x0, y0 + 20, prog(tau, 0, 1.3), 40, 1500, 7);
      wash(c, x0, y0 - 60, 420, 300, C.paperHi, 0.8 * (1 - prog(tau, 0, 0.9)));
      // white water at the foot of the rocks, running off
      const froth = ease.out2(prog(tau, 0, 0.3)) * (1 - prog(tau, 1.6, 3.4));
      wash(c, x0, y0 + 46, 620, 60, C.paperHi, 0.85 * froth, 0.6);
      for (let i = 0; i < 16; i++) A.foamHeap(c, x0 - 520 + i * 70 + Math.sin(tau * 2 + i) * 14, y0 + 44 + (i % 3) * 14, 16 + hash(i * 9) * 20, i + 50, 0.9 * froth, 0);
    }
    for (const h of HEAPS) {
      if (h.front !== front) continue;
      const g = 640;
      let px = x0 + h.vx * tau * (1 - 0.12 * tau);
      let py = y0 + h.vy * tau + 0.5 * g * tau * tau;
      if (py > y0 + 60 && tau > 1) continue;
      px += Math.sin(tau * 2 + h.spin * 4) * 14 * clamp(tau - 1);
      A.foamHeap(c, px, py, h.r * (0.4 + 0.6 * ease.out2(prog(tau, 0, 0.35))), Math.round(h.r * 7), (1 - prog(tau, 2.6, 3.4)) * ease.out2(prog(tau, 0, 0.12)), h.spin * tau);
    }
  }

  // ── 一时多少豪杰: flags along the ridges and the far bank, little warships on the river ──
  const FLAGS = [];
  {
    const cm = camera(T.flags);
    for (let i = 0; i < 22; i++) FLAGS.push({ layer: "mid", tx: cm.x * 0.16 + 900 + 70 + i * 84 + (hash(i * 9) - 0.5) * 40, k: i / 22, man: i % 2 === 0 });
    for (let i = 0; i < 12; i++) FLAGS.push({ layer: "bank", tx: cm.x * BP + 200 + 120 + i * 150 + (hash(i * 5 + 2) - 0.5) * 60, k: (i + 0.5) / 12, man: true });
  }
  const FLEET_SMALL = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 260 + i * 270 + (hash(i * 11) - 0.5) * 80, y: 46 + hash(i * 3) * 110, k: (i + 0.3) / 6 }));
  function flags(c, cm, t) {
    if (t < T.flags || t > T.pushIn1 + 0.4) return;
    const span = Math.max(0.8, T.vEnd[10] - T.flags) * 0.9;
    const out = 1 - prog(t, T.pushIn0 + 0.3, T.pushIn1);
    for (const f of FLAGS) {
      const k = ease.outBack(prog(t, T.flags + f.k * span, T.flags + f.k * span + 0.28)) * out;
      if (k <= 0.01) continue;
      const tile = tiles[f.layer];
      const par = f.layer === "mid" ? 0.16 : BP;
      const off = f.layer === "mid" ? 900 : 200;
      const bottom = f.layer === "mid" ? 622 + cm.up * 0.78 : WATER + 6 + cm.up;
      const sx = f.tx - (cm.x * par + off);
      const txi = ((Math.round(f.tx) % tile.width) + tile.width) % tile.width;
      const y = bottom - tile.hs[txi] + 4;
      c.save();
      c.translate(sx, y);
      c.scale(0.7 * k, 0.7 * k);
      if (f.man) A.figure(c, -30, 2, { s: 0.36, hat: "helm", prop: "spear", arm: 0.3, t, ph: f.tx });
      SC.pennant(c, 0, 0, t, f.tx, 1);
      c.restore();
    }
    for (const s of FLEET_SMALL) {
      const k = ease.outBack(prog(t, T.flags + s.k * span, T.flags + s.k * span + 0.3)) * out;
      if (k > 0.01) A.warship(c, s.x - (cm.x - camera(T.flags).x) * 0.8, WATER + cm.up + s.y, { s: 0.2 * k, t, ph: s.x });
    }
  }

  // ── 遥想公瑾当年 …… 樯橹灰飞烟灭: the past, playing in the mist over the river ──
  // the chained fleet: a far rank, paler, and a near one. Ignited from the right (upwind), the fire runs left
  const FLEET = [];
  for (let j = 0; j < 8; j++) FLEET.push({ x: 90 + j * 112, dy: -26, s: 0.42, a: 0.55, far: true });
  for (let i = 0; i < 7; i++) FLEET.push({ x: 130 + i * 126, dy: 12 + (i % 2) * 8, s: 0.62, a: 0.9, far: false });
  FLEET.forEach((f) => (f.order = 1 - (f.x - 80) / 830 + (f.far ? 0.06 : 0)));
  const ASH = [];
  for (let i = 0; i < 280; i++) ASH.push({ x: 140 + hash(i * 17) * 900, y: 520 + hash(i * 5) * 180, born: -0.4 + hash(i * 3) * 1.7, life: 1.5 + hash(i * 11) * 1.3, vx: -(60 + hash(i * 7) * 200), vy: -(90 + hash(i * 13) * 190), r: 2.4 + hash(i * 19) * 4.4 });
  function vision(c, cm, t) {
    if (t < T.eyesShut || t > T.ashEnd + 0.8) return;
    const up = cm.up;
    const mistA = ease.io2(prog(t, T.eyesShut + 0.2, T.pushIn1)) * (1 - prog(t, T.night, T.ashEnd + 0.6));
    SC.mist(c, WATER + up - 50, 170, 0.95 * mistA, t * 16, 5);
    SC.mist(c, WATER + up - 210, 150, 0.75 * mistA, -t * 11, 9);
    const gone = prog(t, T.collapse + 0.4, T.night); // the whole vision going
    // the chained fleet, far across the water
    const fleetA = ease.io2(prog(t, T.ship + 0.3, T.ship + 1.5));
    const span = Math.max(0.6, T.collapse - T.ignite - 0.45);
    const wy = WATER + up + 34;
    if (fleetA > 0) {
      const burnAll = prog(t, T.ignite, T.collapse);
      if (burnAll > 0) {
        const glow = Math.sin(Math.PI * clamp(prog(t, T.ignite, T.collapse + 1.0)));
        wash(c, 520, wy - 110, 820, 420, [244, 186, 88], 0.5 * glow);
        wash(c, 520, wy + 150, 720, 160, [244, 186, 88], 0.3 * glow); // on the water
      }
      inkLine(c, [[80, wy + 4], [520, wy + 10], [960, wy + 4]], { w: 3.4, color: C.ink, alpha: 0.5 * fleetA * (1 - prog(t, T.collapse, T.collapse + 0.5)), taper: "none" }); // the chain
      FLEET.forEach((f, i) => {
        const tI = T.ignite + clamp(f.order) * span;
        const burn = prog(t, tI, tI + 0.4);
        const fall = ease.in2(prog(t, T.collapse - 0.1 + f.order * 0.2, T.collapse + 0.9));
        const a = fleetA * f.a * (1 - prog(t, T.collapse + 0.25, T.collapse + 1.0));
        if (a <= 0.01) return;
        const y = wy + f.dy + fall * 70;
        if (burn > 0) A.smoke(c, f.x, y - 220 * f.s, 120 * f.s, 440, t, i * 7 + 3, 0.9 * burn * (1 - gone), -0.55);
        A.warship(c, f.x, y, { s: f.s, t, ph: i, wind: 0.8, a, char: 0.9 * prog(t, tI + 0.15, T.collapse), list: (i % 2 ? 1 : -1) * 0.5 * fall, oars: false });
        if (burn > 0) A.flame(c, f.x, y - 30 * f.s, 330 * f.s, 380 * f.s * burn * (1 - prog(t, T.collapse + 0.2, T.collapse + 1.0)), t, i * 5 + 1, a / f.a, -0.6);
      });
    }
    // the flagship noses in from the right, 周瑜 at the bow, 小乔 beside him
    const shipA = ease.io2(prog(t, T.ship, T.ship + 1.2)) * (1 - gone);
    if (shipA > 0.01) {
      const sx = lerp(W + 1100, 1500, ease.out3(prog(t, T.ship, T.ship + 2.0))); // its sail stops short of the caption slip
      const sy = WATER + up + 84 + Math.sin(t * 1.6) * 5;
      const deck = sy - 16 * 2.6;
      const proud = ease.out2(prog(t, T.proud, T.proud + 0.5));
      c.save();
      c.globalAlpha = shipA;
      if (proud > 0) {
        // the light behind him
        wash(c, sx - 360, deck - 300, 560, 460, C.gold, 0.5 * proud);
        for (let i = 0; i < 11; i++) {
          const a0 = -Math.PI * 0.94 + (i / 10) * Math.PI * 0.88;
          inkLine(c, [[sx - 360 + Math.cos(a0) * 230, deck - 300 + Math.sin(a0) * 230], [sx - 360 + Math.cos(a0) * (420 + 60 * Math.sin(t * 3 + i)), deck - 300 + Math.sin(a0) * (420 + 60 * Math.sin(t * 3 + i))]], { w: 9, color: [246, 214, 140], alpha: 0.4 * proud, taper: "both", seg: 0 });
        }
      }
      A.warship(c, sx, sy, { s: 2.6, flip: true, t, wind: -0.8, oars: false });
      const fanUp = ease.outBack(prog(t, T.fan, T.fan + 0.4));
      const flick = bumpAt(t, T.flick - 0.08, 0.5);
      const qa = ease.io2(prog(t, T.qiao, T.qiao + 0.6));
      if (qa > 0) A.lady(c, sx - 205, deck, { s: 1.55, flip: true, a: qa, t, wind: -0.6, robe: [232, 178, 164] });
      A.figure(c, sx - 345, deck, {
        s: 1.78,
        flip: true,
        hat: "jin",
        robe: [66, 88, 118],
        trim: [44, 58, 84],
        face: [232, 212, 184],
        capeColor: [44, 58, 84],
        cape: 0.3 + 0.4 * proud,
        eyes: true,
        wind: -0.8,
        prop: t >= T.fan ? "fan" : null,
        arm: 0.15 + 0.5 * fanUp + 0.3 * flick + 0.25 * proud * (t < T.fan ? 1 : 0),
        flick: -0.9 * flick,
        t,
      });
      c.restore();
      // one flick of the fan: a spark crosses to the fleet
      const sp = prog(t, T.flick + 0.1, T.ignite);
      if (sp > 0 && sp < 1) {
        const ax = sx - 345 - 150;
        const ay = deck - 330;
        const bx = 130 + 6 * 126;
        const by = wy - 70;
        for (let k = 0; k < 6; k++) {
          const q = clamp(sp - k * 0.035);
          const px = lerp(ax, bx, q);
          const py = lerp(ay, by, q) - 120 * Math.sin(Math.PI * q);
          c.beginPath();
          c.arc(px, py, 9 - k * 1.2, 0, 7);
          c.fillStyle = rgba(k ? [244, 186, 88] : [252, 234, 178], 0.95 - k * 0.14);
          c.fill();
        }
      }
    }
    // 灰飞烟灭: what is left rises, drifts downwind, and is gone
    const tau = t - T.collapse;
    if (tau > -0.5 && tau < 3.2) {
      for (const p of ASH) {
        const age = (tau - p.born) / p.life;
        if (age <= 0 || age >= 1) continue;
        const px = p.x + p.vx * age * p.life + Math.sin(age * 9 + p.r) * 24;
        const py = p.y + p.vy * age * p.life + up;
        c.beginPath();
        c.arc(px, py, p.r * (1 - age * 0.4), 0, 7);
        c.fillStyle = rgba(age < 0.25 ? [244, 186, 88] : mix([150, 144, 134], [60, 56, 54], hash(p.r * 97)), Math.sin(Math.PI * age) * 0.9);
        c.fill();
      }
    }
    // smoke over everything, thickest as day turns to night underneath
    const sm = kf(t, [[T.ignite + 0.3, 0], [T.night, 1, ease.io2], [T.ashEnd + 0.6, 0, ease.io2]]);
    if (sm > 0) {
      c.fillStyle = rgba([44, 40, 38], 0.5 * sm);
      c.fillRect(-500, -500, W + 1000, H + 1000);
      SC.mist(c, 140 + up * 0.3, 260, 0.8 * sm, -t * 60, 21, [44, 40, 38]);
      SC.mist(c, 400 + up * 0.5, 240, 0.7 * sm, -t * 84, 27, [58, 52, 48]);
      SC.mist(c, 620 + up, 200, 0.5 * sm, -t * 50, 33, [44, 40, 38]);
    }
  }

  // 早生华发: three white hairs spring up on the dot at (x, y), radius r — and stay for the rest of the film
  function hairs(c, x, y, r, sy, t) {
    const k0 = r / R;
    for (let k = 0; k < 3; k++) {
      const g = ease.outElastic(prog(t, T.hair + k * 0.13, T.hair + k * 0.13 + 0.7));
      if (g <= 0) continue;
      const a0 = -Math.PI / 2 + (k - 1) * 0.42;
      const x0 = x + Math.cos(a0) * r * 0.92;
      const y0 = y + Math.sin(a0) * r * 0.92 * sy;
      const len = (30 + k * 4) * g * k0;
      const sw = Math.sin(t * 3 + k * 1.4) * 5 * k0;
      const pts = [[x0, y0], [x0 + Math.cos(a0) * len * 0.5 + sw * 0.4, y0 + Math.sin(a0) * len * 0.6], [x0 + Math.cos(a0) * len + (k - 1) * 8 * k0 + sw, y0 + Math.sin(a0) * len]];
      inkLine(c, pts, { w: 6.5 * k0, color: [54, 62, 82], taper: "end", rough: 0.1 });
      inkLine(c, pts, { w: 4 * k0, color: [250, 248, 240], taper: "end", rough: 0.1 });
    }
  }

  // ── the skiff with the dot aboard, and what the dot does there ──
  function drawSkiff(c, cm, t, withDot) {
    const b = skiffState(t);
    const sx = b.x - cm.x + 960;
    const sy = b.y + cm.up;
    const f = face(t);
    const night = nightK(t);
    A.skiff(c, sx, sy, {
      rot: b.rot,
      sx: b.sx,
      sy: b.sy,
      dot: (cc) => {
        if (!withDot) return;
        const sq = bumpAt(t, T.boatLand, 0.2) + bumpAt(t, T.tossLand, 0.2);
        const dy = SEAT[1] + b.seat + 14 * sq;
        A.dot(cc, SEAT[0], dy, { r: R, sx: 1 + 0.3 * sq, sy: 1 - 0.3 * sq, ...f });
        hairs(cc, SEAT[0], dy, R, 1 - 0.3 * sq, t);
        // 一尊还酹江月: the cup, raised to the moon and emptied into the river
        const cupA = ease.outBack(prog(t, T.cup, T.cup + 0.3)) * (1 - prog(t, T.hop - 0.4, T.hop - 0.2));
        if (cupA > 0.01) {
          const lift = ease.io2(prog(t, T.cup + 0.1, T.cup + 0.6));
          const tip = ease.io2(prog(t, T.pour, T.pour + 0.35)) * (1 - ease.io2(prog(t, T.pourEnd + 0.1, T.pourEnd + 0.4)));
          const cx = SEAT[0] + 84 + 14 * lift;
          const cy = dy + 16 - 70 * lift;
          A.cup(cc, cx, cy, 1.9 * cupA, 1.75 * tip, tip < 0.9 || t < T.pour + 0.5 ? 1 : 0);
          const pp = prog(t, T.pour + 0.25, T.pourEnd);
          if (pp > 0 && pp < 1) {
            for (let k = 0; k < 18; k++) {
              const q = (pp * 1.6 + k / 18) % 1;
              if (q > pp * 1.6) continue;
              const px = cx + 66 + q * 76;
              const py = cy - 62 + q * q * 196;
              cc.beginPath();
              cc.arc(px, py, 6.5 - q * 2.5, 0, 7);
              cc.fillStyle = rgba([246, 222, 150], 0.95);
              cc.fill();
            }
          }
        }
      },
    });
    // a lamp at the stern once it is dark
    if (night > 0) {
      const lx = sx - 176 * Math.cos(b.rot) + 166 * Math.sin(b.rot);
      const ly = sy - 176 * Math.sin(b.rot) - 166 * Math.cos(b.rot);
      wash(c, lx, ly, 90, 90, C.gold, 0.5 * night);
      c.beginPath();
      c.arc(lx, ly, 9, 0, 7);
      c.fillStyle = rgba([252, 234, 178], night);
      c.fill();
    }
    return [sx, sy, b];
  }

  // ── one frame of the world (no picture-in-a-scroll, no fade: scene() adds those) ──
  function drawWorld(c, t, withDot) {
    const cm = camera(t);
    const night = nightK(t);
    c.save();
    view(c, cm);
    drawRiver(c, cm, t, { sun: sunSet(t), dusk: duskK(t), night, speed: speedAt(t), behind: (cc) => bankFeatures(cc, cm, t) });
    flags(c, cm, t);
    heroWave(c, cm, t);
    vision(c, cm, t);
    slamWave(c, cm, t);
    foam(c, cm, t, false);
    // the rock the dot lands on, standing in the river
    const rx = -cm.x + 960;
    if (rx > -800) {
      const wl = ROCK + 104 + cm.up; // its water line
      c.drawImage(props.rock, rx - 323, ROCK - 46 + cm.up);
      wash(c, rx, wl + 16, 380, 26, [58, 86, 88], 0.4); // its shadow on the water
      inkLine(c, [[rx - 330, wl], [rx - 120, wl + 6 + Math.sin(t * 2) * 3], [rx + 110, wl + 1], [rx + 340, wl + 5 + Math.cos(t * 2.3) * 3]], { w: 8, color: C.paperHi, alpha: 0.92, taper: "both" });
    }
    const onRock = t < T.boatLand;
    // once the dot has left to write, the empty skiff dissolves — and nothing is left under the credit line
    const skiffA = 1 - ease.io2(prog(t, T.hop + 0.15, T.hop + 0.9));
    c.save();
    c.globalAlpha *= skiffA;
    const sk = t >= T.skiffIn - 0.1 && skiffA > 0.01 ? drawSkiff(c, cm, t, withDot && !onRock) : null;
    c.restore();
    if (sk) {
      const wy = FLOAT + cm.up;
      A.splash(c, sk[0] + 40, wy, prog(t, T.boatLand, T.boatLand + 0.7), 18, 460, 100);
      A.splash(c, sk[0], wy, prog(t, T.tossLand, T.tossLand + 0.8), 30, 760, 300);
      // 酹江月: rings where the wine meets the river
      const pk = prog(t, T.pour + 0.55, T.pourEnd + 0.9);
      if (pk > 0 && pk < 1) {
        for (let k = 0; k < 3; k++) {
          const q = clamp(pk * 1.3 - k * 0.18);
          if (q <= 0 || q >= 1) continue;
          c.beginPath();
          c.ellipse(sk[0] + 262, wy + 34, 24 + q * 210, 6 + q * 34, 0, 0, 7);
          c.strokeStyle = rgba([250, 244, 224], 0.9 * (1 - q));
          c.lineWidth = 5 * (1 - q) + 1;
          c.stroke();
        }
      }
    }
    if (withDot && onRock && t >= T.drop) {
      const d = dotRock(t);
      const dx = d.x - cm.x + 960;
      const gy = ROCK + cm.up;
      if (t < T.boatLand - 0.45) A.shadow(c, dx, gy + 4, R * (1.25 - 0.5 * d.air) * d.sx, 1 - 0.6 * d.air);
      if (t < T.land1) for (const k of [-1, 0, 1]) inkLine(c, [[dx + k * 22, gy + d.y - 70], [dx + k * 22, gy + d.y - 220 + Math.abs(k) * 50]], { w: 5, color: C.inkPale, alpha: 0.5 * prog(t, T.drop + 0.1, T.land1), taper: "end", seg: 0 });
      A.dot(c, dx, gy + d.y, { r: R, sx: d.sx, sy: d.sy, rot: d.rot, ...face(t) });
      A.ticks(c, dx, gy, prog(t, T.land1, T.land1 + 0.32), 9, 62, 46, 11);
      A.ticks(c, dx, gy, prog(t, T.land2, T.land2 + 0.24), 6, 56, 26, 23);
    }
    foam(c, cm, t, true);
    // night mist on the water
    if (night > 0) {
      SC.mist(c, WATER + cm.up + 30, 90, 0.34 * night, t * 14, 41, [150, 170, 196]);
      SC.mist(c, FLOAT + cm.up + 150, 120, 0.22 * night, -t * 20, 47, [150, 170, 196]);
    }
    c.restore();
    return cm;
  }

  function scene(ctx, t) {
    if (t < T.bloom) {
      if (t >= T.drop) {
        // only the dot, on the bare sheet
        const cm = camera(t);
        const d = dotRock(t);
        const gy = ROCK;
        ctx.save();
        view(ctx, cm);
        A.shadow(ctx, 960, gy + 4, R * (1.25 - 0.5 * d.air) * d.sx, 1 - 0.6 * d.air);
        if (t < T.land1) for (const k of [-1, 0, 1]) inkLine(ctx, [[960 + k * 22, gy + d.y - 70], [960 + k * 22, gy + d.y - 220 + Math.abs(k) * 50]], { w: 5, color: C.inkPale, alpha: 0.5 * prog(t, T.drop + 0.1, T.land1), taper: "end", seg: 0 });
        A.dot(ctx, 960, gy + d.y, { r: R, sx: d.sx, sy: d.sy, rot: d.rot, ...face(t) });
        A.ticks(ctx, 960, gy, prog(t, T.land1, T.land1 + 0.32), 9, 62, 46, 11);
        A.ticks(ctx, 960, gy, prog(t, T.land2, T.land2 + 0.24), 6, 56, 26, 23);
        ctx.restore();
      }
      return;
    }
    const bloom = prog(t, T.bloom, T.bloom + 1.4);
    if (bloom < 1) {
      // the river soaks outward from under the dot
      const cm = camera(t);
      const [mx, my] = finalXY(cm, 960 - cm.x, ROCK + 20);
      ST.bloom(ctx, (c) => drawWorld(c, t, true), mx, my, bloom);
      return;
    }
    // 江山如画: the whole view shrinks into a mounted scroll, then we go back in
    const pk = ease.io2(prog(t, T.frame0, T.frame1)) * (1 - ease.io2(prog(t, T.pushIn0, T.pushIn1)));
    if (pk > 0.002) {
      const pc = props.pic.getContext("2d");
      pc.setTransform(1, 0, 0, 1, 0, 0);
      pc.globalAlpha = 1;
      pc.globalCompositeOperation = "source-over";
      pc.drawImage(SC.paper, 0, 0);
      drawWorld(pc, t, true);
      const s = lerp(1, 0.62, pk);
      const cx = lerp(960, 890, pk);
      const cy = lerp(540, 520, pk);
      SC.scrollMount(ctx, cx - (W * s) / 2, cy - (H * s) / 2, W * s, H * s, clamp(pk * 1.6));
      ctx.drawImage(props.pic, cx - (W * s) / 2, cy - (H * s) / 2, W * s, H * s);
      ctx.strokeStyle = rgba(C.ink, 0.75 * clamp(pk * 1.6));
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - (W * s) / 2, cy - (H * s) / 2, W * s, H * s);
      return;
    }
    // from T.hop the dot belongs to the stage, and the night sinks back behind the last line
    if (t >= T.hop) {
      const fade = lerp(1, 0.2, ease.io2(prog(t, T.hop + 0.05, T.hop + 1.0)));
      const sink = 150 * ease.io2(prog(t, T.hop, T.hop + 1.0));
      ST.faded(
        ctx,
        (c) => {
          c.translate(0, sink); // shift it inside the sheet: the sky is painted well past the top, so no edge shows
          drawWorld(c, t, false);
        },
        fade,
        0,
      );
      return;
    }
    drawWorld(ctx, t, true);
  }

  // ── the cover: the cliff with its two characters, the great wave, the skiff riding it ──
  function cover(c, time) {
    const tt = T.carve2 + 3 + time; // any time after the characters are cut
    const cm = { x: (cliffLX + 600 + 960 - 900) / BP - time * 40, up: 200, z: 1, fx: 960, fy: 540, shx: 0, shy: 0 };
    drawRiver(c, cm, tt, { sun: 0.3, dusk: 0, night: 0, speed: 500, behind: (cc) => bankFeatures(cc, cm, Math.max(T.carve2 + 3, T.spires + 2)) });
    A.bigWave(c, 330, 1010, { s: 1.5, t: tt });
    A.skiff(c, 640, 880 + Math.sin(tt * 2) * 4, { scale: 1.3, rot: -0.2, dot: (cc) => A.dot(cc, SEAT[0], SEAT[1], { r: R, eye: 1, open: 1, lx: 0.7, ly: -0.8, mood: "wow" }) });
    for (let i = 0; i < 7; i++) A.foamHeap(c, 610 + i * 36 + hash(i) * 50, 600 - hash(i * 3) * 130, 14 + hash(i * 7) * 22, i, 0.95, i); // thrown clear of the dot
  }

  ST.run({
    build,
    scene,
    cover,
    titleFrom() {
      const cm = camera(T.hop);
      const b = skiffState(T.hop);
      const [x, y] = finalXY(cm, b.x - cm.x + 960 + SEAT[0], b.y + cm.up + SEAT[1]);
      return { x, y, r: R * cm.z };
    },
    // it keeps its white hairs while it writes
    decorate(ctx, x, y, o) {
      hairs(ctx, x, y, o.r, o.sy || 1, T.dur);
    },
    debug: { camera, boatX, speedAt, fortLX, cliffLX, impactLX },
  });
})();
