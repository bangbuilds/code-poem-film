// The cast: the red dot; boats, waves, people, warships, fire, gibbons and the small effects around them;
// the caption slip and the seal.
(function () {
  const QZ = window.QZ;
  const { C, rgba, mix, clamp, lerp, prog, ease, hash, inkLine, wash } = QZ;
  const A = (QZ.actors = {});

  // ── the dot ──
  // s: {r, sx, sy, rot, eye (0..1 pop), open (0..1), lx, ly (-1..1 gaze), mood, alpha}
  // moods: "plain" | "happy" | "wow" | "set" (determined) | "squint"
  A.dot = (ctx, x, y, s) => {
    const r = s.r || 44;
    const sx = s.sx === undefined ? 1 : s.sx;
    const sy = s.sy === undefined ? 1 : s.sy;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(s.rot || 0);
    ctx.globalAlpha = s.alpha === undefined ? 1 : s.alpha;
    if (!s.noBody) {
      ctx.save();
      ctx.scale(sx, sy);
      QZ.blob(ctx, 0, 0, r, r, 7, 0.018, 48);
      const g = ctx.createRadialGradient(-r * 0.32, -r * 0.38, r * 0.1, 0, 0, r * 1.05);
      g.addColorStop(0, rgba(C.redHi));
      g.addColorStop(0.45, rgba(C.red));
      g.addColorStop(1, rgba(C.redLo));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    }
    const eye = s.eye === undefined ? 1 : s.eye;
    if (eye > 0.01 && r > 9) {
      const k = r / 44;
      const lx = (s.lx || 0) * 7 * k;
      const ly = (s.ly || 0) * 6 * k;
      const mood = s.mood || "plain";
      const big = mood === "wow" ? 1.22 : 1;
      const ex = 15.5 * k * sx;
      const ey = -7 * k * sy;
      const open = s.open === undefined ? 1 : s.open;
      for (const side of [-1, 1]) {
        const cx = side * ex + lx * 0.9;
        const cy = ey + ly * 0.8;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(eye, eye);
        if (mood === "happy" || mood === "squint") {
          // ^ ^  or  > <
          const pts = mood === "happy" ? [[-8 * k, 3 * k], [0, -6 * k], [8 * k, 3 * k]] : [[-side * 8 * k, -6 * k], [side * 5 * k, 0], [-side * 8 * k, 6 * k]];
          inkLine(ctx, pts, { w: 5.2 * k, color: C.ink, taper: "both", rough: 0.1, seg: mood === "happy" ? 6 : 0 });
        } else {
          ctx.beginPath();
          ctx.ellipse(0, 0, 9.2 * k * big, Math.max(0.8, 11.2 * k * big * open), 0, 0, 7);
          ctx.fillStyle = rgba(C.paperHi);
          ctx.fill();
          if (open > 0.3) {
            ctx.beginPath();
            ctx.ellipse(lx * 0.42, ly * 0.5, 4.9 * k, Math.min(4.9 * k, 11.2 * k * open - 1), 0, 0, 7);
            ctx.fillStyle = rgba(C.ink);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(lx * 0.42 - 1.6 * k, ly * 0.5 - 1.9 * k, 1.5 * k, 0, 7);
            ctx.fillStyle = rgba(C.paperHi);
            ctx.fill();
          }
          if (mood === "set") {
            inkLine(ctx, [[-side * 12 * k, -17 * k], [side * 7 * k, -11 * k]], { w: 4.6 * k, color: C.ink, taper: "both", rough: 0.1, seg: 0 });
          }
        }
        ctx.restore();
      }
      if (mood === "wow") {
        ctx.beginPath();
        ctx.ellipse(lx * 0.9, 13 * k * sy + ly * 0.5, 4.4 * k * eye, 5.6 * k * eye, 0, 0, 7);
        ctx.fillStyle = rgba(C.redLo, 0.9);
        ctx.fill();
      }
      if (mood === "happy") {
        inkLine(ctx, [[-6 * k + lx, 11 * k * sy], [lx, 16 * k * sy], [6 * k + lx, 11 * k * sy]], { w: 3.4 * k * eye, color: C.redLo, taper: "both", rough: 0.1 });
      }
    }
    ctx.restore();
  };

  // Motion for a dot standing on a ground line at y = 0 (its centre rests at -r).
  // s is the state being built: {x, y, sx, sy, air}. Each helper returns true if t falls inside it,
  // so a path reads as one chain:  if (m.hop(...)) {} else if (m.squash(...)) {} else if ...
  A.mover = (t, s, r = 44) => ({
    // an arc of height h over d seconds from t0, optionally travelling x0 → x1; stretches with speed
    hop: (t0, d, h, x0, x1) => {
      const p = (t - t0) / d;
      if (p < 0 || p > 1) return false;
      s.y = -r - h * 4 * p * (1 - p);
      s.air = 4 * p * (1 - p);
      const v = Math.abs(1 - 2 * p);
      s.sy = 1 + 0.14 * v;
      s.sx = 1 - 0.1 * v;
      if (x0 !== undefined) s.x = lerp(x0, x1, p);
      return true;
    },
    // a landing: flattens (amt 1 = hard) and springs back over d seconds, feet staying on the ground
    squash: (t0, d, amt) => {
      const p = (t - t0) / d;
      if (p < 0 || p > 1) return false;
      const k = Math.sin(Math.PI * p) * amt;
      s.sy = 1 - 0.46 * k;
      s.sx = 1 + 0.52 * k;
      s.y = -r * s.sy;
      return true;
    },
    // the standard entrance: falls in from above, bounces twice, settles. T needs drop, land1, land2, land3.
    dropIn: (T, until) => {
      const m = A.mover(t, s, r);
      if (t < T.drop) {
        s.y = -2000;
      } else if (t < T.land1) {
        const p = prog(t, T.drop, T.land1);
        s.y = lerp(-900, -r, ease.in2(p));
        s.sy = 1 + 0.3 * p;
        s.sx = 1 - 0.2 * p;
        s.air = 1;
      } else if (m.squash(T.land1, 0.14, 1)) {
      } else if (m.hop(T.land1 + 0.14, T.land2 - T.land1 - 0.14, 250)) {
      } else if (m.squash(T.land2, 0.11, 0.6)) {
      } else if (m.hop(T.land2 + 0.11, T.land3 - T.land2 - 0.11, 80)) {
      } else if (m.squash(T.land3, 0.1, 0.32)) {
      } else if (t < until) {
        const w = QZ.decay(t, T.land3 + 0.1, 8, 24) * 0.06;
        s.sy = 1 + w;
        s.sx = 1 - w;
        s.y = -r * s.sy;
      } else return false;
      return true;
    },
  });

  // soft contact shadow
  A.shadow = (ctx, x, y, w, a) => {
    wash(ctx, x, y, w, w * 0.2, C.ink, 0.3 * a, 0.2);
  };

  // short radiating ink ticks — a landing, a stamp
  A.ticks = (ctx, x, y, p, n, r0, len, seed, color) => {
    if (p <= 0 || p >= 1) return;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i + 0.5) * (Math.PI / n) + (hash(seed + i) - 0.5) * 0.25;
      const d0 = r0 + ease.out3(p) * len * 0.9;
      const l = len * (0.5 + hash(seed + i * 7) * 0.5) * (1 - p);
      inkLine(ctx, [[x + Math.cos(a) * d0, y + Math.sin(a) * d0 * 0.72], [x + Math.cos(a) * (d0 + l), y + Math.sin(a) * (d0 + l) * 0.72]], {
        w: 5,
        color: color || C.ink,
        alpha: 0.85 * (1 - p),
        taper: "both",
        seg: 0,
      });
    }
  };

  // ── the boat (origin: hull centre at the water line, bow to +x) ──
  // o: {sail 0..1, billow 0..1, speed 0..1, t, dot: fn(ctx) drawn seated inside}
  function hullPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(-112, -24);
    ctx.quadraticCurveTo(-74, -9, -40, -7);
    ctx.lineTo(54, -9);
    ctx.quadraticCurveTo(96, -15, 128, -44);
    ctx.quadraticCurveTo(100, 24, 42, 31);
    ctx.lineTo(-52, 31);
    ctx.quadraticCurveTo(-100, 24, -112, -24);
    ctx.closePath();
  }
  A.boat = (ctx, x, y, o) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.rot || 0);
    ctx.scale((o.scale || 1) * (o.sx || 1), (o.scale || 1) * (o.sy || 1));
    const t = o.t || 0;
    // mast + sail behind the hull
    const mx = 42;
    const sail = o.sail === undefined ? 1 : o.sail;
    inkLine(ctx, [[mx, -6], [mx + 1, -110], [mx, -212]], { w: 7, color: C.wood, taper: "none", rough: 0.3 });
    if (sail > 0.01) {
      const b = (o.billow || 0) * 26 + Math.sin(t * 6) * 2 * (o.billow || 0);
      const topY = -206;
      const botY = lerp(topY + 8, -44, sail);
      const L = (yy) => mx - 34 + ((yy - topY) / (-44 - topY)) * -8; // luff, a little behind the mast
      const R = (yy) => {
        const k = (yy - topY) / (botY - topY || 1);
        return mx + 44 + ((yy - topY) / (-44 - topY)) * 30 + Math.sin(k * Math.PI) * b;
      };
      ctx.beginPath();
      ctx.moveTo(L(topY), topY);
      const N = 10;
      for (let i = 0; i <= N; i++) {
        const yy = lerp(topY, botY, i / N);
        ctx.lineTo(R(yy), yy - (1 - i / N) * 6);
      }
      for (let i = N; i >= 0; i--) {
        const yy = lerp(topY, botY, i / N);
        ctx.lineTo(L(yy) + Math.sin((i / N) * Math.PI) * b * 0.35, yy);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, topY, 0, -44);
      g.addColorStop(0, rgba([250, 245, 232]));
      g.addColorStop(1, rgba([232, 220, 194]));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = rgba(C.ink, 0.8);
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.stroke();
      const rows = Math.round(5 * sail);
      for (let i = 1; i <= rows; i++) {
        const yy = lerp(topY, -44, i / 6);
        if (yy > botY - 4) break;
        const k = (yy - topY) / (botY - topY || 1);
        inkLine(ctx, [[L(yy) + Math.sin(k * Math.PI) * b * 0.35, yy], [(L(yy) + R(yy)) / 2 + b * 0.3, yy - 3], [R(yy), yy - (1 - k) * 6]], { w: 2.6, color: C.wood, alpha: 0.8, taper: "none" });
      }
    }
    // pennant at the masthead streams back with speed
    const sp = o.speed || 0;
    const fl = 30 + sp * 34;
    const wv = (k) => Math.sin(t * (7 + sp * 9) + k * 1.4) * (5 - sp * 2) * k;
    ctx.beginPath();
    ctx.moveTo(mx, -212);
    ctx.quadraticCurveTo(mx - fl * 0.5, -218 + wv(1), mx - fl, -204 + wv(2));
    ctx.quadraticCurveTo(mx - fl * 0.5, -200 + wv(1), mx, -196);
    ctx.closePath();
    ctx.fillStyle = rgba(C.gold);
    ctx.fill();
    ctx.strokeStyle = rgba(C.ink, 0.75);
    ctx.lineWidth = 2;
    ctx.stroke();

    // hull back, passenger, hull front
    hullPath(ctx);
    ctx.fillStyle = rgba([58, 44, 34]);
    ctx.fill();
    if (o.dot) o.dot(ctx);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-140, -9, 290, 60);
    ctx.clip();
    hullPath(ctx);
    const g2 = ctx.createLinearGradient(0, -20, 0, 34);
    g2.addColorStop(0, rgba([112, 84, 60]));
    g2.addColorStop(1, rgba([66, 48, 36]));
    ctx.fillStyle = g2;
    ctx.fill();
    ctx.restore();
    // gunwale and a plank seam
    inkLine(ctx, [[-112, -24], [-74, -10], [-40, -8], [54, -10], [96, -17], [128, -44]], { w: 5.5, color: [44, 34, 28], taper: "none", rough: 0.3 });
    inkLine(ctx, [[-96, 6], [-40, 12], [50, 11], [104, -4]], { w: 2.4, color: [38, 30, 24], alpha: 0.6, taper: "both" });
    ctx.restore();
  };

  // ── gibbon hanging by one arm from (0,0); faces +x unless flipped ──
  // o: {scale, flip, swing (rad), wave (-1..1), hoot (0..1 mouth open), t}
  A.gibbon = (ctx, x, y, o) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.swing || 0);
    ctx.scale((o.flip ? -1 : 1) * (o.scale || 1), o.scale || 1);
    const fur = [42, 37, 33];
    const hoot = o.hoot || 0;
    const wv = o.wave || 0;
    // tail
    inkLine(ctx, [[2, 112], [-22, 132], [-40, 118], [-36, 96], [-26, 102]], { w: 6, color: fur, taper: "end" });
    // legs
    inkLine(ctx, [[18, 114], [34, 132 + wv * 3], [26, 152]], { w: 9, color: fur, taper: "end" });
    inkLine(ctx, [[6, 116], [-6, 138 - wv * 3], [8, 154]], { w: 9, color: fur, taper: "end" });
    // holding arm
    inkLine(ctx, [[0, -2], [-5, 30], [8, 62]], { w: 10, color: fur, taper: "none" });
    // body
    ctx.save();
    ctx.translate(14, 92);
    ctx.rotate(0.12);
    QZ.blob(ctx, 0, 0, 25, 33, 12, 0.07);
    ctx.fillStyle = rgba(fur);
    ctx.fill();
    ctx.restore();
    // free arm: waving, or cupped to the mouth when hooting
    const hx = lerp(62, 46, hoot);
    const hy = lerp(40 + wv * 16, 54, hoot);
    inkLine(ctx, [[24, 72], [lerp(52, 50, hoot), lerp(66 + wv * 6, 78, hoot)], [hx, hy]], { w: 9, color: fur, taper: "end" });
    // head
    ctx.beginPath();
    ctx.arc(10, 44, 7, 0, 7);
    ctx.arc(26, 50, 20, 0, 7);
    ctx.fillStyle = rgba(fur);
    ctx.fill();
    QZ.blob(ctx, 32, 53, 12.5, 13.5, 3, 0.05);
    ctx.fillStyle = rgba([226, 204, 170]);
    ctx.fill();
    ctx.fillStyle = rgba(C.ink);
    ctx.beginPath();
    ctx.arc(28, 49, 2.4, 0, 7);
    ctx.arc(37.5, 49, 2.4, 0, 7);
    ctx.fill();
    if (hoot > 0.08) {
      ctx.beginPath();
      ctx.ellipse(35 + hoot * 2, 58.5, 3.2 + hoot * 2, 2 + hoot * 5, 0, 0, 7);
      ctx.fillStyle = rgba([60, 30, 26]);
      ctx.fill();
    } else {
      inkLine(ctx, [[29, 58], [33, 60.5], [38, 58]], { w: 2, color: C.ink, taper: "both" });
    }
    ctx.restore();
  };
  // sound rings leaving a hooting mouth; p = 0..1 life of one call
  A.hootRings = (ctx, x, y, dir, p, scale = 1) => {
    if (p <= 0 || p >= 1) return;
    for (let k = 0; k < 3; k++) {
      const q = clamp(p * 1.5 - k * 0.22);
      if (q <= 0 || q >= 1) continue;
      const rad = (20 + q * 70) * scale;
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const a = dir + (i / 8 - 0.5) * 1.15;
        pts.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad]);
      }
      inkLine(ctx, pts, { w: 5 * scale * (1 - q * 0.5), color: C.ink, alpha: 0.75 * (1 - q), taper: "both" });
    }
  };
  // a branch reaching out from the cliff, with leaves
  A.branch = (ctx, x, y, len, flip) => {
    const d = flip ? -1 : 1;
    inkLine(ctx, [[x - d * len, y - 34], [x - d * len * 0.5, y - 10], [x, y], [x + d * 54, y - 16]], { w: 13, color: [52, 42, 34], taper: "end", rough: 0.5 });
    for (let i = 0; i < 6; i++) {
      const u = i / 5;
      const lx = x - d * len * 0.55 + d * u * (len * 0.55 + 50);
      const ly = y - 14 - Math.abs(u - 0.6) * 12 - 10;
      ctx.beginPath();
      ctx.ellipse(lx, ly - 6 - hash(i * 5) * 8, 20, 7, d * (-0.5 + hash(i) * 0.6), 0, 7);
      ctx.fillStyle = rgba(C.pine, 0.92);
      ctx.fill();
    }
  };

  // water thrown up: n droplets on ballistic arcs, p = 0..1
  A.splash = (ctx, x, y, p, n, power, seed) => {
    if (p <= 0 || p >= 1) return;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (hash(seed + i) - 0.5) * 2.3;
      const v = power * (0.45 + hash(seed + i * 3) * 0.75);
      const tt = p * 0.9;
      const px = x + Math.cos(a) * v * tt;
      const py = y + Math.sin(a) * v * tt + 900 * tt * tt;
      if (py > y + 6) continue;
      const rr = (3.5 + hash(seed + i * 5) * 5.5) * (1 - p * 0.6);
      ctx.beginPath();
      ctx.ellipse(px, py, rr, rr * 1.3, a, 0, 7);
      ctx.fillStyle = rgba(hash(seed + i * 11) > 0.5 ? C.paperHi : [150, 190, 186], 0.95 * (1 - p * p));
      ctx.fill();
      ctx.strokeStyle = rgba([58, 96, 100], 0.55 * (1 - p));
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // rings on the surface
    for (let k = 0; k < 2; k++) {
      const q = clamp(p * 1.25 - k * 0.2);
      if (q <= 0 || q >= 1) continue;
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 40 + q * power * 0.42, 6 + q * 15, 0, 0, 7);
      ctx.strokeStyle = rgba(C.paperHi, 0.9 * (1 - q));
      ctx.lineWidth = 5 * (1 - q) + 1;
      ctx.stroke();
    }
  };

  // a small breaking wave rising to the right: bow wave, and (scaled up) the rapid
  A.crest = (ctx, x, y, s, sp, t) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    const h = 58;
    const j = Math.sin(t * 20) * 3;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.bezierCurveTo(24, -6, 34, -h * 0.9, 58, -h + j);
    ctx.bezierCurveTo(80, -h * 1.04 + j, 98, -h * 0.72, 92, -h * 0.44);
    ctx.bezierCurveTo(84, -h * 0.64, 70, -h * 0.52, 68, -h * 0.3);
    ctx.bezierCurveTo(72, -4, 104, 0, 132, 2);
    ctx.closePath();
    ctx.fillStyle = rgba(C.paperHi, 0.97);
    ctx.fill();
    ctx.strokeStyle = rgba([58, 96, 100], 0.75);
    ctx.lineWidth = 2.6 / s;
    ctx.lineJoin = "round";
    ctx.stroke();
    inkLine(ctx, [[10, -4], [30, -h * 0.5], [52, -h * 0.82]], { w: 2.4 / s + 1, color: [58, 96, 100], alpha: 0.45, taper: "both" });
    for (let i = 0; i < 7; i++) {
      const ph = (t * 3 + i / 7) % 1;
      const a = -2.2 + hash(i * 13) * 1.0;
      const v = (60 + hash(i * 7) * 70) * (0.5 + sp);
      ctx.beginPath();
      ctx.arc(74 + Math.cos(a) * v * ph, -h + Math.sin(a) * v * ph + 90 * ph * ph, (3.4 * (1 - ph) + 0.8) / Math.sqrt(s), 0, 7);
      ctx.fillStyle = rgba(C.paperHi, 0.95 * (1 - ph));
      ctx.fill();
    }
    ctx.restore();
  };

  // bow wave and wake for a boat at (x, y) moving right; sp = 0..1
  A.wake = (ctx, x, y, sp, t, scale = 1) => {
    if (sp <= 0.02) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    A.crest(ctx, 92, 12, 0.6 + sp * 0.55, sp, t);
    // foam trailing from the stern
    const len = 180 + sp * 620;
    for (let k = 0; k < 4; k++) {
      const yy = 8 + k * 9;
      const j = Math.sin(t * 16 + k * 2) * 3;
      inkLine(ctx, [[-96, yy], [-96 - len * 0.3, yy + j + k * 2], [-96 - len * (0.65 + k * 0.1), yy + k * 5 - j]], { w: 8 - k * 1.2, color: C.paperHi, alpha: 0.9 - k * 0.14, taper: "end" });
    }
    ctx.restore();
  };

  // ── a small skiff with a woven canopy (origin: hull centre at the water line, bow to +x) ──
  // o: {scale, rot, sx, sy, dot: fn(ctx) drawn seated toward the bow, at about (52, -42)}
  function skiffHull(ctx) {
    ctx.beginPath();
    ctx.moveTo(-150, -30);
    ctx.quadraticCurveTo(-110, -8, -60, -6);
    ctx.lineTo(70, -8);
    ctx.quadraticCurveTo(120, -14, 158, -46);
    ctx.quadraticCurveTo(128, 22, 60, 30);
    ctx.lineTo(-70, 30);
    ctx.quadraticCurveTo(-128, 24, -150, -30);
    ctx.closePath();
  }
  A.skiff = (ctx, x, y, o) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.rot || 0);
    ctx.scale((o.scale || 1) * (o.sx || 1), (o.scale || 1) * (o.sy || 1));
    // the pole, stowed at the stern
    inkLine(ctx, [[-132, -18], [-158, -92], [-178, -168]], { w: 5, color: C.wood, taper: "end", rough: 0.2 });
    skiffHull(ctx);
    ctx.fillStyle = rgba([58, 44, 34]);
    ctx.fill();
    // canopy: an arch of woven matting over the stern half
    ctx.beginPath();
    ctx.moveTo(-120, -8);
    ctx.bezierCurveTo(-120, -84, -92, -104, -60, -104);
    ctx.bezierCurveTo(-28, -104, -2, -84, -2, -8);
    ctx.closePath();
    const cg = ctx.createLinearGradient(0, -104, 0, -8);
    cg.addColorStop(0, rgba([190, 160, 112]));
    cg.addColorStop(1, rgba([138, 110, 74]));
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = rgba(C.ink, 0.8);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    for (let k = 0; k < 7; k++) inkLine(ctx, [[-124, -92 + k * 14], [-60, -98 + k * 14], [2, -92 + k * 14]], { w: 1.8, color: C.wood, alpha: 0.5, taper: "none" });
    for (let k = 1; k < 8; k++) inkLine(ctx, [[-120 + k * 15, -110], [-120 + k * 15, -6]], { w: 1.4, color: C.wood, alpha: 0.4, taper: "none", seg: 0 });
    ctx.restore();
    ctx.fillStyle = rgba(C.ink, 0.75); // the dark of the cabin mouth
    ctx.beginPath();
    ctx.moveTo(-26, -8);
    ctx.bezierCurveTo(-26, -66, -14, -86, -2, -8);
    ctx.closePath();
    ctx.fill();
    if (o.dot) o.dot(ctx);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-180, -9, 360, 60);
    ctx.clip();
    skiffHull(ctx);
    const g2 = ctx.createLinearGradient(0, -20, 0, 34);
    g2.addColorStop(0, rgba([112, 84, 60]));
    g2.addColorStop(1, rgba([66, 48, 36]));
    ctx.fillStyle = g2;
    ctx.fill();
    ctx.restore();
    inkLine(ctx, [[-150, -30], [-110, -10], [-60, -8], [70, -10], [120, -17], [158, -46]], { w: 5.5, color: [44, 34, 28], taper: "none", rough: 0.3 });
    inkLine(ctx, [[-128, 6], [-60, 12], [60, 11], [130, -6]], { w: 2.4, color: [38, 30, 24], alpha: 0.6, taper: "both" });
    ctx.restore();
  };

  // ── a great wave, curling to the right (origin: the middle of its base; about 840 wide and 320 tall at s = 1) ──
  // o: {s, a, t, inside: fn(ctx) drawn clipped to the body, in the wave's own coordinates}
  function wavePath(ctx) {
    ctx.beginPath();
    ctx.moveTo(-420, 0);
    ctx.bezierCurveTo(-260, -10, -120, -120, 0, -250);
    ctx.bezierCurveTo(50, -300, 130, -322, 190, -292);
    ctx.bezierCurveTo(250, -262, 270, -210, 242, -168);
    ctx.bezierCurveTo(234, -206, 200, -232, 160, -226);
    ctx.bezierCurveTo(108, -216, 98, -150, 130, -92);
    ctx.bezierCurveTo(152, -46, 224, -12, 420, 0);
    ctx.closePath();
  }
  A.bigWave = (ctx, x, y, o) => {
    const s = o.s || 1;
    const t = o.t || 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s * (o.squash === undefined ? 1 : o.squash));
    ctx.globalAlpha *= o.a === undefined ? 1 : o.a;
    wavePath(ctx);
    const g = ctx.createLinearGradient(0, -320, 0, 0);
    g.addColorStop(0, rgba(C.paperHi, 0.97));
    g.addColorStop(0.3, rgba([186, 212, 200], 0.96));
    g.addColorStop(1, rgba([96, 146, 148], 0.94));
    ctx.fillStyle = g;
    ctx.fill();
    if (o.inside) {
      ctx.save();
      wavePath(ctx);
      ctx.clip();
      o.inside(ctx);
      ctx.restore();
    }
    // the flow of the water up its back
    for (let k = 0; k < 5; k++) {
      const u = k / 4;
      inkLine(ctx, [[-340 + u * 220, -8 - u * 6], [-150 + u * 150, -70 - u * 60], [10 + u * 60, -214 - u * 26], [120 + u * 30, -276 - u * 6]], { w: 3.2 / Math.sqrt(s) + 1, color: [58, 96, 100], alpha: 0.42, taper: "both" });
    }
    wavePath(ctx);
    ctx.strokeStyle = rgba([52, 88, 94], 0.8);
    ctx.lineWidth = 3.4 / s + 1.2;
    ctx.lineJoin = "round";
    ctx.stroke();
    // foam claws along the lip, and spray thrown ahead of it
    for (let i = 0; i < 9; i++) {
      const u = i / 8;
      const px = lerp(96, 244, u) + Math.sin(t * 9 + i * 1.7) * 5;
      const py = -300 + 132 * Math.pow(u, 2.2) + Math.cos(t * 7 + i) * 4 - (u < 0.3 ? 8 : 0);
      const r = 20 - u * 6 + hash(i * 7) * 8;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, 7);
      ctx.fillStyle = rgba(C.paperHi, 0.98);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, r, 0.2, 2.6);
      ctx.strokeStyle = rgba([52, 88, 94], 0.6);
      ctx.lineWidth = 2.4 / s + 1;
      ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const ph = (t * 1.6 + hash(i * 13)) % 1;
      const a0 = -1.1 + hash(i * 5) * 1.2;
      const v = 120 + hash(i * 9) * 150;
      ctx.beginPath();
      ctx.arc(236 + Math.cos(a0) * v * ph, -230 + Math.sin(a0) * v * ph + 160 * ph * ph, 7 * (1 - ph) + 2, 0, 7);
      ctx.fillStyle = rgba(C.paperHi, 0.95 * (1 - ph));
      ctx.fill();
    }
    ctx.restore();
  };

  // a heap of thrown foam — 「卷起千堆雪」. r is its radius; spin tumbles it
  A.foamHeap = (ctx, x, y, r, seed, a = 1, spin = 0) => {
    if (a <= 0.01 || r < 1) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.globalAlpha *= a;
    const n = 5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const ang = Math.PI + (i / (n - 1)) * Math.PI;
      const rr = r * (0.42 + hash(seed * 7 + i) * 0.2);
      const cx = Math.cos(ang) * r * 0.62;
      const cy = Math.sin(ang) * r * 0.42;
      ctx.moveTo(cx + rr, cy);
      ctx.arc(cx, cy, rr, 0, 7);
    }
    ctx.ellipse(0, r * 0.1, r * 0.82, r * 0.34, 0, 0, 7);
    ctx.fillStyle = rgba(C.paperHi, 0.98);
    ctx.fill();
    inkLine(ctx, [[-r * 0.8, r * 0.3], [0, r * 0.46], [r * 0.8, r * 0.28]], { w: Math.max(1.6, r * 0.07), color: [70, 110, 116], alpha: 0.55, taper: "both" });
    inkLine(ctx, [[-r * 0.5, -r * 0.5], [-r * 0.1, -r * 0.82], [r * 0.34, -r * 0.6]], { w: Math.max(1.4, r * 0.05), color: [70, 110, 116], alpha: 0.4, taper: "both" });
    ctx.restore();
  };

  // ── people, seen from afar (origin at the feet; faces +x unless flipped; about 195 tall at s = 1) ──
  // o: {s, flip, a, robe, trim, face, hat: "jin" | "guan" | "helm" | "tall", prop: "fan" | "spear" | "sword" | "staff" | "banner",
  //     arm 0..1 (the front arm raised), flick (rad, turns the prop), cape 0..1, wind (-1..1: > 0 streams capes and ribbons
  //     toward -x, behind the figure; < 0 toward +x), eyes (a stroke for the eye, for a large figure), t, ph, melt 0..1}
  A.figure = (ctx, x, y, o) => {
    const s = o.s || 1;
    const t = o.t || 0;
    const ph = o.ph || 0;
    const wind = o.wind === undefined ? 0.5 : o.wind;
    const robe = o.robe || C.ink;
    const trim = o.trim || mix(robe, C.ink, 0.55);
    const sway = Math.sin(t * 2.4 + ph);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale((o.flip ? -1 : 1) * s, s * (1 - 0.4 * (o.melt || 0)));
    ctx.globalAlpha *= o.a === undefined ? 1 : o.a;
    const dir = wind >= 0 ? -1 : 1; // which way things stream
    const wa = Math.abs(wind);
    if (o.cape) {
      const L = 130 * o.cape;
      ctx.beginPath();
      ctx.moveTo(dir * 12, -152);
      ctx.bezierCurveTo(dir * (40 + L * 0.3 * wa), -146, dir * (64 + L * 0.7 * wa), -118 + sway * 7, dir * (72 + L * wa), -70 + sway * 14);
      ctx.bezierCurveTo(dir * (58 + L * 0.7 * wa), -52 + sway * 8, dir * (44 + L * 0.3 * wa), -34 + sway * 5, dir * 30, -22);
      ctx.lineTo(dir * 6, -118);
      ctx.closePath();
      ctx.fillStyle = rgba(o.capeColor || trim, 0.94);
      ctx.fill();
    }
    // robe
    ctx.beginPath();
    ctx.moveTo(-19, -152);
    ctx.bezierCurveTo(-30, -110, -36, -60, -46 - wind * 9 + sway * 2, -3);
    ctx.quadraticCurveTo(-18, 6, 2, 0);
    ctx.quadraticCurveTo(26, -6, 46 - wind * 10 + sway * 3, -2);
    ctx.bezierCurveTo(36, -60, 30, -110, 19, -152);
    ctx.quadraticCurveTo(0, -164, -19, -152);
    ctx.closePath();
    ctx.fillStyle = rgba(robe);
    ctx.fill();
    // the back sleeve, hanging and blown
    ctx.beginPath();
    ctx.moveTo(-17, -148);
    ctx.bezierCurveTo(-44, -130, -52 - wind * 9, -92, -42 - wind * 14 + sway * 3, -60);
    ctx.bezierCurveTo(-30, -64, -22, -80, -13, -112);
    ctx.closePath();
    ctx.fillStyle = rgba(trim);
    ctx.fill();
    inkLine(ctx, [[-26, -97], [0, -92], [26, -97]], { w: 5, color: o.belt || C.gold, alpha: 0.9, taper: "none" });
    // the front arm
    const arm = o.arm || 0;
    const hx = lerp(40, 60, arm);
    const hy = lerp(-80, -170, arm);
    ctx.beginPath();
    ctx.moveTo(13, -151);
    ctx.quadraticCurveTo(lerp(46, 42, arm), lerp(-130, -152, arm), hx + 5, hy - 7);
    ctx.lineTo(hx - 3, hy + 17);
    ctx.quadraticCurveTo(lerp(30, 24, arm), lerp(-96, -122, arm), 9, -118);
    ctx.closePath();
    ctx.fillStyle = rgba(trim);
    ctx.fill();
    // head and headgear
    ctx.beginPath();
    ctx.ellipse(1, -174, 15, 17, 0, 0, 7);
    ctx.fillStyle = rgba(o.face || robe);
    ctx.fill();
    if (o.eyes) inkLine(ctx, [[5, -177], [12, -176]], { w: 2.6, color: C.ink, taper: "both", seg: 0 }); // one stroke: an eye, in profile
    const hat = o.hat || "jin";
    ctx.fillStyle = rgba(C.ink);
    if (hat === "jin") {
      // 纶巾: a soft cap over the topknot, two ribbons down the back
      ctx.beginPath();
      ctx.ellipse(0, -184, 16, 11, 0, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-2, -197, 9, 8, 0, 0, 7);
      ctx.fill();
      for (const k of [0, 1]) inkLine(ctx, [[dir * 10, -190], [dir * (26 + wa * 22), -186 + k * 10 + sway * 4], [dir * (40 + wa * 46), -172 + k * 14 + sway * 9]], { w: 4.5, color: C.ink, taper: "end" });
    } else if (hat === "guan") {
      ctx.fillRect(-9, -204, 18, 16);
      inkLine(ctx, [[-17, -196], [17, -196]], { w: 3, color: C.ink, taper: "none", seg: 0 });
      ctx.beginPath();
      ctx.ellipse(0, -186, 15, 8, 0, Math.PI, 0);
      ctx.fill();
    } else if (hat === "helm") {
      ctx.beginPath();
      ctx.ellipse(0, -182, 18, 15, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-19, -184, 8, 16);
      inkLine(ctx, [[0, -196], [-4 - wind * 10, -214], [-14 - wind * 22, -222 + sway * 3]], { w: 7, color: o.plume || C.gold, taper: "end" });
    } else if (hat === "tall") {
      ctx.beginPath();
      ctx.moveTo(-14, -184);
      ctx.lineTo(-10, -214);
      ctx.lineTo(13, -210);
      ctx.lineTo(15, -184);
      ctx.closePath();
      ctx.fill();
    }
    // what the front hand holds
    const prop = o.prop;
    if (prop) {
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(o.flick || 0);
      if (prop === "fan") {
        // 羽扇: a short handle and a leaf of feathers
        inkLine(ctx, [[0, 10], [6, -14]], { w: 4, color: C.wood, taper: "none", seg: 0 });
        ctx.beginPath();
        ctx.moveTo(6, -14);
        ctx.bezierCurveTo(-22, -34, -20, -74, 12, -88);
        ctx.bezierCurveTo(40, -72, 40, -34, 6, -14);
        ctx.closePath();
        ctx.fillStyle = rgba(C.paperHi);
        ctx.fill();
        ctx.strokeStyle = rgba(C.ink, 0.75);
        ctx.lineWidth = 2;
        ctx.stroke();
        for (let k = -2; k <= 2; k++) inkLine(ctx, [[6, -16], [9 + k * 9, -50], [11 + k * 12, -78 + Math.abs(k) * 6]], { w: 1.6, color: C.inkMid, alpha: 0.7, taper: "end" });
      } else if (prop === "spear") {
        inkLine(ctx, [[-10, 150], [0, 0], [10, -150]], { w: 4.5, color: C.ink, taper: "none" });
        ctx.beginPath();
        ctx.moveTo(10, -150);
        ctx.lineTo(4, -176);
        ctx.lineTo(18, -176);
        ctx.closePath();
        ctx.moveTo(11, -196);
        ctx.lineTo(4, -176);
        ctx.lineTo(18, -176);
        ctx.closePath();
        ctx.fillStyle = rgba(C.ink);
        ctx.fill();
        inkLine(ctx, [[9, -146], [-4 - wind * 12, -138], [-10 - wind * 20, -124 + sway * 3]], { w: 6, color: o.plume || C.gold, taper: "end" });
      } else if (prop === "sword") {
        inkLine(ctx, [[-4, 8], [0, 0], [26, -96]], { w: 4.5, color: C.ink, taper: "end" });
        inkLine(ctx, [[-10, -2], [12, -8]], { w: 4, color: C.ink, taper: "none", seg: 0 });
      } else if (prop === "staff") {
        inkLine(ctx, [[-14, 172], [0, 0], [6, -70], [-2, -84]], { w: 5, color: C.ink, taper: "none" });
      } else if (prop === "banner") {
        inkLine(ctx, [[-8, 150], [0, 0], [12, -190]], { w: 4.5, color: C.ink, taper: "none" });
        const fw = (k) => Math.sin(t * 5 + k * 1.3 + ph) * 6 * k;
        ctx.beginPath();
        ctx.moveTo(12, -190);
        ctx.quadraticCurveTo(-30 * wind - 10, -196 + fw(1), -86 * wind - 20, -176 + fw(2));
        ctx.quadraticCurveTo(-30 * wind - 6, -160 + fw(1), 9, -140);
        ctx.closePath();
        ctx.fillStyle = rgba(o.plume || C.gold);
        ctx.fill();
        ctx.strokeStyle = rgba(C.ink, 0.7);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  };

  // a lady in long sleeves and a trailing skirt (origin at the feet; about 185 tall at s = 1)
  // o: {s, flip, a, robe, sash, face, wind, t, ph}
  A.lady = (ctx, x, y, o) => {
    const s = o.s || 1;
    const t = o.t || 0;
    const ph = o.ph || 0;
    const wind = o.wind === undefined ? 0.5 : o.wind;
    const robe = o.robe || C.blush;
    const sash = o.sash || C.paperHi;
    const sway = Math.sin(t * 2.1 + ph);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale((o.flip ? -1 : 1) * s, s);
    ctx.globalAlpha *= o.a === undefined ? 1 : o.a;
    // the scarf, floating behind
    const dir = wind >= 0 ? -1 : 1; // which way the scarf streams
    const wa = Math.abs(wind);
    inkLine(ctx, [[-dir * 10, -140], [dir * 20, -150], [dir * (50 + wa * 30), -120 + sway * 8], [dir * (70 + wa * 60), -70 + sway * 14], [dir * (96 + wa * 80), -40 + sway * 18]], { w: 9, color: sash, alpha: 0.95, taper: "end" });
    // skirt: narrow at the waist, trailing downwind at the hem
    ctx.beginPath();
    ctx.moveTo(-11, -104);
    ctx.bezierCurveTo(-18, -70, -30 - wind * 6, -30, -44 - wind * 26 + sway * 3, -2);
    ctx.quadraticCurveTo(-10, 6, 6, 0);
    ctx.quadraticCurveTo(22, -4, 30 - wind * 6, -3);
    ctx.bezierCurveTo(24, -40, 16, -74, 11, -104);
    ctx.closePath();
    ctx.fillStyle = rgba(robe);
    ctx.fill();
    // bodice and sleeves
    ctx.beginPath();
    ctx.moveTo(-13, -148);
    ctx.lineTo(-11, -102);
    ctx.lineTo(11, -102);
    ctx.lineTo(13, -148);
    ctx.quadraticCurveTo(0, -156, -13, -148);
    ctx.closePath();
    ctx.fillStyle = rgba(mix(robe, C.paperHi, 0.35));
    ctx.fill();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 11, -146);
      ctx.bezierCurveTo(side * 30 - wind * 8, -130, side * 34 - wind * 16, -96, side * 26 - wind * 26 + sway * 4, -58);
      ctx.bezierCurveTo(side * 16 - wind * 12, -70, side * 10, -92, side * 7, -116);
      ctx.closePath();
      ctx.fillStyle = rgba(mix(robe, C.paperHi, 0.2));
      ctx.fill();
    }
    inkLine(ctx, [[-12, -104], [0, -101], [12, -104]], { w: 4, color: C.gold, alpha: 0.9, taper: "none" });
    // head, high buns, a hairpin
    ctx.beginPath();
    ctx.ellipse(1, -166, 12, 14.5, 0, 0, 7);
    ctx.fillStyle = rgba(o.face || [232, 212, 184]);
    ctx.fill();
    ctx.fillStyle = rgba(C.ink);
    ctx.beginPath();
    ctx.ellipse(-1, -174, 13.5, 10, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-7, -188, 8, 9, -0.3, 0, 7);
    ctx.ellipse(6, -190, 7, 8, 0.3, 0, 7);
    ctx.fill();
    inkLine(ctx, [[-12, -170], [-15, -150], [-13, -136]], { w: 4, color: C.ink, taper: "end" });
    ctx.beginPath();
    ctx.arc(13, -188, 3.2, 0, 7);
    ctx.fillStyle = rgba(C.gold);
    ctx.fill();
    ctx.restore();
  };

  // ── a war junk seen side-on (origin: hull centre at the water line; bow to +x; about 380 long, 260 tall at s = 1) ──
  // o: {s, flip, a, t, wind, flag (colour), char 0..1 (burnt black), list (rad), oars}
  A.warship = (ctx, x, y, o) => {
    const s = o.s || 1;
    const t = o.t || 0;
    const wind = o.wind === undefined ? 0.6 : o.wind;
    const ch = o.char || 0;
    const tone = (c) => mix(c, [34, 30, 28], ch);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.list || 0);
    ctx.scale((o.flip ? -1 : 1) * s, s);
    ctx.globalAlpha *= o.a === undefined ? 1 : o.a;
    // mast, yard and a battened sail
    inkLine(ctx, [[10, -60], [10, -250]], { w: 7, color: tone(C.wood), taper: "none", seg: 0 });
    ctx.beginPath();
    ctx.moveTo(-58, -214);
    ctx.lineTo(82, -222);
    ctx.lineTo(90, -118);
    ctx.lineTo(-52, -112);
    ctx.closePath();
    ctx.fillStyle = rgba(tone([198, 174, 130]), 0.96);
    ctx.fill();
    ctx.strokeStyle = rgba(C.ink, 0.75);
    ctx.lineWidth = 2.6;
    ctx.stroke();
    for (let k = 1; k < 5; k++) inkLine(ctx, [[-57 + k * 1.2, -214 + k * 20.5], [86 + k * 1.6, -222 + k * 20.8]], { w: 2.2, color: tone(C.wood), alpha: 0.8, taper: "none", seg: 0 });
    // pennant at the masthead, streaming downwind
    const fw = (k) => Math.sin(t * 6 + k * 1.3 + (o.ph || 0)) * 5 * k;
    ctx.beginPath();
    ctx.moveTo(10, -250);
    ctx.quadraticCurveTo(10 - 30 * wind, -256 + fw(1), 10 - 70 * wind, -240 + fw(2));
    ctx.quadraticCurveTo(10 - 30 * wind, -236 + fw(1), 10, -228);
    ctx.closePath();
    ctx.fillStyle = rgba(tone(o.flag || C.gold));
    ctx.fill();
    // hull with a raised prow and a stern castle
    ctx.beginPath();
    ctx.moveTo(-176, -52);
    ctx.quadraticCurveTo(-130, -16, -70, -14);
    ctx.lineTo(96, -16);
    ctx.quadraticCurveTo(146, -24, 192, -76);
    ctx.quadraticCurveTo(154, 8, 98, 26);
    ctx.lineTo(-96, 26);
    ctx.quadraticCurveTo(-156, 18, -176, -52);
    ctx.closePath();
    ctx.fillStyle = rgba(tone([70, 52, 40]));
    ctx.fill();
    // the deck house, two tiers
    for (const [x0, x1, y0, y1] of [[-60, 70, -16, -62], [-36, 46, -68, -104]]) {
      ctx.fillStyle = rgba(tone([124, 96, 70]));
      ctx.fillRect(x0, y1, x1 - x0, y0 - y1);
      ctx.fillStyle = rgba(tone(C.paperHi), 0.7 * (1 - ch));
      for (let k = 0; k < 4; k++) ctx.fillRect(lerp(x0, x1, (k + 0.25) / 4), y1 + 12, (x1 - x0) / 9, (y0 - y1) * 0.42);
      ctx.beginPath();
      ctx.moveTo(x0 - 22, y1 - 2);
      ctx.quadraticCurveTo((x0 + x1) / 2, y1 - 22, x1 + 22, y1 - 2);
      ctx.quadraticCurveTo((x0 + x1) / 2, y1 + 6, x0 - 22, y1 - 2);
      ctx.closePath();
      ctx.fillStyle = rgba(tone([60, 74, 80]));
      ctx.fill();
    }
    ctx.fillStyle = rgba(tone([124, 96, 70]));
    ctx.fillRect(-150, -80, 56, 44);
    ctx.beginPath();
    ctx.moveTo(-164, -82);
    ctx.quadraticCurveTo(-122, -100, -84, -82);
    ctx.quadraticCurveTo(-122, -74, -164, -82);
    ctx.closePath();
    ctx.fillStyle = rgba(tone([60, 74, 80]));
    ctx.fill();
    inkLine(ctx, [[-176, -52], [-130, -18], [-70, -16], [96, -18], [146, -27], [192, -76]], { w: 5, color: [40, 32, 28], taper: "none", rough: 0.3 });
    // oars
    if (o.oars !== false) for (let k = 0; k < 7; k++) inkLine(ctx, [[-96 + k * 28, 2], [-112 + k * 28 + Math.sin(t * 3 + k * 0.5) * 6, 34]], { w: 3, color: tone(C.wood), alpha: 0.9, taper: "end", seg: 0 });
    ctx.restore();
  };

  // ── fire, smoke ──
  // flames along a base line w wide, up to h tall; lean (-1..1) pushes the tips sideways. No vermilion: gold to amber
  A.flame = (ctx, x, y, w, h, t, seed, a = 1, lean = 0) => {
    if (a <= 0.01 || h < 2) return;
    wash(ctx, x, y - h * 0.4, w * 1.1 + h * 0.5, h * 1.25, C.gold, 0.34 * a);
    const n = Math.max(3, Math.round(w / 24));
    const cols = [[226, 140, 64], [244, 186, 88], [252, 234, 178]];
    for (let pass = 0; pass < 3; pass++) {
      const k = [1, 0.7, 0.4][pass];
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n - 0.5;
        const fl = 0.62 + 0.38 * Math.sin(t * (9 + hash(seed + i) * 7) + i * 2.1 + seed);
        const bx = x + u * w + Math.sin(t * 5 + i + seed) * 3;
        const hh = h * k * (0.5 + 0.5 * hash(seed * 3 + i)) * fl * (1 - Math.abs(u) * 0.7);
        const ln = Math.sin(t * 3.1 + i * 1.3 + seed) * hh * 0.16 + lean * hh * 0.45;
        const bw = (w / n) * 0.8 * k + 3;
        ctx.beginPath();
        ctx.moveTo(bx - bw, y);
        ctx.bezierCurveTo(bx - bw * 1.25, y - hh * 0.45, bx + ln * 0.4 - bw * 0.3, y - hh * 0.72, bx + ln, y - hh);
        ctx.bezierCurveTo(bx + ln * 0.5 + bw * 0.5, y - hh * 0.6, bx + bw * 1.3, y - hh * 0.35, bx + bw, y);
        ctx.closePath();
        ctx.fillStyle = rgba(cols[pass], 0.9 * a);
        ctx.fill();
      }
    }
  };
  // a column of smoke rising from (x, y), w wide at the foot, h tall; drift pushes it sideways as it rises
  A.smoke = (ctx, x, y, w, h, t, seed, a = 1, drift = 0) => {
    if (a <= 0.01) return;
    for (let i = 0; i < 9; i++) {
      const age = (t * (0.22 + hash(seed + i) * 0.1) + hash(seed * 5 + i * 3)) % 1;
      const px = x + (hash(seed * 7 + i) - 0.5) * w + drift * age * h + Math.sin(t * 1.3 + i) * 12 * age;
      const py = y - age * h;
      const r = w * 0.35 + age * h * 0.28;
      wash(ctx, px, py, r, r * 0.86, [44, 40, 38], a * 0.5 * Math.sin(Math.PI * Math.min(1, age * 1.15)), 0.45);
    }
  };

  // a bronze wine cup (尊), seen side-on; origin at the middle of its foot. tilt pours it toward +x; wine 0..1 = how full
  A.cup = (ctx, x, y, s, tilt = 0, wine = 1) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(-17, -40);
    ctx.quadraticCurveTo(-15, -14, -5, -12);
    ctx.lineTo(-5, -4);
    ctx.lineTo(-13, 0);
    ctx.lineTo(13, 0);
    ctx.lineTo(5, -4);
    ctx.lineTo(5, -12);
    ctx.quadraticCurveTo(15, -14, 17, -40);
    ctx.closePath();
    const g = ctx.createLinearGradient(-17, 0, 17, 0);
    g.addColorStop(0, rgba([120, 104, 70]));
    g.addColorStop(0.5, rgba([176, 152, 100]));
    g.addColorStop(1, rgba([110, 94, 62]));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = rgba(C.ink, 0.8);
    ctx.lineWidth = 2.2;
    ctx.lineJoin = "round";
    ctx.stroke();
    if (wine > 0.05) {
      ctx.beginPath();
      ctx.ellipse(0, -40, 15.5, 3.4, 0, 0, 7);
      ctx.fillStyle = rgba([246, 222, 150], 0.95);
      ctx.fill();
    }
    inkLine(ctx, [[-13, -28], [0, -25], [13, -28]], { w: 1.6, color: C.ink, alpha: 0.5, taper: "none" });
    ctx.restore();
  };

  // ── 题签: the slip of paper each line of the poem is written on ──
  // o: {h (full height), unroll 0..1, text, p 0..1 written, fade 0..1 (text alpha), prevText, prevFade}
  A.slip = (ctx, o) => {
    if (o.unroll <= 0) return;
    const x = 1746;
    const y = 84;
    const w = 96;
    const h = (o.h || 628) * o.unroll;
    ctx.save();
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    ctx.fillStyle = rgba(C.ink, 0.16);
    ctx.fillRect(x + 6, y + 8, w, h);
    ctx.fillStyle = rgba([249, 244, 231]);
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = rgba(C.ink, 0.78);
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = rgba(C.ink, 0.35);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 7, y + 7, w - 14, Math.max(0, h - 14));
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (o.prevText && o.prevFade > 0) QZ.drawText(ctx, o.prevText, x + 14, y + 24, 68, 83, rgba(C.ink, o.prevFade), 1, true);
    if (o.text) QZ.drawText(ctx, o.text, x + 14, y + 24, 68, 83, rgba(C.ink, o.fade === undefined ? 1 : o.fade), o.p, true);
    ctx.restore();
  };

  // ── the seal ──
  // radius: 1 a disc … 0.1 a carved block. text: 1–3 characters stacked, or 4 in a 2×2 block
  // (read top to bottom, right column first). textA fades the lettering in.
  A.seal = (ctx, x, y, w, h, radius, textA, rot, text) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.beginPath();
    const n = 64;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      // superellipse → rounded rectangle; a little chewed, like a carved stone edge
      const e = 2 / lerp(2, 9, clamp(1 - radius));
      const cx = Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), e);
      const cy = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), e);
      const k = 1 + 0.02 * (QZ.fbm(i * 0.7, 5, 2) - 0.5) * 2;
      const px = (cx * w * k) / 2;
      const py = (cy * h * k) / 2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    g.addColorStop(0, rgba(mix(C.red, C.redHi, 0.25)));
    g.addColorStop(1, rgba(C.red));
    ctx.fillStyle = g;
    ctx.fill();
    const chars = [...(text || "")];
    if (textA > 0 && chars.length) {
      const pad = w * 0.08;
      const col = rgba(C.paperHi, textA);
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(2, w * 0.028);
      ctx.strokeRect(-w / 2 + pad, -h / 2 + pad, w - pad * 2, h - pad * 2);
      if (chars.length === 4) {
        const cs = Math.min((w - pad * 2) * 0.5, (h - pad * 2) * 0.5);
        chars.forEach((ch, i) => QZ.drawGlyph(ctx, ch, (i < 2 ? 0.02 : -1.02) * cs, (i % 2 ? -0.02 : -0.98) * cs, cs, col));
      } else {
        const n = chars.length;
        const cs = Math.min(w * 0.72, (h - pad * 2) * (1.04 / n));
        const top = -(n * 0.92 * cs) / 2 - 0.05 * cs;
        chars.forEach((ch, i) => QZ.drawGlyph(ctx, ch, -cs / 2, top + i * 0.92 * cs, cs, col));
      }
    }
    ctx.restore();
  };
})();
