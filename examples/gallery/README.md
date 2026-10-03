# 画法库图鉴

不是片子，是把引擎自带的每样东西画在四张图上，方便开工前看一眼库里有什么。`references/kit-1.jpg` … `kit-4.jpg` 就是它渲出来的。

往库里加了新东西之后，在 `film/scenes.js` 里也加一格，然后重新出图：

```bash
python3 $SK/scripts/new_project.py /tmp/gallery --example gallery
cd /tmp/gallery
python3 tools/film.py voice --dry && python3 tools/film.py build
# 四张图分别在封面结束后 0.05、0.25、0.45、0.65 秒（空跑时封面是 1.2 秒）
npx hyperframes snapshot --no-end --describe false --at 1.25,1.45,1.65,1.85
# snapshots/ 里的四张 PNG 缩到 1600×900 存成 references/kit-1.jpg … kit-4.jpg
```
