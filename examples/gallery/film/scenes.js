// Kit gallery: draws every prop the engine ships with, labelled, on four sheets (film time 0.05 → sheet 1, 0.25 → 2, 0.45 → 3, 0.65 → 4).
// Not a film — a way to see the kit. Regenerate the pictures in references/ with the commands in this example's README.
(function () {
  const QZ = window.QZ;
  const T = window.TIMING;
  const { W, H, C, rgba, mix } = QZ;
  const SC = QZ.scenery;
  const ST = QZ.stage;
  const A = QZ.actors;
  const tiles = {};
  const label = (c, text, x, y) => {
    c.font = "600 24px Menlo, monospace";
    c.fillStyle = "rgba(31,27,24,0.9)";
    c.fillText(text, x, y);
  };
  function sheet1(c, t) {
    const tt = 3.3;
    // the dot's moods
    ["plain", "happy", "wow", "set", "squint"].forEach((m, i) => {
      A.dot(c, 110 + i * 150, 110, { r: 50, eye: 1, open: 1, lx: 0.5, ly: -0.3, mood: m });
      label(c, m, 70 + i * 150, 200);
    });
    A.dot(c, 880, 120, { r: 50, sx: 1.4, sy: 0.6, eye: 1, mood: "squint" });
    label(c, "squash", 830, 200);
    A.dot(c, 1030, 105, { r: 50, sx: 0.82, sy: 1.25, eye: 1, mood: "wow", ly: 1 });
    label(c, "stretch", 980, 200);
    label(c, "A.dot: moods, squash, stretch", 1150, 190);
    // boat
    A.wake(c, 260, 420, 0.7, tt);
    A.boat(c, 260, 420, { sail: 1, billow: 0.8, speed: 0.7, t: tt, rot: -0.05, dot: (cc) => A.dot(cc, -46, -40, { r: 44, eye: 1, mood: "happy" }) });
    label(c, "A.boat + A.wake (dot seated at -46,-40)", 60, 500);
    // gibbon on a branch, calling
    A.branch(c, 760, 300, 150, true);
    A.gibbon(c, 760, 300, { scale: 1.2, flip: true, swing: 0.15, wave: 0.5, hoot: 0.9, t: tt });
    A.hootRings(c, 700, 380, Math.PI * 0.85, 0.45, 1.2);
    label(c, "A.branch + A.gibbon + A.hootRings", 590, 520);
    // effects
    A.crest(c, 1160, 430, 1.6, 0.7, tt);
    label(c, "A.crest", 1160, 500);
    A.splash(c, 1500, 430, 0.3, 22, 560, 100);
    label(c, "A.splash", 1440, 500);
    A.ticks(c, 1760, 400, 0.3, 9, 50, 46, 11);
    label(c, "A.ticks", 1710, 500);
    // slip, seal
    A.slip(c, { h: 380, unroll: 1, text: "白帝彩云", p: 0.8 });
    label(c, "A.slip", 1640, 60);
    A.seal(c, 140, 720, 104, 150, 0.12, 1, -0.03, "太白");
    A.seal(c, 300, 720, 124, 124, 0.12, 1, 0.02, "山高水长");
    A.seal(c, 440, 720, 96, 96, 1, 0, 0, "");
    label(c, "A.seal (2 chars / 4 chars / radius 1)", 60, 850);
    // sky things
    SC.sun(c, 720, 720, 60, 1);
    label(c, "SC.sun", 670, 850);
    c.fillStyle = "rgb(58,74,100)";
    c.fillRect(860, 610, 520, 210);
    SC.stars(c, 2, 26, 1, [870, 620, 1370, 810], 3);
    SC.moon(c, 980, 715, 62, 1, 1);
    SC.moon(c, 1240, 715, 62, 1, 0.45);
    label(c, "SC.moon (phase 1 / 0.45) + SC.stars", 860, 850);
    SC.cloud(c, 1560, 700, 0.9, C.blush, 0.96);
    SC.cloud(c, 1780, 760, 0.7, C.lilac, 0.96, true);
    label(c, "SC.cloud", 1500, 850);
    SC.birds(c, 120, 960, tt, 5);
    label(c, "SC.birds", 60, 1040);
    c.save();
    c.beginPath();
    c.rect(520, 890, 420, 170);
    c.clip();
    SC.rain(c, tt, 0.7, 160, 22);
    c.restore();
    label(c, "SC.rain", 540, 1040);
    c.fillStyle = "rgb(96,112,128)";
    c.fillRect(1000, 890, 420, 170);
    c.save();
    c.beginPath();
    c.rect(1000, 890, 420, 170);
    c.clip();
    SC.snow(c, tt, 0.95, 240);
    c.restore();
    label(c, "SC.snow", 1020, 1040);
    SC.pennant(c, 1560, 1030, tt, 0, 1);
    label(c, "SC.pennant", 1620, 1040);
  }
  function sheet2(c, t) {
    const tt = 3.3;
    const base = 400;
    c.save();
    c.translate(140, base);
    SC.pine(c, 0, 0, 1);
    c.restore();
    label(c, "SC.pine", 120, base + 40);
    SC.willow(c, 640, base, 1.0, tt);
    label(c, "SC.willow", 560, base + 40);
    c.save();
    c.translate(1040, base);
    c.scale(0.9, 0.9);
    SC.gateTower(c, 0);
    c.restore();
    label(c, "SC.gateTower", 940, base + 40);
    c.save();
    c.translate(1480, base);
    SC.pagoda(c, 0, 4, 150);
    c.restore();
    label(c, "SC.pagoda (4 floors)", 1340, base + 40);
    [30, 70, 110].forEach((dx, i) => SC.miniPine(c, 1760 + dx, base, 1 + i * 0.5, 0.9));
    label(c, "SC.miniPine", 1720, base + 40);
    // tiles, as strips
    const strip = (tile, x, y, w, h, name) => {
      c.save();
      c.beginPath();
      c.rect(x, y, w, h);
      c.clip();
      const k = h / tile.height;
      c.drawImage(tile, 0, 0, Math.min(tile.width, w / k), tile.height, x, y, Math.min(tile.width, w / k) * k, h);
      c.restore();
      c.strokeStyle = "rgba(31,27,24,0.35)";
      c.strokeRect(x, y, w, h);
      label(c, name, x, y + h + 30);
    };
    strip(tiles.far, 60, 480, 560, 130, "SC.ridgeTile (sharp 1.9: far peaks)");
    strip(tiles.mid, 680, 480, 560, 130, "SC.ridgeTile (sharp 1.5: mountains)");
    strip(tiles.cliffs, 1300, 480, 560, 130, "SC.cliffTile (gorge wall)");
    strip(tiles.wide, 60, 680, 560, 130, "SC.fadingRidge (ends at the right)");
    strip(tiles.bank, 680, 680, 560, 130, "SC.groundTile (a bank to stand on)");
    strip(tiles.fg, 1300, 680, 560, 130, "SC.bankTile (near bank, smeared)");
    c.save();
    c.beginPath();
    c.rect(60, 880, 840, 170);
    c.clip();
    SC.water(c, 300, 890, tt, 1, 600);
    c.restore();
    label(c, "SC.water (river from its bank)", 80, 1040);
    c.save();
    c.beginPath();
    c.rect(1000, 880, 860, 170);
    c.clip();
    c.translate(0, 230);
    SC.openWater(c, 650);
    SC.glint(c, 1500, 650, tt);
    SC.ripples(c, 650, 1);
    c.restore();
    label(c, "SC.openWater + SC.glint + SC.ripples", 1020, 1040);
  }
  const tt = 3.3;
  function sheet3(c) {
    // figures
    const base = 330;
    A.figure(c, 140, base, { s: 1.3, hat: "jin", prop: "fan", arm: 0.5, cape: 1, robe: [70, 92, 120], face: [232, 212, 184], t: tt });
    label(c, "A.figure jin+fan+cape", 40, base + 36);
    A.figure(c, 420, base, { s: 1.3, hat: "helm", prop: "spear", arm: 0.3, t: tt });
    label(c, "helm+spear", 350, base + 36);
    A.figure(c, 640, base, { s: 1.3, hat: "guan", prop: "sword", arm: 0.9, t: tt });
    label(c, "guan+sword", 570, base + 36);
    A.figure(c, 860, base, { s: 1.3, hat: "tall", prop: "staff", arm: 0.1, t: tt });
    label(c, "tall+staff", 800, base + 36);
    A.figure(c, 1080, base, { s: 1.3, hat: "helm", prop: "banner", arm: 0.5, cape: 0.7, t: tt });
    label(c, "helm+banner", 1010, base + 36);
    A.lady(c, 1320, base, { s: 1.3, t: tt });
    label(c, "A.lady", 1290, base + 36);
    A.figure(c, 1520, base, { s: 1.3, hat: "jin", prop: "fan", arm: 1, flick: -0.6, cape: 1, a: 0.5, melt: 0.5, t: tt });
    label(c, "a .5 melt .5", 1460, base + 36);
    // warships
    A.warship(c, 260, 700, { s: 1, t: tt });
    label(c, "A.warship", 180, 760);
    A.warship(c, 720, 700, { s: 1, t: tt, char: 0.6, list: 0.12 });
    A.flame(c, 720, 640, 260, 190, tt, 5, 1, -0.5);
    A.smoke(c, 720, 470, 160, 330, tt, 3, 1, -0.6);
    label(c, "char .6 + A.flame + A.smoke", 560, 760);
    A.warship(c, 1150, 700, { s: 0.5, t: tt });
    A.warship(c, 1330, 700, { s: 0.5, t: tt, flip: true });
    label(c, "s 0.5 / flip", 1100, 760);
    A.skiff(c, 1640, 690, { scale: 1, dot: (cc) => A.dot(cc, 52, -42, { r: 44, eye: 1, mood: "happy" }) });
    label(c, "A.skiff", 1600, 760);
    A.cup(c, 160, 960, 2.4, 0, 1);
    A.cup(c, 300, 960, 2.4, 0.9, 0);
    label(c, "A.cup", 140, 1010);
    for (let i = 0; i < 6; i++) A.foamHeap(c, 520 + i * 150, 930 - (i % 2) * 40, 30 + i * 12, i, 1, i * 0.2);
    label(c, "A.foamHeap", 500, 1010);
  }
  function sheet4(c) {
    A.bigWave(c, 520, 560, { s: 1.2, t: tt, inside: (cc) => { for (let i = 0; i < 4; i++) A.figure(cc, -240 + i * 110, -20 + i * 6, { s: 0.9, a: 0.45, hat: ["helm", "jin", "guan", "tall"][i], prop: ["spear", "fan", "sword", "staff"][i], arm: 0.4, color: [40, 70, 78], robe: [40, 70, 78], t: tt, ph: i }); } });
    label(c, "A.bigWave s1.2, figures drawn inside", 80, 610);
    A.bigWave(c, 1400, 560, { s: 0.6, t: tt });
    label(c, "A.bigWave s0.6", 1250, 610);
    SC.spire(c, 200, 1050, 170, 400, 1, [128, 92, 70], 30);
    SC.spire(c, 400, 1050, 130, 300, 2, [128, 92, 70], -16);
    SC.spire(c, 560, 1050, 190, 430, 3, [128, 92, 70], 40);
    label(c, "SC.spire", 660, 1040);
    SC.ruin(c, 1180, 1040, 1);
    label(c, "SC.ruin", 1500, 1040);
    SC.mist(c, 720, 80, 0.8, 0, 3);
    label(c, "SC.mist (the pale band) + SC.swells (the long crests)", 60, 668);
    SC.swells(c, 0, 640, tt, 1, 0);
    c.fillStyle = "rgb(150,180,176)";
    c.fillRect(1500, 120, 300, 170);
    SC.scrollMount(c, 1500, 120, 300, 170, 1);
    label(c, "SC.scrollMount", 1500, 380);
  }
  ST.run({
    build() {
      tiles.far = SC.ridgeTile({ w: 3072, h: 440, seed: 61, freq: 7, amp: 330, floor: 0.1, sharp: 1.9, paint: { color: C.slate, aTop: 0.5, aBot: 0.0, depth: 250, seed: 1, outline: { w: 2.2, a: 0.22, color: mix(C.slate, C.ink, 0.5) } } });
      tiles.mid = SC.ridgeTile({ w: 3072, h: 520, seed: 43, freq: 5, amp: 400, floor: 0.16, sharp: 1.5, jitter: { amp: 10, f: 0.05, seed: 5 }, paint: { color: [86, 116, 120], aTop: 0.7, aBot: 0.04, depth: 400, seed: 2, outline: { w: 3, a: 0.36 }, tex: { kind: "slope", n: 240, len: 90, a: 0.12 }, moss: 60 } });
      tiles.cliffs = SC.cliffTile({ w: 4096, h: 760, seed: 37, freq: 6, amp: 640, floor: 0.42, plate: [0.34, 0.6], paint: { color: [72, 90, 84], aTop: 0.92, aBot: 0.6, depth: 560, seed: 3, outline: { w: 4, a: 0.55 }, tex: { kind: "vertical", n: 900, len: 200, a: 0.17 }, moss: 150 } });
      tiles.fg = SC.bankTile({ w: 4096, h: 300, seed: 71, freq: 6, amp: 250 });
      tiles.wide = SC.fadingRidge({ w: 2400, h: 620, amp: 520, scale: 520, seed: 151, floor: 0.2, sharp: 1.25, taper: 900, paint: { color: [62, 86, 76], aTop: 0.8, aBot: 0.1, depth: 400, seed: 24, outline: { w: 3.6, a: 0.5 }, tex: { kind: "slope", n: 300, len: 110, a: 0.1 }, moss: 80 } });
      tiles.bank = SC.groundTile({ w: 3072, h: 420, top: 40, seed: 7 });
    },
    scene(ctx, t) {
      if (t < 0) return;
      if (t < 0.15) sheet1(ctx, t);
      else if (t < 0.34) sheet2(ctx, t);
      else if (t < 0.55) sheet3(ctx);
      else if (t < 0.75) sheet4(ctx);
    },
    cover() {},
    titleFrom: () => ({ x: 0, y: 0, r: 30 }),
  });
})();
