// When things happen in this film, on the film's own clock (t = 0 is the blank sheet before the dot falls).
// List your scene events here; engine/timing.js then works out the recitation, the captions, the last line
// and the total length from how long the voice actually takes.
//
// This starter is a walk along a scroll: the dot arrives, the landscape soaks in, it hops to the right past one
// prop per line, then leaps up and writes the last line. Replace the walk with scenes of your own (see the
// example in the skill's examples/qingzhou/film/timing.js for a film with real events).
(function (root) {
  const T = {
    fps: 30,

    // the dot arrives: falls, bounces twice, opens its eyes
    drop: 0.35,
    land1: 0.85,
    land2: 1.44,
    land3: 1.82,
    eyes: 2.15,
    blink: 2.6,

    // the world soaks in around it, and it sets off
    bloom: 3.0,
    walk0: 4.1,
    step: 0.44, // seconds per hop
    notEvents: "step", // names in this table that are lengths, not moments (the checks skip them)
  };

  root.PoemTiming.finish(T, {
    // one rule per captioned line (every line but the last). See engine/timing.js for the rule kinds.
    lines: root.POEM.lines.slice(0, -1).map((_, i) => (i === 0 ? { at: T.bloom + 1.15 } : { after: 0.7 })), // the first waits for the upward run to finish
    hopAfter: 0.9, // the dot leaves to write this long after the last captioned line
  });

  // the landings of the walk — the picture and the score both use them
  T.steps = [];
  for (let t = T.walk0; t + T.step < T.hop - 0.35; t += T.step) T.steps.push(+(t + T.step * 0.7).toFixed(3));

  root.TIMING = T;
})(typeof window !== "undefined" ? window : globalThis);
