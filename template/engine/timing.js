// Shared timing rules. A film's own film/timing.js lists when its scenes happen and calls
// PoemTiming.finish(T, rules); this file works out everything that follows from the recitation:
// how long the cover is held, when each line is spoken and its caption written, when each
// character of the last line is brushed, and how long the whole film is.
//
// Times are on the film's own clock (t = 0 is the blank sheet before the dot falls).
// Composition time = T.intro + t, because the cover is held in front of the film.
//
// The browser loads this as a script; tools/dump_timing.mjs evaluates the same files for the score.
(function (root) {
  const PT = {};

  // T needs: land1 (the dot's first landing). hop (the dot leaves the scene to write) and write0 (first
  // stroke) are yours to set; left out, the dot leaves `hopAfter` seconds after the last captioned line.
  // rules.lines: one entry per captioned line (every line but the last), in order:
  //   { at: 3.3 }                 start the line at this time
  //   { gapAt: T.launch }         put the pause inside the line (after the 4th character of 7, or 2nd of 5)
  //                               on this moment — an event lands in the reciter's breath
  //   { after: 0.3, min: 10.3 }   start this long after the previous line ends, but not before `min`
  //   lead: seconds the slip leads the voice by (default 0.12); split: characters before the pause
  // rules.intro: shortest cover hold (default 2.1 with a voice, 1.2 without)
  // rules.capOut: [from, to] the caption slip fades out; rules.capEnd: it is gone after this
  // rules.hopAfter: seconds between the last captioned line and the dot leaving (default 0.8), when T.hop is not set
  PT.finish = function (T, rules) {
    const V = root.VOICE;
    const P = root.POEM;
    rules = rules || {};
    const last = P.lines.length - 1;
    T.fps = T.fps || 30;
    T.title = P.lines[last];
    T.hasVoice = !V.dry;

    // the title is read over the cover; the poet's name ends as the dot first lands
    T.vAuthor = T.land1 - 0.04 - V.author.d;
    T.vTitle = T.vAuthor - 0.32 - V.title.d;
    T.intro = T.hasVoice ? Math.max(rules.intro || 2.1, 0.3 - T.vTitle) : rules.introSilent || 1.2;

    T.v = [];
    T.vEnd = [];
    T.cap = [];
    T.capWrite = [];
    let prevEnd = -1e9;
    for (let i = 0; i < last; i++) {
      const L = V.lines[i];
      const r = (rules.lines && rules.lines[i]) || {};
      const n = [...P.lines[i]].length;
      let v;
      if (r.gapAt !== undefined && L.gap) v = r.gapAt - L.gap[0] - 0.04;
      else if (r.at !== undefined) v = r.at;
      else v = prevEnd + (r.after === undefined ? 0.3 : r.after);
      if (r.min !== undefined) v = Math.max(v, r.min);
      v = Math.max(v, prevEnd + 0.1); // never two lines at once
      T.v.push(v);
      T.cap.push(v - (r.lead === undefined ? 0.12 : r.lead));
      if (r.gapAt !== undefined && L.gap) {
        const a = (r.split || (n >= 7 ? 4 : 2)) / n;
        T.capWrite.push([
          [v + 0.02, v + L.gap[0], a],
          [v + L.gap[1], v + L.d - 0.12, 1 - a],
        ]);
      } else T.capWrite.push([[v + 0.02, v + L.d - 0.12, 1]]);
      prevEnd = v + L.d;
      T.vEnd.push(prevEnd);
    }
    T.lineEnd = last ? prevEnd : (T.bloom || 3) + 1.2;
    if (T.hop === undefined) T.hop = T.lineEnd + (rules.hopAfter === undefined ? 0.8 : rules.hopAfter);
    if (T.write0 === undefined) T.write0 = T.hop + 0.75;
    T.capOut = rules.capOut || [T.hop - 0.5, T.hop - 0.1];
    T.capEnd = rules.capEnd === undefined ? T.hop : rules.capEnd;

    // the last line is spoken while it is written
    T.vFinal = T.write0;
    T.charOn = V.lines[last].syl.map((s) => T.write0 + s);
    T.write1 = T.write0 + V.lines[last].d;
    T.sealJump = T.write1 + 0.06;
    T.stamp = T.sealJump + 0.52;
    T.sign0 = T.stamp - 0.28;
    T.credit = T.stamp + 0.47;
    // whole frames, so the composition's length is exact
    T.total = Math.ceil((T.intro + T.credit + 1.65) * T.fps - 1e-6) / T.fps;
    T.dur = T.total - T.intro;
    T.strokeSlots = (glyphs) => PT.strokeSlots(T, glyphs);
    return T;
  };

  // When each stroke of the last line is drawn: every character is written inside its own syllable,
  // its strokes sharing that window by length; a character whose syllable is shorter than the writing
  // borrows a little from the next. 82% of a stroke's slot draws, the rest carries the dot onward.
  PT.strokeSlots = function (T, glyphs) {
    const chars = [...T.title];
    const slots = [];
    chars.forEach((ch, ci) => {
      glyphs[ch].m.forEach((med, si) => {
        let len = 0;
        for (let i = 1; i < med.length; i++) len += Math.hypot(med[i][0] - med[i - 1][0], med[i][1] - med[i - 1][1]);
        slots.push({ ch, ci, si, wgt: Math.pow(len, 0.55) + 6 });
      });
    });
    let free = T.write0; // when the brush is next available
    // the least time a stroke gets: 55 ms, less when the line has many strokes for its length (never under 30)
    const least = Math.min(0.055, Math.max(0.03, (0.8 * (T.write1 - T.write0)) / slots.length));
    chars.forEach((ch, ci) => {
      const mine = slots.filter((s) => s.ci === ci);
      const a = Math.max(T.charOn[ci], free);
      const next = ci < chars.length - 1 ? T.charOn[ci + 1] : T.write1;
      const b = Math.max(Math.min(next - 0.02, a + 0.56), a + least * mine.length);
      const tot = mine.reduce((s, x) => s + x.wgt, 0);
      let t = a;
      for (const s of mine) {
        const d = (s.wgt / tot) * (b - a);
        s.t0 = t;
        s.t1 = t + d * 0.82;
        s.end = t + d;
        t += d;
      }
      free = b + 0.01;
    });
    return slots;
  };

  root.PoemTiming = PT;
})(typeof window !== "undefined" ? window : globalThis);
