# poem.json 和时间表

## poem.json：片子里所有的字

```json
{
  "slug": "qingzhou",
  "prefix": "",
  "title": "早发白帝城",
  "author": "李白",
  "lines": ["朝辞白帝彩云间", "千里江陵一日还", "两岸猿声啼不住", "轻舟已过万重山"],
  "punct": ["，", "。", "，", "。"],
  "seal": "太白",
  "tagline": "轻舟已过万重山",
  "mood": "dawn",
  "credit": ["全片代码绘制", "配乐代码合成"],
  "creditVoice": "朗诵语音合成",
  "say": { "朝": "昭", "还": "环", "重": "崇" },
  "voice": { "provider": "auto", "id": "", "speed": 0.85 },
  "onsets": { "<音色 id>": [0.0, 0.46, 1.01, 1.17, 1.67, 2.02, 2.5] },
  "glyphs": ""
}
```

| 字段 | 含义 |
|---|---|
| `title` / `author` | 标题和作者。封面题签、片尾落款、朗诵开头都用它 |
| `prefix` | 词牌名（`"prefix": "念奴娇", "title": "赤壁怀古"`）。封面上写在作者上方，落款写成「苏轼 · 念奴娇 · 赤壁怀古」，朗诵读作「念奴娇，赤壁怀古。」。诗不用写 |
| `lines` | 诗句，不带标点。**最后一句**是片尾大字写出来的那句；前面每句写在右上角的题签上 |
| `punct` | 每句后面的标点，只给朗诵用。不写就是「，。，。」交替 |
| `seal` | 印文，1–4 个字（2 个字最好看；4 个字排成 2×2，右列先读）。通常用作者的字或号 |
| `tagline` | 封面左下角那行大字。不写就用最后一句；写 `""` 就不要 |
| `mood` | 只有起步片子用：`dawn` / `dusk` / `night` |
| `credit` | 片尾小字，几项之间自动加点 |
| `creditVoice` | 有真配音时才追加的一项。空跑的片子里不出现，免得写了「朗诵」却没有声音 |
| `say` | 多音字 → 同音字，只影响送去合成的文字。见 `audio.md` |
| `sayLines` | 整句替换合成文字（和 `lines` 等长的数组，不替换的位置写 `null`）。同一个字在诗里出现两次、读音不同的时候用 |
| `voice` | `provider`（`auto` / `say` / `edge` / `command` / 你的插件名）、`id`（音色）、`speed`（朗诵用 0.8–0.9）；可选：`split`（`whole` 整首一次合成 / `sentence` 逐句合成；不写时超过 8 句自动逐句）、`tempo`（把某几句在本地放慢，如 `{"*": 0.92, "l4": 0.82}`）、`lift`（某几句人声提一点）。见 `audio.md` |
| `onsets` | 末句每个字开始的时刻（从这一句开头算，秒），按音色 id 存。没有就平均分 |
| `glyphs` | 场景里另外要写的字（比如匾额）。引擎只带这首诗用到的字的笔画数据 |

改了 `poem.json` 之后跑 `python3 tools/film.py build`。改了诗句或多音字会改变合成文字，真配音要重新合成一次（要花钱）。

字的笔画来自开源数据集 hanzi-writer-data。个别生僻字没有数据，`film.py glyphs` 会报出来；换字，或者那个字自己画。

## film/timing.js：什么时候发生什么

时间表写的是**影片自己的时钟**：`t = 0` 是红点落下之前的白纸。封面停在片子前面 `T.intro` 秒，所以成片里的时刻 = `T.intro + t`。场景代码里永远用影片时钟，不用管封面。

```js
(function (root) {
  const T = {
    fps: 30,
    drop: 0.35, land1: 0.85, land2: 1.44, land3: 1.82,   // 红点落下、弹两下（A.mover 的 dropIn 用这四个）
    eyes: 2.15, blink: 2.6,
    bloom: 3.0,                                          // 世界从红点脚下晕开
    launch: 8.6,                                         // 这首诗自己的事件，随便起名
    hop: 17.15,                                          // 红点离开场景去写字
    write0: 17.9,                                        // 末句第一笔
    beat: 0.38, notEvents: "beat",                       // 不是时刻的数（节拍长度）列在 notEvents 里
  };
  root.PoemTiming.finish(T, { lines: [ … ], capOut: [ … ], capEnd: … });
  root.TIMING = T;
})(typeof window !== "undefined" ? window : globalThis);
```

