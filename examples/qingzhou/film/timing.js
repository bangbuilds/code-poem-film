// 《早发白帝城》的时间表：这首诗的每个动作发生在什么时候（影片自己的时钟，t = 0 是红点落下前的白纸）。
// 朗诵、题签、末句书写、印章、总时长由 engine/timing.js 根据配音的实际长度推出来。
(function (root) {
  const T = {
    fps: 30,

    // A — a dot on paper
    drop: 0.35,
    land1: 0.85,
    land2: 1.44,
    land3: 1.82,
    eyes: 2.15,
    blink: 2.6,

    // B — 朝辞白帝彩云间
    bloom: 3.0,
    bow1: 4.7,
    bow2: 5.0,
    roll: 5.28,
    crouch: 5.68,
    leap: 5.86,

    // C — 千里江陵一日还
    boatLand: 7.05,
    sail: 7.5,
    pull: 8.2,
    launch: 8.6,

    // D — 两岸猿声啼不住 (the fast music runs on a 0.38 s beat from `launch`; these sit on it)
    beat: 0.38,
    notEvents: "beat", // a length, not a moment (the checks skip it)
    hoot1: 10.12,
    hoot2: 11.07,
    hoot3: 11.83,
    jump: 12.4,
    splash2: 13.16,
    gate: 13.54,
    cut: 13.92,

    // E — 轻舟已过万重山: the wide view, no words, a held breath before the last line
    open: 14.2,
    lookBack: 15.6,
    hop: 17.15,

    // F — the line, written as it is spoken
    write0: 17.9,
  };

  root.PoemTiming.finish(T, {
    lines: [
      { at: 3.3, lead: 0.15 }, // 朝辞白帝彩云间 — as the world soaks in
      { gapAt: T.launch, at: 7.2 }, // 千里江陵 | 一日还 — the boat is launched in the breath between (at: for a voice that takes no breath there)
      { after: 0.3, min: 10.3 }, // 两岸猿声啼不住 — under the gibbons
    ],
    capOut: [T.gate + 0.05, T.gate + 0.3], // the slip goes as the cliff sweeps across
    capEnd: T.cut,
  });

  root.TIMING = T;
})(typeof window !== "undefined" ? window : globalThis);
