// Evaluates the same timing files the browser loads and writes build/timing.json for the score and the
// checks; also keeps the composition's length in index.html in step. Run through: python3 tools/film.py timing
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const win = {};
for (const f of ["assets/glyphs.js", "assets/poem.js", "assets/voice.js", "engine/timing.js", "film/timing.js"]) {
  new Function("window", readFileSync(f, "utf8"))(win);
}
const T = win.TIMING;
const out = {};
for (const [k, v] of Object.entries(T)) {
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") out[k] = v;
  else if (Array.isArray(v) && v.every((x) => typeof x === "number")) out[k] = v;
}
out.strokes = T.strokeSlots(win.GLYPHS).map((s) => ({ ch: s.ch, ci: s.ci, si: s.si, t0: +s.t0.toFixed(4), t1: +s.t1.toFixed(4) }));
mkdirSync("build", { recursive: true });
writeFileSync("build/timing.json", JSON.stringify(out, null, 1));
// The renderer makes ceil(duration × fps) frames, so the duration written into the page must never round UP past the
// last frame (72.16666… written as "72.1667" renders one frame too many): cut it off at four decimals instead.
const total = (Math.floor(T.total * 1e4 + 1e-6) / 1e4).toString();
const html = readFileSync("index.html", "utf8");
const next = html.replace(/data-duration="[^"]*"/g, `data-duration="${total}"`);
if (next !== html) writeFileSync("index.html", next);
const lines = (T.v || []).map((v, i) => `line ${i + 1} at ${(v + T.intro).toFixed(2)}`).join(", ");
console.log(`timing → build/timing.json · cover ${T.intro.toFixed(2)}s · film ${T.dur.toFixed(2)}s · total ${total}s · ${lines}${lines ? ", " : ""}last line at ${(T.write0 + T.intro).toFixed(2)}`);