必须有：`land1`（作者名念完正好落地）。`hop` 和 `write0` 不写的话，红点在最后一句题签念完 `hopAfter` 秒后离开。

### 每句的摆法（`rules.lines`，除最后一句外每句一条）

| 写法 | 意思 |
|---|---|
| `{ at: 3.3 }` | 这一刻开始念 |
| `{ gapAt: T.launch }` | 把句中的换气（七言在第 4 字后，五言在第 2 字后）对在这一刻。用来让一个事件落在朗诵的停顿里 |
| `{ after: 0.3, min: 10.3 }` | 上一句念完 0.3 秒后开始，但不早于 10.3 |
| `lead: 0.15` | 题签比声音早多少秒出现（默认 0.12） |
| `split: 4` | `gapAt` 时停顿前有几个字（默认七言 4、五言 2） |

`gapAt` 需要配音里真的有那个停顿；没有（读得太快、一口气读完）就退回 `at` / `after` 的摆法，`film.py voice` 打印的 `pauses inside` 能看到每句内部停在哪。

### 句子多的时候：先定停顿，再挂动作

词、律诗有十几二十句，一句句写 `at` 既累又脆（换个音色全要重算）。反过来排：

```js
const V = root.VOICE;
const gaps = [0, 0.6, 0.6, 3.2, 0.55, …];          // 每句开口前停多久；0.5 左右是句读，2–3 秒是留给画面的一拍
root.PoemTiming.finish(T, {
  lines: gaps.map((g, i) => (i === 0 ? { at: T.bloom + 0.5 } : { after: g })),
  hopAfter: 3.0,                                    // 最后一句题签念完，到红点提笔，中间留给收尾的动作
});
const S = T.v, E = T.vEnd, d = (i) => V.lines[i].d; // 开口、念完、这一句多长
Object.assign(T, {
  boatLand: E[2] + 1.35,                            // 第 3 句念完 1.35 秒，红点上船
  carve1: S[5] + d(5) * 0.6,                        // 第 6 句念到六成（「赤」字）时，凿第一个字
  slam: S[7] + d(7) * 0.62,                         // 「惊涛拍岸」的「拍」
});
```

画面里所有时刻都挂在 `S` / `E` / `d` 上，配音一换，整条片子自动重排。完整例子见 `examples/chibi/film/timing.js`。字在句中的位置先按「第几个字 ÷ 字数」估，要更准就看这一句的频谱图（`voice --spec` 每句都会画）。

### 其他规则

| 字段 | 意思 |
|---|---|
| `intro` | 封面最少停多久（默认有配音 2.1 秒；空跑 1.2 秒）。配音的标题比较长时会自动加长 |
| `capOut: [a, b]` | 题签在这段时间里淡出（默认在 `hop` 前 0.5 秒） |
| `capEnd` | 这之后题签不再画 |
| `hopAfter` | 没写 `T.hop` 时，最后一句题签念完到红点离开的间隔 |

### finish 之后时间表里多出来的东西

| 名字 | 含义 |
|---|---|
| `T.intro` / `T.dur` / `T.total` | 封面时长、正片时长、成片总时长（已对齐到整帧） |
| `T.vTitle` / `T.vAuthor` | 标题、作者开始念的时刻（负数：在封面期间） |
| `T.v[i]` / `T.vEnd[i]` | 第 i 句开始念、念完的时刻（i 从 0 起，不含最后一句）；`T.cap[i]` 题签出现；`T.capWrite[i]` 题签写字的时间段 |
| `T.charOn[k]` | 末句第 k 个字开始念的时刻 |
| `T.write1`、`T.sealJump`、`T.stamp`、`T.sign0`、`T.credit` | 末句念完、红点跳向印章、盖章、落款、片尾小字 |
| `T.hasVoice` | 有真配音（不是空跑） |

`python3 tools/film.py timing` 会把这些打印出来，并写进 `build/timing.json`（`film/score.py` 和检查脚本读它）。场景里要用到的自定义数组（比如每一步落地的时刻）也可以挂在 `T` 上，只要是数字数组就会被导出。

## 生成的文件（不要手改）

`assets/poem.js`、`assets/voice.js`、`assets/glyphs.js`、`assets/score.wav`、`build/*`、`index.html` 里的时长。
