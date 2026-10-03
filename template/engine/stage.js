// The stage: what every poem film shares. A film hands over its scenes with QZ.stage.run({...});
// the stage owns the frame loop, the cover held over the opening, the caption slip, the last line
// written in step with the voice, the seal, and the paper everything sinks into.
//
// Every frame is a pure function of time: FILM.draw(time) paints composition time `time`.
(function () {
  const QZ = window.QZ;
  const T = window.TIMING;
  const P = window.POEM;
  const { W, H, C, rgba, clamp, lerp, prog, ease, kf, wash, decay } = QZ;
  const SC = QZ.scenery;
  const A = QZ.actors;
  const ST = (QZ.stage = {});

  ST.R = 44; // the dot
  ST.RW = 30; // the dot while it writes

  // ── camera ── cam: {x, y, z, shx, shy}. A world point on the main layer lands at toScreen(cam, wx, wy);
  // slower layers multiply cam.x / cam.y by their parallax factor before subtracting.
  ST.view = (c, cam) => {
    c.translate(W / 2, H / 2);
    c.scale(cam.z || 1, cam.z || 1);
    c.translate(-W / 2 + (cam.shx || 0), -H / 2 + (cam.shy || 0));
  };
  ST.toScreen = (cam, wx, wy) => [wx - cam.x + W / 2, wy - cam.y + H / 2];
  // where toScreen's point ends up once ST.view's zoom is applied
  ST.zoomed = (cam, sx, sy) => [(sx - W / 2) * (cam.z || 1) + W / 2, (sy - H / 2) * (cam.z || 1) + H / 2];

  // ── the scratch sheet: paint a whole scene as one layer, then reveal, fade or slide it ──
  function sheet() {
    const c = SC.scratch.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    c.clearRect(0, 0, W, H);
    return c;
  }
  // the world soaks outward from (sx, sy) like ink into wet paper. p: 0 nothing … 1 everything.
  // draw(c) paints the world (wrap your own save / ST.view / restore inside it).
  ST.bloom = (ctx, draw, sx, sy, p) => {
    const c = sheet();
    draw(c);
    c.setTransform(1, 0, 0, 1, 0, 0);
    const rad = 80 + ease.out2(p) * 2300;
    c.globalCompositeOperation = "destination-in";
    const g = c.createRadialGradient(sx, sy, rad * 0.55, sx, sy, rad);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = "source-over";
    ctx.drawImage(SC.scratch, 0, 0);
  };
  // paint a scene at `alpha`, shifted down by dy — how a scene sinks back behind the title
  ST.faded = (ctx, draw, alpha, dy = 0) => {
    const c = sheet();
    draw(c);
    ctx.globalAlpha = alpha;
    ctx.drawImage(SC.scratch, 0, dy);
    ctx.globalAlpha = 1;
  };

  // ── captions: every line but the last, written on the slip as it is spoken ──
  const capLines = P.lines.slice(0, P.lines.length - 1);
  const capN = Math.max(1, ...capLines.map((l) => [...l].length));
  const SLIP_H = 24 + (capN - 1) * 83 + 68 + 38;
  ST.captions = (ctx, t) => {
    if (!capLines.length || t < T.cap[0] || t > T.capEnd) return;
    let k = 0;
    for (let i = 1; i < capLines.length; i++) if (t >= T.cap[i]) k = i;
    const t0 = T.cap[k];
    A.slip(ctx, {
      h: SLIP_H,
      unroll: ease.out3(prog(t, T.cap[0], T.cap[0] + 0.36)),
      alpha: 1 - prog(t, T.capOut[0], T.capOut[1]),
      text: capLines[k],
      p: T.capWrite[k].reduce((p, [a, b, share]) => p + share * prog(t, a, b), 0),
      prevText: k ? capLines[k - 1] : null,
      prevFade: 1 - prog(t, t0, t0 + 0.22),
    });
  };

  // ── the last line, written large; the dot rides the brush tip, then becomes the seal ──
  const chars = [...T.title];
  const TP = Math.round(Math.min(300, 1538 / (chars.length - 1 + 0.928))); // pitch: the line fills ~80% of the width
  const TS = Math.round(TP * 0.928);
  const TX = (W - ((chars.length - 1) * TP + TS)) / 2;
  const TY = Math.round(395 - TS / 2);
  const slots = T.strokeSlots(window.GLYPHS);
  const slotMap = chars.map((_, ci) => slots.filter((s) => s.ci === ci));
  const tipOf = (s, f) => QZ.strokeTip(s.ch, s.si, f, TX + s.ci * TP, TY, TS);
  const SEAL = (ST.SEAL = [1668, 652]);
  ST.titleBox = { x: TX, y: TY, size: TS, pitch: TP };
  function penPos(t) {
    if (t <= slots[0].t0) return tipOf(slots[0], 0);
    for (let k = 0; k < slots.length; k++) {
      const s = slots[k];
      if (t <= s.t1) return tipOf(s, prog(t, s.t0, s.t1));
      const nx = slots[k + 1];
      const until = nx ? Math.max(s.end, nx.t0) : s.end; // a pause in the voice is spent crossing to the next character
      if (t <= until) {
        if (!nx) return tipOf(s, 1);
        const q = ease.io2(prog(t, s.t1, until));
        const a = tipOf(s, 1);
        const b = tipOf(nx, 0);
        return [lerp(a[0], b[0], q), lerp(a[1], b[1], q) - (nx.ci !== s.ci ? 44 : 16) * Math.sin(Math.PI * q)];
      }
    }
    return tipOf(slots[slots.length - 1], 1);
  }
  // from: {x, y, r} — where the dot is, and how big, when it leaves the scene at T.hop.
  // deco(ctx, x, y, state): optional, drawn over the dot each time (something it carries from the scene)
  ST.title = (ctx, t, from, deco) => {
    if (t < T.hop) return;
    const dot = (x, y, o) => {
      A.dot(ctx, x, y, o);
      if (deco) deco(ctx, x, y, o);
    };
    const ink = rgba(C.ink);
    // a breath of ink under the line so it sits in the paper, then the strokes
    if (t > T.write0) {
      ctx.save();
      ctx.shadowColor = rgba(C.ink, 0.28);
      ctx.shadowBlur = 7;
      chars.forEach((ch, ci) => {
        const ss = slotMap[ci];
        if (t < ss[0].t0) return;
        QZ.drawGlyph(ctx, ch, TX + ci * TP, TY, TS, ink, (si) => prog(t, ss[si].t0, ss[si].t1));
      });
      ctx.restore();
    }
    // signature: poet · title
    const sg = prog(t, T.sign0, T.sign0 + 0.7);
    if (sg > 0) {
      const size = 50;
      const pitch = 57;
      const txt = [P.author, P.prefix, P.title].filter(Boolean).join(" "); // 苏轼 · 念奴娇 · 赤壁怀古
      const x0 = SEAL[0] - 84 - [...txt].length * pitch;
      QZ.drawText(ctx, txt, x0, 628, size, pitch, rgba(C.ink, 0.92), sg, false);
      [...txt].forEach((ch, i) => {
        if (ch !== " " || sg < (i + 1) / [...txt].length) return;
        ctx.beginPath();
        ctx.arc(x0 + (i + 0.5) * pitch - 4, 654, 4.5, 0, 7);
        ctx.fillStyle = rgba(C.ink, 0.9);
        ctx.fill();
      });
    }
    // credit
    const cr = ease.out2(prog(t, T.credit, T.credit + 0.6));
    if (cr > 0) {
      const txt = (P.credit || []).concat(T.hasVoice && P.creditVoice ? [P.creditVoice] : []).join(" ");
      const size = 34;
      const pitch = 40;
      const x0 = (W - [...txt].length * pitch) / 2;
      QZ.drawText(ctx, txt, x0, 962 + (1 - cr) * 10, size, pitch, rgba(C.ink, 0.72 * cr), 1, false);
      [...txt].forEach((ch, i) => {
        if (ch !== " ") return;
        ctx.beginPath();
        ctx.arc(x0 + (i + 0.5) * pitch - 3, 979 + (1 - cr) * 10, 3.2, 0, 7);
        ctx.fillStyle = rgba(C.ink, 0.7 * cr);
        ctx.fill();
      });
    }

    // the dot: out of the scene, along every stroke, then down as the seal
    const RW = ST.RW;
    if (t < T.write0) {
      const p = prog(t, T.hop, T.write0 - 0.04);
      const b = tipOf(slots[0], 0);
      const q = ease.io2(p);
      const x = lerp(from.x, b[0], q);
      const y = lerp(from.y, b[1], q) - 250 * Math.sin(Math.PI * p);
      const v = Math.abs(1 - 2 * p);
      dot(x, y, { r: lerp(from.r, RW, q), sx: 1 - 0.1 * (1 - v), sy: 1 + 0.16 * (1 - v), rot: -0.5 * (1 - p), eye: 1, lx: -1, ly: lerp(-0.8, 0.6, p), mood: "wow" });
    } else if (t < T.sealJump) {
      const [x, y] = penPos(t);
      const [px, py] = penPos(t - 1 / 60);
      const vx = (x - px) * 60;
      const vy = (y - py) * 60;
      const st = clamp(Math.hypot(vx, vy) / 2600);
      dot(x, y, { r: RW, sx: 1 + 0.12 * st, sy: 1 - 0.1 * st, rot: clamp(vx / 4000, -0.3, 0.3), eye: 1, lx: clamp(vx / 600, -1, 1), ly: clamp(vy / 600, -1, 1), mood: "set" });
    } else if (t < T.stamp) {
      const p = prog(t, T.sealJump, T.stamp);
      const a = tipOf(slots[slots.length - 1], 1);
      const q = ease.io2(p);
      const x = lerp(a[0], SEAL[0], q);
      const y = lerp(a[1], SEAL[1], ease.in2(p)) - 210 * Math.sin(Math.PI * p) * (1 - p * 0.3);
      dot(x, y, { r: lerp(RW, 46, q), sx: 1 - 0.12 * p, sy: 1 + 0.2 * p, rot: 0.4 * Math.sin(Math.PI * p), eye: 1, lx: 0.6, ly: lerp(-0.6, 1, p), mood: p > 0.6 ? "wow" : "happy" });
    } else {
      const m = prog(t, T.stamp, T.stamp + 0.42);
      const w = kf(m, [[0, 96], [0.3, 158, ease.out2], [1, 104, ease.outBack]]);
      const h = kf(m, [[0, 92], [0.3, 80, ease.out2], [1, 150, ease.outBack]]);
      const round = 1 - ease.out2(prog(m, 0.1, 0.8)) * 0.88;
      A.seal(ctx, SEAL[0], SEAL[1], w, h, round, ease.out2(prog(t, T.stamp + 0.3, T.stamp + 0.75)), -0.035 * ease.out2(m), P.seal);
      const ea = 1 - prog(t, T.stamp + 0.22, T.stamp + 0.5);
      if (ea > 0) A.dot(ctx, SEAL[0], SEAL[1] + 4, { r: 44, noBody: true, eye: ea, mood: m < 0.35 ? "squint" : "happy", alpha: ea });
      A.ticks(ctx, SEAL[0], SEAL[1] + 20, prog(t, T.stamp, T.stamp + 0.34), 11, 96, 54, 77);
    }
  };

  // ── the cover: the film's first frame (platforms take it as the thumbnail), held while the title is read ──
  // film.cover(c, time) paints the picture; the stage adds the tag line, the title slip, and the fade.
  ST.cover = (ctx, time, film) => {
    const a = 1 - ease.io2(prog(time, T.intro - 0.85, T.intro - 0.2));
    if (T.intro <= 0 || a <= 0) return;
    const c = SC.scratch.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    c.drawImage(SC.paper, 0, 0);
    c.save();
    film.cover(c, time);
    c.restore();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    // the famous line, low in the frame, on a darker pool so the picture doesn't cut through it
    const tag = P.tagline === undefined ? T.title : P.tagline;
    if (tag) {
      const wTag = ([...tag].length - 1) * 104 + 96;
      wash(c, 96 + wTag * 0.52, 944, wTag * 0.889, 120, P.taglinePool || [44, 92, 98], 0.5, 0.6);
      c.save();
      c.shadowColor = rgba(C.ink, 0.6);
      c.shadowBlur = 14;
      c.shadowOffsetY = 3;
      QZ.drawText(c, tag, 96, 896, 96, 104, rgba(C.paperHi), 1, false);
      c.restore();
    }
    // title slip: the title, the poet, the seal
    const tl = [...P.title];
    const pitch = Math.min(176, 880 / tl.length);
    const size = Math.round(pitch * 0.932);
    const x = 1404;
    const y = 58;
    const w = 336;
    const h = Math.round(96 + (tl.length - 1) * pitch + size);
    c.fillStyle = rgba(C.ink, 0.22);
    c.fillRect(x + 10, y + 12, w, h);
    c.fillStyle = rgba([249, 244, 231]);
    c.fillRect(x, y, w, h);
    c.strokeStyle = rgba(C.ink, 0.82);
    c.lineWidth = 4;
    c.strokeRect(x, y, w, h);
    c.strokeStyle = rgba(C.ink, 0.35);
    c.lineWidth = 2;
    c.strokeRect(x + 10, y + 10, w - 20, h - 20);
    QZ.drawText(c, P.title, x + w - 44 - size, y + 44, size, pitch, rgba(C.ink), 1, true);
    const ay = y + Math.round(h * 0.4876);
    const na = [...P.author].length;
    if (P.prefix) QZ.drawText(c, P.prefix, x + 36, y + 50, 78, 88, rgba(C.ink, 0.94), 1, true); // 词牌, above the poet
    QZ.drawText(c, P.author, x + 36, ay, 78, 88, rgba(C.ink, 0.94), 1, true);
    A.seal(c, x + 36 + 39, ay + na * 88 + 86, 78, 112, 0.12, 1, -0.03, P.seal);
    ctx.globalAlpha = a;
    ctx.drawImage(SC.scratch, 0, 0);
    ctx.globalAlpha = 1;
  };

  // ── run a film ──
  // film: {
  //   build()            paint tiles and props once
  //   scene(ctx, t)      everything behind the captions, at film time t (t < 0 while the cover is up)
  //   front(ctx, t)      optional: things that pass in front of the captions (a wipe)
  //   cover(c, time)     the cover picture
  //   titleFrom()        {x, y, r}: where the dot is when it leaves to write the last line
  //   decorate(ctx, x, y, s)   optional: drawn over the dot while it writes (s = the state given to A.dot)
  //   debug              optional: values exposed on FILM.debug for checks
  // }
  ST.run = (film) => {
    let ctx;
    const FILM = (window.FILM = {});
    FILM.init = (canvas) => {
      ctx = canvas.getContext("2d");
      SC.init();
      if (film.build) film.build();
    };
    const paint = (time) => {
      const t = Math.min(time - T.intro, T.dur);
      ctx.drawImage(SC.paper, 0, 0);
      film.scene(ctx, t);
      if (t >= T.hop) {
        ctx.save();
        ctx.translate(0, decay(t, T.stamp, 12, 50) * 9); // the stamp lands
        ST.title(ctx, t, film.titleFrom(), film.decorate);
        ctx.restore();
      }
      ST.captions(ctx, t);
      if (film.front) film.front(ctx, t);
      ST.cover(ctx, time, film);
      // paper tooth over everything, so every colour sinks into the sheet
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = 0.46;
      ctx.drawImage(SC.tooth, 0, 0, W, H);
    };
    FILM.draw = (time) => {
      // a frame that throws would otherwise leave the previous frame on screen and look like a freeze:
      // write the error across the picture instead, where the frame checks and the eye both catch it
      for (let depth = 0; depth < 40; depth++) ctx.restore(); // drop any state a failed frame left behind
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      try {
        ctx.save();
        paint(time);
        ctx.restore();
        FILM.error = null;
      } catch (e) {
        FILM.error = `${time.toFixed(2)}s: ${e.message}`;
        console.error("[film]", FILM.error, e);
        for (let depth = 0; depth < 40; depth++) ctx.restore();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#b3261e";
        ctx.fillRect(0, 0, W, 150);
        ctx.fillStyle = "#fff";
        ctx.font = "700 40px Menlo, monospace";
        ctx.fillText("FILM ERROR  " + FILM.error.slice(0, 64), 30, 62);
        ctx.font = "400 30px Menlo, monospace";
        ctx.fillText(FILM.error.slice(64, 170), 30, 112);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };
    FILM.debug = Object.assign({ slots }, film.debug || {});
  };
})();
