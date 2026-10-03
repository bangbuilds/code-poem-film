# 画场景

先看 `kit-1.jpg` … `kit-4.jpg`（库里每样东西的样子），再读一条完整片子怎么用它们：短诗看 `examples/qingzhou/film/scenes.js`，长篇看 `examples/chibi/film/scenes.js`。

## 目录

- [舞台和你的分工](#舞台和你的分工)
- [坐标、镜头、视差](#坐标镜头视差)
- [四种常用的场面调度](#四种常用的场面调度)
- [画法库清单](#画法库清单)
- [画库里没有的东西](#画库里没有的东西)
- [配色](#配色)
- [规矩](#规矩)

## 舞台和你的分工

`film/scenes.js` 最后把片子交给舞台：

```js
QZ.stage.run({
  build() { … },              // 一次性画好的贴图（山、岸、建筑）
  scene(ctx, t) { … },        // 每一帧：t 是影片时钟。封面期间 t < 0，这时什么都不画（留白纸）
  front(ctx, t) { … },        // 可选：要盖在题签上面的东西（比如扫过镜头的山崖）
  cover(c, time) { … },       // 封面那张画。标题签、作者、印章、左下角的名句由舞台加
  titleFrom() { return { x, y, r }; },   // 红点离开场景去写字时的位置和半径（屏幕坐标）
  decorate(ctx, x, y, s) { … },          // 可选：红点写字时画在它身上的东西（它从场景里带走的：白发、斗笠……）
  debug: { … },               // 可选：挂到 FILM.debug 上，方便在浏览器里查数
});
```

舞台每帧的顺序：宣纸 → `scene` → 末句和印章（`t ≥ T.hop`）→ 题签 → `front` → 封面 → 纸纹。所以：

- `t ≥ T.hop` 之后红点由舞台接手（飞到第一笔、沿笔画写字、跳去变印章）。你的 `scene` 从 `T.hop` 起不要再画红点，并且把场景淡下去、往下沉，给大字让位（范例和起步片子都是：1 秒内淡到 0.2、下沉 150 像素）。
- 淡出的场景里别留会压到落款和片尾小字的东西。落款在 (1100–1590, 628–686)，印章在 (1616–1720, 577–727)，片尾小字在底部正中 y≈962–1000。上次淡出的小舟正好压在片尾小字上。
- 封面是成片第一帧，平台拿它当缩略图。`cover` 里画这首诗最有代表性的一个画面，红点要大（1.6 倍左右）、眼睛睁着、朝标题签方向看。右边 x > 1400 是标题签，左下角是名句，别把主体放在这两处。

## 坐标、镜头、视差

画布 1920×1080。常用做法是一个连续的世界加一个镜头：

```js
const cam = { x, y, z, shx, shy };        // 世界坐标里的镜头中心、缩放、抖动
ctx.save(); ST.view(ctx, cam);            // 套上缩放和抖动
const [sx, sy] = ST.toScreen(cam, wx, wy); // 主层上的世界点 → 屏幕
…
ctx.restore();
```

远处的层乘一个小于 1 的系数再减（远峰 0.08、群山 0.22、对岸 0.5、主层 1、前景 1.7）：

```js
SC.drawTile(ctx, tiles.far, cam.x * 0.08 + 300, 585, 1);   // 第三个参数是这一层滚动了多少
```

要把东西立在某一层的山脊上：

```js
// 这一层上的点 wx 在屏幕上是 sx = wx - cam.x * 0.5 + 960；贴图是按 cam.x * 0.5 + OFF 滚动画的，
// 所以它在贴图里的 x 是 wx - 960 + OFF（再对贴图宽度取模）。山顶的屏幕 y = 贴图底边 y - tile.hs[tx]
const tx = (((Math.round(wx) - 960 + OFF) % tw) + tw) % tw;
const topY = bottom - tile.hs[tx];
```

这个偏移一定要算对。算错的结果是东西悬在半空或埋在山里，而且只有看截图才看得出来。

岸上的大件东西（一座山崖、一座废垒）不必放进贴图：单独画一张 `QZ.canvas`，按「它被念到的那一刻该在屏幕哪」反推它在这一层的位置，每帧贴上去：

```js
const BP = 0.75;                                              // 这一层的视差
const lxAt = (sx, t) => sx - 960 + camera(t).x * BP;          // 想让它在 t 时刻出现在屏幕 sx 处 → 它在这一层的 x
const cliffLX = lxAt(550, T.v[5] + 1.3);
const bankSX = (lx, cam) => lx - cam.x * BP + 960;            // 每帧：这一层的 x → 屏幕 x
```

**水面上的东西按水线排前后**：水线（东西和水面相接的那条线）的屏幕 y 越大，离镜头越近，越后画。小舟的水线在 776、礁石的在 804，小舟却画在礁石之后，看上去就是船搁在石头上。

**镜头仰起、俯下**（`cam.up`）时，远的层也要跟着走，只是少走一些（远峰 0.4、群山 0.55–0.8、对岸 1）。远层几乎不动的话，山脚和岸之间会露出一条白纸。

镜头的位置、缩放都写成时间的函数（`QZ.kf(t, [[时刻, 值, 缓动], …])`）。镜头跟随主角时，让它落后一点再追上，比死死锁住好看。撞击、落水、盖章时加一个衰减的抖动：`QZ.decay(t, t0, 11, 46) * 10`。

## 四种常用的场面调度

**从红点脚下晕开**（世界第一次出现）：

```js
const p = QZ.prog(t, T.bloom, T.bloom + 1.3);
if (p > 0 && p < 1) ST.bloom(ctx, (c) => { c.save(); ST.view(c, cam); drawWorld(c, cam, t); c.restore(); }, dotX, dotY + 40, p);
else if (p >= 1) drawWorld(ctx, cam, t);
```

**整层淡出、下沉**（场景退到大字后面）：`ST.faded(ctx, (c) => drawWorld(c, cam, t), alpha, dy)`。

**物体转场**（两个机位之间硬切）：让一个大的前景物体（山崖、树干、云）快速扫过整个画面，在它完全盖住画面的那几帧切换场景。范例里的 `gateWipe` 就是。它要画在题签上面，所以放在 `front` 里。

**远景**（主角变小，交代全貌）：换一套画法，按屏幕坐标直接画（`SC.openWater` + 几层 `SC.fadingRidge` + `SC.ripples` + 小船）。几层山用不同速度滑走，就有了纵深。

**画中画**（「江山如画」）：把整帧先画进一张自己的 `QZ.canvas(W, H)`（先铺 `SC.paper`，再画世界），再缩小贴到屏幕上，外面套 `SC.scrollMount`。

**换时辰**：同一个世界从白天到黄昏到夜里，不必画三套：日头下沉（`SC.sun` 的 y）、整帧乘一层褐色（入暮）、天空换成 `SC.sky("night")` 加月亮和星、山水乘一层蓝（夜）。每一样都由一个 0→1 的量控制，见范例的 `drawRiver()`。白天到夜晚如果要「切」，用一层浓烟或浓雾盖住切换的那一刻。

**淡出的场景要收拾干净**：红点离开后场景会淡到大字后面，落在落款和片尾小字底下的东西（空船、石头）让它自己淡出：`c.globalAlpha *= 1 - prog(t, T.hop + 0.15, T.hop + 0.9)`。

`ST.bloom`、`ST.faded` 和封面共用一张临时画布，同一帧里可以先后用，不能嵌套。

## 画法库清单

`const SC = QZ.scenery, A = QZ.actors, ST = QZ.stage;`

**贴图（在 `build` 里画一次，返回 canvas，带 `.hs` 高度表）**

| 函数 | 画什么 | 关键参数 |
|---|---|---|
| `SC.ridgeTile({w,h,seed,freq,amp,floor,sharp,jitter,paint})` | 可无缝重复的山 | `sharp` 1.2 缓丘 … 2.0 尖峰；`floor` 谷底占 `amp` 的比例 |
| `SC.cliffTile({w,h,seed,freq,amp,floor,plate,paint})` | 峡谷绝壁：台地 + 柱状岩面，脚下赭石色，顶上小松 | `plate: [0.34, 0.6]` 台地的陡缓 |
| `SC.bankTile({w,h,seed,freq,amp})` | 镜头前的近岸：礁石和芦苇，横向轻微拖影 | `smear` 拖影步数（别超过 3，再多就糊成一团） |
| `SC.fadingRidge({w,h,seed,amp,scale,floor,sharp,taper,paint})` | 不重复、右端渐渐消失的山，远景里滑走用 | `taper` 从离右端多远开始矮下去 |
| `SC.groundTile({w,h,top,seed})` | 可以站的草岸，`tile.top` 是地面线在贴图里的 y | |

`paint`：`{ color, aTop, aBot, depth, seed, outline: {w, a}, tex: {kind: "slope"|"vertical", n, len, a}, moss }`。山体从山脊往下由 `aTop` 渐变到 `aBot`，`aBot` 小就是山脚有雾。远的层颜色浅、`aTop` 小、不加纹理；近的层深、加皴线和苔点。

**每帧画的**

| 函数 | 画什么 |
|---|---|
| `SC.drawTile(ctx, tile, 滚动量, 底边y, 透明度)` | 铺一层贴图 |
| `SC.reflect(ctx, tile, 滚动量, 水面y, 透明度)` | 这一层在水里的倒影 |
| `SC.sky(ctx, "dawn"|"dusk"|"night", a)` | 天色 |
| `SC.sun(ctx, x, y, r, a)`、`SC.moon(ctx, x, y, r, a, phase)`、`SC.stars(ctx, t, n, a, [x0,y0,x1,y1])` | 日、月（`phase` 1 满月，0.45 月牙）、星 |
| `SC.cloud(ctx, x, y, 大小, 颜色, a, 翻转)` | 祥云 |
| `SC.water(ctx, camX, 水面y, t, a, 速度, 色调)` | 从岸边看的江面，波纹随镜头滚动，速度大时拉长 |
| `SC.openWater(ctx, hz)`、`SC.glint(ctx, x, hz, t)`、`SC.ripples(ctx, hz, 漂移)` | 高处看的开阔水面、水上的日光/月光、水纹 |
| `SC.birds(ctx, x, y, t, n)`、`SC.rain(ctx, t, a, 密度, 风)`、`SC.snow(ctx, t, a, 密度)` | 飞鸟、雨、雪 |
| `SC.pine(ctx, x, y, s)`、`SC.willow(ctx, x, y, s, t)`、`SC.miniPine(ctx, x, y, s, a)` | 斜松、垂柳、远处的小松 |
| `SC.gateTower(ctx, gx)`、`SC.pagoda(ctx, cx, 层数, 底宽)`、`SC.hall` / `SC.roof` / `SC.roofPath` | 城门楼、多层楼阁、单层殿身和屋顶（地面在 y = 0，先 `translate` 到位） |
| `SC.pennant(ctx, x, y, t, 相位, a)` | 小旗 |
| `SC.mist(ctx, y, 厚度, a, 漂移, seed, 颜色)` | 一带雾。颜色给深色就是烟 |
| `SC.swells(ctx, camX, 水面y, t, a, 漂移)` | 大江上的长浪：几排带浪花的浪脊，叠在 `SC.water` 上面 |
| `SC.spire(ctx, x, y, 宽, 高, seed, 颜色, 倾斜)` | 石峰（乱石穿空）。要「拔起来」就先画进小画布，每帧按高度缩放贴图 |
| `SC.ruin(ctx, x, y, s)` | 残垒：断墙、塌了的门洞、枯树、荒草 |
| `SC.scrollMount(ctx, x, y, w, h, a)` | 手卷的装裱：绫边和两根轴，画心留给你 |

**角色和效果**

| 函数 | 画什么 |
|---|---|
| `A.dot(ctx, x, y, {r, sx, sy, rot, eye, open, lx, ly, mood})` | 红点。见 `acting.md` |
| `A.mover(t, s, r)` → `hop` / `squash` / `dropIn` | 红点在地面上的运动 |
| `A.shadow(ctx, x, y, w, a)`、`A.ticks(ctx, x, y, p, n, r0, len, seed)` | 脚下的影子；落地、盖章时炸开的短墨线 |
| `A.boat(ctx, x, y, {scale, rot, sx, sy, sail, billow, speed, t, dot})`、`A.wake`、`A.crest` | 小舟（`dot` 回调把红点画在舱里，座位在 (−46, −40)）、船尾浪、浪头 |
| `A.gibbon(ctx, x, y, {scale, flip, swing, wave, hoot, t})`、`A.hootRings`、`A.branch` | 挂在树上的猿、叫声的声波、树枝 |
| `A.splash(ctx, x, y, p, n, 力度, seed)` | 溅起的水花和水面的圈 |
| `A.skiff(ctx, x, y, {scale, rot, sx, sy, dot})` | 乌篷小舟（`dot` 回调里把红点画在船头，座位在 (52, −42)） |
| `A.bigWave(ctx, x, y, {s, a, t, squash, inside})` | 一道卷起的巨浪（约 840×320）。`inside(ctx)` 里画的东西会被裁在浪的形状里；`squash` 0→1 让它立起来或塌下去 |
| `A.foamHeap(ctx, x, y, r, seed, a, 旋转)` | 一团浪花（千堆雪）。几十团按抛物线抛出去、再慢慢落下 |
| `A.figure(ctx, x, y, {s, flip, hat, prop, arm, flick, cape, wind, robe, face, eyes, a, melt, t})` | 人物剪影，脚在 (x, y)。`hat`: jin 纶巾 / guan 冠 / helm 盔 / tall 高帽；`prop`: fan 羽扇 / spear / sword / staff / banner；`arm` 0→1 抬手；`wind` 决定披风和飘带往哪边飘 |
| `A.lady(ctx, x, y, {s, flip, robe, sash, wind, a, t})` | 仕女：高髻、长裙、飘带 |
| `A.warship(ctx, x, y, {s, flip, a, t, wind, char, list, oars})` | 楼船，侧面。`char` 0→1 烧黑，`list` 倾侧 |
| `A.flame(ctx, x, y, 宽, 高, t, seed, a, 倾斜)`、`A.smoke(ctx, x, y, 宽, 高, t, seed, a, 漂移)` | 火（藤黄到琥珀，不用朱红）和烟柱 |
| `A.cup(ctx, x, y, s, 倾角, 有酒)` | 酒杯（尊） |
| `A.seal`、`A.slip` | 印章、题签（舞台已经在用，一般不用自己调） |

**画笔**（`QZ`）：`inkLine(ctx, 点, {w, color, alpha, taper, p})` 毛笔线，`p` 是画出的比例（0→1 就是一笔画出来）；`wash(ctx, x, y, rx, ry, 颜色, a)` 一团淡彩；`blob(ctx, cx, cy, rx, ry, seed, 抖动)` 手抖的圆；`drawText(ctx, 字, x, y, 字号, 间距, 颜色, p, 竖排)` 逐笔写字；`kf` / `prog` / `ease.*` / `bumpAt` / `decay` / `hash` / `rng` / `fbm`。

## 画库里没有的东西

多数东西是「一个轮廓 + 一圈墨线 + 几笔细节」：

```js
function lantern(ctx, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 2) * 3 * s);       // 轻轻晃
  QZ.blob(ctx, 0, 0, 26 * s, 34 * s, 9, 0.05);          // 灯身
  ctx.fillStyle = QZ.rgba(QZ.C.gold);                   // 不是红色：全片只有红点是红的
  ctx.fill();
  QZ.inkLine(ctx, [[-26 * s, 0], [0, 4 * s], [26 * s, 0]], { w: 3 * s, alpha: 0.5 });
  QZ.inkLine(ctx, [[0, -34 * s], [0, -70 * s]], { w: 3 * s, taper: "none", seg: 0 });
  ctx.restore();
}
```

- 大而不动的东西（一整面山崖、一座城）在 `build` 里画进一张 `QZ.canvas(w, h)`，每帧只贴图；范例的白帝城山崖就是。小而会动的直接每帧画。
- 会重复出现的随机细节用 `QZ.rng(seed)`，逐帧变化的用 `QZ.hash(整数)`，都是确定的。
- 新东西画完，单独抓一帧放大看（`npx hyperframes snapshot --at <时刻>`）。画法库就是这样一样一样看出来的。
- 人物用 `A.figure` / `A.lady`：没有脸的剪影，能站、抬手、挥一下手里的东西、披风飘动。主角仍然是红点（它是诗里的「我」），人物是它看见的、想起的。要人物做细致表演的诗，先和用户商量。
- 画岩石别用长竖线：一排从上到下的细线看上去是木纹。用几块明暗不同的色块、断断续续的横向岩层、几道折线裂缝（`SC.spire` 和范例 `buildCliff()` 的画法）。

## 配色

`QZ.C` 里：`paper` `paperHi`（纸）、`ink` `inkMid` `inkPale`（墨）、`cyan` 石青、`green` 石绿、`pine` 松绿、`slate` 黛蓝、`ochre` 赭石、`gold` 藤黄、`blush` 胭脂、`peach`、`lilac`、`wood`、`red` `redHi` `redLo`（朱红，只给红点和印章）。

远山用 `slate`，中景往 `pine` 靠，近处加 `ink`。暖色只用在天上和点缀上。整帧最后会乘一层纸纹，所以颜色会比你设的暗一点、灰一点，属于正常。

## 规矩

- 每帧只由 `t` 决定。不用 `Date`、`performance.now`、`Math.random`、不存「上一帧的状态」。
- 全片只有红点（和它变成的印章）是正红色。
- 一帧里的绘制量控制在几百次调用以内。大面积细节放进贴图。范例整片每帧约 0.5 毫秒。
- 贴图总量别太大（每张 4096×760 约 12 MB 显存）；范例用了十张左右。
- 题签在右上角 (1746–1842, 84–712)，别把这一句的主体放在它后面。
